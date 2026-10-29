/**
 * Fictional sample content for the /design style tile and UI tests.
 * Every person, company and job here is invented. Never put real data here.
 */
import { boldSegments, type CvDocument } from "@/lib/cv/document";
import type { FeedJob } from "@/lib/jobs/view";

const b = boldSegments;

export const sampleCv: CvDocument = {
  name: "Nadia Chowdhury",
  contact: [
    { text: "Sylhet, Bangladesh" },
    { text: "nadia.chowdhury@example.com", url: "mailto:nadia.chowdhury@example.com" },
    { text: "Github", url: "https://github.com/example-nadia" },
    { text: "LinkedIn", url: "https://www.linkedin.com/in/example-nadia" },
  ],
  sections: [
    {
      kind: "summary",
      title: "Summary",
      segments: b(
        "Backend Engineer with 5+ years of experience designing Go and Python services, PostgreSQL schemas and event pipelines for logistics and payments products.",
        [],
      ),
    },
    {
      kind: "skills",
      title: "Technical Skills",
      lines: [
        [
          { group: "Languages", items: ["Go", "Python", "SQL"] },
          { group: "Data", items: ["PostgreSQL", "Redis"] },
        ],
        [{ group: "Backend", items: ["gRPC", "Kafka", "REST APIs", "Django", "Celery"] }],
        [{ group: "Infrastructure", items: ["Docker", "Kubernetes", "AWS", "GitHub Actions"] }],
      ],
    },
    {
      kind: "entries",
      title: "Professional Experience",
      entries: [
        {
          kind: "role",
          id: "exp_1",
          org: "Parcelwise",
          title: "Senior Backend Engineer",
          right: "Jun 2023 – Present",
          bullets: [
            {
              sourceIds: ["b_1_1", "b_1_2"],
              segments: b(
                "Designed the rate-quote service in Go that answers about 1,200 requests per second at p99 under 80 ms, and moved nightly billing jobs to a Kafka-based event pipeline that cut failed invoice runs by roughly 60%.",
                ["rate-quote service", "1,200 requests per second", "Kafka", "60%"],
              ),
            },
          ],
          tech: ["Go", "PostgreSQL", "Kafka", "Redis", "Docker", "Kubernetes", "gRPC"],
        },
        {
          kind: "role",
          id: "exp_2",
          org: "Taka Pay",
          title: "Backend Developer",
          right: "Feb 2020 – May 2023",
          bullets: [
            {
              sourceIds: ["b_2_1", "b_2_2"],
              segments: b(
                "Built the merchant settlement API in Python (Django) used by 2,000+ merchants, and wrote the reconciliation job that matches bank statements to ledger entries with 98% automatic matches.",
                ["Python (Django)", "2,000+ merchants", "98% automatic matches"],
              ),
            },
          ],
          tech: ["Python", "Django", "PostgreSQL", "Celery", "AWS"],
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
          name: "pgwatch-lite",
          links: [{ label: "Source", url: "https://github.com/example-nadia/pgwatch-lite" }],
          bullets: [
            {
              sourceIds: ["b_p1_1"],
              segments: b("Small CLI that samples pg_stat_statements and flags slow queries in CI.", [
                "slow queries in CI",
              ]),
            },
          ],
          tech: ["Go", "PostgreSQL"],
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
          org: "Shahjalal University of Science and Technology",
          title: "B.Sc. in Computer Science",
          right: "Sylhet, Bangladesh",
          bullets: [],
        },
      ],
    },
  ],
};

