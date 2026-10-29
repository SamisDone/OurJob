import { Briefcase } from "lucide-react";

/** The OurJob mark: a briefcase in a small square. The sidebar header and sign-in use it. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        "flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
      }
    >
      <Briefcase className="size-4" aria-hidden />
    </div>
  );
}
