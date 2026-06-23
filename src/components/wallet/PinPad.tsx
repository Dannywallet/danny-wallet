"use client";

import React from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function PinDots({ length, filled, error }: { length: number; filled: number; error?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3.5">
      {Array.from({ length }).map((_, i) => (
        <span
          key={i}
          className={`h-3.5 w-3.5 rounded-full transition ${
            error
              ? "bg-[var(--dw-rose)]"
              : i < filled
              ? "bg-gradient-to-br from-[var(--dw-violet)] to-[var(--dw-cyan)]"
              : "bg-white/12"
          }`}
        />
      ))}
    </div>
  );
}

export function PinPad({
  onKey,
  onDelete,
}: {
  onKey: (d: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {KEYS.map((k, i) =>
        k === "" ? (
          <span key={i} />
        ) : (
          <button
            key={i}
            onClick={() => (k === "⌫" ? onDelete() : onKey(k))}
            className="dw-key dw-glass mx-auto grid h-16 w-16 place-items-center rounded-full text-2xl font-medium text-white transition"
          >
            {k}
          </button>
        )
      )}
    </div>
  );
}
