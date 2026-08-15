"use client";

import { useEffect, useState } from "react";
import { useAuction } from "@/lib/state/auction-store";
import { MarketTimeline } from "@/components/auction/MarketTimeline";
import { loadPlayers } from "@/data/load-players";
import type { Player } from "@/types/player";

export default function MarketPage() {
  const { auctionState, editSale, deleteSale, undoLast } = useAuction();
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    loadPlayers().then(setPlayers);
  }, []);

  if (!auctionState) return null;

  return (
    <MarketTimeline
      auctionState={auctionState}
      players={players}
      onEdit={editSale}
      onDelete={deleteSale}
      onUndoLast={undoLast}
    />
  );
}
