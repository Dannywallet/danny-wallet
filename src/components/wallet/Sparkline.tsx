// กราฟราคา SVG เบา ๆ (sparkline หรือ area chart)
import React from "react";

export function Sparkline({
  data,
  width = 100,
  height = 32,
  up = true,
  area = false,
  id,
}: {
  data: number[];
  width?: number;
  height?: number;
  up?: boolean;
  area?: boolean;
  id?: string;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((v - min) / span) * h;
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const color = up ? "#34d399" : "#f43f5e";
  const gid = id ?? `spark-${up ? "u" : "d"}-${data.length}`;
  const areaPath = `${line} L${pad + w},${pad + h} L${pad},${pad + h} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={areaPath} fill={`url(#${gid})`} />}
      <path d={line} stroke={color} strokeWidth={area ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
