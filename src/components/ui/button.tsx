import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium",
    "transition-[background-color,border-color,color,transform] duration-[120ms] ease-ink",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-ink text-sheet hover:bg-ink/88",
        secondary: "border border-rule bg-sheet text-body hover:border-graphite hover:bg-ink-wash",
        ghost: "bg-transparent text-body hover:bg-ink-wash",
        destructive: "bg-redpen text-sheet hover:bg-redpen/88",
        link: "h-auto rounded-none px-0 text-ink underline decoration-rule underline-offset-4 hover:decoration-ink",
      },
      size: {
        sm: "h-8 px-3 text-sm max-md:h-11 max-md:px-4",
        md: "h-10 px-4 text-sm max-md:h-11",
        icon: "size-10 max-md:size-11",
        "icon-sm": "size-8 max-md:size-11",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
