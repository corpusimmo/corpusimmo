import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Ce qui est vérifié ici n'est pas le dessin de la barre, c'est sa POLITESSE.
 *
 * Une invite d'installation rate toujours de la même façon : elle arrive trop
 * tôt, elle vole le focus, elle revient après un refus, ou elle s'invite au
 * milieu d'un travail en cours. Chacun de ces quatre défauts a son test.
 */

let pathname = "/outils/dcf";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { InstallInvite } from "./install-invite";

/** Simule l'événement que Chrome tire quand il juge le site installable. */
function tirerBeforeInstallPrompt() {
  const evenement = new Event("beforeinstallprompt") as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string; platform: string }>;
  };
  evenement.prompt = vi.fn(async () => {});
  evenement.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" });
  window.dispatchEvent(evenement);
  return evenement;
}

/** Quelqu'un qui a déjà lu plusieurs pages : le signe d'intérêt est acquis. */
function dejaLecteur() {
  localStorage.setItem("corpusimmo.pwa-presence.v1", JSON.stringify({ vues: 5, derniere: 0 }));
}

describe("InstallInvite", () => {
  beforeEach(() => {
    localStorage.clear();
    pathname = "/outils/dcf";
  });

  it("ne rend RIEN à quelqu'un qui vient d'arriver", () => {
    tirerBeforeInstallPrompt();
    render(<InstallInvite />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("apparaît une fois le lecteur engagé, correctement étiquetée et NON modale", async () => {
    dejaLecteur();
    tirerBeforeInstallPrompt();
    render(<InstallInvite />);

    const invite = await screen.findByRole("dialog");
    expect(invite).toHaveAccessibleName("Installer CorpusImmo");
    expect(invite).toHaveAccessibleDescription(/hors connexion/i);
    // Non modale : elle ne doit pas masquer le reste de la page aux lecteurs d'écran.
    expect(invite).not.toHaveAttribute("aria-modal");
    expect(screen.getByRole("button", { name: "Installer" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ne plus proposer l'installation" }),
    ).toBeInTheDocument();
  });

  it("ne vole jamais le focus en apparaissant", async () => {
    dejaLecteur();
    tirerBeforeInstallPrompt();
    render(<InstallInvite />);
    await screen.findByRole("dialog");
    expect(document.body).toHaveFocus();
  });

  it("se ferme avec Échap et mémorise le refus pour soixante jours", async () => {
    dejaLecteur();
    tirerBeforeInstallPrompt();
    const user = userEvent.setup();
    render(<InstallInvite />);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const memoire = JSON.parse(localStorage.getItem("corpusimmo.pwa-invite.v1") ?? "{}");
    expect(memoire.statut).toBe("refuse");
    expect(memoire.nieme).toBe(1);
  });

  it("ne réapparaît pas au rechargement suivant après un refus", async () => {
    dejaLecteur();
    localStorage.setItem(
      "corpusimmo.pwa-invite.v1",
      JSON.stringify({ statut: "refuse", depuis: Date.now(), nieme: 1 }),
    );
    tirerBeforeInstallPrompt();
    render(<InstallInvite />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("se tait sur les écrans de travail", async () => {
    dejaLecteur();
    pathname = "/estimer";
    tirerBeforeInstallPrompt();
    render(<InstallInvite />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("laisse Échap à une vraie modale ouverte par-dessus", async () => {
    dejaLecteur();
    tirerBeforeInstallPrompt();
    const user = userEvent.setup();
    render(<InstallInvite />);
    await screen.findByRole("dialog");

    const modale = document.createElement("div");
    modale.setAttribute("aria-modal", "true");
    document.body.appendChild(modale);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeInTheDocument();
    modale.remove();
  });

  it("rend le focus à l'endroit d'où l'on est entré au clavier", async () => {
    dejaLecteur();
    tirerBeforeInstallPrompt();
    const user = userEvent.setup();
    const { container } = render(
      <>
        <button type="button">Lien de la page</button>
        <InstallInvite />
      </>,
    );
    await screen.findByRole("dialog");

    const origine = container.querySelector("button") as HTMLButtonElement;
    origine.focus();
    await user.tab(); // on entre dans la barre
    await user.keyboard("{Escape}");

    await waitFor(() => expect(origine).toHaveFocus());
  });
});
