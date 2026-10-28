import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import zlib from "node:zlib";
import ipaddr from "ipaddr.js";
import { IngestError } from "@/lib/ingest/errors";
import { USER_AGENT } from "./user-agent";

/**
 * SSRF guard for every URL a person types in (portfolio, careers page, add
 * company). Only http(s) on standard ports, no credentials in the URL, and
 * every resolved address must be public unicast. The address check runs
 * inside the socket's own DNS lookup, so a hostname cannot pass the check and
 * then connect somewhere else (DNS rebinding).
 */

const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  let ip = ipaddr.parse(address);
  if (ip.kind() === "ipv6" && (ip as ipaddr.IPv6).isIPv4MappedAddress()) ip = (ip as ipaddr.IPv6).toIPv4Address();
  return ip.range() === "unicast";
}

/** Throws IngestError("blocked_url") unless the URL is safe to fetch on the server. */
export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new IngestError("blocked_url", "That does not look like a web address. Include https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new IngestError("blocked_url", "Only http and https addresses can be fetched.");
  }
  if (url.username || url.password) throw new IngestError("blocked_url", "Remove the username and password from the address.");
  if (!ALLOWED_PORTS.has(url.port)) throw new IngestError("blocked_url", "Only standard web ports can be fetched.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host) && !isPublicAddress(host)) {
    throw new IngestError("blocked_url", "Private and local network addresses cannot be fetched.");
  }
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) {
    throw new IngestError("blocked_url", "Private and local network addresses cannot be fetched.");
  }
  return url;
}

/** A DNS lookup that refuses to hand back non-public addresses. */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => !isPublicAddress(a.address));
    if (bad || list.length === 0) {
      const e = new IngestError("blocked_url", "That address points to a private network and cannot be fetched.");
      return callback(e as unknown as NodeJS.ErrnoException, "", 4);
    }
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

export type SafeFetchResult = { url: string; status: number; contentType: string; body: string };

type Options = { maxBytes?: number; timeoutMs?: number; maxRedirects?: number; accept?: string };

function requestOnce(url: URL, opts: Required<Options>): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        headers: { "user-agent": USER_AGENT, accept: opts.accept, "accept-encoding": "gzip, deflate, br" },
        timeout: opts.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        const encoding = String(res.headers["content-encoding"] ?? "");
        const stream =
          encoding === "gzip"
            ? res.pipe(zlib.createGunzip())
            : encoding === "deflate"
              ? res.pipe(zlib.createInflate())
              : encoding === "br"
                ? res.pipe(zlib.createBrotliDecompress())
                : res;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > opts.maxBytes) {
            req.destroy();
            reject(new IngestError("fetch_failed", "That page is larger than 2 MB, so it was not read."));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new IngestError("fetch_failed", "That site took longer than 10 seconds to answer.")));
    req.on("error", reject);
    req.end();
  });
}

/** GET a user-supplied URL with the SSRF guard, a size cap, a timeout and at most 3 redirects. */
export async function safeFetch(raw: string, options: Options = {}): Promise<SafeFetchResult> {
  const opts: Required<Options> = {
    maxBytes: options.maxBytes ?? 2 * 1024 * 1024,
    timeoutMs: options.timeoutMs ?? 10_000,
    maxRedirects: options.maxRedirects ?? 3,
    accept: options.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
  };
  let url = assertFetchableUrl(raw);
  for (let hop = 0; hop <= opts.maxRedirects; hop++) {
    let res;
    try {
      res = await requestOnce(url, opts);
    } catch (e) {
      if (e instanceof IngestError) throw e;
      throw new IngestError("fetch_failed", "That site could not be reached. Check the address and try again.");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      url = assertFetchableUrl(new URL(res.headers.location, url).toString());
      continue;
    }
    if (res.status === 404) throw new IngestError("not_found", "That page was not found (404).");
    if (res.status >= 400) throw new IngestError("fetch_failed", `That site answered with an error (${res.status}).`);
    return {
      url: url.toString(),
      status: res.status,
      contentType: String(res.headers["content-type"] ?? ""),
      body: res.body.toString("utf8"),
    };
  }
  throw new IngestError("fetch_failed", "That address redirects too many times.");
}
