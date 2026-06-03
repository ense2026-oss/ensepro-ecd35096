/**
 * FaceScan Bridge — รันบน PC ในออฟฟิศ (เปิดทิ้งไว้)
 * ------------------------------------------------------------------
 * ดึงข้อมูลการสแกนจากเครื่อง HIP CiF76S (ตระกูล ZK) ผ่าน LAN ที่พอร์ต 4370
 * แล้วส่งขึ้นระบบลงเวลาผ่าน Edge Function facescan-ingest
 *
 * การไหลของข้อมูล:
 *   poll   -> facescan-bridge-poll  (รับรายชื่อเครื่อง + คำสั่งที่ค้าง)
 *   pull   -> node-zklib อ่าน attendance log จากเครื่อง
 *   ingest -> facescan-ingest       (บันทึกลงตารางลงเวลา)
 *   ack    -> facescan-bridge-ack   (รายงานผลคำสั่งกลับ)
 *
 * ใช้งาน:  npm install && npm start
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const ZKLib = require("node-zklib");

// ---------- ตั้งค่าจาก .env ----------
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN;
const FN_BASE = (process.env.FN_BASE || "").replace(/\/+$/, "");
const DEVICE_PORT = parseInt(process.env.DEVICE_PORT || "4370", 10); // พอร์ต ZK มาตรฐาน
const ZK_TIMEOUT = parseInt(process.env.ZK_TIMEOUT_MS || "10000", 10);
const DEFAULT_POLL_SECONDS = parseInt(process.env.POLL_SECONDS || "30", 10);

if (!BRIDGE_TOKEN || !FN_BASE) {
  console.error(
    "[config] ขาดค่า BRIDGE_TOKEN หรือ FN_BASE — กรุณาสร้างไฟล์ .env (ดูตัวอย่างใน .env.example)"
  );
  process.exit(1);
}

const POLL_URL = `${FN_BASE}/facescan-bridge-poll`;
const INGEST_URL = `${FN_BASE}/facescan-ingest`;
const ACK_URL = `${FN_BASE}/facescan-bridge-ack`;

// ---------- เก็บ cursor เวลาล่าสุดต่อเครื่อง ----------
const STATE_FILE = path.join(__dirname, "state.json");
let state = {};
try {
  if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) || {};
  }
} catch (e) {
  console.warn("[state] อ่าน state.json ไม่ได้ เริ่มใหม่:", e.message);
  state = {};
}
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.warn("[state] บันทึก state.json ไม่ได้:", e.message);
  }
}

// ---------- helper ----------
function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

const headers = {
  "Content-Type": "application/json",
  "x-bridge-token": BRIDGE_TOKEN,
};

async function httpJson(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${json.error || text || "request failed"}`);
  }
  return json;
}

// แปลง record จากเครื่อง -> รูปแบบที่ facescan-ingest ต้องการ
function normalizeRecord(rec) {
  const enroll = rec.deviceUserId ?? rec.userSn ?? rec.uid;
  const time = rec.recordTime ?? rec.timestamp ?? rec.time;
  const dt = time instanceof Date ? time : new Date(time);
  if (!enroll || isNaN(dt.getTime())) return null;
  return {
    enroll_number: String(enroll),
    datetime: dt.toISOString(),
    verify_mode: "face",
    in_out: typeof rec.state === "number" ? rec.state : undefined,
  };
}

// เชื่อมต่อเครื่อง + ดึง attendance logs ทั้งหมด
async function readDeviceLogs(device) {
  const ip = device.device_ip;
  if (!ip) throw new Error("device ไม่มี device_ip");
  const zk = new ZKLib(ip, DEVICE_PORT, ZK_TIMEOUT, ZK_TIMEOUT);
  await zk.createSocket();
  let logs;
  try {
    const res = await zk.getAttendances();
    logs = Array.isArray(res) ? res : res?.data || [];
  } finally {
    try {
      await zk.disconnect();
    } catch {
      /* ignore */
    }
  }
  return logs;
}

// ส่ง records เข้า ingest
async function pushRecords(deviceId, records) {
  if (!records.length) return { inserted: 0 };
  return await httpJson(INGEST_URL, {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId, records }),
  });
}

// รายงานผลคำสั่งกลับ
async function ack(logId, status, message, extra = {}) {
  if (!logId) return;
  try {
    await httpJson(ACK_URL, {
      method: "POST",
      body: JSON.stringify({ log_id: logId, status, message, ...extra }),
    });
  } catch (e) {
    log("[ack] ส่งผลกลับไม่ได้:", e.message);
  }
}

