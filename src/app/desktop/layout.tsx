import type { Metadata } from "next";
import "../wallet/wallet.css";
import { AutoLock } from "@/components/wallet/AutoLock";

export const metadata: Metadata = {
  title: "Danny Wallet — Desktop",
  description: "Danny Wallet สำหรับเดสก์ท็อป — พอร์ต, สลับเหรียญ และจัดการสินทรัพย์บน Danny Chain",
};

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AutoLock />
      {children}
    </>
  );
}
