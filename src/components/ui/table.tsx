"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface TableProps {
  /** Rendered as a sr-only `<caption>` — screen readers get the table's purpose. */
  caption?: string;
  className?: string;
  children: ReactNode;
}

export function Table({ caption, className, children }: TableProps) {
  return (
    <div className="scroll-slim w-full overflow-x-auto rounded-lg border border-border bg-surface">
      <table className={cn("w-full border-collapse text-sm", className)}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function TableHead({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <thead className={cn("bg-surface-2 text-ink-muted", className)}>{children}</thead>
  );
}

export function TableBody({ className, children }: { className?: string; children: ReactNode }) {
  return <tbody className={className}>{children}</tbody>;
}

export interface TableRowProps {
  className?: string;
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function TableRow({ className, selected, onClick, children }: TableRowProps) {
  return (
    <tr
      onClick={onClick}
      aria-selected={selected}
      data-selected={selected ? "" : undefined}
      className={cn(
        "border-b border-border-soft transition-colors duration-150 last:border-b-0",
        onClick && "cursor-pointer",
        selected ? "bg-primary-soft" : "hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </tr>
  );
}

const ALIGN: Record<"left" | "right" | "center", string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

const JUSTIFY: Record<"left" | "right" | "center", string> = {
  left: "justify-start",
  right: "justify-end",
  center: "justify-center",
};

export interface TableHeaderCellProps {
  align?: "left" | "right" | "center";
  sortable?: boolean;
  sorted?: "asc" | "desc" | false;
  onSort?: () => void;
  className?: string;
  children: ReactNode;
}

export function TableHeaderCell({
  align = "left",
  sortable = false,
  sorted = false,
  onSort,
  className,
  children,
}: TableHeaderCellProps) {
  const ariaSort = sortable
    ? sorted === "asc"
      ? "ascending"
      : sorted === "desc"
        ? "descending"
        : "none"
    : undefined;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        "px-3.5 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap",
        ALIGN[align],
        className,
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            "inline-flex w-full items-center gap-1 rounded-xs transition-colors duration-150 hover:text-ink",
            JUSTIFY[align],
            sorted && "text-ink",
          )}
        >
          {children}
          {sorted === "asc" ? (
            <ChevronUp className="size-3.5" aria-hidden="true" />
          ) : sorted === "desc" ? (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden="true" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export interface TableCellProps {
  align?: "left" | "right" | "center";
  /** Tabular figures — prices and surfaces must line up. */
  numeric?: boolean;
  className?: string;
  colSpan?: number;
  children: ReactNode;
}

export function TableCell({
  align = "left",
  numeric = false,
  className,
  colSpan,
  children,
}: TableCellProps) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-3.5 py-3 text-ink",
        ALIGN[align],
        numeric && "tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}
