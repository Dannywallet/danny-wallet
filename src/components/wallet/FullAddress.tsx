/**
 * แสดงที่อยู่เต็มทุกตัว แบ่งกลุ่มละ 4 ตัวให้ไล่เทียบง่าย
 *
 * ใช้ในจุดตัดสินใจ (หน้ายืนยัน/ใส่ PIN) — ห้ามย่อเป็น 0x1234…abcd เพราะที่อยู่ปลอม
 * (address poisoning) จงใจทำหัวกับท้ายให้เหมือนของจริง ตรงกลางคือส่วนที่ต่าง
 * เว้นช่องด้วย margin ไม่ใช่ช่องว่างจริง ก๊อปไปวางแล้วยังเป็นที่อยู่ต่อเนื่อง
 */
export function FullAddress({ address, className = "" }: { address: string; className?: string }) {
  const a = address.trim();
  const body = /^0x/i.test(a) ? a.slice(2) : a;
  const groups = body.match(/.{1,4}/g) ?? [];
  return (
    <span className={`break-all font-mono ${className}`}>
      <span className="opacity-60">0x</span>
      {groups.map((g, i) => (
        <span key={i} className={`${i % 2 ? "opacity-75" : ""} ${i < groups.length - 1 ? "mr-[0.3em]" : ""}`}>
          {g}
        </span>
      ))}
    </span>
  );
}
