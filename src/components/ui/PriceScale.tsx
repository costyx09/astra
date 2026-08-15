export function PriceScale({
  currentBid,
  suggested,
  max,
}: {
  currentBid: number;
  suggested: number;
  max: number;
}) {
  const scaleMax = Math.max(max * 1.15, currentBid * 1.05, 1);
  const pct = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;

  const bidZoneColor =
    currentBid <= suggested
      ? "var(--color-rilancia)"
      : currentBid <= max
        ? "var(--color-aspetta)"
        : "var(--color-non-rilanciare)";

  return (
    <div className="w-full">
      <div className="relative h-2 w-full overflow-visible rounded-full" style={{ backgroundColor: "var(--color-border)" }}>
        {/* Zona 0 → consigliato: verde tenue */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: pct(suggested), backgroundColor: "var(--color-rilancia-soft)" }}
        />
        {/* Zona consigliato → massimo: giallo tenue */}
        <div
          className="absolute inset-y-0 rounded-full"
          style={{ left: pct(suggested), width: `calc(${pct(max)} - ${pct(suggested)})`, backgroundColor: "var(--color-aspetta-soft)" }}
        />
        {/* Marker prezzo consigliato */}
        <div className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2" style={{ left: pct(suggested), backgroundColor: "var(--color-text-faint)" }} />
        {/* Marker prezzo massimo */}
        <div className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2" style={{ left: pct(max), backgroundColor: "var(--color-text-faint)" }} />
        {/* Bid attuale: pallino evidente */}
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-300"
          style={{ left: pct(currentBid), backgroundColor: bidZoneColor, borderColor: "var(--color-bg)" }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-tabular text-[10px]" style={{ color: "var(--color-text-faint)" }}>
        <span>0</span>
        <span>consigliato {suggested}</span>
        <span>massimo {max}</span>
      </div>
    </div>
  );
}
