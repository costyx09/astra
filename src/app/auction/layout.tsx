"use client";

import { useAuction } from "@/lib/state/auction-store";
import { SetupScreen } from "@/components/auction/SetupScreen";
import { TabBar } from "@/components/ui/TabBar";

export default function AuctionLayout({ children }: { children: React.ReactNode }) {
  const { isInitialized, resetAuction } = useAuction();

  if (!isInitialized) {
    return <SetupScreen />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-brand)" }}>
          Astra
        </h1>
        <button
          onClick={resetAuction}
          className="text-xs underline-offset-2 hover:underline"
          style={{ color: "var(--color-text-muted)" }}
        >
          Nuova asta
        </button>
      </div>
      <TabBar />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">{children}</div>
    </div>
  );
}
