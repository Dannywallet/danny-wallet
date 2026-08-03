// สกุลเงินที่ใช้แสดงมูลค่า (ราคาต้นทางเป็น USD เสมอ แล้วแปลงตามอัตราแลกเปลี่ยน)
export type CurrencyCode = "USD" | "THB" | "EUR" | "GBP" | "JPY" | "CNY" | "KRW" | "SGD" | "AUD" | "INR";

export type CurrencyInfo = {
  code: CurrencyCode;
  label: string; // ชื่อที่แสดงในเมนู
  locale: string; // locale สำหรับ Intl.NumberFormat
  digits: number; // ทศนิยมปกติ (JPY/KRW ไม่มีเศษ)
};

export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", label: "USD · US Dollar", locale: "en-US", digits: 2 },
  { code: "THB", label: "THB · บาทไทย", locale: "th-TH", digits: 2 },
  { code: "EUR", label: "EUR · Euro", locale: "de-DE", digits: 2 },
  { code: "GBP", label: "GBP · British Pound", locale: "en-GB", digits: 2 },
  { code: "JPY", label: "JPY · 日本円", locale: "ja-JP", digits: 0 },
  { code: "CNY", label: "CNY · 人民币", locale: "zh-CN", digits: 2 },
  { code: "KRW", label: "KRW · 원", locale: "ko-KR", digits: 0 },
  { code: "SGD", label: "SGD · Singapore Dollar", locale: "en-SG", digits: 2 },
  { code: "AUD", label: "AUD · Australian Dollar", locale: "en-AU", digits: 2 },
  { code: "INR", label: "INR · ₹ Rupee", locale: "en-IN", digits: 2 },
];

export const DEFAULT_CURRENCY: CurrencyCode = "USD";
export const CURRENCY_KEY = "dw-currency";

export function currencyInfo(code: string): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

// --- สถานะระดับโมดูล ---
// formatUsd() ถูกเรียกจากหลายที่โดยไม่ผ่าน React context จึงเก็บค่าปัจจุบันไว้ที่นี่
// (CurrencyProvider เป็นผู้ตั้งค่า และบังคับ re-render ผ่าน context ของ i18n)
let current: { code: CurrencyCode; rate: number } = { code: DEFAULT_CURRENCY, rate: 1 };

export function setActiveCurrency(code: CurrencyCode, rate: number) {
  current = { code, rate: rate > 0 ? rate : 1 };
}
export function getActiveCurrency() {
  return current;
}

/** แปลงมูลค่า USD → สกุลปัจจุบัน แล้ว format ตาม locale ของสกุลนั้น */
export function formatMoney(usd: number, opts?: { compact?: boolean }): string {
  const { code, rate } = current;
  const info = currencyInfo(code);
  const v = usd * rate;
  const compact = opts?.compact && Math.abs(v) >= 1000;
  try {
    return new Intl.NumberFormat(info.locale, {
      style: "currency",
      currency: code,
      notation: compact ? "compact" : "standard",
      minimumFractionDigits: compact ? undefined : info.digits,
      maximumFractionDigits: compact ? 2 : info.digits,
    }).format(v);
  } catch {
    return `${v.toFixed(info.digits)} ${code}`;
  }
}
