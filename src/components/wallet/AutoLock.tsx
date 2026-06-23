"use client";

// ล็อกกระเป๋าอัตโนมัติเมื่อไม่มีการใช้งานครบเวลา (ตามค่า autoLockMin) — ทำงานจริง
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/wallet-store";

export function AutoLock() {
  const { created, locked, autoLockMin, lock } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!created || locked) return;

    const doLock = () => {
      lock();
      router.replace("/wallet/unlock");
    };

    // ออโต้ล็อกเมื่อไม่มีการใช้งานครบเวลา (ถ้าเปิดไว้)
    // เมื่อแอปอยู่พื้นหลังจะไม่มี activity → timer ครบ → ล็อกเอง
    const ms = autoLockMin > 0 ? autoLockMin * 60_000 : 0;
    if (!ms) return;
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(doLock, ms);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart", "visibilitychange"] as const;
    events.forEach((e) =>
      (e === "visibilitychange" ? document : window).addEventListener(e, reset, { passive: true })
    );
    reset();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) =>
        (e === "visibilitychange" ? document : window).removeEventListener(e, reset)
      );
    };
  }, [created, locked, autoLockMin, lock, router, pathname]);

  return null;
}
