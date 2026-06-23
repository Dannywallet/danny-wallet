"use client";

// ไอคอนเหรียญ — ใช้โลโก้จริงถ้ามี (จาก dandex), ไม่งั้น fallback เป็นวงกลมไล่เฉด + ตัวอักษร
import React from "react";

export function TokenIcon({
  symbol,
  gradient,
  size = 40,
  logo,
}: {
  symbol: string;
  gradient: [string, string];
  size?: number;
  logo?: string | null;
}) {
  const [failed, setFailed] = React.useState(false);
  const showLogo = logo && !failed;

  if (showLogo) {
    return (
      <img
        src={logo as string}
        alt={symbol}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size, background: "#0b1120" }}
      />
    );
  }

  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
        boxShadow: `0 6px 18px -6px ${gradient[0]}aa`,
      }}
    >
      {symbol.replace(/^d/, "").slice(0, 2).toUpperCase()}
    </span>
  );
}
