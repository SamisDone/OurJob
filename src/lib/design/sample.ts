/**
 * Fictional sample content for the /design style tile and UI tests.
 * Every person, company and job here is invented. Never put real data here.
 */
import { boldSegments, type CvDocument } from "@/lib/cv/document";

const b = boldSegments;

export const sampleCv: CvDocument = {
  name: "Arif Rahman",
  contact: [
    { text: "Dhaka, Bangladesh" },
    { text: "arif.rahman@example.com", url: "mailto:arif.rahman@example.com" },
    { text: "Github", url: "https://github.com/example-arif" },
    { text: "LinkedIn", url: "https://www.linkedin.com/in/example-arif" },
    { text: "Portfolio", url: "https://example.com" },
  ],
  sections: [
    {
      kind: "summary",
      title: "Summary",
      segments: b(
        "Full-Stack Engineer with 4+ years of experience building TypeScript products, REST APIs, and data-heavy dashboards, owning features from database design to production.",
        [],
      ),
    },
    {
      kind: "skills",
      title: "Technical Skills",
      lines: [
        [
          { group: "Languages", items: ["TypeScript", "JavaScript", "Python", "SQL"] },
          { group: "Frameworks", items: ["Node.js", "Express.js", "React.js", "Next.js"] },
        ],
        [
          { group: "Databases", items: ["PostgreSQL", "Redis", "Prisma"] },
          { group: "Testing & Tools", items: ["Git", "Vitest", "Playwright"] },
        ],
        [{ group: "DevOps/Infra", items: ["Docker", "GitHub Actions", "Vercel", "AWS (basic)"] }],
      ],
    },
    {
      kind: "entries",
      title: "Professional Experience",
      entries: [
        {
          kind: "role",
          id: "exp_1",
          org: "Brightfield Software",
          orgUrl: "https://example.com/brightfield",
          title: "Full-Stack Engineer",
          right: "Mar 2024 – Present",
          bullets: [
            {
              sourceIds: ["b_1_1", "b_1_3"],
              segments: b(
                "Built the real-time shipment dashboard used by 40 client teams, moving live order updates from REST polling to WebSockets; cut the main bundle size by 35% through route splitting.",
                ["real-time shipment dashboard", "40 client teams", "35%"],
              ),
            },
          ],
          tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "Redis", "WebSockets", "Docker"],
        },
        {
          kind: "role",
          id: "exp_2",
          org: "Kite & Co. Digital",
          title: "Web Developer",
          right: "Jan 2022 – Feb 2024",
          bullets: [
            {
              sourceIds: ["b_2_1", "b_2_2"],
              segments: b(
                "Delivered 12 booking and marketing sites for local businesses with a headless CMS, and wrote Playwright tests for checkout flows that caught 9 regressions before release.",
                ["12 booking and marketing sites", "9 regressions"],
              ),
            },
          ],
          tech: ["Next.js", "TypeScript", "Tailwind CSS", "Playwright", "Vercel"],
        },
      ],
    },
    {
      kind: "entries",
      title: "Projects",
      entries: [
        {
          kind: "project",
          id: "proj_1",
          name: "Ledgerly",
          links: [
            { label: "Live", url: "https://example.com/ledgerly" },
            { label: "Source", url: "https://github.com/example-arif/ledgerly" },
          ],
          bullets: [
            {
              sourceIds: ["b_p1_1"],
              segments: b(
                "Shared household budgeting app with role-based access for 4 user types and offline support through a service worker and background sync.",
                ["role-based access", "offline support"],
              ),
            },
          ],
          tech: ["Next.js", "TypeScript", "PostgreSQL", "Prisma", "Vitest"],
        },
        {
          kind: "project",
          id: "proj_2",
          name: "Queue Lite",
          links: [{ label: "Source", url: "https://github.com/example-arif/queue-lite" }],
          bullets: [
            {
              sourceIds: ["b_p2_1"],
              segments: b(
                "Built a background job queue with separate API and worker services, retries with exponential backoff, and integration tests against a real PostgreSQL database.",
                ["background job queue", "exponential backoff"],
              ),
            },
          ],
          tech: ["Node.js", "TypeScript", "PostgreSQL", "Docker"],
        },
      ],
    },
    {
      kind: "entries",
      title: "Education",
      entries: [
        {
          kind: "role",
          id: "edu_1",
          org: "Example University of Science and Technology",
          title: "B.Sc. in Computer Science and Engineering",
          right: "Chattogram, Bangladesh",
          bullets: [],
        },
      ],
    },
  ],
};

export const sampleJd = {
  title: "Senior Frontend Engineer",
  company: "Lumen Labs",
  text: `Lumen Labs builds scheduling software for community clinics in 14 countries. Nurses, front-desk staff and patients use it every day to book, move and confirm appointments, often on old Android phones and slow connections. We are a team of 31, fully remote across eight time zones, and we are hiring a Senior Frontend Engineer to own the patient booking flow end to end.

In your first months you will rebuild the booking flow that patients see when a clinic shares a link by text message. Today it is a single page that loads every clinic's full calendar before showing anything, which makes the first screen slow on mid-range phones and confusing for people who only want the next free slot. You will work with our product designer and one backend engineer to split it into smaller steps, load availability as the patient moves through them, and keep the whole thing usable with a screen reader. You will build product features in React and TypeScript, work closely with our design systems team, and ship weekly behind feature flags, so a change reaches a few clinics first and everyone a week later.

Our API is GraphQL over Node.js, backed by PostgreSQL. Real-time updates reach clinic staff through WebSockets, so when a patient books, the slot disappears from the front desk's screen within a second. Most of our frontend code is covered by tests, and we expect new features to be as well.

Requirements: 4+ years building web applications with React and TypeScript. Experience with GraphQL. A habit of writing tests; we use Playwright and Vitest. Care for accessibility, including keyboard and screen reader use.

Nice to have: Next.js, Storybook, experience working in a remote, async team.

Pay is $95,000 to $130,000 a year, or the local equivalent. We hire anywhere between UTC-3 and UTC+8.`,
  matched: ["React", "TypeScript", "Node.js", "PostgreSQL", "WebSockets", "Playwright", "Vitest", "Next.js"],
  missing: ["GraphQL", "design systems", "accessibility", "Storybook"],
};

