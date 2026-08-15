"use client";

import { useState } from "react";
import type { AuctionState } from "@/types/auction";
import type { Player } from "@/types/player";

export function MarketTimeline({
  auctionState,
  players,
  onEdit,
  onDelete,
  onUndoLast,
}: {
  auctionState: AuctionState;
  players: Player[];
  onEdit: (id: string, updates: { price?: number; buyerId?: string }) => void;
  onDelete: (id: string) => void;
  onUndoLast: () => void;
}) {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const teamById = new Map(auctionState.teams.map((t) => [t.id, t]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState(0);
  const [draftBuyer, setDraftBuyer] = useState("me");

  const entries = [...auctionState.marketLog].reverse();

  function startEdit(id: string, price: number, buyerId: string) {
    setEditingId(id);
    setDraftPrice(price);
    setDraftBuyer(buyerId);
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-6">
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {entries.length} acquisti registrati
        </span>
        <button
          disabled={entries.length === 0}
          onClick={() => {
            if (window.confirm("Annullare l'ultima operazione registrata?")) onUndoLast();
          }}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
        >
          Annulla ultima operazione
        </button>
      </div>

      {entries.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Nessun acquisto ancora registrato.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {entries.map((entry) => {
          const player = playerById.get(entry.playerId);
          const buyer = teamById.get(entry.buyerId);
          const isEditing = editingId === entry.id;

          return (
            <div
              key={entry.id}
              className="rounded-lg border px-3 py-2"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              {!isEditing ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{player?.name ?? entry.playerId}</div>
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {buyer?.name ?? entry.buyerId}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-tabular text-sm font-semibold">{entry.pricePaid} cr</span>
                    <button
                      onClick={() => startEdit(entry.id, entry.pricePaid, entry.buyerId)}
                      className="text-xs underline-offset-2 hover:underline"
                      style={{ color: "var(--color-brand)" }}
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Eliminare l'acquisto di ${player?.name ?? entry.playerId}?`)) {
                          onDelete(entry.id);
                        }
                      }}
                      className="text-xs underline-offset-2 hover:underline"
                      style={{ color: "var(--color-non-rilanciare)" }}
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{player?.name ?? entry.playerId}</span>
                  <select
                    value={draftBuyer}
                    onChange={(e) => setDraftBuyer(e.target.value)}
                    className="rounded-lg border px-2 py-1.5 text-sm"
                    style={{ backgroundColor: "var(--color-surface-raised)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  >
                    {auctionState.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={draftPrice}
                    onChange={(e) => setDraftPrice(Number(e.target.value) || 0)}
                    className="w-20 rounded-lg border px-2 py-1.5 font-tabular text-sm"
                    style={{ backgroundColor: "var(--color-surface-raised)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  />
                  <button
                    onClick={() => {
                      onEdit(entry.id, { price: draftPrice, buyerId: draftBuyer });
                      setEditingId(null);
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ backgroundColor: "var(--color-brand)", color: "#0b0e14" }}
                  >
                    Salva
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Annulla
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