export const sampleJd = {
  title: "Senior Backend Engineer",
  company: "Lumen Labs",
  text: `Lumen Labs builds scheduling software for community clinics in 14 countries. Nurses, front-desk staff and patients use it every day to book, move and confirm appointments, often on old Android phones and slow connections. We are a team of 31, fully remote across eight time zones, and we are hiring a Senior Backend Engineer to own the availability service end to end.

In your first months you will rebuild the service that answers one question thousands of times a minute: which slots are free? Today it reads every clinic's full calendar from PostgreSQL on each request, which makes the first screen slow for patients and puts heavy load on the database at 8 a.m. in every time zone. You will work with our product designer and one frontend engineer to split it into smaller steps, cache availability in Redis, and publish booking changes as events instead of polling. You will write services in Go, keep the schema healthy as clinics grow, and ship weekly behind feature flags, so a change reaches a few clinics first and everyone a week later.

Our services talk over gRPC and run on Kubernetes, packaged with Docker. Booking events flow through Kafka, so when a patient books, the slot disappears from the front desk's screen within a second. Some reporting jobs are still in Python, and we expect new work to be covered by tests.

Requirements: 5+ years building backend services, with production Go. Strong PostgreSQL skills, including query tuning. Experience with event-driven systems such as Kafka. Comfort with Terraform for the infrastructure you own.

Nice to have: GraphQL, OpenTelemetry, load testing, experience working in a remote, async team.

Pay is $95,000 to $130,000 a year, or the local equivalent. We hire anywhere between UTC-3 and UTC+8.`,
  matched: ["Go", "PostgreSQL", "Redis", "gRPC", "Kubernetes", "Docker", "Kafka", "Python"],
  missing: ["Terraform", "GraphQL", "OpenTelemetry", "load testing"],
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
    title: "Senior Backend Engineer",
    company: "Lumen Labs",
    source: "Direct from careers page (Ashby)",
    newCompany: true,
    isNew: true,
    remote: "Remote, worldwide",
    pay: "$95k to $130k a year",
    posted: "2 days ago",
    fit: 88,
    reasons: [
      "5 years of Go and PostgreSQL matches the core requirement",
      "Built a Kafka event pipeline like their booking events",
      "gRPC and Kubernetes are in your current role",
    ],
    gaps: ["Terraform", "GraphQL"],
    preview:
      "Lumen Labs builds scheduling software for community clinics in 14 countries. We are hiring a Senior Backend Engineer to own the availability service end to end.",
  },
  {
    id: "j2",
    title: "Backend Developer (Go, Python)",
    company: "Tallow Health",
    source: "Direct from careers page (Greenhouse)",
    isNew: true,
    remote: "Remote, Asia and Europe",
    pay: "approx. $64k a year",
    posted: "Today",
    fit: 81,
    reasons: ["Go and Python appear in your last two roles", "Timezone window fits UTC+6"],
    gaps: ["HL7 FHIR"],
    preview:
      "Tallow Health connects small pharmacies to insurers. You will work on the claims API in Go and the reporting jobs in Python.",
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
      detail: "Backend and engineer appear in the summary",
    },
    { id: "seniority", label: "Seniority and years", points: 5, max: 5, detail: "5+ years fits a senior role" },
    { id: "parse", label: "Parseability", points: 15, max: 15, detail: "7 of 7 checks pass" },
  ],
};

/** "Now" for the previews, so relative dates in screenshots never drift. */
export const sampleNow = new Date("2026-10-29T03:10:00Z");

/** Nadia lives in Sylhet. */
export const sampleTimeZone = "Asia/Dhaka";

/** The last daily search, for the Today header: 6:32 in the morning in Sylhet. */
export const sampleRun = { finishedAt: "2026-10-29T00:32:00Z", companies: 412 };

