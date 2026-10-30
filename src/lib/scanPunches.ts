/**
 * ตัวช่วยประมวลผลรายการสแกนดิบจากเครื่องสแกนหน้า (UDISKLOG) ก่อนนำเข้า
 *  - กรองสแกนซ้ำ (สแกนซ้ำภายใน N นาที)
 *  - จับคู่เข้า-ออกของ "กะข้ามเที่ยงคืน" ให้เป็นวันทำงานเดียวกัน (วันที่เริ่มกะ)
 *
 * เครื่องไม่บอกว่าครั้งไหนเข้า/ออก (IOMd เป็นค่าคงที่) จึงใช้กติกา: ครั้งแรก = เข้า, ครั้งสุดท้าย = ออก
 */

export interface Punch {
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
}

/** กะเป็นนาทีนับจาก 00:00; ถ้า end <= start แปลว่าข้ามเที่ยงคืน */
export interface ShiftWindow {
  start: number;
  end: number;
}

export interface PairedDay {
  date: string; // วันทำงาน (วันที่เริ่มกะ)
  checkIn: string; // "-" ถ้าไม่มี
  checkOut: string; // "-" ถ้าไม่มี
  overnight: boolean; // เวลาออกมาจากสแกนของเช้าวันถัดไป
}

// ช่วงที่ยอมให้สแกนเข้าก่อนเริ่มกะ / สแกนออกหลังเลิกกะ (นาที)
const PRE_SHIFT_MIN = 180;
const POST_SHIFT_MIN = 180;

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
};

const dayNumber = (isoDate: string): number => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};

export const addDaysISO = (isoDate: string, days: number): string => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
};

const isCrossing = (s: ShiftWindow | null | undefined): s is ShiftWindow => !!s && s.end <= s.start;

const byDateTime = (a: Punch, b: Punch) =>
  a.date === b.date ? (a.time < b.time ? -1 : a.time > b.time ? 1 : 0) : a.date < b.date ? -1 : 1;

/** กรองสแกนที่ห่างจากครั้งก่อนหน้า (ที่เก็บไว้) น้อยกว่า minGapMin นาที ออก */
export function dedupePunches(punches: Punch[], minGapMin = 2): { kept: Punch[]; removed: number } {
  const sorted = [...punches].sort(byDateTime);
  const kept: Punch[] = [];
  let lastAbs = Number.NEGATIVE_INFINITY;
  for (const p of sorted) {
    const abs = dayNumber(p.date) * 1440 + toMinutes(p.time);
    if (abs - lastAbs < minGapMin) continue;
    kept.push(p);
    lastAbs = abs;
  }
  return { kept, removed: punches.length - kept.length };
}

/**
 * รวมสแกนของพนักงานหนึ่งคนเป็นรายวันทำงาน
 *  - กะปกติ/ไม่รู้กะ: จัดตามวันปฏิทิน (ครั้งแรก = เข้า, ครั้งสุดท้าย = ออก) เหมือนเดิม
 *  - กะข้ามเที่ยงคืน: สแกนช่วงเช้าหลังเที่ยงคืน (ภายใน POST_SHIFT_MIN หลังเวลาเลิกกะ) นับเป็น "ออก" ของวันก่อนหน้า
 */
export function pairPunches(
  punches: Punch[],
  shiftOn: (date: string) => ShiftWindow | null,
): { days: PairedDay[]; overnightPaired: number } {
  type Bucket = { ins: Punch[]; after: Punch[] };
  const buckets = new Map<string, Bucket>();
  const bucket = (date: string): Bucket => {
    let b = buckets.get(date);
    if (!b) { b = { ins: [], after: [] }; buckets.set(date, b); }
    return b;
  };

  for (const p of [...punches].sort(byDateTime)) {
    const tm = toMinutes(p.time);
    const prevShift = shiftOn(addDaysISO(p.date, -1));
    if (isCrossing(prevShift) && tm <= prevShift.end + POST_SHIFT_MIN) {
      // เช้าหลังเที่ยงคืนของกะข้ามคืนเมื่อวาน
      bucket(addDaysISO(p.date, -1)).after.push(p);
      continue;
    }
    bucket(p.date).ins.push(p);
  }

  const days: PairedDay[] = [];
  let overnightPaired = 0;
  for (const [date, b] of [...buckets.entries()].sort((a, c) => (a[0] < c[0] ? -1 : 1))) {
    const checkIn = b.ins.length > 0 ? b.ins[0].time : "-";
    // เวลาออก: สแกนเช้าวันถัดไปมาก่อน ไม่มีค่อยใช้สแกนสุดท้ายของวันเดียวกัน (ที่ไม่ใช่ครั้งแรก)
    let checkOut = "-";
    if (b.after.length > 0) {
      checkOut = b.after[b.after.length - 1].time;
      overnightPaired++;
    } else if (b.ins.length > 1) {
      checkOut = b.ins[b.ins.length - 1].time;
    }
    days.push({ date, checkIn, checkOut, overnight: b.after.length > 0 });
  }
  return { days, overnightPaired };
}

/* ───────────── กะของพนักงาน (ให้ตรงกับ get_shift_start_time ในฐานข้อมูล) ───────────── */

export interface ShiftRow { id: string; name: string; start_time: string; end_time: string }
export interface ShiftAssignmentRow { employee_id: string; shift_id: string; start_date: string; end_date: string | null }

const toWindow = (start: string, end: string): ShiftWindow | null => {
  if (!/^\d{1,2}:\d{2}/.test(start || "") || !/^\d{1,2}:\d{2}/.test(end || "")) return null;
  return { start: toMinutes(start.slice(0, 5)), end: toMinutes(end.slice(0, 5)) };
};

/** คืนฟังก์ชันหา "กะของพนักงานในวันที่หนึ่ง": การมอบหมายกะ (ล่าสุดที่ครอบวันนั้น) → ชื่อกะที่เก็บในตัวพนักงาน */
export function buildShiftResolver(
  shifts: ShiftRow[],
  assignments: ShiftAssignmentRow[],
  employeeShiftText: Map<string, string>,
): (employeeId: string, date: string) => ShiftWindow | null {
  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  const byEmployee = new Map<string, ShiftAssignmentRow[]>();
  for (const a of assignments) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.start_date || "")) continue;
    const arr = byEmployee.get(a.employee_id) || [];
    arr.push(a);
    byEmployee.set(a.employee_id, arr);
  }
  for (const arr of byEmployee.values()) arr.sort((x, y) => (x.start_date < y.start_date ? 1 : -1)); // ล่าสุดก่อน

  const fromText = (text: string): ShiftWindow | null => {
    if (!text) return null;
    const hit = shifts.find((s) => text === s.name || text === `${s.name} ${s.start_time}-${s.end_time}`);
    if (hit) return toWindow(hit.start_time, hit.end_time);
    const m = text.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    return m ? toWindow(m[1].padStart(5, "0"), m[2].padStart(5, "0")) : null;
  };

  return (employeeId, date) => {
    for (const a of byEmployee.get(employeeId) || []) {
      if (a.start_date > date) continue;
      const end = a.end_date || "";
      if (end && /^\d{4}-\d{2}-\d{2}$/.test(end) && end < date) continue;
      const s = shiftById.get(a.shift_id);
      const w = s ? toWindow(s.start_time, s.end_time) : null;
      if (w) return w;
    }
    return fromText(employeeShiftText.get(employeeId) || "");
  };
}
