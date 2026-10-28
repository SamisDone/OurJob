import { createPoliteClient, PoliteHttpError, type PoliteClient } from "@/lib/http/polite";
import { IngestError } from "./errors";

/**
 * Public GitHub data for P1: profile, owned non-fork repos (most recently
 * pushed first, top 20), languages per repo, and README text (first 4,000
 * characters) for 8 repos picked by stars and recent activity.
 * Coded against real responses saved in tests/fixtures/sources/github/
 * (API version 2026-03-10). Pinned repos need the GraphQL API and a token,
 * so they are not used.
 */

export const GITHUB_API = "https://api.github.com";
export const GITHUB_API_VERSION = "2026-03-10";
const MAX_REPOS = 20;
const MAX_READMES = 8;
const README_CHARS = 4000;

type ApiUser = {
  login: string;
  name: string | null;
  bio: string | null;
  blog: string | null;
  location: string | null;
  company: string | null;
  html_url: string;
  public_repos: number;
};

type ApiRepo = {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  fork: boolean;
  archived: boolean;
  language: string | null;
  stargazers_count: number;
  pushed_at: string | null;
  topics?: string[];
};

export type GitHubRepo = {
  name: string;
  description: string | null;
  url: string;
  homepage: string | null;
  primaryLanguage: string | null;
  /** Languages by bytes of code, largest first. */
  languages: string[];
  stars: number;
  pushedAt: string | null;
  topics: string[];
  archived: boolean;
  readme: string | null;
};

export type GitHubImport = {
  user: {
    login: string;
    name: string | null;
    bio: string | null;
    blog: string | null;
    location: string | null;
    company: string | null;
    url: string;
  };
  repos: GitHubRepo[];
  /** For "12 public repos, 6 with READMEs". */
  counts: { publicRepos: number; ownRepos: number; withReadme: number };
};

const USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** Accepts "name", "@name" or a github.com profile URL. Returns null when it is not a valid username. */
export function parseGitHubUsername(input: string): string | null {
  let s = input.trim().replace(/^@/, "");
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)/i.exec(s);
  if (m) s = m[1];
  return USERNAME.test(s) ? s : null;
}

/** 4 by stars, then the most recently pushed, up to 8. */
export function pickReadmeRepos(repos: GitHubRepo[]): Set<string> {
  const picked = new Set<string>();
  for (const r of [...repos].sort((a, b) => b.stars - a.stars).slice(0, 4)) picked.add(r.name);
  for (const r of repos) {
    if (picked.size >= MAX_READMES) break;
    picked.add(r.name);
  }
  return picked;
}

export async function importGitHub(
  input: string,
  opts: { client?: PoliteClient; token?: string } = {},
): Promise<GitHubImport> {
  const login = parseGitHubUsername(input);
  if (!login) throw new IngestError("not_found", "That is not a GitHub username. Use the name from github.com/your-name.");
  const client = opts.client ?? createPoliteClient();
  const token = opts.token ?? process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": GITHUB_API_VERSION,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };

  const call = async <T>(path: string, extra: Record<string, string> = {}): Promise<T> => {
    try {
      const res = await client.get(`${GITHUB_API}${path}`, { ...headers, ...extra });
      return (extra.accept?.includes("raw") ? res.text : JSON.parse(res.text)) as T;
    } catch (e) {
      if (e instanceof PoliteHttpError && (e.status === 403 || e.status === 429)) {
        throw new IngestError(
          "fetch_failed",
          "GitHub's rate limit for anonymous requests was reached. Try again in an hour, or add a GITHUB_TOKEN.",
        );
      }
      throw e;
    }
  };

  let user: ApiUser;
  try {
    user = await call<ApiUser>(`/users/${encodeURIComponent(login)}`);
  } catch (e) {
    if (e instanceof PoliteHttpError && e.status === 404) {
      throw new IngestError("not_found", `No GitHub account is named ${login}.`);
    }
    throw e;
  }

  const apiRepos = await call<ApiRepo[]>(`/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed&per_page=100`);
  const own = apiRepos
    .filter((r) => !r.fork)
    .sort((a, b) => (b.pushed_at ?? "").localeCompare(a.pushed_at ?? ""))
    .slice(0, MAX_REPOS);

  const repos: GitHubRepo[] = [];
  for (const r of own) {
    const langs = await call<Record<string, number>>(`/repos/${encodeURIComponent(login)}/${encodeURIComponent(r.name)}/languages`);
    repos.push({
      name: r.name,
      description: r.description,
      url: r.html_url,
      homepage: r.homepage || null,
      primaryLanguage: r.language,
      languages: Object.entries(langs)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name),
      stars: r.stargazers_count,
      pushedAt: r.pushed_at,
      topics: r.topics ?? [],
      archived: r.archived,
      readme: null,
    });
  }

  const wanted = pickReadmeRepos(repos);
  for (const repo of repos) {
    if (!wanted.has(repo.name)) continue;
    try {
      const text = await call<string>(
        `/repos/${encodeURIComponent(login)}/${encodeURIComponent(repo.name)}/readme`,
        { accept: "application/vnd.github.raw+json" },
      );
      repo.readme = text.slice(0, README_CHARS);
    } catch (e) {
      if (!(e instanceof PoliteHttpError && e.status === 404)) throw e;
    }
  }

  return {
    user: {
      login: user.login,
      name: user.name,
      bio: user.bio,
      blog: user.blog || null,
      location: user.location,
      company: user.company,
      url: user.html_url,
    },
    repos,
    counts: {
      publicRepos: user.public_repos,
      ownRepos: repos.length,
      withReadme: repos.filter((r) => r.readme && r.readme.trim().length > 0).length,
    },
  };
}

/** Plain text for P1's <source kind="github">. P1 makes projects only from repos with a description or README. */
export function githubToSourceText(g: GitHubImport): string {
  const lines = [
    `GitHub user: ${g.user.login}${g.user.name ? ` (${g.user.name})` : ""}`,
    `Profile: ${g.user.url}`,
    g.user.bio && `Bio: ${g.user.bio}`,
    g.user.blog && `Website: ${g.user.blog}`,
    g.user.location && `Location: ${g.user.location}`,
    "",
  ].filter((l): l is string => l !== null && l !== undefined);
  for (const r of g.repos) {
    lines.push(`## Repository: ${r.name}`, `URL: ${r.url}`);
    if (r.homepage) lines.push(`Live: ${r.homepage}`);
    if (r.description) lines.push(`Description: ${r.description}`);
    if (r.languages.length) lines.push(`Languages: ${r.languages.join(", ")}`);
    if (r.topics.length) lines.push(`Topics: ${r.topics.join(", ")}`);
    if (r.pushedAt) lines.push(`Last pushed: ${r.pushedAt.slice(0, 10)}`);
    if (r.archived) lines.push("Archived: yes");
    if (r.readme) lines.push("README:", r.readme.trim());
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}
