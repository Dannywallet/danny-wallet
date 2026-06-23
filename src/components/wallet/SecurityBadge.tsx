import React from "react";
import { Shield } from "./Icons";

export function SecurityBadge({ label = "ปลอดภัย", demo = false }: { label?: string; demo?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dw-green)]/30 bg-[var(--dw-green)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--dw-green)]">
      <Shield size={13} />
      {label}
      {demo && (
        <span className="ml-1 rounded-full bg-white/10 px-1.5 text-[9px] tracking-wide text-[var(--dw-muted)]">
          DEMO
        </span>
      )}
    </span>
  );
}
