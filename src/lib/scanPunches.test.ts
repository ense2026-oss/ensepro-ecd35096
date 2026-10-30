import { describe, it, expect } from "vitest";
import { dedupePunches, pairPunches, buildShiftResolver, type ShiftWindow } from "./scanPunches";

const day: ShiftWindow = { start: 8 * 60, end: 17 * 60 };
const night: ShiftWindow = { start: 18 * 60, end: 2 * 60 }; // 18:00 → 02:00

describe("dedupePunches", () => {
  it("กรองสแกนซ้ำภายใน 2 นาที แต่เก็บครั้งแรก", () => {
    const { kept, removed } = dedupePunches([
      { date: "2026-09-01", time: "08:01" },
      { date: "2026-09-01", time: "08:02" },
      { date: "2026-09-01", time: "17:30" },
    ]);
    expect(removed).toBe(1);
    expect(kept.map((p) => p.time)).toEqual(["08:01", "17:30"]);
  });

  it("ข้ามเที่ยงคืนก็นับระยะห่างถูก", () => {
    const { removed } = dedupePunches([
      { date: "2026-09-01", time: "23:59" },
      { date: "2026-09-02", time: "00:00" },
    ]);
    expect(removed).toBe(1);
  });
});

describe("pairPunches", () => {
  it("กะปกติ: ครั้งแรก=เข้า ครั้งสุดท้าย=ออก, สแกนครั้งเดียว=เข้าอย่างเดียว", () => {
    const { days, overnightPaired } = pairPunches(
      [
        { date: "2026-09-01", time: "08:10" },
        { date: "2026-09-01", time: "12:00" },
        { date: "2026-09-01", time: "17:31" },
        { date: "2026-09-02", time: "08:05" },
      ],
      () => day,
    );
    expect(overnightPaired).toBe(0);
    expect(days).toEqual([
      { date: "2026-09-01", checkIn: "08:10", checkOut: "17:31", overnight: false },
      { date: "2026-09-02", checkIn: "08:05", checkOut: "-", overnight: false },
    ]);
  });

  it("ไม่รู้กะ: ทำงานแบบเดิม", () => {
    const { days } = pairPunches([{ date: "2026-09-01", time: "09:00" }, { date: "2026-09-01", time: "18:00" }], () => null);
    expect(days[0]).toMatchObject({ checkIn: "09:00", checkOut: "18:00" });
  });

  it("กะข้ามเที่ยงคืน: สแกนเช้าที่เกินช่วงยอม (เลิกกะ + 3 ชม.) ถือเป็นของวันใหม่ ไม่ใช่เวลาออก", () => {
    const { days, overnightPaired } = pairPunches(
      [
        { date: "2026-10-01", time: "18:00" },
        { date: "2026-10-02", time: "06:17" },
      ],
      () => night,
    );
    // 06:17 เกิน 02:00 + 3 ชม. (05:00)
    expect(overnightPaired).toBe(0);
    expect(days).toHaveLength(2);
  });

  it("กะข้ามเที่ยงคืน: ออกภายในช่วงที่ยอม", () => {
    const { days, overnightPaired } = pairPunches(
      [
        { date: "2026-10-01", time: "17:58" },
        { date: "2026-10-02", time: "02:10" },
        { date: "2026-10-02", time: "17:55" },
        { date: "2026-10-03", time: "01:40" },
      ],
      () => night,
    );
    expect(overnightPaired).toBe(2);
    expect(days).toEqual([
      { date: "2026-10-01", checkIn: "17:58", checkOut: "02:10", overnight: true },
      { date: "2026-10-02", checkIn: "17:55", checkOut: "01:40", overnight: true },
    ]);
  });

  it("กะข้ามคืนที่มีแต่สแกนออก (ไม่มีสแกนเข้า) ได้วันทำงานที่เข้าเป็น '-'", () => {
    const { days } = pairPunches([{ date: "2026-10-02", time: "01:30" }], () => night);
    expect(days).toEqual([{ date: "2026-10-01", checkIn: "-", checkOut: "01:30", overnight: true }]);
  });

  it("กะ 16:00–00:00: ออกก่อนเที่ยงคืนยังเป็นวันเดียวกัน, ออกหลังเที่ยงคืนจับคู่ข้ามวัน", () => {
    const s: ShiftWindow = { start: 16 * 60, end: 0 };
    const a = pairPunches([{ date: "2026-10-01", time: "15:55" }, { date: "2026-10-01", time: "23:58" }], () => s);
    expect(a.days).toEqual([{ date: "2026-10-01", checkIn: "15:55", checkOut: "23:58", overnight: false }]);
    const b = pairPunches([{ date: "2026-10-01", time: "15:55" }, { date: "2026-10-02", time: "00:06" }], () => s);
    expect(b.days).toEqual([{ date: "2026-10-01", checkIn: "15:55", checkOut: "00:06", overnight: true }]);
  });
});

