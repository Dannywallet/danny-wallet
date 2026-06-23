"use client";

// คัดลอกแบบชั่วคราว — ล้าง clipboard อัตโนมัติหลังเวลาที่กำหนด (กันข้อมูลลับค้างใน clipboard)
let timer: ReturnType<typeof setTimeout> | null = null;

export async function copyEphemeral(text: string, clearAfterMs = 30_000): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        // ล้างเฉพาะเมื่อ clipboard ยังเป็นค่าเดิม (ไม่เขียนทับสิ่งที่ผู้ใช้คัดลอกใหม่)
        const cur = await navigator.clipboard.readText().catch(() => null);
        if (cur === null || cur === text) await navigator.clipboard.writeText("");
      } catch {
        /* readText อาจถูกบล็อก — ข้าม */
      }
    }, clearAfterMs);
    return true;
  } catch {
    return false;
  }
}

export async function copyPlain(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
