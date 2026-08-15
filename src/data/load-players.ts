/**
 * Carica players.json (dati reali generati dallo script Python).
 * Fallback su mock solo per sviluppo locale se il file non è disponibile.
 */
import type { Player } from "@/types/player";

let playersCache: Player[] | null = null;

export async function loadPlayers(): Promise<Player[]> {
  if (playersCache) return playersCache;

  try {
    const response = await fetch("/players.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    playersCache = (await response.json()) as Player[];
    return playersCache;
  } catch (error) {
    console.warn("Fallback ai dati mock (players.json non trovato)", error);
    const { mockPlayers } = await import("./players.mock");
    return mockPlayers;
  }
}
