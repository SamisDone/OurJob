import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanJobText } from "@/lib/jd/clean";
import { addStatedTerms, importanceAt } from "@/lib/jd/terms";
import type { JobSpec } from "@/lib/profile/schema";

const post = cleanJobText(readFileSync("tests/fixtures/jds/11-fullstack-llm.txt", "utf8"));

// What a model run might return: it left out the auth, access-control and LLM terms, and called React "nice".
const spec: JobSpec = {
  title: "Full-Stack Engineer",
  responsibilities: [],
  keywords: [
    {
      term: "React",
      canonical: "React",
      synonyms: [],
      importance: "nice",
      kind: "hard_skill",
      evidenceQuote: "3+ years building web apps with TypeScript and React.",
    },
  ],
};

describe("addStatedTerms", () => {
  const out = addStatedTerms(spec, post);
  const by = (term: RegExp) => out.keywords.find((k) => term.test(k.term) || term.test(k.canonical));

  it("adds the terms the post states that the model left out", () => {
    expect(by(/^authentication$|^auth$/i)).toBeDefined();
    expect(by(/role-based access control/i)).toBeDefined();
    expect(by(/LLM APIs/i)).toBeDefined();
    expect(by(/REST APIs/i)).toBeDefined();
    expect(by(/PostgreSQL/)).toBeDefined();
    for (const k of out.keywords) expect(post).toContain(k.evidenceQuote);
  });

  it("sets must or nice from where the term sits, not from the model", () => {
    expect(by(/^React$/)?.importance).toBe("must");
    expect(by(/role-based access control/i)?.importance).toBe("must");
    expect(by(/^Docker$/)?.importance).toBe("nice");
    expect(by(/^GraphQL$/)?.importance).toBe("nice");
  });

  it("gives the same answer every time", () => {
    expect(addStatedTerms(spec, post)).toEqual(out);
  });

  it("does not add a term twice when the model already listed a synonym", () => {
    const withPg = addStatedTerms(
      {
        ...spec,
        keywords: [
          ...spec.keywords,
          {
            term: "Postgres",
            canonical: "PostgreSQL",
            synonyms: [],
            importance: "must",
            kind: "hard_skill",
            evidenceQuote: "Comfort with REST APIs and PostgreSQL.",
          },
        ],
      },
      post,
    );
    expect(withPg.keywords.filter((k) => /postgre/i.test(k.canonical))).toHaveLength(1);
  });
});

describe("importanceAt", () => {
  it("reads a Nice to have line and the section a line sits in", () => {
    const text = "Requirements\n- Go and Kafka\n\nNice to have\n- Terraform\n\nAlso nice to have: Rust.";
    expect(importanceAt(text, text.indexOf("Kafka"))).toBe("must");
    expect(importanceAt(text, text.indexOf("Terraform"))).toBe("nice");
    expect(importanceAt(text, text.indexOf("Rust"))).toBe("nice");
  });
});
