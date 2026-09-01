import { cn } from "@/lib/utils/cn";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "size-3.5",
  md: "size-4.5",
  lg: "size-6",
};

/**
 * Decorative by design: the busy state is announced by the container
 * (`aria-busy` on the button, `role="status"` on LoadingState).
 */
export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("animate-spin", SIZES[size], className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="currentColor"
        strokeWidth="2.25"
        className="opacity-20"
      />
      <path
        d="M21.5 12A9.5 9.5 0 0 0 12 2.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
