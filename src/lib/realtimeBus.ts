import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Shared realtime bus — รวม postgres_changes ของทุก context ไว้ใน channel เดียว
// ("app-realtime") และ bind แต่ละตารางแค่ครั้งเดียว ไม่ว่าจะมีกี่ context ฟังอยู่
// (เดิมแต่ละ context เปิด channel ของตัวเอง และบางตารางถูก subscribe ซ้ำ เช่น
// app_notifications / time_edit_requests) → ลดจำนวน connection/binding ต่อผู้ใช้
// เพื่อกันชน limit ของ realtime

type Payload = Record<string, unknown>;
type Cb = (payload: Payload) => void;

const listeners = new Map<string, Set<Cb>>();
let channel: RealtimeChannel | null = null;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
let currentKey = "";

function rebuild() {
  const tables = [...listeners.entries()]
    .filter(([, set]) => set.size > 0)
    .map(([t]) => t)
    .sort();
  const key = tables.join("|");
  // ตารางชุดเดิม (แค่ callback เพิ่ม/ลดในตารางที่มีอยู่แล้ว) ไม่ต้องสร้าง channel ใหม่ —
  // handler อ่าน listeners สด ๆ ตอนมี event อยู่แล้ว
  if (key === currentKey) return;
  currentKey = key;

  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  if (tables.length === 0) return;

  let ch = supabase.channel("app-realtime");
  for (const table of tables) {
    ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
      const set = listeners.get(table);
      if (set) set.forEach((cb) => { try { cb(payload as Payload); } catch { /* ignore listener errors */ } });
    });
  }
  ch.subscribe();
  channel = ch;
}

function scheduleRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  // หน่วงเล็กน้อยเพื่อรวมการลงทะเบียนตอนแอปเริ่ม (หลาย context mount ใกล้กัน) ให้ rebuild ครั้งเดียว
  rebuildTimer = setTimeout(rebuild, 60);
}

/**
 * ฟังการเปลี่ยนแปลงของตารางผ่าน channel กลางร่วมกัน คืนฟังก์ชันสำหรับยกเลิก
 * ตารางเดียวกันจาก context หลายตัวจะ bind แค่ครั้งเดียว แล้ว fan-out ให้ทุก callback
 */
export function onTable(table: string, cb: Cb): () => void {
  let set = listeners.get(table);
  if (!set) {
    set = new Set();
    listeners.set(table, set);
  }
  set.add(cb);
  scheduleRebuild();
  return () => {
    const s = listeners.get(table);
    if (s) {
      s.delete(cb);
      if (s.size === 0) listeners.delete(table);
    }
    scheduleRebuild();
  };
}
