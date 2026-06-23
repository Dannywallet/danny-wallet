"use client";

import React from "react";
import Link from "next/link";
import { Screen } from "@/components/wallet/PhoneShell";
import { TopBar } from "@/components/wallet/TopBar";
import { BottomNav } from "@/components/wallet/BottomNav";
import { Check, Warn, ChevronRight } from "@/components/wallet/Icons";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="dw-glass relative rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span className="dw-btn-primary grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold">{n}</span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="mt-2 pl-10 text-sm leading-relaxed text-[var(--dw-muted)]">{children}</div>
    </div>
  );
}

export default function HowToListPage() {
  return (
    <>
      <TopBar title="วิธีลงลิสต์โทเคน" />
      <Screen className="space-y-3 pb-8">
        <p className="px-1 pt-1 text-sm text-[var(--dw-muted)]">
          กระเป๋านี้ดึงโทเคนจาก <span className="text-white">Danny Chain (5069)</span> โดยอัตโนมัติ —
          ทำตามขั้นตอนเพื่อให้โทเคนของคุณแสดงครบทั้งราคา กราฟ และโลโก้
        </p>

        <Step n={1} title="ให้ชื่อ/เหรียญขึ้น (ขั้นต่ำ)">
          Deploy สัญญา <span className="font-semibold text-white">ERC-20</span> บนเชน 5069 แล้วให้
          explorer (dannyscan) index — เหรียญจะโผล่ในหน้า “สำรวจโทเคนทั้งหมด” อัตโนมัติ พร้อมชื่อ สัญลักษณ์ holders และซัพพลาย
        </Step>

        <Step n={2} title="ให้มีราคา / กราฟ / วอลุ่ม">
          สร้าง <span className="font-semibold text-white">liquidity pool บน dandex</span> จับคู่กับ{" "}
          <span className="font-semibold text-white">WDAN</span> หรือ <span className="font-semibold text-white">USDT</span> —
          เมื่อมีสภาพคล่อง กระเป๋าจะแสดงราคา, %24ชม., วอลุ่ม และกราฟ on-chain ให้เอง
        </Step>

        <Step n={3} title="ให้มีโลโก้">
          เพิ่มโลโก้เข้า token list ของ dandex หรือ{" "}
          <Link href="/wallet/listing" className="font-semibold text-[var(--dw-cyan)]">ส่งคำขอลงลิสต์</Link>{" "}
          พร้อมไฟล์โลโก้ — ทีมงานจะเพิ่มให้ในแมปของกระเป๋า
        </Step>

        <div className="dw-glass rounded-2xl p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--dw-rose)]">
            <Warn size={15} /> โทเคนจะไม่แสดง ถ้า
          </h3>
          <ul className="space-y-1.5 text-sm text-[var(--dw-muted)]">
            <li>• ไม่ใช่มาตรฐาน ERC-20 (เช่น NFT/ERC-721)</li>
            <li>• ชื่อ/สัญลักษณ์เข้าข่าย LP token (มีคำว่า LP/liquidity)</li>
            <li>• อยู่ในรายการที่ถูกซ่อนโดยทีมงาน</li>
          </ul>
        </div>

        <div className="dw-glass rounded-2xl p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--dw-green)]">
            <Check size={15} /> เกณฑ์อนุมัติโลโก้/ลิสต์
          </h3>
          <ul className="space-y-1.5 text-sm text-[var(--dw-muted)]">
            <li>• สัญญายืนยัน (verified) บน dannyscan</li>
            <li>• มีสภาพคล่องจริงบน dandex</li>
            <li>• โลโก้จัตุรัส พื้นโปร่ง (PNG/SVG) ≤ 300KB</li>
            <li>• มีช่องทางติดต่อ/โซเชียลของโปรเจกต์</li>
          </ul>
        </div>

        <Link
          href="/wallet/listing"
          className="dw-btn-primary mt-1 flex w-full items-center justify-center gap-1.5 rounded-2xl py-4 font-semibold"
        >
          ส่งคำขอลงลิสต์โทเคน <ChevronRight size={16} />
        </Link>
      </Screen>
      <BottomNav />
    </>
  );
}
