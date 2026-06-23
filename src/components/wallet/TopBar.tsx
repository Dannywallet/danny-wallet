"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "./Icons";

export function TopBar({
  title,
  right,
  onBack,
}: {
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  return (
    <div className="relative z-10 flex items-center justify-between px-4 pb-1 pt-5">
      <button
        onClick={() => (onBack ? onBack() : router.back())}
        className="dw-btn-ghost grid h-9 w-9 place-items-center rounded-full"
        aria-label="ย้อนกลับ"
      >
        <ChevronLeft size={20} />
      </button>
      {title && <h1 className="text-base font-semibold">{title}</h1>}
      <div className="flex h-9 min-w-9 items-center justify-end">{right}</div>
    </div>
  );
}
