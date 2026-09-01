import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("renders its children in a real button", () => {
    render(<Button>Estimer mon bien</Button>);
    expect(screen.getByRole("button", { name: "Estimer mon bien" })).toBeInTheDocument();
  });

  it("applies variant and size classes without leaking hardcoded colours", () => {
    const { rerender } = render(<Button variant="danger">Supprimer</Button>);
    const button = screen.getByRole("button", { name: "Supprimer" });
    expect(button.className).toContain("bg-danger");
    expect(button.className).not.toMatch(/bg-(blue|red|green|slate)-\d/);

    rerender(
      <Button variant="ghost" size="lg">
        Supprimer
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Supprimer" }).className).toContain("h-13");
  });

  it("takes the full width on demand", () => {
    render(<Button fullWidth>Continuer</Button>);
    expect(screen.getByRole("button", { name: "Continuer" }).className).toContain("w-full");
  });

  it("is busy and non-clickable while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Calcul en cours
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Calcul en cours" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    await userEvent.click(button, { pointerEventsCheck: 0 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Envoyer
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }), {
      pointerEventsCheck: 0,
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Valider</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  describe("asChild", () => {
    it("renders the child element instead of a button and merges classes", () => {
      render(
        <Button asChild variant="accent" className="mt-4">
          <a href="/estimer" className="tracking-tight">
            Estimer
          </a>
        </Button>,
      );

      const link = screen.getByRole("link", { name: "Estimer" });
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute("href", "/estimer");
      expect(link.className).toContain("bg-accent");
      expect(link.className).toContain("mt-4");
      expect(link.className).toContain("tracking-tight");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("marks the child as busy and disabled when loading", () => {
      render(
        <Button asChild loading>
          <a href="/estimer">Estimer</a>
        </Button>,
      );

      const link = screen.getByRole("link", { name: "Estimer" });
      expect(link).toHaveAttribute("aria-busy", "true");
      expect(link).toHaveAttribute("aria-disabled", "true");
    });
  });
});
