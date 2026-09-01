import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./modal";

function Harness({ onClosed }: { onClosed?: () => void } = {}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ouvrir
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          onClosed?.();
        }}
        title="Module en préparation"
        description="Ce module n'est pas encore disponible."
        footer={
          <button type="button" onClick={() => setOpen(false)}>
            Compris
          </button>
        }
      >
        <input aria-label="Votre e-mail" />
      </Modal>
    </>
  );
}

async function open() {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Ouvrir" }));
  return { user, dialog: screen.getByRole("dialog") };
}

describe("Modal", () => {
  it("renders nothing while closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("exposes a labelled, described, modal dialog once open", async () => {
    const { dialog } = await open();

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Module en préparation");
    expect(dialog).toHaveAccessibleDescription("Ce module n'est pas encore disponible.");
    expect(screen.getByRole("heading", { name: "Module en préparation" })).toBeInTheDocument();
  });

  it("moves focus inside and locks the body scroll", async () => {
    await open();

    expect(screen.getByRole("button", { name: "Fermer" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("traps Tab and Shift+Tab inside the panel", async () => {
    const { user } = await open();

    const close = screen.getByRole("button", { name: "Fermer" });
    const input = screen.getByLabelText("Votre e-mail");
    const confirm = screen.getByRole("button", { name: "Compris" });

    expect(close).toHaveFocus();

    await user.tab();
    expect(input).toHaveFocus();

    await user.tab();
    expect(confirm).toHaveFocus();

    // Past the last focusable, focus loops back to the first.
    await user.tab();
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const { user } = await open();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ouvrir" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on a click on the overlay", async () => {
    const { user, dialog } = await open();

    const overlay = dialog.parentElement?.firstElementChild;
    expect(overlay).toBeTruthy();

    await user.click(overlay as Element);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes from the close button", async () => {
    const onClosed = vi.fn();
    const user = userEvent.setup();
    render(<Harness onClosed={onClosed} />);

    await user.click(screen.getByRole("button", { name: "Ouvrir" }));
    await user.click(screen.getByRole("button", { name: "Fermer" }));

    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
