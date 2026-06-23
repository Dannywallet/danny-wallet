"use client";

// กราฟแท่งเทียน (candlestick) — รวมจุดราคา on-chain เป็นแท่ง OHLC + แกนราคา/เวลา + แตะดู OHLC
// วาดด้วยพิกัดจริง (วัดความกว้าง container) เพื่อให้ตัวอักษรคมไม่ยืด
import React from "react";
import type { ChartPoint } from "./PriceChart";

type Candle = { o: number; h: number; l: number; c: number; t: number };

function fmtP(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p <= 0) return "0";
  const d = Math.min(8, Math.max(2, -Math.floor(Math.log10(p)) + 2));
  return p.toFixed(d);
}
function fmtTime(t: number): string {
  return new Date(t).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export function CandleChart({ points, height = 188 }: { points: ChartPoint[]; height?: number }) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const pressed = React.useRef(false);
  const [w, setW] = React.useState(320);
  const [sel, setSel] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center text-xs text-[var(--dw-muted)]" style={{ height }}>
        ข้อมูลกราฟไม่พอ
      </div>
    );
  }

  // จัดกลุ่มจุดเป็น N แท่ง (ถี่ขึ้น) คำนวณ OHLC + เวลากึ่งกลาง
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const N = Math.min(32, Math.max(10, Math.floor(sorted.length / 2)));
  const per = sorted.length / N;
  const candles: Candle[] = [];
  for (let i = 0; i < N; i++) {
    const start = Math.floor(i * per);
    const end = Math.max(Math.floor((i + 1) * per), start + 1);
    const seg = sorted.slice(start, end);
    if (!seg.length) continue;
    const ps = seg.map((s) => s.p);
    candles.push({
      o: seg[0].p,
      c: seg[seg.length - 1].p,
      h: Math.max(...ps),
      l: Math.min(...ps),
      t: seg[Math.floor(seg.length / 2)].t,
    });
  }

  const H = height;
  const padL = 6, padR = 52, padTop = 10, padBot = 18;
  const plotW = Math.max(40, w - padL - padR);
  const plotH = H - padTop - padBot;

  const pMax = Math.max(...candles.map((c) => c.h));
  const pMin = Math.min(...candles.map((c) => c.l));
  const span = pMax - pMin || pMax || 1;

  const slot = plotW / candles.length;
  const bw = Math.max(1.5, slot * 0.6);
  const x = (i: number) => padL + slot * (i + 0.5);
  const y = (p: number) => padTop + plotH - ((p - pMin) / span) * plotH;

  const green = "#34d399";
  const red = "#f43f5e";
  const grid = "rgba(255,255,255,0.06)";
  const axis = "rgba(160,172,205,0.65)";

  const levels = [0, 0.25, 0.5, 0.75, 1].map((f) => pMin + span * f);
  const activeIdx = sel != null && sel < candles.length ? sel : candles.length - 1;
  const sc = candles[activeIdx];
  const scUp = sc.c >= sc.o;

  // เส้นค่าเฉลี่ยเคลื่อนที่ (MA) ของราคาปิด
  const maPeriod = Math.min(7, Math.max(2, Math.floor(candles.length / 4)));
  const maPts: { x: number; y: number }[] = [];
  for (let i = maPeriod - 1; i < candles.length; i++) {
    let sum = 0;
    for (let k = 0; k < maPeriod; k++) sum += candles[i - k].c;
    maPts.push({ x: x(i), y: y(sum / maPeriod) });
  }
  const maPath = maPts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // เลือกแท่งจากพิกัด x (ใช้ทั้งแตะและลาก)
  const selectAt = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const idx = Math.round((clientX - rect.left - padL) / slot - 0.5);
    if (idx >= 0 && idx < candles.length) setSel(idx);
  };
  const onDown = (e: React.PointerEvent) => {
    pressed.current = true;
    try {
      wrapRef.current?.setPointerCapture?.(e.pointerId);
    } catch {
      /* บางเบราว์เซอร์/อีเวนต์สังเคราะห์ capture ไม่ได้ — ไม่เป็นไร */
    }
    selectAt(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => {
    if (pressed.current) selectAt(e.clientX);
  };
  const onUp = () => {
    pressed.current = false;
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full cursor-crosshair select-none touch-none"
      style={{ height: H }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <svg width={w} height={H} className="block">
        {/* เส้นกริด + ป้ายราคา (แกน Y ขวา) */}
        {levels.map((p, i) => {
          const yy = y(p);
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={padL + plotW} y2={yy} stroke={grid} strokeWidth="1" />
              <text x={padL + plotW + 4} y={yy + 3.5} fontSize="9" fill={axis}>${fmtP(p)}</text>
            </g>
          );
        })}

        {/* ป้ายเวลา (แกน X) — ซ้าย/กลาง/ขวา */}
        {[0, Math.floor(candles.length / 2), candles.length - 1].map((idx, k) => (
          <text
            key={k}
            x={Math.min(Math.max(x(idx), padL + 14), padL + plotW - 14)}
            y={H - 5}
            fontSize="9"
            fill={axis}
            textAnchor="middle"
          >
            {fmtTime(candles[idx].t)}
          </text>
        ))}

        {/* เส้นไฮไลต์แท่งที่เลือก */}
        <line x1={x(activeIdx)} y1={padTop} x2={x(activeIdx)} y2={padTop + plotH} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 3" />

        {/* แท่งเทียน */}
        {candles.map((c, i) => {
          const cx = x(i);
          const up = c.c >= c.o;
          const col = up ? green : red;
          const yo = y(c.o), yc = y(c.c);
          const top = Math.min(yo, yc);
          const bodyH = Math.max(1.2, Math.abs(yc - yo));
          return (
            <g key={i} opacity={i === activeIdx ? 1 : 0.92}>
              <line x1={cx} y1={y(c.h)} x2={cx} y2={y(c.l)} stroke={col} strokeWidth="1.2" />
              <rect x={cx - bw / 2} y={top} width={bw} height={bodyH} fill={col} rx="0.6" />
            </g>
          );
        })}

        {/* เส้นค่าเฉลี่ยเคลื่อนที่ (MA) */}
        {maPts.length > 1 && (
          <path d={maPath} fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" opacity="0.95" />
        )}
      </svg>

      {/* legend MA */}
      <div className="pointer-events-none absolute right-1 top-1.5 flex items-center gap-1 text-[9px] text-[var(--dw-muted)]">
        <span className="inline-block h-[2px] w-3 rounded" style={{ background: "#fbbf24" }} /> MA{maPeriod}
      </div>

      {/* กล่อง OHLC ของแท่งที่เลือก */}
      <div className="pointer-events-none absolute left-2 top-1.5 flex flex-wrap items-center gap-x-2 gap-y-0 rounded-lg bg-black/35 px-2 py-1 text-[10px] backdrop-blur-sm">
        <span className="text-[var(--dw-muted)]">{fmtTime(sc.t)}</span>
        <span className="text-[var(--dw-muted)]">O <b className="text-white">{fmtP(sc.o)}</b></span>
        <span className="text-[var(--dw-muted)]">H <b className="text-[var(--dw-green)]">{fmtP(sc.h)}</b></span>
        <span className="text-[var(--dw-muted)]">L <b className="text-[var(--dw-rose)]">{fmtP(sc.l)}</b></span>
        <span className="text-[var(--dw-muted)]">C <b style={{ color: scUp ? green : red }}>{fmtP(sc.c)}</b></span>
      </div>
    </div>
  );
}
