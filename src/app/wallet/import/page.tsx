"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useWallet, deriveAddress } from "@/lib/wallet/wallet-store";
import { scanUsedAccounts } from "@/lib/wallet/account-scan";
import { Screen } from "@/components/wallet/PhoneShell";
import { TopBar } from "@/components/wallet/TopBar";
import {
  SecretInput,
  SecretModeTabs,
  SecretPolicyHint,
  fillN,
  type SecretMode,
} from "@/components/wallet/SecretInput";
import { validateSecret, MIN_PIN_LEN, MIN_PASSPHRASE_LEN } from "@/lib/wallet/crypto";
import { SeedImportGrid } from "@/components/wallet/SeedImportGrid";
import { WORDLIST } from "@/lib/wallet/wordlist";
import { Mnemonic, Wallet } from "ethers";
import { Warn, Check } from "@/components/wallet/Icons";
import { shortAddress } from "@/lib/wallet/format";
import { useI18n } from "@/lib/wallet/i18n";

const SET = new Set(WORDLIST);

export default function ImportWallet() {
  const router = useRouter();
  const { t: tr } = useI18n();
  const { createWallet, createWalletFromKey, addDerivedAccounts } = useWallet();
  const [scanning, setScanning] = React.useState(false); // กำลังค้นหาบัญชีลูกที่เคยใช้งาน
  const [tab, setTab] = React.useState<"seed" | "key">("seed");
  const [count, setCount] = React.useState<12 | 24>(12);
  const [words, setWords] = React.useState<string[]>(Array(12).fill(""));
  const [pk, setPk] = React.useState("");
  const [mode, setMode] = React.useState<"input" | "pin">("input");
  const [pin, setPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");
  const [secretMode, setSecretMode] = React.useState<SecretMode>("text");
  const secretReady = validateSecret(pin).ok && pin === confirmPin && confirmPin.length > 0;
  const [busy, setBusy] = React.useState(false);
  const [importErr, setImportErr] = React.useState(false);

  const setCountAndResize = (c: 12 | 24) => {
    setCount(c);
    setWords((prev) => {
      const next = Array(c).fill("");
      for (let i = 0; i < Math.min(c, prev.length); i++) next[i] = prev[i];
      return next;
    });
  };

  const filled = words.filter((w) => w.trim()).length;
  const phrase = words.join(" ").trim();
  const allWords = filled === count && words.every((w) => SET.has(w));
  const allValid = allWords && Mnemonic.isValidMnemonic(phrase);

  // ตรวจ private key (64 hex) → คำนวณที่อยู่
  const pkHex = pk.trim().replace(/^0x/i, "");
  const pkLooksValid = /^[0-9a-fA-F]{64}$/.test(pkHex);
  let pkAddress: string | null = null;
  if (pkLooksValid) {
    try {
      pkAddress = new Wallet("0x" + pkHex).address;
    } catch {
      /* invalid */
    }
  }
  const pkValid = !!pkAddress;
  const canNext = tab === "seed" ? allValid : pkValid;

  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").trim();
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 11) {
      e.preventDefault();
      const c: 12 | 24 = parts.length > 12 ? 24 : 12;
      setCount(c);
      const next = Array(c).fill("");
      for (let i = 0; i < Math.min(c, parts.length); i++)
        next[i] = parts[i].replace(/[^a-zA-Z]/g, "").toLowerCase();
      setWords(next);
    }
  };

  /** สร้างกระเป๋าด้วยรหัสที่ผู้ใช้ตั้ง — เรียกเมื่อผ่านนโยบายและยืนยันตรงกันแล้ว */
  const finish = async (secret: string) => {
    if (busy) return;
    setBusy(true);
    try {
      if (tab === "seed") {
        const w = Wallet.fromPhrase(phrase); // throw ถ้า checksum ผิด
        await createWallet(secret, phrase, w.address);
        // กู้บัญชีลูกที่เคยใช้งานกลับมาด้วย — วลีเดิม derive ได้ที่อยู่เดิมเสมอ
        // ถ้า explorer/RPC มีปัญหาก็แค่ข้ามไป ผู้ใช้ยังกด "เพิ่มบัญชี (จาก seed)" เองได้เหมือนเดิม
        try {
          setScanning(true);
          const found = await scanUsedAccounts((i) => deriveAddress(phrase, i), { timeoutMs: 12_000 });
          if (found.indexes.length > 0) addDerivedAccounts(phrase, found.indexes);
        } catch {
          /* ไม่ให้การสแกนขวางการ import */
        } finally {
          setScanning(false);
        }
      } else {
        const w = new Wallet("0x" + pkHex); // throw ถ้า key ผิด
        await createWalletFromKey(secret, w.privateKey, w.address);
      }
      router.replace("/wallet/home");
    } catch {
      setImportErr(true);
      setPin("");
      setConfirmPin("");
      setMode("input");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar
        title={tr("import.title")}
        onBack={() => (mode === "pin" ? setMode("input") : router.back())}
      />
      <Screen>
        {mode === "input" ? (
          <div className="dw-rise" onPaste={tab === "seed" ? onPaste : undefined}>
            <div className="dw-glass mb-4 flex items-start gap-2.5 rounded-2xl border-[var(--dw-amber)]/30 bg-[var(--dw-amber)]/[0.06] p-3.5 text-sm text-[var(--dw-muted)]">
              <Warn size={18} className="mt-0.5 shrink-0 text-[var(--dw-amber)]" />
              {tr("import.trustNote")}
            </div>

            {/* สลับ วลีกู้คืน / Private Key */}
            <div className="dw-glass mb-4 flex gap-1 rounded-2xl p-1">
              {(["seed", "key"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setImportErr(false); }}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
                    tab === t ? "dw-btn-primary" : "text-[var(--dw-muted)]"
                  }`}
                >
                  {t === "seed" ? tr("settings.recovery") : "Private Key"}
                </button>
              ))}
            </div>

            {tab === "seed" ? (
              <>
                {/* สลับ 12 / 24 คำ */}
                <div className="dw-glass mb-4 flex gap-1 rounded-2xl p-1">
                  {([12, 24] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCountAndResize(c)}
                      className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
                        count === c ? "dw-btn-primary" : "text-[var(--dw-muted)]"
                      }`}
                    >
                      {c} {tr("import.wordsSuffix")}
                    </button>
                  ))}
                </div>

                <SeedImportGrid count={count} words={words} onChange={setWords} />

                <div className="mt-3 flex items-center justify-between text-xs text-[var(--dw-muted)]">
                  <span>{tr("import.filledPre")} {filled}/{count} {tr("import.wordsSuffix")}</span>
                  {allValid ? (
                    <span className="flex items-center gap-1 text-[var(--dw-green)]">
                      <Check size={14} /> {tr("import.seedValid")}
                    </span>
                  ) : allWords ? (
                    <span className="flex items-center gap-1 text-[var(--dw-rose)]">
                      <Warn size={13} /> {tr("import.checksumFail")}
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <textarea
                  value={pk}
                  onChange={(e) => { setPk(e.target.value); setImportErr(false); }}
                  rows={3}
                  placeholder={tr("import.pkPlaceholder")}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="dw-glass w-full resize-none rounded-2xl px-4 py-3 font-mono text-sm outline-none placeholder:text-[var(--dw-muted)] focus:border-[var(--dw-cyan)]/50"
                  style={{ color: "var(--dw-text)" }}
                />
                <div className="mt-2 flex items-center justify-between px-1 text-xs">
                  <span className="text-[var(--dw-muted)]">{tr("import.noSeedNote")}</span>
                  {pk.trim() &&
                    (pkValid ? (
                      <span className="flex items-center gap-1 text-[var(--dw-green)]">
                        <Check size={13} /> {pkAddress ? shortAddress(pkAddress) : ""}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[var(--dw-rose)]">
                        <Warn size={13} /> {tr("import.keyInvalid")}
                      </span>
                    ))}
                </div>
              </>
            )}

            {importErr && (
              <p className="mt-2 flex items-center gap-1 text-xs text-[var(--dw-rose)]">
                <Warn size={13} /> {tab === "seed" ? tr("import.seedInvalid") : tr("import.pkInvalid")}
              </p>
            )}

            <button
              onClick={() => { setImportErr(false); setMode("pin"); }}
              disabled={!canNext}
              className="dw-btn-primary mt-4 w-full rounded-2xl py-4 font-semibold"
            >
              {tr("import.nextSetPin")}
            </button>
            <p className="mt-3 text-center text-[11px] text-[var(--dw-muted)]">
              {tab === "seed" ? tr("import.seedHint") : tr("import.pkHint")}
            </p>
          </div>
        ) : (
          <div className="dw-rise flex flex-col items-center pt-6">
            <h2 className="text-lg font-semibold">{tr("create.setPin")}</h2>
            <p className="mt-1 text-sm text-[var(--dw-muted)]">{tr("import.pinDesc2")}</p>
            <div className="mt-6 w-full max-w-[300px]">
              <SecretModeTabs
                mode={secretMode}
                onMode={(m) => {
                  setSecretMode(m);
                  setPin("");
                  setConfirmPin("");
                }}
                labels={{ pin: fillN(tr("sec.modePin"), MIN_PIN_LEN), text: fillN(tr("sec.modeText"), MIN_PASSPHRASE_LEN) }}
              />
              <SecretInput
                value={pin}
                onChange={setPin}
                mode={secretMode}
                placeholder={
                  secretMode === "pin" ? fillN(tr("sec.phPin"), MIN_PIN_LEN) : fillN(tr("sec.phText"), MIN_PASSPHRASE_LEN)
                }
                autoFocus
                disabled={busy}
              />
              <SecretPolicyHint
                value={pin}
                mode={secretMode}
                texts={{ pinTooShort: tr("sec.pinTooShort"), textTooShort: tr("sec.textTooShort"), ok: tr("sec.lengthOk"), digitsOnly: tr("sec.digitsOnlyHint") }}
              />
              <label className="mb-1 mt-4 block text-xs text-[var(--dw-muted)]">
                {tr("create.confirmPinAgain")}
              </label>
              <SecretInput
                value={confirmPin}
                onChange={setConfirmPin}
                onSubmit={() => secretReady && void finish(pin)}
                mode={secretMode}
                placeholder={tr("sec.retype")}
                disabled={busy}
              />
              {confirmPin.length > 0 && confirmPin !== pin && (
                <p className="mt-2 text-center text-xs text-[var(--dw-rose)]">
                  {tr("create.pinMismatch")}
                </p>
              )}
              <button
                onClick={() => void finish(pin)}
                disabled={!secretReady}
                className="dw-btn-primary mt-6 w-full rounded-2xl py-3.5 font-semibold disabled:opacity-50"
              >
                {busy ? (scanning ? tr("import.scanning") : "…") : tr("common.confirm")}
              </button>
            </div>
          </div>
        )}
      </Screen>
    </>
  );
}
