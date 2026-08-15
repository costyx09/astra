"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuction } from "@/lib/state/auction-store";
import { loadPlayers } from "@/data/load-players";
import type { Player } from "@/types/player";
import {
  analyzeDepartment,
  detectOpportunities,
  getActiveDepartment,
  getDepartmentDashboard,
  rankRemainingPlayers,
} from "@/lib/engine/reparto-intelligence-engine";
import {
  computeDepartmentCompletion,
  computeDepartmentPlan,
  computeNextObjective,
  computeRepartoFit,
} from "@/lib/engine/department-plan-engine";
import { DepartmentDashboardBar } from "@/components/auction/DepartmentDashboardBar";
import { DepartmentReportCard } from "@/components/auction/DepartmentReportCard";
import { DepartmentOpportunities } from "@/components/auction/DepartmentOpportunities";
import { DepartmentPlanCard } from "@/components/auction/DepartmentPlanCard";
import { DepartmentPlayerList } from "@/components/auction/DepartmentPlayerList";

export default function RepartoPage() {
  const { auctionState } = useAuction();
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    loadPlayers().then(setPlayers);
  }, []);

  const activeRole = useMemo(() => (auctionState ? getActiveDepartment(auctionState) : null), [auctionState]);

  const report = useMemo(
    () => (auctionState && activeRole && players.length > 0 ? analyzeDepartment(auctionState, players, activeRole) : null),
    [auctionState, activeRole, players]
  );

  const ranked = useMemo(
    () => (auctionState && activeRole && players.length > 0 ? rankRemainingPlayers(auctionState, players, activeRole) : []),
    [auctionState, activeRole, players]
  );

  const opportunities = useMemo(
    () => (activeRole ? detectOpportunities(ranked, activeRole) : []),
    [ranked, activeRole]
  );

  const dashboard = useMemo(
    () => (auctionState && activeRole && players.length > 0 ? getDepartmentDashboard(auctionState, players, activeRole) : null),
    [auctionState, activeRole, players]
  );

  const plan = useMemo(
    () => (auctionState && activeRole && players.length > 0 ? computeDepartmentPlan(auctionState, players, activeRole) : null),
    [auctionState, activeRole, players]
  );

  const fit = useMemo(
    () => (auctionState && activeRole && players.length > 0 ? computeRepartoFit(auctionState, players, activeRole) : []),
    [auctionState, activeRole, players]
  );

  const objective = useMemo(
    () => (auctionState && activeRole && players.length > 0 ? computeNextObjective(auctionState, players, activeRole, fit) : null),
    [auctionState, activeRole, players, fit]
  );

  const completion = useMemo(
    () => (auctionState && activeRole && players.length > 0 ? computeDepartmentCompletion(auctionState, players, activeRole) : null),
    [auctionState, activeRole, players]
  );

  if (!auctionState || !activeRole || !report || !dashboard || !plan) return null;

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <DepartmentDashboardBar dashboard={dashboard} />
      <DepartmentPlanCard plan={plan} objective={objective} bestFit={fit[0] ?? null} completion={completion} />
      <DepartmentReportCard report={report} />
      <DepartmentOpportunities opportunities={opportunities} />
      <DepartmentPlayerList ranked={ranked} />
    </div>
  );
}
