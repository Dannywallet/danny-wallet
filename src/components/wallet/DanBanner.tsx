"use client";

// แบนเนอร์โปรโมชันบนหน้า home — โชว์รูปเหรียญ DAN (public/danny-mockup1.png) เข้าธีม neon
import React from "react";
import Link from "next/link";
import { ChevronRight } from "./Icons";

export function DanBanner() {
  return (
    <Link
      href="/wallet/asset/native"
      className="dw-glass-strong dw-glow-violet relative mt-5 block overflow-hidden rounded-[26px] p-5 transition active:scale-[0.99]"
    >
      {/* พื้นไล่เฉด + แสงทอง */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(110deg, rgba(124,58,237,0.28), rgba(34,211,238,0.10) 60%, transparent)" }}
      />
      <div
        className="pointer-events-none absolute -right-6 -top-10 h-44 w-44 rounded-full opacity-50 blur-2xl"
        style={{ background: "radial-gradient(circle, #f9bb4b, transparent 70%)" }}
      />

      <div className="relative flex items-center gap-3">
        {/* ข้อความซ้าย */}
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--dw-violet)]/25 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--dw-purple)]">
            ✦ DANNY CHAIN
          </span>
          <h3 className="mt-2 text-xl font-bold leading-snug">
            เหรียญ <span className="dw-text-grad">DAN</span>
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dw-muted)]">
            เหรียญหลักของเครือข่าย · ดูราคาและกราฟเรียลไทม์
          </p>
          <span className="dw-btn-primary mt-3 inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold">
            ดูรายละเอียด <ChevronRight size={14} />
          </span>
        </div>

        {/* รูปเหรียญ DAN — object-contain เห็นเต็มไม่โดนตัด, จำกัดกว้างไม่ให้เบียดข้อความ */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/danny-mockup1.png"
          alt="เหรียญ DAN"
          draggable={false}
          className="dw-float h-20 w-auto max-w-[38%] shrink-0 object-contain drop-shadow-[0_8px_22px_rgba(249,187,75,0.35)]"
        />
      </div>
    </Link>
  );
}
