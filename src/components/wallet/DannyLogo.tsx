// โลโก้ DX (dandex) — ใช้ไฟล์ภาพจริง /public/logo.png แสดงแบบ object-contain (เห็นเต็มวง ไม่โดนตัด)
import React from "react";

export function DannyLogo({ size = 96 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="Danny Wallet"
      draggable={false}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}
