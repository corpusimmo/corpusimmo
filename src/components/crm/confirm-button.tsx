"use client";

import { useTransition } from "react";

import { Button, type ButtonProps } from "@/components/ui";

/** Un bouton qui demande confirmation avant une action irréversible. */
export function ConfirmButton({
  message,
  action,
  children,
  ...props
}: Omit<ButtonProps, "onClick"> & { message: string; action: () => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <Button
      {...props}
      loading={pending}
      onClick={() => {
        if (!window.confirm(message)) return;
        start(async () => {
          await action();
        });
      }}
    >
      {children}
    </Button>
  );
}
