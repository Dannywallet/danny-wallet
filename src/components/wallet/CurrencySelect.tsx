"use client";

// เลือกสกุลเงินที่ใช้แสดงมูลค่า (USD/THB/EUR/…) — ราคาต้นทางเป็น USD แล้วแปลงตามอัตราแลกเปลี่ยน
import React from "react";
import { useI18n } from "@/lib/wallet/i18n";
import { CURRENCIES, type CurrencyCode } from "@/lib/wallet/currency";

export function CurrencySelect({ className = "" }: { className?: string }) {
  const { currency, setCurrency } = useI18n();
  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
      aria-label="currency"
      className={`dw-btn-ghost rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none ${className}`}
      style={{ color: "var(--dw-text)", background: "var(--dw-panel)" }}
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code} style={{ background: "var(--dw-panel)", color: "var(--dw-text)" }}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
