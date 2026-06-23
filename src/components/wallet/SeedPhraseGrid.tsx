"use client";

import React from "react";

export function SeedPhraseGrid({ words }: { words: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {words.map((w, i) => (
        <div
          key={i}
          className="dw-glass flex items-center gap-2 rounded-xl px-3 py-2.5"
        >
          <span className="w-5 text-right text-xs text-[var(--dw-muted)]">{i + 1}</span>
          <span className="font-medium">{w}</span>
        </div>
      ))}
    </div>
  );
}

/** เลือกคำตามลำดับเพื่อยืนยันการสำรอง */
export function SeedConfirm({
  words,
  ask,
  onComplete,
}: {
  words: string[];
  ask: number[]; // index ที่ต้องเลือก
  onComplete: (ok: boolean) => void;
}) {
  const [step, setStep] = React.useState(0);
  const [wrong, setWrong] = React.useState<string | null>(null);

  const target = words[ask[step]];
  // ตัวเลือก: คำที่ถูก + 2 คำสุ่มอื่น
  const options = React.useMemo(() => {
    const others = words.filter((w) => w !== target);
    const picks = [target, others[(ask[step] * 3) % others.length], others[(ask[step] * 7 + 1) % others.length]];
    return Array.from(new Set(picks)).sort();
  }, [step, target, words, ask]);

  const choose = (w: string) => {
    if (w !== target) {
      setWrong(w);
      setTimeout(() => setWrong(null), 600);
      return;
    }
    if (step + 1 >= ask.length) {
      onComplete(true);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div>
      <p className="text-center text-sm text-[var(--dw-muted)]">
        แตะคำลำดับที่{" "}
        <span className="font-semibold text-white">#{ask[step] + 1}</span> เพื่อยืนยัน
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2.5">
        {options.map((w) => (
          <button
            key={w}
            onClick={() => choose(w)}
            className={`dw-glass rounded-xl px-4 py-3 font-medium transition active:scale-[0.98] ${
              wrong === w ? "border-[var(--dw-rose)] text-[var(--dw-rose)]" : "hover:bg-white/[0.07]"
            }`}
          >
            {w}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-1.5">
        {ask.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i <= step ? "w-6 bg-[var(--dw-cyan)]" : "w-2 bg-white/15"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
