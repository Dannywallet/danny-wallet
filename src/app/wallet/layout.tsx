import type { Metadata } from "next";
import "./wallet.css";
import { PhoneShell } from "@/components/wallet/PhoneShell";
import { AutoLock } from "@/components/wallet/AutoLock";

export const metadata: Metadata = {
  title: "Danny Wallet — กระเป๋าคริปโตบน Danny Chain",
  description: "กระเป๋าคริปโตดีไซน์ทันสมัย ปลอดภัย สำหรับ Danny Chain (เดโม)",
};

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AutoLock />
      <PhoneShell>{children}</PhoneShell>
    </>
  );
}
