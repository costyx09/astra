"use client";

import { useEffect, useState } from "react";
import { useAuction } from "@/lib/state/auction-store";
import { PlayersPool } from "@/components/auction/PlayersPool";
import { loadPlayers } from "@/data/load-players";
import type { Player } from "@/types/player";

export default function PlayersPage() {
  const { auctionState } = useAuction();
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    loadPlayers().then(setPlayers);
  }, []);

  if (!auctionState) return null;
  return <PlayersPool auctionState={auctionState} players={players} />;
}
