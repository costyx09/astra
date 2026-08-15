"use client";

import { useMemo, useState } from "react";
import type { AuctionState } from "@/types/auction";
import type { Player, Role } from "@/types/player";
import { suggestNextCalls } from "@/lib/engine/suggestion-engine";

type SortKey = "astraIndex" | "suggestedPrice" | "name";
type ViewMode = "browse" | "suggested";

const ROLE_FILTERS: Array<Role | "ALL"> = ["ALL", "P", "D", "C", "A"];
const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "astraIndex", label: "Indice Astra" },
  { key: "suggestedPrice", label: "Prezzo consigliato" },
  { key: "name", label: "Nome" },
];

export function PlayersPool({ auctionState, players }: { auctionState: AuctionState; players: Player[] }) {
  const [view, setView] = useState<ViewMode>("suggested");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("astraIndex");

  const soldIds = useMemo(() => new Set(auctionState.marketLog.map((e) => e.playerId)), [auctionState.marketLog]);

  const suggestions = useMemo(() => {
    if (view !== "suggested") return [];
    return suggestNextCalls(auctionState, players, 12);
  }, [view, auctionState, players]);

  const filtered = useMemo(() => {
    if (view !== "browse") return [];
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => !soldIds.has(p.id))
      .filter((p) => roleFilter === "ALL" || p.role === roleFilter)
      .filter((p) => q.length === 0 || p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name);
        if (sortKey === "suggestedPrice") return b.pricing.suggestedPrice - a.pricing.suggestedPrice;
        return b.scores.astraIndex - a.scores.astraIndex;
      });
  }, [view, players, soldIds, roleFilter, query, sortKey]);

  return (
    <div className="flex flex-col gap-3 px-4 py-6">
      <div className="flex gap-1 rounded-xl border p-1" style={{ borderColor: "var(--color-border)" }}>
        <button
          onClick={() => setView("suggested")}
          className="flex-1 rounded-lg py-2 text-sm font-semibold"
          style={{
            backgroundColor: view === "suggested" ? "var(--color-brand)" : "transparent",
            color: view === "suggested" ? "#0b0e14" : "var(--color-text-muted)",
          }}
        >
          🎯 Chi chiamare?
        </button>
        <button
          onClick={() => setView("browse")}
          className="flex-1 rounded-lg py-2 text-sm font-semibold"
          style={{
            backgroundColor: view === "browse" ? "var(--color-brand)" : "transparent",
            color: view === "browse" ? "#0b0e14" : "var(--color-text-muted)",
          }}
        >
          Sfoglia listone
        </button>
      </div>

      {view === "suggested" && (
        <>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Migliori occasioni ora, in base a ruoli mancanti, qualità e budget residuo — usa gli stessi prezzi dinamici dell&apos;Asta Live.
          </p>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <div
                key={s.player.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {s.player.name} <span style={{ color: "var(--color-text-muted)" }}>· {s.player.role}</span>
                  </div>
                  <div className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {s.reason}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-tabular text-sm font-semibold" style={{ color: "var(--color-brand)" }}>
                    {s.dynamicSuggestedPrice} cr
                  </div>
                  <div className="font-tabular text-xs" style={{ color: "var(--color-text-muted)" }}>
                    max {s.dynamicMaxPrice}
                  </div>
                </div>
              </div>
            ))}
            {suggestions.length === 0 && (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Nessun suggerimento: budget insufficiente per i giocatori rimasti, o rosa già completa.
              </p>
            )}
          </div>
        </>
      )}

      {view === "browse" && (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome..."
            className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
            style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {ROLE_FILTERS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: roleFilter === r ? "var(--color-brand)" : "var(--color-surface)",
                    color: roleFilter === r ? "#0b0e14" : "var(--color-text-muted)",
                    border: `1px solid var(--color-border)`,
                  }}
                >
                  {r === "ALL" ? "Tutti" : r}
                </button>
              ))}
            </div>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="ml-auto rounded-lg border px-2 py-1.5 text-xs"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  Ordina per {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {p.role} · {p.team}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-tabular text-sm font-semibold" style={{ color: "var(--color-brand)" }}>
                    {p.scores.astraIndex}
                  </div>
                  <div className="font-tabular text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {p.pricing.suggestedPrice} cr
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Nessun giocatore trovato con questi filtri.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
