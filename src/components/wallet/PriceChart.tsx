"use client";

// กราฟราคา SVG (area) — วาดเองจากจุดราคา on-chain ในธีม neon
import React from "react";

export type ChartPoint = { t: number; p: number };

export function PriceChart({
  points,
  up = true,
  height = 150,
}: {
  points: ChartPoint[];
  up?: boolean;
  height?: number;
}) {
  const uid = React.useId();
  const gid = `pc-${uid}`;
  const W = 320;
  const H = height;
  const padX = 6;
  const padY = 12;

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center text-xs text-[var(--dw-muted)]" style={{ height: H }}>
        ข้อมูลกราฟไม่พอ
      </div>
    );
  }

  const ts = points.map((p) => p.t);
  const ps = points.map((p) => p.p);
  const tMin = Math.min(...ts), tMax = Math.max(...ts);
  const pMin = Math.min(...ps), pMax = Math.max(...ps);
  const tSpan = tMax - tMin || 1;
  const pSpan = pMax - pMin || pMax || 1;
  const w = W - padX * 2;
  const h = H - padY * 2;

  const xy = points.map((pt) => {
    const x = padX + ((pt.t - tMin) / tSpan) * w;
    const y = padY + h - ((pt.p - pMin) / pSpan) * h;
    return [x, y] as const;
  });
  const line = xy.map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ");
  const area = `${line} L${(padX + w).toFixed(1)},${(padY + h).toFixed(1)} L${padX.toFixed(1)},${(padY + h).toFixed(1)} Z`;
  const color = up ? "#34d399" : "#f43f5e";
  const lastX = xy[xy.length - 1][0];
  const lastY = xy[xy.length - 1][1];

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" fill="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="3.5" fill={color} />
      <circle cx={lastX} cy={lastY} r="6" fill={color} opacity="0.25" />
    </svg>
  );
}
