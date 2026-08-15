"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuction } from "@/lib/state/auction-store";
import { ActiveDepartmentBanner } from "@/components/auction/ActiveDepartmentBanner";
import { PlayerSearch } from "@/components/auction/PlayerSearch";
import { RosterSummary } from "@/components/auction/RosterSummary";
import { DecisionPanel } from "@/components/auction/DecisionPanel";
import { NextCallCard } from "@/components/auction/NextCallCard";
import { loadPlayers } from "@/data/load-players";
import { getActiveDepartment } from "@/lib/engine/reparto-intelligence-engine";
import type { Player } from "@/types/player";

export default function AuctionLivePage() {
  const { auctionState, registerSale } = useAuction();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayers()
      .then(setPlayers)
      .finally(() => setLoading(false));
  }, []);

  // Reparto attivo: unica fonte di verità, riusata così com'è (nessuna
  // logica duplicata) — guida sia il banner sia il filtro di ricerca.
  const activeRole = useMemo(() => (auctionState ? getActiveDepartment(auctionState) : null), [auctionState]);

  if (!auctionState || !activeRole) return null; // il layout mostra SetupScreen finché non inizializzata
  if (loading) return <div className="p-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>Caricamento dati...</div>;
  if (players.length === 0) return <div className="p-6 text-center text-sm" style={{ color: "var(--color-non-rilanciare)" }}>Errore nel caricamento dei giocatori</div>;

  const soldPlayerIds = new Set(auctionState.marketLog.map((e) => e.playerId));

  return (
    <div className="flex w-full flex-1 flex-col gap-4 px-4 py-6">
      <ActiveDepartmentBanner auctionState={auctionState} activeRole={activeRole} />
      <RosterSummary auctionState={auctionState} />

      {!selectedPlayer && (
        <>
          <NextCallCard auctionState={auctionState} players={players} onSelect={setSelectedPlayer} />
          <PlayerSearch players={players} soldPlayerIds={soldPlayerIds} activeRole={activeRole} onSelect={setSelectedPlayer} />
        </>
      )}

      {selectedPlayer && (
        <DecisionPanel
          player={selectedPlayer}
          players={players}
          auctionState={auctionState}
          onCancel={() => setSelectedPlayer(null)}
          onConfirmPurchase={({ buyerId, price }) => {
            registerSale({ playerId: selectedPlayer.id, role: selectedPlayer.role, price, buyerId });
            setSelectedPlayer(null);
          }}
        />
      )}
    </div>
  );
}