// ดึงเฉพาะรายการใหม่ (ตาม cursor) แล้วส่งเข้า ingest
async function syncDevice(device, { sinceMs } = {}) {
  const logs = await readDeviceLogs(device);
  const cursor = sinceMs != null ? sinceMs : state[device.id] ? Date.parse(state[device.id]) : 0;

  let maxMs = cursor;
  const fresh = [];
  for (const raw of logs) {
    const rec = normalizeRecord(raw);
    if (!rec) continue;
    const ms = Date.parse(rec.datetime);
    if (ms > cursor) {
      fresh.push(rec);
      if (ms > maxMs) maxMs = ms;
    }
  }

  let inserted = 0;
  if (fresh.length) {
    const result = await pushRecords(device.id, fresh);
    inserted = result.inserted ?? 0;
    log(
      `[sync] ${device.name}: ดึง ${logs.length} รายการ, ใหม่ ${fresh.length}, บันทึก ${inserted}` +
        (result.skipped ? `, ข้าม ${result.skipped}` : "")
    );
  } else {
    log(`[sync] ${device.name}: ไม่มีรายการใหม่ (รวม ${logs.length} รายการบนเครื่อง)`);
  }

  // เลื่อน cursor เฉพาะการ sync ปกติ (ไม่ใช่ pull ย้อนหลัง)
  if (sinceMs == null && maxMs > cursor) {
    state[device.id] = new Date(maxMs).toISOString();
    saveState();
  }

  return { total: logs.length, fresh: fresh.length, inserted };
}

// ---------- จัดการคำสั่งจากระบบ ----------
async function handleCommand(cmd, deviceMap) {
  const device = cmd.device_id ? deviceMap.get(cmd.device_id) : null;
  log(`[cmd] ${cmd.sync_type} (${cmd.id})${device ? " -> " + device.name : ""}`);

  try {
    if (cmd.sync_type === "test_connection") {
      if (!device) throw new Error("ไม่พบเครื่องสำหรับทดสอบ");
      const zk = new ZKLib(device.device_ip, DEVICE_PORT, ZK_TIMEOUT, ZK_TIMEOUT);
      await zk.createSocket();
      let info = "";
      try {
        const t = await zk.getTime().catch(() => null);
        info = t ? `เวลาเครื่อง: ${t}` : "เชื่อมต่อสำเร็จ";
      } finally {
        try { await zk.disconnect(); } catch { /* ignore */ }
      }
      await ack(cmd.id, "success", `เชื่อมต่อ ${device.name} (${device.device_ip}:${DEVICE_PORT}) ได้ — ${info}`);
      return;
    }

    if (cmd.sync_type === "pull_logs") {
      if (!device) throw new Error("ไม่พบเครื่องสำหรับดึงข้อมูล");
      const days = parseInt(cmd.command_payload?.days ?? 7, 10) || 7;
      const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
      const r = await syncDevice(device, { sinceMs });
      await ack(cmd.id, "success", `ดึงย้อนหลัง ${days} วัน: บันทึก ${r.inserted} จาก ${r.fresh} รายการใหม่`, {
        records_synced: r.inserted,
      });
      return;
    }

    // คำสั่งอื่น (enroll_push / delete_user) — ยังไม่รองรับผ่าน ZK ในเวอร์ชันนี้
    await ack(cmd.id, "error", `คำสั่ง ${cmd.sync_type} ยังไม่รองรับใน Bridge เวอร์ชันนี้`);
  } catch (e) {
    log(`[cmd] ${cmd.sync_type} ล้มเหลว:`, e.message);
    await ack(cmd.id, "error", e.message);
  }
}

// ---------- รอบทำงานหลัก ----------
let pollSeconds = DEFAULT_POLL_SECONDS;

async function tick() {
  try {
    const cfg = await httpJson(POLL_URL, { method: "GET" });
    if (cfg.poll_interval_seconds) pollSeconds = cfg.poll_interval_seconds;

    const devices = (cfg.devices || []).filter(
      (d) => d.enabled && d.device_ip && (d.connection_mode === "bridge" || !d.connection_mode)
    );
    const deviceMap = new Map((cfg.devices || []).map((d) => [d.id, d]));

    // 1) ประมวลคำสั่งที่ค้างอยู่ก่อน
    for (const cmd of cfg.commands || []) {
      await handleCommand(cmd, deviceMap);
    }

    // 2) sync ปกติทุกเครื่อง (เครื่องนึงพังไม่กระทบเครื่องอื่น)
    for (const device of devices) {
      try {
        await syncDevice(device);
      } catch (e) {
        log(`[sync] ${device.name} ล้มเหลว:`, e.message);
      }
    }
  } catch (e) {
    log("[poll] ติดต่อระบบไม่ได้:", e.message);
  } finally {
    setTimeout(tick, pollSeconds * 1000);
  }
}

log("FaceScan Bridge เริ่มทำงาน");
log(`ระบบ: ${FN_BASE}`);
log(`พอร์ตเครื่อง (ZK): ${DEVICE_PORT}, รอบ poll: ${pollSeconds} วินาที`);
tick();
