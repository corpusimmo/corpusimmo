"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui";

/** Un bouton de formulaire qui montre l'attente pendant l'action serveur. */
export function PendingButton(props: ButtonProps) {
  const { pending } = useFormStatus();
  return <Button {...props} loading={pending} />;
}
