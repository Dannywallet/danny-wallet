"use client";

// Bottom sheet แบบใช้ซ้ำได้ (สำหรับ settings: เลือกออโต้ล็อก, สมุดที่อยู่, เกี่ยวกับ)
import React from "react";

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        aria-label="ปิด"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      <div
        className="dw-glass-strong relative max-h-[80%] overflow-y-auto rounded-t-[28px] border-t border-white/10 p-5 pb-7"
        style={{ background: "rgba(11,17,32,0.96)", animation: "dw-rise 0.28s ease both" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="dw-btn-ghost grid h-8 w-8 place-items-center rounded-full text-[var(--dw-muted)]">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
