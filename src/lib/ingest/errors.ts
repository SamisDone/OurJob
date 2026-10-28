export type IngestErrorCode =
  | "too_large"
  | "unsupported_type"
  | "no_text_layer"
  | "unreadable"
  | "empty"
  | "blocked_url"
  | "fetch_failed"
  | "not_found";

/** An ingestion failure with copy that can be shown to the person as is. */
export class IngestError extends Error {
  constructor(
    public readonly code: IngestErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IngestError";
  }
}
