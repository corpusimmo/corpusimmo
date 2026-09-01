"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  defaultOpen?: string;
  className?: string;
}

export function Accordion({ items, defaultOpen, className }: AccordionProps) {
  const [openId, setOpenId] = useState<string | undefined>(defaultOpen);
  const prefix = useId();

  return (
    <div
      className={cn(
        "divide-y divide-border-soft overflow-hidden rounded-lg border border-border bg-surface",
        className,
      )}
    >
      {items.map((item) => {
        const open = item.id === openId;
        const buttonId = `${prefix}-${item.id}-trigger`;
        const panelId = `${prefix}-${item.id}-panel`;

        return (
          <div key={item.id}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? undefined : item.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface-2"
              >
                {item.title}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0 text-ink-subtle transition-transform duration-200 ease-out",
                    open && "rotate-180",
                  )}
                />
              </button>
            </h3>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              // `inert` keeps the collapsed content out of the tab order and the
              // a11y tree while still allowing the height transition.
              inert={!open}
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="px-5 pb-4 text-sm leading-relaxed text-ink-muted">
                  {item.content}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
