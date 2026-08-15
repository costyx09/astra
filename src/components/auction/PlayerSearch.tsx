"use client";

import { useMemo, useState } from "react";
import type { Player, Role } from "@/types/player";

const ROLE_LABEL: Record<Player["role"], string> = { P: "Por", D: "Dif", C: "Cen", A: "Att" };

export function PlayerSearch({
  players,
  soldPlayerIds,
  activeRole,
  onSelect,
}: {
  players: Player[];
  soldPlayerIds: Set<string>;
  /** Reparto attivo (da `getActiveDepartment`, unica fonte di verità) — la ricerca mostra solo giocatori di questo ruolo, mai reparti futuri. */
  activeRole: Role;
  onSelect: (player: Player) => void;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (query.trim().length === 0) return [];
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => p.role === activeRole && !soldPlayerIds.has(p.id) && p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [players, soldPlayerIds, activeRole, query]);

  return (
    <div className="relative w-full">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Cerca ${ROLE_LABEL[activeRole]} chiamato...`}
        className="touch-target w-full rounded-xl border px-4 py-4 text-lg outline-none focus:ring-2"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border-strong)",
          color: "var(--color-text)",
        }}
      />
      {results.length > 0 && (
        <ul
          className="animate-fade-in absolute z-10 mt-1 w-full overflow-hidden rounded-xl border"
          style={{ backgroundColor: "var(--color-surface-raised)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-overlay)" }}
        >
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  onSelect(p);
                  setQuery("");
                }}
                className="touch-target flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:opacity-80"
              >
                <span>{p.name}</span>
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {ROLE_LABEL[p.role]} · {p.team}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
