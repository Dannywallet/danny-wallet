"use client";

import React from "react";
import { WORDLIST } from "@/lib/wallet/wordlist";
import { Check } from "./Icons";
import { useI18n } from "@/lib/wallet/i18n";

const SET = new Set(WORDLIST);

/** หาคำที่ "คล้ายกัน" จากสิ่งที่พิมพ์: ขึ้นต้นตรงก่อน แล้วตามด้วยคำที่มี substring */
function suggest(input: string): string[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  const starts = WORDLIST.filter((w) => w.startsWith(q));
  const contains = WORDLIST.filter((w) => !w.startsWith(q) && w.includes(q));
  return [...starts, ...contains].slice(0, 3);
}

export function SeedImportGrid({
  count,
  words,
  onChange,
}: {
  count: 12 | 24;
  words: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  const [active, setActive] = React.useState(0);
  const inputs = React.useRef<(HTMLInputElement | null)[]>([]);

  const setWord = (i: number, val: string) => {
    const next = [...words];
    next[i] = val.replace(/[^a-zA-Z]/g, "").toLowerCase();
    onChange(next);
  };

  const commit = (i: number, word: string) => {
    const next = [...words];
    next[i] = word;
    onChange(next);
    const to = i + 1 < count ? i + 1 : i;
    setActive(to);
    inputs.current[to]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent) => {
    const sug = suggest(words[i] || "");
    if ((e.key === " " || e.key === "Enter") && sug[0]) {
      e.preventDefault();
      commit(i, sug[0]);
    } else if (e.key === "Backspace" && !words[i] && i > 0) {
      e.preventDefault();
      setActive(i - 1);
      inputs.current[i - 1]?.focus();
    }
  };

  const suggestions = suggest(words[active] || "");

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: count }).map((_, i) => {
          const val = words[i] || "";
          const known = val.length > 0 && SET.has(val);
          const bad = val.length > 0 && !SET.has(val) && active !== i;
          return (
            <label
              key={i}
              className={`dw-glass flex items-center gap-1.5 rounded-xl px-2.5 py-2 transition ${
                active === i
                  ? "border-[var(--dw-cyan)]/60 ring-1 ring-[var(--dw-cyan)]/40"
                  : bad
                  ? "border-[var(--dw-rose)]/50"
                  : ""
              }`}
            >
              <span className="w-4 shrink-0 text-right text-[11px] text-[var(--dw-muted)]">
                {i + 1}
              </span>
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={val}
                onChange={(e) => setWord(i, e.target.value)}
                onFocus={() => setActive(i)}
                onKeyDown={(e) => onKeyDown(i, e)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-[var(--dw-muted)]"
                style={{ color: "var(--dw-text)" }}
                placeholder="·····"
              />
              {known && <Check size={13} className="shrink-0 text-[var(--dw-green)]" />}
            </label>
          );
        })}
      </div>

      {/* แถบตัวเลือกที่คล้ายกัน */}
      <div className="mt-3 min-h-[44px]">
        {suggestions.length > 0 ? (
          <>
            <p className="mb-1.5 text-[11px] text-[var(--dw-muted)]">{t("seed.similarOptions")}</p>
            <div className="flex gap-2">
              {suggestions.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => commit(active, w)}
                  className="dw-glass-strong flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:border-[var(--dw-cyan)]/50 active:scale-95"
                >
                  {w}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="pt-2 text-center text-[11px] text-[var(--dw-muted)]">
            {t("seed.typeHint")}
          </p>
        )}
      </div>
    </div>
  );
}
