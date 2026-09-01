/**
 * INSEE code arithmetic.
 *
 * Two French quirks bite every naive `code.slice(0, 2)`:
 *  - overseas departments use a 3-digit prefix (`97105` → `971`);
 *  - Paris, Lyon and Marseille are one commune for the INSEE but are published
 *    per *arrondissement municipal* in DVF (`75056` never has a file, `75101`
 *    does).
 */

/** Communes published per arrondissement in DVF, and their arrondissement codes. */
const PLM_ARRONDISSEMENTS: Record<string, readonly string[]> = {
  // Paris — 75101 → 75120
  "75056": Array.from({ length: 20 }, (_, i) => `751${String(i + 1).padStart(2, "0")}`),
  // Lyon — 69381 → 69389
  "69123": Array.from({ length: 9 }, (_, i) => `693${81 + i}`),
  // Marseille — 13201 → 13216
  "13055": Array.from({ length: 16 }, (_, i) => `132${String(i + 1).padStart(2, "0")}`),
};

export function departmentCodeFromInsee(insee: string): string | undefined {
  const code = insee.trim();
  if (code.length < 2) return undefined;
  // 971…978 (DROM/COM) carry three digits; Corsica keeps its 2A / 2B letters.
  if (code.startsWith("97") || code.startsWith("98")) return code.slice(0, 3);
  return code.slice(0, 2);
}

/** True when the code designates Paris, Lyon or Marseille as a whole. */
export function isPlmParentCommune(insee: string): boolean {
  return insee in PLM_ARRONDISSEMENTS;
}

/**
 * Expands a PLM parent code into the arrondissement codes DVF actually
 * publishes. Any other code is returned untouched.
 */
export function expandPlmCommune(insee: string): readonly string[] {
  return PLM_ARRONDISSEMENTS[insee] ?? [insee];
}
