"use client";

// ชั้นเข้ารหัสของ wallet — scrypt (memory-hard) + AES-256-GCM
// ตรวจรหัสผ่านด้วย GCM auth tag (ผิด = decrypt fail)
//
// ทำไมเปลี่ยนจาก PBKDF2 → scrypt:
//   PBKDF2 ไม่ memory-hard → GPU เร่งได้เต็มที่ (~24,000 ครั้ง/วินาที ที่ 210k รอบ)
//   scrypt ต้องใช้แรม 64 MB ต่อการลอง 1 ครั้ง → GPU ทำขนานได้น้อยลงหลักร้อยเท่า
//
// ⚠️ สำคัญ: KDF ที่แข็งขึ้นช่วยได้เท่านั้น — ตัวชี้ขาดคือ "ความยาวรหัส"
//   รหัส 6 หลักตัวเลข = 1,000,000 แบบ (~20 bit) ต่อให้ scrypt ก็ยังไล่ครบได้ในเวลาไม่นาน
//   ดู MIN_SECRET_LEN ด้านล่าง — ต้องบังคับที่ชั้น UI ด้วย

import { scrypt } from "ethers";

// --- พารามิเตอร์ scrypt ---
// N=2^16, r=8, p=1 → ใช้แรม 64 MB ต่อครั้ง (~0.2 วิ native, ~0.5-1 วิ ในเบราว์เซอร์)
// เลือก 2^16 แทน 2^17 เพื่อให้มือถือสเปกต่ำยังไหว (2^17 = 128 MB เสี่ยง OOM บน Safari มือถือ)
const SCRYPT_N = 1 << 16;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32; // AES-256

// PBKDF2 ของรูปแบบเดิม (v1) — เก็บไว้เพื่อถอดรหัสกระเป๋าเก่าเท่านั้น ไม่ใช้เข้ารหัสใหม่แล้ว
const LEGACY_PBKDF2_ITERS = 210_000;

// --- นโยบายความแข็งแรงของรหัส ---
// รองรับ 2 แบบ ให้ผู้ใช้เลือก:
//   PIN ตัวเลขล้วน ต้อง ≥ 12 หลัก  (10^12 แบบ — ไล่ครบ ~100,000 ปีที่ 300 ครั้ง/วินาที)
//   รหัสผสม ต้อง ≥ 8 ตัว          (62^8 แบบ — แข็งแรงกว่ามากในความยาวที่จำง่ายกว่า)
// ของเดิมคือ 6 หลัก = 10^6 ซึ่งไล่ครบได้ใน ~1 ชั่วโมง จึงถือว่า "อ่อน" และต้องบังคับเปลี่ยน
export const MIN_PIN_LEN = 12;
export const MIN_PASSPHRASE_LEN = 8;

export type SecretKind = "pin" | "passphrase";

/** ตัวเลขล้วน = pin · มีอย่างอื่นปน = passphrase */
export function classifySecret(secret: string): SecretKind {
  return /^\d+$/.test(secret) ? "pin" : "passphrase";
}

export type SecretCheck = { ok: boolean; kind: SecretKind; min: number };

/** ตรวจว่ารหัสผ่านนโยบายไหม — ใช้ทั้งตอนสร้างกระเป๋าและตอนเปลี่ยนรหัส */
export function validateSecret(secret: string): SecretCheck {
  const kind = classifySecret(secret);
  const min = kind === "pin" ? MIN_PIN_LEN : MIN_PASSPHRASE_LEN;
  return { ok: secret.length >= min, kind, min };
}

/**
 * true = รหัสนี้อ่อนเกินนโยบายปัจจุบัน (เช่น PIN 6 หลักแบบเดิม)
 * ใช้ตอนปลดล็อกสำเร็จ เพื่อบังคับให้ผู้ใช้ตั้งรหัสใหม่
 */
export function isWeakSecret(secret: string): boolean {
  return !validateSecret(secret).ok;
}

/**
 * ข้อผิดพลาดของขั้น derive key (scrypt/PBKDF2/WebCrypto) — ไม่ใช่ "รหัสผิด"
 *
 * ⚠️ ทำไมต้องแยก: scrypt จองแรม 64 MB ทุกครั้ง บนมือถือสเปกต่ำอาจจองไม่สำเร็จแล้ว throw
 * ถ้าเหมารวมว่าเป็นรหัสผิด ตัวนับ failedAttempts จะเดินหน้าจนครบ 10 แล้ว "ล้างกระเป๋า"
 * ทั้งที่ผู้ใช้พิมพ์รหัสถูกมาตลอด — ผู้ใช้เสียกระเป๋าเพราะเครื่องแรมไม่พอ
 * ผู้เรียกต้องจับ error ชนิดนี้แล้วแจ้งให้ลองใหม่ โดยห้ามนับเป็นครั้งที่ใส่ผิด
 */
export class KdfError extends Error {
  constructor(cause?: unknown) {
    super("key derivation failed");
    this.name = "KdfError";
    (this as { cause?: unknown }).cause = cause;
  }
}

