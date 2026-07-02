"use client";

// ปุ่มสลับภาษา ไทย/อังกฤษ/เวียดนาม/จีน
import { useI18n, type Lang } from "@/lib/wallet/i18n";

const LABELS: Record<Lang, string> = { th: "ไทย", en: "EN", vi: "VI", zh: "中文" };

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {(["th", "en", "vi", "zh"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
            lang === l ? "dw-btn-primary" : "dw-btn-ghost text-[var(--dw-muted)]"
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
