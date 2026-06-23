"use client";

// ชั้นเข้ารหัสของ wallet — WebCrypto (PBKDF2 + AES-256-GCM)
// ใช้ derive key จาก PIN เพื่อเข้ารหัส seed; ตรวจ PIN ด้วย GCM auth tag (ผิด = decrypt fail)

const PBKDF2_ITERS = 210_000; // ตามคำแนะนำ OWASP สำหรับ PBKDF2-SHA256

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

/** derive AES-256-GCM key จาก PIN + salt */
async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await subtle().importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return subtle().deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export type EncBlob = { iv: string; salt: string; data: string };

/** เข้ารหัสข้อความด้วย PIN — คืน {iv, salt, data} (hex) */
export async function encryptWithPin(plaintext: string, pin: string): Promise<EncBlob> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(pin, salt);
  const ct = await subtle().encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { iv: toHex(iv), salt: toHex(salt), data: toHex(ct) };
}

/** ถอดรหัสด้วย PIN — throw ถ้า PIN ผิด (GCM auth fail) */
export async function decryptWithPin(blob: EncBlob, pin: string): Promise<string> {
  const key = await deriveKey(pin, fromHex(blob.salt));
  const pt = await subtle().decrypt(
    { name: "AES-GCM", iv: fromHex(blob.iv) },
    key,
    fromHex(blob.data)
  );
  return new TextDecoder().decode(pt);
}

/** ตรวจ PIN โดยลองถอดรหัส (true = ถูก) */
export async function verifyPin(blob: EncBlob, pin: string): Promise<boolean> {
  try {
    await decryptWithPin(blob, pin);
    return true;
  } catch {
    return false;
  }
}
