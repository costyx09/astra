"use client";

import { useEffect, useState } from "react";
import { useAuction } from "@/lib/state/auction-store";
import { MyRosterPanel } from "@/components/auction/MyRosterPanel";
import { loadPlayers } from "@/data/load-players";
import type { Player } from "@/types/player";

export default function RosterPage() {
  const { auctionState } = useAuction();
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    loadPlayers().then(setPlayers);
  }, []);

  if (!auctionState) return null;
  return <MyRosterPanel auctionState={auctionState} players={players} />;
}