describe("buildShiftResolver", () => {
  const shifts = [
    { id: "s1", name: "กะเช้า", start_time: "08:00", end_time: "17:00" },
    { id: "s2", name: "กะดึก", start_time: "22:00", end_time: "07:00" },
  ];

  it("ใช้การมอบหมายกะที่ครอบวันนั้นก่อน (ล่าสุดชนะ)", () => {
    const r = buildShiftResolver(
      shifts,
      [
        { employee_id: "e1", shift_id: "s1", start_date: "2026-10-01", end_date: "" },
        { employee_id: "e1", shift_id: "s2", start_date: "2026-10-10", end_date: "2026-10-12" },
      ],
      new Map(),
    );
    expect(r("e1", "2026-10-05")).toEqual({ start: 480, end: 1020 });
    expect(r("e1", "2026-10-11")).toEqual({ start: 1320, end: 420 });
    expect(r("e1", "2026-10-13")).toEqual({ start: 480, end: 1020 });
  });

  it("ไม่มีการมอบหมาย: ใช้ชื่อกะ/ช่วงเวลาในตัวพนักงาน", () => {
    const r = buildShiftResolver(shifts, [], new Map([["e2", "กะดึก"], ["e3", "ช่าง 18น. 18:00-02:00"], ["e4", "กะ ไม่มีเวลา"]]));
    expect(r("e2", "2026-10-01")).toEqual({ start: 1320, end: 420 });
    expect(r("e3", "2026-10-01")).toEqual({ start: 1080, end: 120 });
    expect(r("e4", "2026-10-01")).toBeNull();
    expect(r("e5", "2026-10-01")).toBeNull();
  });
});

import { parseReportRows, resolveSingleScan } from "./scanPunches";

describe("parseReportRows", () => {
  const hdr = ["รหัสที่เครื่อง", "ชื่อ-นามสกุล", "วันที่", "เข้า", "ออก"];
  it("อ่านตามหัวคอลัมน์ แปลงรหัส/วันที่/เวลา", () => {
    const rows = parseReportRows([
      hdr,
      ["1/1", "อัณณ์ชญา", "03-10-2026", "", "17:53"],
      ["2/2", "อิทธิพล", "04-10-2026", "8:14", "16:37"],
      ["", "", "", "", ""],
    ]);
    expect(rows).toEqual([
      { pin: "1", name: "อัณณ์ชญา", date: "2026-10-03", checkIn: "", checkOut: "17:53" },
      { pin: "2", name: "อิทธิพล", date: "2026-10-04", checkIn: "08:14", checkOut: "16:37" },
    ]);
  });
  it("ไฟล์รายงานเต็ม (คอลัมน์เยอะ/ลำดับต่าง) อ่านได้เหมือนกัน", () => {
    const rows = parseReportRows([
      ["ลำดับ", "รหัสที่เครื่อง", "ชื่อ-นามสกุล", "แผนก", "วันที่", "สถานะ", "เข้า", "ออก"],
      ["1", "9/9", "ทดสอบ", "x", "01-10-2026", "วันทำงาน", "07:01", "16:30"],
    ]);
    expect(rows).toEqual([{ pin: "9", name: "ทดสอบ", date: "2026-10-01", checkIn: "07:01", checkOut: "16:30" }]);
  });
  it("หัวคอลัมน์ไม่ครบ = null", () => {
    expect(parseReportRows([["a", "b"], ["1", "2"]])).toBeNull();
  });
});

describe("resolveSingleScan", () => {
  it("ใช้จุดกึ่งกลางกะ", () => {
    expect(resolveSingleScan("08:10", { start: 480, end: 1020 })).toBe("in");
    expect(resolveSingleScan("17:20", { start: 480, end: 1020 })).toBe("out");
    expect(resolveSingleScan("06:28", { start: 420, end: 960 })).toBe("in");
  });
  it("กะข้ามคืน", () => {
    expect(resolveSingleScan("18:05", { start: 1080, end: 120 })).toBe("in");
    expect(resolveSingleScan("01:50", { start: 1080, end: 120 })).toBe("out");
  });
  it("ไม่รู้กะ: ก่อนเที่ยง = เข้า", () => {
    expect(resolveSingleScan("09:00", null)).toBe("in");
    expect(resolveSingleScan("18:00", null)).toBe("out");
  });
});
