// Danny Chain Wallet — ตัวช่วย format (DEMO)

export function formatUsd(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatToken(value: number, symbol?: string): string {
  const n = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: value < 1 ? 6 : 4,
  }).format(value);
  return symbol ? `${n} ${symbol}` : n;
}

export function formatChange(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

/** ย่อที่อยู่ 0x1234...abcd */
export function shortAddress(addr: string, lead = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= lead + tail) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

/** ตรวจรูปแบบที่อยู่แบบ EVM (สมมติ) — ใช้เตือน UI เท่านั้น */
export function isLikelyAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

export function hidden(value: string, on: boolean): string {
  return on ? "••••••" : value;
}

/** แปลชื่อบัญชีเริ่มต้น ("บัญชี N" / "Account N" …) ให้ตรงภาษาปัจจุบัน — ชื่อที่ผู้ใช้ตั้งเองไม่แตะ */
export function accountLabel(name: string, accountWord: string): string {
  const m = (name || "").match(/^(?:บัญชี|Account|Tài khoản|账户)\s*(\d+)$/);
  return m ? `${accountWord} ${m[1]}` : name;
}
