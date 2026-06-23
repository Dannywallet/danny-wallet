"use client";

// สมุดที่อยู่ — เก็บใน localStorage (ต่ออุปกรณ์), sync ข้ามคอมโพเนนต์ด้วย event
import React from "react";

export type Contact = { id: string; name: string; address: string };
const KEY = "dannywallet.addressbook";
const EVT = "dw-addressbook";

function read(): Contact[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function write(list: Contact[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* noop */
  }
}

export function isValidAddress(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a.trim());
}

export function useAddressBook() {
  const [list, setList] = React.useState<Contact[]>([]);

  React.useEffect(() => {
    const sync = () => setList(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const add = React.useCallback((name: string, address: string): boolean => {
    const a = address.trim();
    if (!isValidAddress(a)) return false;
    const cur = read();
    const id = a.toLowerCase();
    const existing = cur.find((c) => c.id === id);
    if (existing) {
      write(cur.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c)));
    } else {
      write([...cur, { id, name: name.trim() || `${a.slice(0, 6)}…${a.slice(-4)}`, address: a }]);
    }
    return true;
  }, []);

  const remove = React.useCallback((id: string) => write(read().filter((c) => c.id !== id)), []);

  const nameOf = React.useCallback(
    (address: string) => list.find((c) => c.id === address.toLowerCase())?.name,
    [list]
  );

  return { list, add, remove, nameOf };
}
