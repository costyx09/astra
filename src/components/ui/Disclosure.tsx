"use client";

import { useState } from "react";

export function Disclosure({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="touch-target flex w-full items-center justify-between rounded-lg px-1 text-xs font-medium"
        style={{ color: "var(--color-text-muted)" }}
      >
        <span>{label}</span>
        <span className="transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          ⌄
        </span>
      </button>
      {open && <div className="animate-fade-in mt-2 flex flex-col gap-3">{children}</div>}
    </div>
  );
}
