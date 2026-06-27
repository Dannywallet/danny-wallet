"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/wallet-store";
import { Screen } from "@/components/wallet/PhoneShell";
import { PinPad, PinDots } from "@/components/wallet/PinPad";
import { DannyLogo } from "@/components/wallet/DannyLogo";
import { Shield, Warn } from "@/components/wallet/Icons";
import { useI18n } from "@/lib/wallet/i18n";

const MAX_ATTEMPTS = 10;

export default function Unlock() {
  const router = useRouter();
  const { t } = useI18n();
  const { hydrated, created, unlock, failedAttempts, lockedUntil } = useWallet();
  const [pin, setPin] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0); // วินาทีที่เหลือ

  React.useEffect(() => {
    if (hydrated && !created) router.replace("/wallet");
  }, [hydrated, created, router]);

  // นับถอยหลัง cooldown
  React.useEffect(() => {
    const remain = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
    setCooldown(remain);
    if (remain <= 0) return;
    const id = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const tryUnlock = async (code: string) => {
    if (busy || cooldown > 0) return;
    setBusy(true);
    let res: { ok: boolean; wiped?: boolean; cooldownMs?: number };
    try {
      res = await unlock(code);
    } catch (e) {
      setBusy(false);
      setPin("");
      setErr(t("unlock.error"));
      setTimeout(() => setErr(null), 1500);
      return;
    }
    setBusy(false);
    if (res.ok) {
      router.replace("/wallet/home");
      return;
    }
    setPin("");
    if (res.wiped) {
      setErr(t("unlock.wiped"));
      setTimeout(() => router.replace("/wallet"), 1800);
      return;
    }
    if (res.cooldownMs && res.cooldownMs > 0) {
      setCooldown(Math.ceil(res.cooldownMs / 1000));
      setErr(t("unlock.cooldownMsg"));
    } else {
      setErr(t("tx.pinWrong"));
    }
    setTimeout(() => setErr(null), 1500);
  };

  const onKey = (d: string) => {
    if (pin.length >= 6 || busy || cooldown > 0) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) void tryUnlock(next);
  };

  const attemptsLeft = MAX_ATTEMPTS - failedAttempts;

  return (
    <Screen className="flex flex-col items-center justify-center">
      <div className="dw-float relative mb-6 lg:hidden">
        <DannyLogo size={88} />
      </div>
      <h1 className="text-xl font-semibold">{t("unlock.welcomeBack")}</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--dw-muted)]">
        <Shield size={14} className="text-[var(--dw-green)]" /> {t("unlock.enterPinToUnlock")}
      </p>

      <div className="my-8">
        <PinDots length={6} filled={pin.length} error={!!err} />
        {err && (
          <p className="mt-3 max-w-[260px] text-center text-sm text-[var(--dw-rose)]">{err}</p>
        )}
        {cooldown > 0 && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-[var(--dw-amber)]">
            <Warn size={13} /> {t("unlock.waitPre")} {cooldown} {t("unlock.waitSuf")}
          </p>
        )}
        {failedAttempts >= 3 && cooldown === 0 && attemptsLeft > 0 && (
          <p className="mt-2 text-center text-[11px] text-[var(--dw-muted)]">
            {t("unlock.attemptsPre")} {attemptsLeft} {t("unlock.attemptsSuf")}
          </p>
        )}
      </div>

      <div className={`w-full max-w-[280px] ${cooldown > 0 || busy ? "pointer-events-none opacity-50" : ""}`}>
        <PinPad onKey={onKey} onDelete={() => setPin((p) => p.slice(0, -1))} />
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-[11px] text-[var(--dw-muted)]">
        <Shield size={12} /> {t("unlock.seedNote")}
      </p>
    </Screen>
  );
}
