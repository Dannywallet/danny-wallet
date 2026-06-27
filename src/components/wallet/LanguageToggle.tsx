"use client";

// ปุ่มสลับภาษา ไทย/อังกฤษ
import { useI18n, type Lang } from "@/lib/wallet/i18n";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`flex gap-1 ${className}`}>
      {(["th", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
            lang === l ? "dw-btn-primary" : "dw-btn-ghost text-[var(--dw-muted)]"
          }`}
        >
          {l === "th" ? "ไทย" : "EN"}
        </button>
      ))}
    </div>
  );
}
