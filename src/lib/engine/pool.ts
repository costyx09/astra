import type { Player, Role } from "@/types/player";

/**
 * Calcola quanti giocatori per ruolo esistono nell'intero listone.
 * Usato da Decision Engine e Auction Intelligence Engine per stimare
 * la scarsità (vedi decision engine doc, sezione 4.2).
 */
export function computePoolSizeByRole(players: Player[]): Record<Role, number> {
  const result: Record<Role, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const p of players) {
    result[p.role] += 1;
  }
  return result;
}
