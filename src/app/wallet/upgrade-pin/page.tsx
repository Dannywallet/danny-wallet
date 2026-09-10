"use client";

// หน้าบังคับตั้งรหัสใหม่ — แสดงเมื่อผู้ใช้ปลดล็อกด้วยรหัสที่อ่อนเกินนโยบาย (เช่น PIN 6 หลักแบบเดิม)
// ตั้งใจให้ "ออกไม่ได้" จนกว่าจะตั้งรหัสใหม่ เพราะรหัส 6 หลักถูกไล่ครบได้ในเวลาไม่กี่นาที
//
// หมายเหตุด้านความปลอดภัย: ต้องให้กรอกรหัสเดิมซ้ำ ไม่ส่งต่อมาจากหน้า unlock
// เพราะการเก็บรหัสไว้ใน state ข้ามหน้า/ใน URL เพิ่มพื้นที่รั่วไหลโดยไม่จำเป็น

import React from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/wallet-store";
import { Screen } from "@/components/wallet/PhoneShell";
import { Shield, Warn } from "@/components/wallet/Icons";
import { useI18n } from "@/lib/wallet/i18n";
import {
  SecretInput,
  SecretModeTabs,
  SecretPolicyHint,
  fillN,
  type SecretMode,
} from "@/components/wallet/SecretInput";
import { validateSecret, MIN_PIN_LEN, MIN_PASSPHRASE_LEN } from "@/lib/wallet/crypto";

export default function UpgradePin() {
  const router = useRouter();
  const { t } = useI18n();
  const { hydrated, created, locked, changePin } = useWallet();

  const [mode, setMode] = React.useState<SecretMode>("text");
  const [oldSecret, setOldSecret] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!created) router.replace("/wallet");
    else if (locked) router.replace("/wallet/unlock");
  }, [hydrated, created, locked, router]);

  const policy = validateSecret(next);
  const matches = next.length > 0 && next === confirm;
  const ready = oldSecret.length > 0 && policy.ok && matches && !busy;

  const submit = async () => {
    if (!ready) return;
    setErr(null);
    setBusy(true);
    try {
      const ok = await changePin(oldSecret, next);
      if (!ok) {
        setErr(t("tx.pinWrong"));
        setOldSecret("");
        return;
      }
      router.replace("/wallet/home");
    } catch {
      setErr(t("unlock.error"));
    } finally {
      setBusy(false);
    }
  };

  const hintTexts = {
    pinTooShort: t("sec.pinTooShort"),
    textTooShort: t("sec.textTooShort"),
    ok: t("sec.lengthOk"),
    digitsOnly: t("sec.digitsOnlyHint"),
  };

  return (
    <Screen className="flex flex-col justify-center px-5">
      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--dw-amber)]/15">
          <Warn size={22} className="text-[var(--dw-amber)]" />
        </div>
        <h1 className="text-xl font-semibold">{t("sec.upgradeTitle")}</h1>
        <p className="mt-2 text-sm text-[var(--dw-muted)]">{t("sec.upgradeDesc")}</p>
      </div>

      <SecretModeTabs
        mode={mode}
        onMode={(m) => {
          setMode(m);
          setNext("");
          setConfirm("");
        }}
        labels={{
          pin: fillN(t("sec.modePin"), MIN_PIN_LEN),
          text: fillN(t("sec.modeText"), MIN_PASSPHRASE_LEN),
        }}
      />

      <label className="mb-1 block text-xs text-[var(--dw-muted)]">{t("sec.oldSecret")}</label>
      <SecretInput
        value={oldSecret}
        onChange={setOldSecret}
        mode="text"
        placeholder={t("tx.enterPin")}
        autoFocus
        disabled={busy}
      />

      <label className="mb-1 mt-4 block text-xs text-[var(--dw-muted)]">{t("sec.newSecret")}</label>
      <SecretInput
        value={next}
        onChange={setNext}
        mode={mode}
        placeholder={
          mode === "pin"
            ? fillN(t("sec.phPin"), MIN_PIN_LEN)
            : fillN(t("sec.phText"), MIN_PASSPHRASE_LEN)
        }
        disabled={busy}
      />
      <SecretPolicyHint value={next} mode={mode} texts={hintTexts} />

      <label className="mb-1 mt-4 block text-xs text-[var(--dw-muted)]">
        {t("sec.confirmSecret")}
      </label>
      <SecretInput
        value={confirm}
        onChange={setConfirm}
        onSubmit={submit}
        mode={mode}
        placeholder={t("sec.retype")}
        disabled={busy}
      />
      {confirm.length > 0 && !matches && (
        <p className="mt-2 text-center text-xs text-[var(--dw-rose)]">{t("sec.mismatch")}</p>
      )}

      {err && (
        <p className="mt-3 flex items-center justify-center gap-1 text-sm text-[var(--dw-rose)]">
          <Warn size={13} /> {err}
        </p>
      )}

      <button
        onClick={submit}
        disabled={!ready}
        className="dw-btn-primary mt-6 w-full rounded-2xl py-3.5 font-semibold disabled:opacity-50"
      >
        {busy ? "…" : t("sec.setNew")}
      </button>

      <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--dw-muted)]">
        <Shield size={12} className="mt-0.5 shrink-0" />
        {t("sec.seedUnchanged")}
      </p>
    </Screen>
  );
}
