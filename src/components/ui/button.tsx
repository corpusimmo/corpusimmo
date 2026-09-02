import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "accent"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** `md` and above keep a ≥44px touch target. */
  size?: ButtonSize;
  /** Shows a spinner, sets `aria-busy` and disables the button. */
  loading?: boolean;
  fullWidth?: boolean;
  /** Renders the single child element instead of a `<button>` (e.g. a Next `<Link>`). */
  asChild?: boolean;
}

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium leading-none " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none " +
  "aria-disabled:opacity-55 [&_svg]:shrink-0";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-fg shadow-sm hover:bg-primary-hover hover:shadow-md active:bg-primary-active",
  secondary:
    "border border-border bg-surface text-ink shadow-xs hover:border-border-strong hover:bg-surface-2",
  outline:
    "border border-border-strong bg-transparent text-ink hover:border-primary hover:bg-primary-soft hover:text-primary-soft-fg",
  ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
  accent: "bg-accent text-accent-fg shadow-xs hover:bg-accent-hover hover:shadow-sm",
  danger: "bg-danger text-ink-inverted shadow-xs hover:bg-danger-soft-fg",
};

/* Des pastilles, à toutes les tailles : le bouton est la forme la plus
   répétée du produit, et c'est elle qui donne le registre. */
const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 rounded-full px-4 text-sm",
  md: "h-11 rounded-full px-6 text-sm",
  lg: "h-13 rounded-full px-8 text-base",
  icon: "size-11 rounded-full",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  asChild = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);

  if (asChild) {
    // No Radix here: clone the single child and merge our styling into it.
    const child = React.Children.only(children) as React.ReactElement<Record<string, unknown>>;
    const childClassName =
      typeof child.props.className === "string" ? child.props.className : undefined;

    return React.cloneElement(child, {
      ...rest,
      className: cn(classes, childClassName),
      "aria-busy": loading || undefined,
      "aria-disabled": disabled || loading || undefined,
    });
  }

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
    >
      {loading ? (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner size={size === "lg" ? "md" : "sm"} />
        </span>
      ) : null}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
        {children}
      </span>
    </button>
  );
}
