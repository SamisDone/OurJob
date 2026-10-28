import pkg from "../../../package.json";

export const REPO_URL = "https://github.com/SamisDone/OurJob";

/** Descriptive User-Agent for every outgoing request (golden rule 6). */
export const USER_AGENT = `OurJob/${pkg.version} (+${REPO_URL})`;