export type SampleMark = { start: number; end: number; kind: "matched" | "missing"; term: string };

/** Naive whole-word finder for the style tile. The real matcher lives in lib/ats. */
export function findSampleMarks(text: string, matched: string[], missing: string[]): SampleMark[] {
  const marks: SampleMark[] = [];
  const add = (term: string, kind: SampleMark["kind"]) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![\\w.])${escaped}(?![\\w])`, "g");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + term.length;
      if (!marks.some((x) => start < x.end && end > x.start)) marks.push({ start, end, kind, term });
    }
  };
  matched.forEach((t) => add(t, "matched"));
  missing.forEach((t) => add(t, "missing"));
  return marks.sort((a, b2) => a.start - b2.start);
}

export type SampleJob = {
  id: string;
  title: string;
  company: string;
  source: string;
  newCompany?: boolean;
  isNew?: boolean;
  remote: string;
  pay: string;
  posted: string;
  fit: number | null;
  reasons: string[];
  gaps: string[];
  preview: string;
};

export const sampleJobs: SampleJob[] = [
  {
    id: "j1",
    title: "Senior Frontend Engineer",
    company: "Lumen Labs",
    source: "Direct from careers page (Ashby)",
    newCompany: true,
    isNew: true,
    remote: "Remote, worldwide",
    pay: "$95k to $130k a year",
    posted: "2 days ago",
    fit: 88,
    reasons: [
      "4 years of React and TypeScript matches the core requirement",
      "Shipped a WebSockets dashboard similar to their clinic staff view",
      "Playwright and Vitest experience fits their testing habit",
    ],
    gaps: ["GraphQL", "Storybook"],
    preview:
      "Lumen Labs builds scheduling software for community clinics in 14 countries. We are hiring a Senior Frontend Engineer to own the patient booking flow end to end.",
  },
  {
    id: "j2",
    title: "Full Stack Developer (React, Node)",
    company: "Tallow Health",
    source: "Direct from careers page (Greenhouse)",
    isNew: true,
    remote: "Remote, Asia and Europe",
    pay: "approx. $64k a year",
    posted: "Today",
    fit: 81,
    reasons: ["Node.js and PostgreSQL appear in two of his roles", "Timezone window fits UTC+6"],
    gaps: ["HL7 FHIR"],
    preview:
      "Tallow Health connects small pharmacies to insurers. You will work across a Next.js app and a Node.js API.",
  },
  {
    id: "j3",
    title: "Product Engineer, Billing",
    company: "Paperplane Payroll",
    source: "Found on Himalayas",
    remote: "Remote, worldwide",
    pay: "Pay not listed",
    posted: "5 days ago",
    fit: null,
    reasons: [],
    gaps: [],
    preview: "Paperplane runs payroll for distributed teams of 5 to 50 people.",
  },
];

export const sampleCompanies = [
  {
    name: "Lumen Labs",
    website: "lumenlabs.example",
    ats: "Ashby",
    roles: 12,
    checked: "Today, 6:32",
    via: "Apply link on Remotive",
    flags: [] as string[],
  },
  {
    name: "Tallow Health",
    website: "tallow.example",
    ats: "Greenhouse",
    roles: 23,
    checked: "Today, 6:31",
    via: "Who is hiring? (HN)",
    flags: [],
  },
  {
    name: "Corvid Logistics",
    website: "corvid.example",
    ats: "Lever",
    roles: 6,
    checked: "Yesterday",
    via: "remoteintech list",
    flags: ["Paused"],
  },
  {
    name: "Fieldnote",
    website: "fieldnote.example",
    ats: "Careers site",
    roles: 3,
    checked: "Today, 6:33",
    via: "Added by you",
    flags: [],
  },
  {
    name: "Atlas Talent Partners",
    website: "atlastalent.example",
    ats: "Workable",
    roles: 140,
    checked: "Today, 6:30",
    via: "Apply link on Jobicy",
    flags: ["Staffing agency", "Muted"],
  },
];

export const sampleAts = {
  master: 54,
  tailored: 74,
  components: [
    { id: "must", label: "Required keywords", points: 31.5, max: 45, detail: "7 of 10 found" },
    { id: "nice", label: "Nice-to-have keywords", points: 7.5, max: 15, detail: "1 of 2 found" },
    {
      id: "placement",
      label: "Keywords in experience",
      points: 8.8,
      max: 10,
      detail: "7 of 8 appear in bullets, not only in skills",
    },
    {
      id: "title",
      label: "Title alignment",
      points: 6,
      max: 10,
      detail: "Frontend and engineer appear in the summary",
    },
    { id: "seniority", label: "Seniority and years", points: 5, max: 5, detail: "4+ years fits a senior role" },
    { id: "parse", label: "Parseability", points: 15, max: 15, detail: "7 of 7 checks pass" },
  ],
};
