// QR แบบเดโม — สร้าง matrix จากแฮชของข้อความ (ไม่ใช่ QR มาตรฐานสำหรับสแกนจริง)
import React from "react";

function hashAt(seed: string, i: number): number {
  let h = 2166136261 ^ i;
  for (let k = 0; k < seed.length; k++) {
    h ^= seed.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}

const FINDER = 7;

function isFinder(x: number, y: number, n: number): boolean | null {
  const inBox = (ox: number, oy: number) =>
    x >= ox && x < ox + FINDER && y >= oy && y < oy + FINDER;
  const boxes = [
    [0, 0],
    [n - FINDER, 0],
    [0, n - FINDER],
  ];
  for (const [ox, oy] of boxes) {
    if (inBox(ox, oy)) {
      const lx = x - ox;
      const ly = y - oy;
      const edge = lx === 0 || ly === 0 || lx === FINDER - 1 || ly === FINDER - 1;
      const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
      return edge || core;
    }
  }
  return null;
}

export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const n = 29;
  const cell = size / n;
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const f = isFinder(x, y, n);
      const on = f !== null ? f : hashAt(value, y * n + x) < 48;
      if (on) {
        rects.push(
          <rect
            key={`${x}-${y}`}
            x={x * cell}
            y={y * cell}
            width={cell + 0.5}
            height={cell + 0.5}
            rx={cell * 0.18}
            fill="url(#qrgrad)"
          />
        );
      }
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="qrgrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0b1120" />
          <stop offset="100%" stopColor="#16213a" />
        </linearGradient>
      </defs>
      <rect width={size} height={size} rx={size * 0.06} fill="#fff" />
      {rects}
    </svg>
  );
}
