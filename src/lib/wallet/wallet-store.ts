"use client";

// สถานะ wallet (client) — เก็บ seed แบบเข้ารหัส, ตรวจ PIN ด้วย AES-GCM, ป้องกัน brute-force
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import React from "react";
import { encryptWithPin, decryptWithPin, verifyPin, type EncBlob } from "./crypto";
import { HDNodeWallet, Mnemonic, Wallet } from "ethers";

const KEY = "dannywallet.v2";
const MAX_ATTEMPTS = 10; // เกินนี้ = ล้าง wallet
const SOFT_LIMIT = 5; // เริ่มหน่วงเวลาหลังจากนี้
const MAX_ACCOUNTS = 100; // จำนวนบัญชีสูงสุด

// บัญชี: HD (derive จาก seed, มี index) หรือ imported (มี private key เข้ารหัสของตัวเอง)
export type WalletAccount = {
  name: string;
  address: string;
  index?: number; // HD derivation index
  enc?: EncBlob; // private key ที่เข้ารหัส (เฉพาะบัญชีนำเข้า)
};

/** derive ที่อยู่บัญชีที่ index ตามมาตรฐาน BIP44 (m/44'/60'/0'/0/i) */
export function deriveAddress(mnemonic: string, index: number): string {
  const node = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic), `m/44'/60'/0'/0/${index}`);
  return node.address;
}

type Persisted = {
  version: 2;
  created: boolean;
  enc: EncBlob | null; // seed ที่เข้ารหัสด้วย PIN
  accounts: WalletAccount[]; // หลายบัญชี derive จาก seed เดียว
  activeIndex: number; // บัญชีที่ใช้งานอยู่
  balanceHidden: boolean;
  autoLockMin: number;
  biometric: boolean;
  failedAttempts: number;
  lockedUntil: number; // epoch ms ที่ล็อกจนถึง
};

const DEFAULTS: Persisted = {
  version: 2,
  created: false,
  enc: null,
  accounts: [],
  activeIndex: 0,
  balanceHidden: false,
  autoLockMin: 5,
  biometric: true,
  failedAttempts: 0,
  lockedUntil: 0,
};

type WalletState = Persisted & { hydrated: boolean; locked: boolean };

type WalletCtx = WalletState & {
  address: string | null; // ที่อยู่ของบัญชีที่ใช้งานอยู่
  hasSeed: boolean; // มีวลีกู้คืน (HD) หรือเป็นกระเป๋าจาก private key ล้วน
  createWallet: (pin: string, mnemonic: string, address: string) => Promise<void>;
  /** สร้างกระเป๋าจาก private key ล้วน (ไม่มี seed) */
  createWalletFromKey: (pin: string, privateKey: string, address: string) => Promise<void>;
  unlock: (pin: string) => Promise<{ ok: boolean; wiped?: boolean; cooldownMs?: number }>;
  lock: () => void;
  reset: () => void;
  toggleBalance: () => void;
  setPref: (p: Partial<Pick<Persisted, "balanceHidden" | "autoLockMin" | "biometric">>) => void;
  revealMnemonic: (pin: string) => Promise<string | null>;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
  addAccount: (pin: string) => Promise<{ ok: boolean; address?: string; reason?: string }>;
  createAccount: (pin: string) => Promise<{ ok: boolean; address?: string; reason?: string }>;
  importAccount: (pin: string, privateKey: string) => Promise<{ ok: boolean; address?: string; reason?: string }>;
  switchAccount: (index: number) => void;
  renameAccount: (index: number, name: string) => void;
  removeAccount: (index: number) => void;
  /** ดึง private key ของบัญชีที่ใช้งานอยู่ (HD derive หรือ imported) ด้วย PIN — สำหรับเซ็นธุรกรรม */
  getActivePrivateKey: (pin: string) => Promise<string | null>;
  /** ดึง private key ของบัญชีใด ๆ ด้วย PIN — สำหรับ export */
  revealPrivateKey: (index: number, pin: string) => Promise<string | null>;
};