function subtle(): SubtleCrypto {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("WebCrypto ไม่พร้อมใช้งาน (ต้องเป็น secure context)");
  }
  return window.crypto.subtle;
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  window.crypto.getRandomValues(b);
  return b;
}

export function toHex(b: ArrayBuffer | Uint8Array): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  return Array.from(u).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * บล็อกข้อมูลที่เข้ารหัสแล้ว
 * v ไม่มี หรือ = 1 → รูปแบบเดิม (PBKDF2) · v = 2 → scrypt
 * เก็บพารามิเตอร์ไว้ในบล็อกด้วย เผื่อวันหน้าปรับค่าแล้วของเก่ายังถอดได้
 */
export type EncBlob = {
  v?: 1 | 2;
  n?: number; // scrypt N
  r?: number; // scrypt r
  p?: number; // scrypt p
  iv: string;
  salt: string;
  data: string;
};

/** true = บล็อกนี้ยังเป็นรูปแบบเก่า ควร re-encrypt เมื่อผู้ใช้ปลดล็อกสำเร็จ */
export function isLegacyBlob(blob: EncBlob): boolean {
  return (blob.v ?? 1) === 1;
}

/** derive คีย์ AES-256-GCM จากรหัสผ่าน — เลือกอัลกอริทึมตามเวอร์ชันของบล็อก */
async function deriveKey(secret: string, salt: Uint8Array, blob?: EncBlob): Promise<CryptoKey> {
  try {
    return await deriveKeyInner(secret, salt, blob);
  } catch (e) {
    // ทุกความล้มเหลวของขั้น derive = ปัญหาระบบ ไม่ใช่รหัสผิด (ดูคำอธิบายที่ KdfError)
    throw new KdfError(e);
  }
}

async function deriveKeyInner(secret: string, salt: Uint8Array, blob?: EncBlob): Promise<CryptoKey> {
  const version = blob ? (blob.v ?? 1) : 2;

  if (version === 1) {
    // --- รูปแบบเดิม: PBKDF2 (ใช้ถอดรหัสกระเป๋าเก่าเท่านั้น) ---
    const baseKey = await subtle().importKey(
      "raw",
      new TextEncoder().encode(secret),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return subtle().deriveKey(
      { name: "PBKDF2", salt, iterations: LEGACY_PBKDF2_ITERS, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // --- รูปแบบใหม่: scrypt (memory-hard) ---
  const N = blob?.n ?? SCRYPT_N;
  const r = blob?.r ?? SCRYPT_R;
  const p = blob?.p ?? SCRYPT_P;
  const dk = await scrypt(new TextEncoder().encode(secret), salt, N, r, p, KEY_LEN);
  return subtle().importKey("raw", fromHex(dk.slice(2)), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** เข้ารหัสข้อความด้วยรหัสผ่าน — เขียนเป็นรูปแบบ v2 (scrypt) เสมอ */
export async function encryptWithPin(plaintext: string, secret: string): Promise<EncBlob> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(secret, salt);
  const ct = await subtle().encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return {
    v: 2,
    n: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    iv: toHex(iv),
    salt: toHex(salt),
    data: toHex(ct),
  };
}

/** ถอดรหัส — รองรับทั้ง v1 (เก่า) และ v2 · throw ถ้ารหัสผิด (GCM auth fail) */
export async function decryptWithPin(blob: EncBlob, secret: string): Promise<string> {
  const key = await deriveKey(secret, fromHex(blob.salt), blob);
  const pt = await subtle().decrypt(
    { name: "AES-GCM", iv: fromHex(blob.iv) },
    key,
    fromHex(blob.data)
  );
  return new TextDecoder().decode(pt);
}

/** ตรวจรหัสผ่านโดยลองถอดรหัส (true = ถูก) */
/**
 * ตรวจรหัสผ่านโดยลองถอดรหัส
 * คืน true/false เฉพาะกรณีที่ตัดสินได้จริง — ถ้าขั้น derive key ล้มเหลวจะ throw KdfError ออกไป
 * เพื่อไม่ให้ผู้เรียกนับเป็น "ใส่รหัสผิด" (ซึ่งจะพาไปสู่การล้างกระเป๋า)
 */
export async function verifyPin(blob: EncBlob, secret: string): Promise<boolean> {
  try {
    await decryptWithPin(blob, secret);
    return true;
  } catch (e) {
    if (e instanceof KdfError) throw e; // ปัญหาระบบ ไม่ใช่รหัสผิด
    return false; // GCM auth tag ไม่ผ่าน = รหัสผิดจริง
  }
}

/**
 * อัปเกรดบล็อกเก่า (v1/PBKDF2) เป็น v2/scrypt โดยใช้รหัสเดิม
 * คืน null ถ้าไม่ต้องอัปเกรด หรือรหัสผิด — ตัวเรียกควรทำหลังปลดล็อกสำเร็จ
 */
export async function upgradeBlob(blob: EncBlob, secret: string): Promise<EncBlob | null> {
  if (!isLegacyBlob(blob)) return null;
  try {
    const plain = await decryptWithPin(blob, secret);
    return await encryptWithPin(plain, secret);
  } catch {
    return null;
  }
}
