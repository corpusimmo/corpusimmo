import { cn } from "@/lib/utils/cn";

/**
 * Consistent gutters for every workspace screen. Dense, but never edge to edge.
 *
 * `` is the structural hook every art direction re-composes
 * (`design-layouts-app.css`): content width, gutters, vertical rhythm between
 * blocks, and the treatment of the page header — which is always the first
 * `<header>` child, whether it comes from `PageHeader` or from the screen.
 */
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1560px] px-4 py-6 md:px-6 lg:px-8", className)}
    >
      {children}
    </div>
  );
}
