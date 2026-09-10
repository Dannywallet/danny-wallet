"use client";

// ช่องกรอก "รหัสปลดล็อก" ที่รองรับทั้ง PIN ตัวเลขและรหัสผสม
// เขียนเป็น component กลางเพื่อไม่ให้แต่ละหน้าหลุดนโยบายกันเอง —
// เดิมโค้ด hardcode เลข 6 กระจายอยู่ 12 ไฟล์ ซึ่งเป็นต้นเหตุที่แก้ตกหล่นได้ง่าย

import React from "react";
import { PinPad } from "./PinPad";
import { Eye, EyeOff } from "./Icons";
import { useI18n } from "@/lib/wallet/i18n";
import { validateSecret, MIN_PIN_LEN, MIN_PASSPHRASE_LEN } from "@/lib/wallet/crypto";

/** แทน {n} ในสตริงแปลด้วยตัวเลขจริง */
export const fillN = (s: string, n: number) => s.replace("{n}", String(n));

export type SecretMode = "pin" | "text";

// ตัวที่พิมพ์คง 16px (text-base) — ต่ำกว่านี้ Safari บน iOS จะซูมหน้าจอเองตอนโฟกัสช่อง input
// ส่วน placeholder เป็นข้อความอธิบายยาว ย่อเหลือ 13px ให้พออ่านโดยไม่ล้นกรอบ
const INPUT_CLASS =
  "dw-glass w-full rounded-2xl py-3 pl-11 pr-11 text-center text-base outline-none " +
  "placeholder:text-[13px] placeholder:font-normal focus:border-[var(--dw-cyan)]/50";

/** แถบสลับโหมด PIN ตัวเลข ↔ รหัสผสม */
export function SecretModeTabs({
  mode,
  onMode,
  labels,
}: {
  mode: SecretMode;
  onMode: (m: SecretMode) => void;
  labels: { pin: string; text: string };
}) {
  return (
    // ใช้ dw-btn-primary กับแท็บที่เลือก ให้ตรงกับแท็บอื่นในแอป (หน้า import ใช้แบบเดียวกัน)
    // เดิมใช้พื้นหลัง cyan 20% ซึ่งจางจนแยกไม่ออกว่าอยู่แท็บไหน
    <div className="dw-glass mb-4 flex gap-1 rounded-2xl p-1">
      {(["pin", "text"] as SecretMode[]).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => onMode(m)}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
            mode === m ? "dw-btn-primary" : "text-[var(--dw-muted)] hover:text-[var(--dw-text)]"
          }`}
        >
          {labels[m]}
        </button>
      ))}
    </div>
  );
}

/**
 * ช่องกรอกรหัส — ใช้ได้ทั้งตอนปลดล็อก/เซ็น (ไม่ตรวจนโยบาย) และตอนตั้งรหัสใหม่ (ตรวจนโยบาย)
 * ตั้ง showKeypad=true เพื่อโชว์แป้นตัวเลขเมื่ออยู่โหมด PIN (สะดวกบนมือถือ)
 */
export function SecretInput({
  value,
  onChange,
  onSubmit,
  mode = "text",
  showKeypad = false,
  placeholder,
  autoFocus,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  mode?: SecretMode;
  showKeypad?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  // โหมด pin = รับเฉพาะตัวเลข (ผู้ใช้เลือกเอง) · โหมด text = รับทุกอย่าง ไม่จำกัดความยาว
  const handle = (raw: string) => onChange(mode === "pin" ? raw.replace(/[^0-9]/g, "") : raw);

  const { t } = useI18n();
  // เปิด/ปิดการมองเห็นรหัส — จำเป็นขึ้นมากเมื่อรหัสยาวและมีตัวอักษรผสม
  // ค่าเริ่มต้นคือซ่อนเสมอ และรีเซ็ตกลับไปซ่อนเมื่อช่องถูกล้าง (กันค้างเปิดไว้โดยไม่ตั้งใจ)
  const [reveal, setReveal] = React.useState(false);
  React.useEffect(() => {
    if (!value) setReveal(false);
  }, [value]);

  return (
    <div>
      <div className="relative">
        <input
          type={reveal ? "text" : "password"}
          inputMode={mode === "pin" ? "numeric" : "text"}
          autoComplete="current-password"
          value={value}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => handle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.length > 0 && !disabled) onSubmit?.();
          }}
          placeholder={placeholder}
          className={INPUT_CLASS}
          style={{ color: "var(--dw-text)" }}
        />
        {value.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? t("sec.hide") : t("sec.show")}
            aria-pressed={reveal}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--dw-muted)] transition hover:text-[var(--dw-text)]"
          >
            {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {showKeypad && mode === "pin" && (
        <div className="mt-4">
          <PinPad
            onKey={(d) => !disabled && onChange(value + d)}
            onDelete={() => !disabled && onChange(value.slice(0, -1))}
          />
        </div>
      )}
    </div>
  );
}

/**
 * แถบบอกว่ารหัสผ่านนโยบายหรือยัง — ใช้เฉพาะหน้าที่ "ตั้ง" รหัส
 * คืน ok ให้หน้าที่เรียกใช้ตัดสินใจ enable ปุ่มต่อ
 */
export function SecretPolicyHint({
  value,
  mode,
  texts,
}: {
  value: string;
  mode: SecretMode;
  texts: { pinTooShort: string; textTooShort: string; ok: string; digitsOnly: string };
}) {
  if (!value) return null;

  // ⚠️ ต้องใช้ผลจาก validateSecret เป็นฐานเดียว — ห้ามคำนวณเกณฑ์จาก mode เอง
  // เพราะ validateSecret ตัดสินจาก "เนื้อหาที่พิมพ์จริง" ไม่ใช่แท็บที่เลือก
  // (อยู่แท็บรหัสผสมแต่พิมพ์ตัวเลขล้วน = ยังเป็น PIN ต้อง 12 หลัก)
  // เดิมใช้ mode คำนวณ need ทำให้ขึ้น "8/8" ทั้งที่ปุ่มยังกดไม่ได้ ผู้ใช้งง
  const { ok, kind, min } = validateSecret(value);

  const msg = ok
    ? texts.ok
    : (kind === "pin" ? texts.pinTooShort : texts.textTooShort).replace("{n}", String(min));

  // ผู้ใช้เลือกแท็บ "รหัสผสม" แต่พิมพ์ตัวเลขล้วน — บอกทางออกให้ชัด
  const hintMixed = !ok && kind === "pin" && mode === "text";

  return (
    <>
      <p className={`mt-2 text-center text-xs ${ok ? "text-[var(--dw-green)]" : "text-[var(--dw-muted)]"}`}>
        {ok ? "✓ " : ""}
        {msg} {!ok && `(${value.length}/${min})`}
      </p>
      {hintMixed && (
        <p className="mt-1 text-center text-[11px] text-[var(--dw-amber)]">
          {texts.digitsOnly.replace("{n}", String(MIN_PASSPHRASE_LEN))}
        </p>
      )}
    </>
  );
}

/** ให้หน้าอื่นเรียกใช้ตรวจก่อน submit ได้โดยไม่ต้อง import จาก crypto เอง */
export { validateSecret, MIN_PIN_LEN, MIN_PASSPHRASE_LEN };
