import { Fragment } from "react";

const NUMBER = /(\$?\d[\d,.]*k?%?)/g;

/**
 * Text with its numbers in Geist Mono and its words in Geist Sans:
 * "$95k to $130k", "2 days ago", "approx. $64k".
 */
export function Nums({ children }: { children: string }) {
  return (
    <>
      {children.split(NUMBER).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="num">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