/** Today's feed for Nadia: fictional jobs at fictional companies. */
export const sampleFeed: FeedJob[] = [
  {
    id: "lumen-backend",
    title: "Senior Backend Engineer",
    company: "Lumen Labs",
    newCompany: true,
    isNew: true,
    saved: true,
    source: "Careers page (Ashby)",
    direct: true,
    where: "Remote, UTC-3 to UTC+8",
    eligibility: "eligible",
    pay: { min: 95_000, max: 130_000, approx: false },
    postedAt: "2026-10-27T09:00:00Z",
    fit: 88,
    reasons: [
      "5 years of Go and PostgreSQL covers the core requirement.",
      "You built a Kafka event pipeline like their booking events.",
      "gRPC and Kubernetes are part of your current role.",
    ],
    missing: ["Terraform", "GraphQL"],
    url: "https://jobs.lumenlabs.example/senior-backend-engineer",
  },
  {
    id: "tallow-backend",
    title: "Backend Developer (Go, Python)",
    company: "Tallow Health",
    newCompany: false,
    isNew: true,
    saved: false,
    source: "Careers page (Greenhouse)",
    direct: true,
    where: "Remote, Asia and Europe",
    eligibility: "eligible",
    pay: { min: 64_000, approx: true },
    postedAt: "2026-10-29T02:00:00Z",
    fit: 84,
    reasons: ["Go and Python appear in your last two roles.", "Their UTC+3 to UTC+8 window includes Sylhet."],
    missing: ["HL7 FHIR"],
    url: "https://boards.tallowhealth.example/backend-developer",
  },
  {
    id: "corvid-platform",
    title: "Platform Engineer, Routing",
    company: "Corvid Logistics",
    newCompany: false,
    isNew: true,
    saved: false,
    source: "Careers page (Lever)",
    direct: true,
    where: "Remote, worldwide",
    eligibility: "eligible",
    pay: { min: 110_000, max: 140_000, approx: false },
    postedAt: "2026-10-28T15:00:00Z",
    fit: 82,
    reasons: [
      "Logistics pricing work at Parcelwise matches their routing service.",
      "Kubernetes and Docker in daily use.",
    ],
    missing: ["Rust"],
    url: "https://jobs.corvid.example/platform-engineer-routing",
  },
  {
    id: "fieldnote-api",
    title: "Senior API Engineer",
    company: "Fieldnote",
    newCompany: true,
    isNew: false,
    saved: false,
    source: "Careers page",
    direct: true,
    where: "Remote, worldwide",
    eligibility: "eligible",
    pay: { min: 90_000, max: 115_000, approx: false },
    postedAt: "2026-10-25T10:00:00Z",
    fit: 80,
    reasons: ["REST API design and PostgreSQL tuning are central here.", "Small team, async, like your current one."],
    missing: ["OpenAPI tooling"],
    url: "https://fieldnote.example/careers/senior-api-engineer",
  },
  {
    id: "quayside-data",
    title: "Data Platform Engineer",
    company: "Quayside",
    newCompany: false,
    isNew: false,
    saved: true,
    source: "Careers page (Workable)",
    direct: true,
    where: "Remote, Europe and Asia",
    eligibility: "eligible",
    pay: { min: 85_000, max: 105_000, approx: false },
    postedAt: "2026-10-24T08:00:00Z",
    fit: 74,
    reasons: ["Kafka and PostgreSQL pipelines match the role.", "Python batch jobs in your Taka Pay work."],
    missing: ["Airflow", "dbt", "Snowflake"],
    url: "https://apply.quayside.example/data-platform-engineer",
  },
  {
    id: "ledgerbird-payments",
    title: "Software Engineer, Payments",
    company: "Ledgerbird",
    newCompany: false,
    isNew: false,
    saved: false,
    source: "Remotive",
    direct: false,
    where: "Remote, location not stated",
    eligibility: "unclear",
    eligibilityNote: "The post says remote but does not name countries or time zones.",
    pay: null,
    postedAt: "2026-10-26T12:00:00Z",
    fit: 71,
    reasons: ["Payments reconciliation at Taka Pay is close to their ledger work."],
    missing: ["Java", "Spring"],
    url: "https://remotive.example/jobs/ledgerbird-software-engineer-payments",
  },
  {
    id: "tidewater-sre",
    title: "Site Reliability Engineer",
    company: "Tidewater Systems",
    newCompany: false,
    isNew: false,
    saved: false,
    source: "Careers page (SmartRecruiters)",
    direct: true,
    where: "Remote, UTC+5 to UTC+9",
    eligibility: "eligible",
    pay: { min: 72_000, max: 96_000, approx: true },
    postedAt: "2026-10-23T07:00:00Z",
    fit: 63,
    reasons: ["Kubernetes operations overlap with your platform work."],
    missing: ["Terraform", "Prometheus", "On-call leadership"],
    url: "https://careers.tidewater.example/sre",
  },
  {
    id: "paperplane-billing",
    title: "Product Engineer, Billing",
    company: "Paperplane Payroll",
    newCompany: false,
    isNew: false,
    saved: false,
    source: "Himalayas",
    direct: false,
    where: "Remote, worldwide",
    eligibility: "eligible",
    pay: null,
    postedAt: "2026-10-24T16:00:00Z",
    fit: null,
    reasons: [],
    missing: [],
    url: "https://himalayas.example/companies/paperplane/jobs/product-engineer-billing",
  },
  {
    id: "pinecrest-fullstack",
    title: "Full Stack Engineer (React, Node)",
    company: "Pinecrest Studio",
    newCompany: false,
    isNew: false,
    saved: false,
    source: "Careers page (Recruitee)",
    direct: true,
    where: "Remote, Americas only",
    eligibility: "ineligible",
    pay: { min: 80_000, max: 100_000, approx: false },
    postedAt: "2026-10-22T11:00:00Z",
    fit: 52,
    reasons: ["API work fits, but the role is mostly frontend."],
    missing: ["React", "TypeScript", "Node.js"],
    url: "https://pinecrest.example/jobs/full-stack-engineer",
  },
];

/** The tailored CV's LaTeX for the LaTeX tab, in Pratik's template (an excerpt). */
export const sampleLatex = String.raw`%-----------EXPERIENCE-----------
\section{Professional Experience}
  \resumeSubHeadingListStart

    \resumeSubheading
      {\underline{Parcelwise}{}}{Senior Backend Engineer}{Jun 2023 -- Present}
      \resumeItemListStart
        \resumeItem{Designed the \textbf{rate-quote service} in Go that answers about \textbf{1,200 requests per second} at p99 under 80 ms, and moved nightly billing jobs to a \textbf{Kafka}-based event pipeline that cut failed invoice runs by roughly \textbf{60\%}.}
        \tech{Go, PostgreSQL, Kafka, Redis, Docker, Kubernetes, gRPC}
      \resumeItemListEnd

  \resumeSubHeadingListEnd`;

export type SampleChange =
  | { kind: "rewritten"; where: string; before: string; after: string }
  | { kind: "moved"; where: string; text: string; note: string }
  | { kind: "dropped"; where: string; text: string; reason: string };

/** What tailoring changed versus the master CV, for the Changes tab. */
export const sampleChanges: SampleChange[] = [
  {
    kind: "rewritten",
    where: "Parcelwise",
    before:
      "Moved nightly billing jobs from cron scripts to a Kafka-based event pipeline; cut failed invoice runs by roughly 60%.",
    after: "Moved nightly billing jobs to a Kafka-based event pipeline that cut failed invoice runs by roughly 60%.",
  },
  {
    kind: "moved",
    where: "Technical Skills",
    text: "Data: PostgreSQL, Redis",
    note: "Moved to the first line: the job asks for PostgreSQL early.",
  },
  {
    kind: "dropped",
    where: "Taka Pay",
    text: "Added PostgreSQL row-level security for multi-tenant reporting.",
    reason: "One bullet per role keeps the CV to one page.",
  },
];
