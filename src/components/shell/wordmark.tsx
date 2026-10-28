/** The OurJob wordmark: set in Plex Sans, no logo mark. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-baseline text-[19px] leading-none font-semibold tracking-[-0.01em] text-ink">
      {compact ? (
        "Oj"
      ) : (
        <>
          <span className="text-graphite">Our</span>Job
        </>
      )}
    </span>
  );
}
