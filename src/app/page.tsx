import { redirect } from "next/navigation";

// หน้าแรกของโปรเจกต์ standalone → เด้งเข้าแอป wallet ทันที
export default function Page() {
  redirect("/wallet");
}
