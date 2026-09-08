"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui";
import { formatDay, memberLabelClient } from "@/components/crm/format";
import { cn } from "@/lib/utils/cn";

export interface TaskRowProps {
  id: string;
  title: string;
  dueAt: Date | null;
  doneAt: Date | null;
  assigneeLabel: string;
  contact?: { id: string; label: string } | null;
  onToggle: (id: string, done: boolean, contactId?: string | null) => Promise<void>;
  onDelete: (id: string, contactId?: string | null) => Promise<void>;
}

export function TaskRow({ id, title, dueAt, doneAt, assigneeLabel, contact, onToggle, onDelete }: TaskRowProps) {
  const [pending, start] = useTransition();
  const done = doneAt !== null;
  const late = !done && dueAt !== null && dueAt.getTime() < Date.now();
  return (
    <li className={cn("flex items-start gap-3 py-3", pending && "opacity-60")}>
      <input
        type="checkbox"
        aria-label={done ? "Rouvrir la tâche" : "Marquer comme faite"}
        checked={done}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.checked;
          start(async () => {
            await onToggle(id, next, contact?.id ?? null);
          });
        }}
        className="mt-1 size-4 accent-[var(--primary)]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-sm", done && "text-ink-muted line-through")}>{title}</span>
        <span className="flex flex-wrap gap-x-3 text-xs text-ink-muted">
          {contact && contact.label ? (
            <Link href={`/crm/contacts/${contact.id}`} className="hover:text-ink hover:underline">
              {contact.label}
            </Link>
          ) : null}
          {dueAt ? (
            <span className={cn(late && "font-medium text-danger")}>
              {late ? "En retard, " : "Pour le "}
              {formatDay(dueAt)}
            </span>
          ) : null}
          <span>{memberLabelClient(assigneeLabel)}</span>
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Supprimer la tâche"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Supprimer cette tâche ?")) return;
          start(async () => {
            await onDelete(id, contact?.id ?? null);
          });
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Button>
    </li>
  );
}
