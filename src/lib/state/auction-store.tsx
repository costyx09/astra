"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuctionState, MarketLogEntry, TeamIdentity } from "@/types/auction";
import { ROLE_TARGETS } from "@/types/auction";
import type { Role } from "@/types/player";
import { deriveTeams } from "./derive-teams";

const STORAGE_KEY = "astra-auction-state-v2";

/**
 * Stato dell'asta interamente client-side (vedi astra-v1-mvp.md): nessun
 * backend, nessun database. Persistenza in localStorage per sopravvivere
 * a refresh accidentali durante l'asta.
 *
 * `marketLog` è l'unica fonte di verità persistita: `teams` (budget e
 * rosa di ogni squadra) viene sempre ricalcolato da `deriveTeams`,
 * mai mutato incrementalmente — è questo che rende sicure le operazioni
 * di correzione (modifica/elimina/annulla, vedi il Pannello Rosa e Mercato).
 */

interface PersistedState {
  teamIdentities: TeamIdentity[];
  marketLog: MarketLogEntry[];
}

function makeId(): string {
  return `sale_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface AuctionContextValue {
  auctionState: AuctionState | null;
  isInitialized: boolean;
  initializeAuction: (opponentNames: string[]) => void;
  registerSale: (params: { playerId: string; role: Role; price: number; buyerId: string }) => void;
  editSale: (id: string, updates: { price?: number; buyerId?: string }) => void;
  deleteSale: (id: string) => void;
  undoLast: () => void;
  resetAuction: () => void;
}

const AuctionContext = createContext<AuctionContextValue | null>(null);

export function AuctionProvider({ children }: { children: React.ReactNode }) {
  const [persisted, setPersisted] = useState<PersistedState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Caricamento iniziale da localStorage (solo lato client)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPersisted(JSON.parse(raw) as PersistedState);
      }
    } catch {
      // localStorage non disponibile o dato corrotto: si riparte da zero
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persistenza automatica ad ogni variazione
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (persisted) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // storage pieno o non disponibile: la sessione resta comunque
      // utilizzabile in memoria per la sessione corrente
    }
  }, [persisted, hydrated]);

  const initializeAuction = useCallback((opponentNames: string[]) => {
    const teamIdentities: TeamIdentity[] = [
      { id: "me", name: "La mia squadra" },
      ...opponentNames.map((name, i) => ({ id: `opp${i + 1}`, name: name.trim() || `Avversario ${i + 1}` })),
    ];
    setPersisted({ teamIdentities, marketLog: [] });
  }, []);

  const registerSale = useCallback(
    (params: { playerId: string; role: Role; price: number; buyerId: string }) => {
      setPersisted((prev) => {
        if (!prev) return prev;
        const entry: MarketLogEntry = {
          id: makeId(),
          playerId: params.playerId,
          role: params.role,
          pricePaid: params.price,
          buyerId: params.buyerId,
          timestamp: new Date().toISOString(),
        };
        return { ...prev, marketLog: [...prev.marketLog, entry] };
      });
    },
    []
  );

  const editSale = useCallback((id: string, updates: { price?: number; buyerId?: string }) => {
    setPersisted((prev) => {
      if (!prev) return prev;
      const marketLog = prev.marketLog.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              pricePaid: updates.price ?? entry.pricePaid,
              buyerId: updates.buyerId ?? entry.buyerId,
            }
          : entry
      );
      return { ...prev, marketLog };
    });
  }, []);

  const deleteSale = useCallback((id: string) => {
    setPersisted((prev) => {
      if (!prev) return prev;
      return { ...prev, marketLog: prev.marketLog.filter((entry) => entry.id !== id) };
    });
  }, []);

  const undoLast = useCallback(() => {
    setPersisted((prev) => {
      if (!prev || prev.marketLog.length === 0) return prev;
      return { ...prev, marketLog: prev.marketLog.slice(0, -1) };
    });
  }, []);

  const resetAuction = useCallback(() => {
    setPersisted(null);
  }, []);

  const auctionState = useMemo<AuctionState | null>(() => {
    if (!persisted) return null;
    return {
      teams: deriveTeams(persisted.teamIdentities, persisted.marketLog),
      marketLog: persisted.marketLog,
      roleTargets: ROLE_TARGETS,
    };
  }, [persisted]);

  const value = useMemo<AuctionContextValue>(
    () => ({
      auctionState,
      isInitialized: auctionState !== null,
      initializeAuction,
      registerSale,
      editSale,
      deleteSale,
      undoLast,
      resetAuction,
    }),
    [auctionState, initializeAuction, registerSale, editSale, deleteSale, undoLast, resetAuction]
  );

  return <AuctionContext.Provider value={value}>{children}</AuctionContext.Provider>;
}

export function useAuction(): AuctionContextValue {
  const ctx = useContext(AuctionContext);
  if (!ctx) {
    throw new Error("useAuction deve essere usato dentro <AuctionProvider>");
  }
  return ctx;
}
