import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The single `<main>` for every route.
 *
 * Pages had drifted to five different max-widths and three padding scales, and
 * each rendered its own `<main>` inside the one in the root layout. This owns
 * both, so a page only says how wide it wants to be.
 */
const WIDTH = {
  narrow: "max-w-3xl",
  medium: "max-w-5xl",
  wide: "max-w-7xl",
} as const;

export default function PageShell({
  title,
  description,
  actions,
  width = "wide",
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  width?: keyof typeof WIDTH;
  className?: string;
  children: ReactNode;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
        WIDTH[width],
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            {title && (
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {title}
              </h1>
            )}
            {description && (
              <p className="max-w-prose text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </header>
      )}
      {children}
    </main>
  );
}
