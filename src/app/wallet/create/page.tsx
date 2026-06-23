"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/wallet-store";
import { Screen } from "@/components/wallet/PhoneShell";
import { TopBar } from "@/components/wallet/TopBar";
import { SeedPhraseGrid, SeedConfirm } from "@/components/wallet/SeedPhraseGrid";
import { PinPad, PinDots } from "@/components/wallet/PinPad";
import { copyEphemeral } from "@/lib/wallet/clipboard";
import { Wallet } from "ethers";
import { Shield, Warn, Copy, Check, EyeOff } from "@/components/wallet/Icons";

type Step = "warn" | "seed" | "confirm" | "pin";

export default function CreateWallet() {
  const router = useRouter();
  const { createWallet } = useWallet();
  const [step, setStep] = React.useState<Step>("warn");
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // สร้าง seed จริงด้วย CSPRNG (ครั้งเดียวต่อการเข้าหน้า)
  const walletRef = React.useRef(Wallet.createRandom());
  const SEED = React.useMemo(
    () => walletRef.current.mnemonic!.phrase.split(" "),
    []
  );

  // pin
  const [pin, setPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");
  const [pinPhase, setPinPhase] = React.useState<"set" | "repeat">("set");
  const [pinErr, setPinErr] = React.useState(false);

  const copySeed = async () => {
    // คัดลอกแล้วล้าง clipboard อัตโนมัติใน 30 วิ (กันค้างใน clipboard)
    await copyEphemeral(SEED.join(" "), 30_000);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const finishCreate = async (finalPin: string) => {
    setBusy(true);
    try {
      await createWallet(finalPin, walletRef.current.mnemonic!.phrase, walletRef.current.address);
      router.replace("/wallet/home");
    } finally {
      setBusy(false);
    }
  };

  const onKey = (d: string) => {
    if (busy) return;
    if (pinPhase === "set") {
      if (pin.length >= 6) return;
      const next = pin + d;
      setPin(next);
      if (next.length === 6) setTimeout(() => setPinPhase("repeat"), 150);
    } else {
      if (confirmPin.length >= 6) return;
      const next = confirmPin + d;
      setConfirmPin(next);
      if (next.length === 6) {
        if (next === pin) {
          void finishCreate(next);
        } else {
          setPinErr(true);
          setTimeout(() => {
            setPinErr(false);
            setConfirmPin("");
            setPin("");
            setPinPhase("set");
          }, 700);
        }
      }
    }
  };
  const onDel = () =>
    pinPhase === "set"
      ? setPin((p) => p.slice(0, -1))
      : setConfirmPin((p) => p.slice(0, -1));

  return (
    <>
      <TopBar
        title="สร้างกระเป๋าใหม่"
        onBack={() => {
          if (step === "seed") setStep("warn");
          else if (step === "confirm") setStep("seed");
          else if (step === "pin") setStep("confirm");
          else router.back();
        }}
      />
      <Screen>
        {/* stepper */}
        <div className="mb-5 flex items-center gap-1.5">
          {(["warn", "seed", "confirm", "pin"] as Step[]).map((s, i) => {
            const order = ["warn", "seed", "confirm", "pin"];
            const active = order.indexOf(step) >= i;
            return (
              <span
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  active ? "bg-gradient-to-r from-[var(--dw-violet)] to-[var(--dw-cyan)]" : "bg-white/12"
                }`}
              />
            );
          })}
        </div>

        {step === "warn" && (
          <div className="dw-rise flex flex-col">
            <div className="dw-glass rounded-2xl border-[var(--dw-amber)]/30 bg-[var(--dw-amber)]/[0.06] p-5">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--dw-amber)]/15 text-[var(--dw-amber)]">
                <Warn size={24} />
              </span>
              <h2 className="mt-4 text-lg font-semibold">เก็บวลีกู้คืนให้ปลอดภัย</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--dw-muted)]">
                วลี 12 คำคือกุญแจเดียวสู่กระเป๋าของคุณ จดลงกระดาษและเก็บออฟไลน์
                อย่าแชร์กับใคร อย่าถ่ายรูป และอย่ากรอกในเว็บที่ไม่รู้จัก
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {["ทีมงานจะไม่ขอวลีนี้เด็ดขาด", "ถ้าทำหาย จะกู้กระเป๋าไม่ได้", "ใครมีวลีนี้ = ควบคุมเงินได้"].map(
                  (t) => (
                    <li key={t} className="flex items-start gap-2 text-[var(--dw-muted)]">
                      <Shield size={16} className="mt-0.5 text-[var(--dw-green)]" /> {t}
                    </li>
                  )
                )}
              </ul>
            </div>
            <button
              onClick={() => setStep("seed")}
              className="dw-btn-primary mt-5 rounded-2xl py-4 font-semibold"
            >
              เข้าใจแล้ว แสดงวลี
            </button>
          </div>
        )}

        {step === "seed" && (
          <div className="dw-rise">
            <p className="text-sm text-[var(--dw-muted)]">
              จดวลี 12 คำตามลำดับ แล้วกดถัดไปเพื่อยืนยัน
            </p>
            <div className="relative mt-4">
              <SeedPhraseGrid words={SEED} />
              {!revealed && (
                <button
                  onClick={() => setRevealed(true)}
                  className="dw-glass-strong absolute inset-0 grid place-items-center rounded-2xl backdrop-blur-md"
                >
                  <span className="flex flex-col items-center gap-2 text-sm text-[var(--dw-muted)]">
                    <EyeOff size={26} /> แตะเพื่อแสดงวลี
                  </span>
                </button>
              )}
            </div>
            <button
              onClick={copySeed}
              className="dw-btn-ghost mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "คัดลอกแล้ว" : "คัดลอกวลี"}
            </button>
            <button
              onClick={() => setStep("confirm")}
              disabled={!revealed}
              className="dw-btn-primary mt-4 w-full rounded-2xl py-4 font-semibold"
            >
              ฉันจดไว้แล้ว ถัดไป
            </button>
          </div>
        )}

        {step === "confirm" && (
          <div className="dw-rise">
            <h2 className="text-lg font-semibold">ยืนยันวลีกู้คืน</h2>
            <p className="mb-5 mt-1 text-sm text-[var(--dw-muted)]">
              เลือกคำให้ถูกต้องเพื่อยืนยันว่าคุณบันทึกไว้แล้ว
            </p>
            <SeedConfirm
              words={SEED}
              ask={[2, 5, 8]}
              onComplete={() => setStep("pin")}
            />
          </div>
        )}

        {step === "pin" && (
          <div className="dw-rise flex flex-col items-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--dw-violet)]/15 text-[var(--dw-purple)]">
              <Shield size={26} />
            </span>
            <h2 className="mt-4 text-lg font-semibold">
              {pinPhase === "set" ? "ตั้งรหัส PIN 6 หลัก" : "ยืนยันรหัส PIN อีกครั้ง"}
            </h2>
            <p className="mt-1 text-sm text-[var(--dw-muted)]">
              ใช้ปลดล็อกกระเป๋าทุกครั้งที่เปิดแอป
            </p>
            <div className="my-7">
              <PinDots
                length={6}
                filled={(pinPhase === "set" ? pin : confirmPin).length}
                error={pinErr}
              />
              {pinErr && (
                <p className="mt-3 text-center text-sm text-[var(--dw-rose)]">
                  PIN ไม่ตรงกัน ลองใหม่
                </p>
              )}
            </div>
            <div className="w-full max-w-[280px]">
              <PinPad onKey={onKey} onDelete={onDel} />
            </div>
          </div>
        )}
      </Screen>
    </>
  );
}
