import { cn } from "@/lib/utils";

/**
 * Loading placeholders. Ten pages already drew their own pulsing bars while
 * three others showed the word "Loading…", so a list and a detail view behaved
 * visibly differently on the same connection.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("animate-pulse rounded bg-border", className)} />
  );
}

export function SkeletonRows({
  rows = 3,
  className,
  label = "Loading",
}: {
  rows?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className={cn("space-y-4", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
