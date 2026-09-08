import { describe, expect, it } from "vitest";

import { parseTeam } from "./team";

describe("parseTeam", () => {
  it("lit des entrées « Nom <adresse> » séparées par des virgules", () => {
    const team = parseTeam("Mathieu Guicheteau <M@Exemple.fr>, Gaël Colin <gael@exemple.fr>");
    expect(team.map((m) => m.email)).toEqual(["m@exemple.fr", "gael@exemple.fr"]);
    expect(team[0]?.firstName).toBe("Mathieu");
    expect(team[1]?.initials).toBe("GC");
  });

  it("accepte une adresse nue et en tire un prénom", () => {
    const [member] = parseTeam("gael@exemple.fr");
    expect(member?.name).toBe("gael");
  });

  it("ignore le vide et les doublons", () => {
    expect(parseTeam(undefined)).toEqual([]);
    expect(parseTeam("a <x@y.fr>; b <X@Y.FR>, rien")).toHaveLength(1);
  });
});
