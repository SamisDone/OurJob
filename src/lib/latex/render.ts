import type { CvDocument, CvProjectEntry, CvRoleEntry, Segment } from "@/lib/cv/document";

/**
 * Renders a CvDocument as LaTeX in his template (templates/resume-sample.tex,
 * Jake Gutierrez's resume layout, MIT). The preamble is copied from the
 * template verbatim; a unit test keeps the two identical. Every user string
 * goes through escapeLatex, every URL through escapeUrl. It compiles with
 * pdflatex, which is what Overleaf uses for this template.
 */

export const PREAMBLE = String.raw`\documentclass[letterpaper,10pt]{article}

\usepackage{latexsym}
\usepackage[letterpaper,top=0.3in,bottom=0.3in,left=0.4in,right=0.4in]{geometry}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\input{glyphtounicode}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% Sections formatting
\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large\bfseries
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]
\titlespacing*{\section}{0pt}{8pt}{8pt}

% Make the PDF machine readable / ATS parsable
\pdfgentounicode=1
\linespread{1.0}

%-------------------------
% Custom commands
\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

% One-line heading: Company | Role ........ Date or Location
\newcommand{\resumeSubheading}[3]{
  \vspace{-2pt}\item
    \begin{tabular*}{1.0\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} $|$ \textit{\small #2} & \textit{\small #3} \\
    \end{tabular*}\vspace{-4pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{1.0\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & \small #2 \\
    \end{tabular*}\vspace{-4pt}
}

\renewcommand\labelitemi{$\vcenter{\hbox{\tiny$\bullet$}}$}
\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.0in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}[itemsep=1pt,parsep=0pt,topsep=3pt]}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{1pt}}

% A link shown as underlined text
\newcommand{\lnk}[2]{\href{#1}{\underline{#2}}}
% The tech line at the end of an entry
\newcommand{\tech}[1]{\resumeItem{\textbf{Tech:} \emph{#1}}}

`;

const SPECIAL: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
  "<": "\\textless{}",
  ">": "\\textgreater{}",
  "|": "\\textbar{}",
  "\u2013": "--",
  // An em dash becomes an en dash: no em dashes in CV text (golden rule 8).
  "\u2014": "--",
  "\u00a0": "~",
};

/** Escapes text for LaTeX body text. Dashes become TeX dashes. */
export function escapeLatex(s: string): string {
  return s.replace(/[\\&%$#_{}~^<>|\u2013\u2014\u00a0]/g, (c) => SPECIAL[c]);
}

/** URLs inside \href: only %, # and \ need escaping there. */
export function escapeUrl(url: string): string {
  return url.replace(/[\\%#]/g, (c) => `\\${c}`);
}

const segs = (s: readonly Segment[]) =>
  s.map((x) => (x.bold ? `\\textbf{${escapeLatex(x.text)}}` : escapeLatex(x.text))).join("");

function items(e: CvRoleEntry | CvProjectEntry, indent: string): string[] {
  if (!e.bullets.length && !e.tech?.length) return [];
  return [
    `${indent}\\resumeItemListStart`,
    ...e.bullets.map((b) => `${indent}  \\resumeItem{${segs(b.segments)}}`),
    ...(e.tech?.length ? [`${indent}  \\tech{${escapeLatex(e.tech.join(", "))}}`] : []),
    `${indent}\\resumeItemListEnd`,
  ];
}

function role(e: CvRoleEntry): string[] {
  // Employers are underlined (or linked); a plain heading (education) has no list under it.
  const hasList = e.bullets.length > 0 || (e.tech?.length ?? 0) > 0;
  const org = e.orgUrl
    ? `\\lnk{${escapeUrl(e.orgUrl)}}{${escapeLatex(e.org)}}`
    : hasList
      ? `\\underline{${escapeLatex(e.org)}}{}`
      : escapeLatex(e.org);
  return [
    "    \\resumeSubheading",
    `      {${org}}{${escapeLatex(e.title)}}{${escapeLatex(e.right ?? "")}}`,
    ...items(e, "      "),
    "",
  ];
}

function project(e: CvProjectEntry): string[] {
  const links = e.links.map((l) => `\\lnk{${escapeUrl(l.url)}}{${escapeLatex(l.label)}}`).join(" $|$ ");
  return [
    "    \\resumeProjectHeading",
    `      {\\textbf{${escapeLatex(e.name)}}}{${links}}`,
    ...items(e, "      "),
    "",
  ];
}

export function renderLatex(doc: CvDocument): string {
  const contact = doc.contact
    .map((c) => (c.url ? `\\lnk{${escapeUrl(c.url)}}{${escapeLatex(c.text)}}` : escapeLatex(c.text)))
    .join(" $|$ ");
  const out: string[] = [
    PREAMBLE,
    "%-------------------------------------------",
    "\\begin{document}",
    "",
    "%----------HEADING----------",
    "\\begin{center}",
    `    {\\huge \\scshape ${escapeLatex(doc.name)}} \\\\ \\vspace{2pt}`,
    `    \\small ${contact}`,
    "    \\vspace{-4pt}",
    "\\end{center}",
    "",
  ];
  for (const s of doc.sections) {
    out.push(`%-----------${s.title.toUpperCase()}-----------`, `\\section{${escapeLatex(s.title)}}`);
    if (s.kind === "summary") {
      out.push(`\\small{${segs(s.segments)}}`, "\\vspace{-3pt}", "");
    } else if (s.kind === "skills") {
      out.push(" \\begin{itemize}[leftmargin=0in, label={}]", "    \\small{\\item{");
      for (const line of s.lines) {
        const groups = line.map((g) => `\\textbf{${escapeLatex(g.group)}}{: ${escapeLatex(g.items.join(", "))}}`);
        out.push(`     ${groups.join(" $|$ ")} \\\\`);
      }
      out.push("    }}", " \\end{itemize}", "\\vspace{-6pt}", "");
    } else if (s.kind === "list") {
      out.push(" \\resumeItemListStart", ...s.items.map((it) => `  \\resumeItem{${segs(it)}}`));
      out.push(" \\resumeItemListEnd", "\\vspace{-6pt}", "");
    } else {
      out.push("  \\resumeSubHeadingListStart", "");
      for (const e of s.entries) out.push(...(e.kind === "role" ? role(e) : project(e)));
      out.push("  \\resumeSubHeadingListEnd", "\\vspace{-5pt}", "");
    }
  }
  out.push("\\end{document}", "");
  return out.join("\n");
}
