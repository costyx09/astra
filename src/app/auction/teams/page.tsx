"use client";

import { useEffect, useState } from "react";
import { useAuction } from "@/lib/state/auction-store";
import { TeamsDashboard } from "@/components/auction/TeamsDashboard";
import { loadPlayers } from "@/data/load-players";
import type { Player } from "@/types/player";

export default function TeamsPage() {
  const { auctionState } = useAuction();
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    loadPlayers().then(setPlayers);
  }, []);

  if (!auctionState) return null;
  return <TeamsDashboard auctionState={auctionState} players={players} />;
}