const Ctx = createContext<WalletCtx | null>(null);

function load(): Persisted {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = { ...DEFAULTS, ...JSON.parse(raw) } as Persisted & { address?: string | null };
    // migrate: รูปแบบเดิมเก็บ address เดี่ยว → แปลงเป็น accounts[]
    if ((!parsed.accounts || parsed.accounts.length === 0) && parsed.created && parsed.address) {
      parsed.accounts = [{ name: "บัญชี 1", address: parsed.address }];
      parsed.activeIndex = 0;
    }
    return parsed;
  } catch {
    return DEFAULTS;
  }
}

function save(p: Persisted) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
}

/** คำนวณเวลาหน่วงตามจำนวนครั้งที่ผิด (exponential, สูงสุด 5 นาที) */
function cooldownFor(attempts: number): number {
  if (attempts < SOFT_LIMIT) return 0;
  const ms = Math.min(5 * 1000 * 2 ** (attempts - SOFT_LIMIT), 5 * 60 * 1000);
  return ms;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({ ...DEFAULTS, hydrated: false, locked: true });

  useEffect(() => {
    const p = load();
    setState({ ...p, hydrated: true, locked: p.created });
  }, []);

  const persist = useCallback((next: Partial<Persisted>) => {
    setState((s) => {
      const merged = { ...s, ...next };
      const { hydrated, locked, ...toSave } = merged;
      save(toSave);
      return merged;
    });
  }, []);

  const createWallet = useCallback(async (pin: string, mnemonic: string, address: string) => {
    const enc = await encryptWithPin(mnemonic, pin);
    setState((s) => {
      const merged: WalletState = {
        ...s, created: true, enc, locked: false,
        accounts: [{ name: "บัญชี 1", address, index: 0 }],
        activeIndex: 0,
        failedAttempts: 0, lockedUntil: 0,
      };
      const { hydrated, locked, ...toSave } = merged;
      save(toSave);
      return merged;
    });
  }, []);

  const createWalletFromKey = useCallback(async (pin: string, privateKey: string, address: string) => {
    const enc = await encryptWithPin(privateKey.trim(), pin);
    setState((s) => {
      const merged: WalletState = {
        ...s, created: true, enc: null, locked: false, // ไม่มี seed
        accounts: [{ name: "บัญชี 1", address, enc }], // บัญชีนำเข้า (มี private key ของตัวเอง)
        activeIndex: 0,
        failedAttempts: 0, lockedUntil: 0,
      };
      const { hydrated, locked, ...toSave } = merged;
      save(toSave);
      return merged;
    });
  }, []);

  const addAccount = useCallback(async (pin: string) => {
    const cur = load();
    if (!cur.enc) return { ok: false, reason: "no-wallet" };
    if (cur.accounts.length >= MAX_ACCOUNTS) return { ok: false, reason: "max" };
    let phrase: string;
    try {
      phrase = await decryptWithPin(cur.enc, pin);
    } catch {
      return { ok: false, reason: "pin" };
    }
    // index ถัดไปของ HD (นับเฉพาะบัญชี derive, ข้ามบัญชีนำเข้า)
    const hdIndex = cur.accounts.reduce((m, a) => (a.index != null && a.index > m ? a.index : m), -1) + 1;
    const address = deriveAddress(phrase, hdIndex);
    const accounts = [...cur.accounts, { name: `บัญชี ${cur.accounts.length + 1}`, address, index: hdIndex }];
    persist({ accounts, activeIndex: accounts.length - 1 });
    return { ok: true, address };
  }, [persist]);

  // สร้างบัญชี/กระเป๋าใหม่ด้วยกุญแจสุ่ม (ของตัวเอง) — ใช้ได้แม้กระเป๋าเป็นแบบนำเข้า (ไม่มี seed)
  const createAccount = useCallback(async (pin: string) => {
    const cur = load();
    if (!cur.created) return { ok: false, reason: "no-wallet" };
    if (cur.accounts.length >= MAX_ACCOUNTS) return { ok: false, reason: "max" };
    const vb = cur.enc ?? cur.accounts.find((a) => a.enc)?.enc ?? null;
    if (!vb || !(await verifyPin(vb, pin))) return { ok: false, reason: "pin" };
    const w = Wallet.createRandom();
    const enc = await encryptWithPin(w.privateKey, pin);
    const accounts = [...cur.accounts, { name: `บัญชี ${cur.accounts.length + 1}`, address: w.address, enc }];
    persist({ accounts, activeIndex: accounts.length - 1 });
    return { ok: true, address: w.address };
  }, [persist]);

  const importAccount = useCallback(async (pin: string, privateKey: string) => {
    const cur = load();
    if (!cur.created) return { ok: false, reason: "no-wallet" };
    if (cur.accounts.length >= MAX_ACCOUNTS) return { ok: false, reason: "max" };
    // ยืนยัน PIN กับ blob ใด ๆ ของกระเป๋า (seed หรือ private key ของบัญชีนำเข้า) — ทุกบัญชีใช้ PIN เดียว
    const vb = cur.enc ?? cur.accounts.find((a) => a.enc)?.enc ?? null;
    if (!vb || !(await verifyPin(vb, pin))) return { ok: false, reason: "pin" };
    let address: string;
    try {
      const key = privateKey.trim();
      address = new Wallet(/^0x/.test(key) ? key : "0x" + key).address;
    } catch {
      return { ok: false, reason: "invalid-key" };
    }
    if (cur.accounts.some((a) => a.address.toLowerCase() === address.toLowerCase())) {
      return { ok: false, reason: "exists" };
    }
    const enc = await encryptWithPin(privateKey.trim(), pin);
    const accounts = [...cur.accounts, { name: `นำเข้า ${address.slice(0, 6)}`, address, enc }];
    persist({ accounts, activeIndex: accounts.length - 1 });
    return { ok: true, address };
  }, [persist]);

  const revealPrivateKey = useCallback(async (index: number, pin: string) => {
    const cur = load();
    const acc = cur.accounts[index];
    if (!acc) return null;
    try {
      if (acc.enc) {
        // บัญชีนำเข้า — ถอดรหัส private key ของตัวเอง
        const pk = await decryptWithPin(acc.enc, pin);
        return new Wallet(/^0x/.test(pk.trim()) ? pk.trim() : "0x" + pk.trim()).privateKey;
      }
      // บัญชี HD — derive จาก seed ตาม index
      if (!cur.enc) return null;
      const phrase = await decryptWithPin(cur.enc, pin);
      const node = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase), `m/44'/60'/0'/0/${acc.index ?? 0}`);
      return node.privateKey;
    } catch {
      return null;
    }
  }, []);

  const getActivePrivateKey = useCallback(
    (pin: string) => revealPrivateKey(load().activeIndex, pin),
    [revealPrivateKey]
  );

  const switchAccount = useCallback((index: number) => {
    const cur = load();
    if (index >= 0 && index < cur.accounts.length) persist({ activeIndex: index });
  }, [persist]);

  const removeAccount = useCallback((index: number) => {
    const cur = load();
    if (cur.accounts.length <= 1) return; // ต้องเหลืออย่างน้อย 1 บัญชี
    if (index < 0 || index >= cur.accounts.length) return;
    const accounts = cur.accounts.filter((_, i) => i !== index);
    let activeIndex = cur.activeIndex;
    if (index === cur.activeIndex) activeIndex = 0;
    else if (index < cur.activeIndex) activeIndex = cur.activeIndex - 1;
    persist({ accounts, activeIndex });
  }, [persist]);

  const renameAccount = useCallback((index: number, name: string) => {
    const cur = load();
    if (index < 0 || index >= cur.accounts.length) return;
    const accounts = cur.accounts.map((a, i) => (i === index ? { ...a, name: name.trim() || a.name } : a));
    persist({ accounts });
  }, [persist]);

  const unlock = useCallback(async (pin: string) => {
    const cur = load();
    // ตรวจ cooldown
    if (cur.lockedUntil && Date.now() < cur.lockedUntil) {
      return { ok: false, cooldownMs: cur.lockedUntil - Date.now() };
    }
    // ตรวจ PIN กับ seed หรือ private key ของบัญชี (รองรับกระเป๋าจาก private key ล้วน)
    const blob = cur.enc ?? cur.accounts[cur.activeIndex]?.enc ?? cur.accounts.find((a) => a.enc)?.enc ?? null;
    if (!blob) return { ok: false };

    const ok = await verifyPin(blob, pin);
    if (ok) {
      persist({ failedAttempts: 0, lockedUntil: 0 });
      setState((s) => ({ ...s, locked: false }));
      return { ok: true };
    }

    // ผิด → เพิ่มตัวนับ + หน่วง/ล้าง
    const attempts = cur.failedAttempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      save(DEFAULTS);
      setState({ ...DEFAULTS, hydrated: true, locked: true });
      return { ok: false, wiped: true };
    }
    const cd = cooldownFor(attempts);
    persist({ failedAttempts: attempts, lockedUntil: cd ? Date.now() + cd : 0 });
    return { ok: false, cooldownMs: cd };
  }, [persist]);

  const lock = useCallback(() => setState((s) => ({ ...s, locked: true })), []);

  const reset = useCallback(() => {
    save(DEFAULTS);
    setState({ ...DEFAULTS, hydrated: true, locked: true });
  }, []);

  const toggleBalance = useCallback(
    () => persist({ balanceHidden: !state.balanceHidden }),
    [persist, state.balanceHidden]
  );

  const setPref = useCallback(
    (p: Partial<Pick<Persisted, "balanceHidden" | "autoLockMin" | "biometric">>) => persist(p),
    [persist]
  );

  const revealMnemonic = useCallback(async (pin: string) => {
    const cur = load();
    if (!cur.enc) return null;
    try {
      return await decryptWithPin(cur.enc, pin);
    } catch {
      return null;
    }
  }, []);

  const changePin = useCallback(async (oldPin: string, newPin: string) => {
    const cur = load();
    const vb = cur.enc ?? cur.accounts.find((a) => a.enc)?.enc ?? null;
    if (!vb || !(await verifyPin(vb, oldPin))) return false;
    try {
      // เข้ารหัสใหม่ทั้ง seed (ถ้ามี) และ private key ของบัญชีนำเข้าทุกตัวด้วย PIN ใหม่
      let enc = cur.enc;
      if (cur.enc) enc = await encryptWithPin(await decryptWithPin(cur.enc, oldPin), newPin);
      const accounts = await Promise.all(
        cur.accounts.map(async (a) =>
          a.enc ? { ...a, enc: await encryptWithPin(await decryptWithPin(a.enc, oldPin), newPin) } : a
        )
      );
      persist({ enc, accounts, failedAttempts: 0, lockedUntil: 0 });
      return true;
    } catch {
      return false;
    }
  }, [persist]);

  const value: WalletCtx = {
    ...state,
    address: state.accounts[state.activeIndex]?.address ?? null,
    hasSeed: state.enc != null,
    createWallet, createWalletFromKey, unlock, lock, reset, toggleBalance, setPref, revealMnemonic, changePin,
    addAccount, createAccount, importAccount, switchAccount, renameAccount, removeAccount, getActivePrivateKey, revealPrivateKey,
  };

  return React.createElement(Ctx.Provider, { value }, children);
}

export function useWallet(): WalletCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet must be used within WalletProvider");
  return c;
}
