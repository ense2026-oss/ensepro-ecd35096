/* eslint-disable */
// Converts ประวัติพนักงาน2569.xlsx into the shape the app's employees table needs,
// generates login usernames, and writes a review workbook for the admin to check
// BEFORE anything is written to the database.
//
//   node tools/build-import.cjs
//
// Outputs (next to the source file, in tools/out/):
//   employees-import.json   — payload for the import edge function
//   employees-review.xlsx   — human review sheet (usernames, mappings, warnings)

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const SRC = "D:/Project/000-ENSEPro/User/03-02-10-69/ประวัติพนักงาน2569.xlsx";
const EMAIL_SRC = "D:/Project/000-ENSEPro/User/03-02-10-69/ข้อมูลEmail อัพเดท 2 ตุลาคม 2569.xlsx";
const OUT_DIR = path.join(__dirname, "out");
const USERNAME_DOMAIN = "ensepro.com";
const DEFAULT_PASSWORD = "123456";

/* ─────────────── Thai → Latin (RTGS-ish, syllable aware) ─────────────── */
// Enough for generating a login handle; every result is shown to the admin for review.
const INITIAL = {
  ก: "k", ข: "kh", ฃ: "kh", ค: "kh", ฅ: "kh", ฆ: "kh", ง: "ng",
  จ: "ch", ฉ: "ch", ช: "ch", ซ: "s", ฌ: "ch", ญ: "y",
  ฎ: "d", ฏ: "t", ฐ: "th", ฑ: "th", ฒ: "th", ณ: "n",
  ด: "d", ต: "t", ถ: "th", ท: "th", ธ: "th", น: "n",
  บ: "b", ป: "p", ผ: "ph", ฝ: "f", พ: "ph", ฟ: "f", ภ: "ph", ม: "m",
  ย: "y", ร: "r", ล: "l", ว: "w", ศ: "s", ษ: "s", ส: "s",
  ห: "h", ฬ: "l", อ: "", ฮ: "h",
};
// Final-position consonants take a different sound in Thai.
const FINAL = {
  ก: "k", ข: "k", ค: "k", ฆ: "k", ง: "ng",
  จ: "t", ช: "t", ซ: "t", ฌ: "t", ฎ: "t", ฏ: "t", ฐ: "t", ฑ: "t", ฒ: "t",
  ด: "t", ต: "t", ถ: "t", ท: "t", ธ: "t", ศ: "t", ษ: "t", ส: "t",
  ญ: "n", ณ: "n", น: "n", ร: "n", ล: "n", ฬ: "n",
  บ: "p", ป: "p", พ: "p", ฟ: "p", ภ: "p", ม: "m",
  ย: "i", ว: "o", ง_: "ng",
};
const TONE = new Set(["่", "้", "๊", "๋", "็", "ฺ"]);
const KILLER = "์";

function isCons(c) { return Object.prototype.hasOwnProperty.call(INITIAL, c); }

// Very small syllable splitter: walks the string, handles leading vowels
// (เ แ โ ใ ไ written before the consonant) and the silent mark.
function translitWord(word) {
  const s = [...String(word || "").trim()];
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (TONE.has(c)) { i++; continue; }
    if (c === KILLER) { // kills the consonant written before it
      out = out.replace(/(kh|ch|th|ph|ng|[a-z])$/, "");
      i++; continue;
    }
    // leading vowels: vowel is written first, consonant follows
    if ("เแโใไ".includes(c)) {
      const nxt = s[i + 1];
      const cons = isCons(nxt) ? INITIAL[nxt] : "";
      const v = c === "เ" ? "e" : c === "แ" ? "ae" : c === "โ" ? "o" : "ai";
      out += cons + v;
      i += isCons(nxt) ? 2 : 1;
      // trailing vowel marks that close the syllable
      while (i < s.length && TONE.has(s[i])) i++;
      if (s[i] === "ีย" ) i++;
      continue;
    }
    if (isCons(c)) {
      let cons = INITIAL[c];
      i++;
      // skip tone marks
      while (i < s.length && TONE.has(s[i])) i++;
      // following vowel
      const v = s[i];
      const VOWELS = {
        "ะ": "a", "ั": "a", "า": "a", "ๅ": "a",
        "ิ": "i", "ี": "i", "ึ": "ue", "ื": "ue",
        "ุ": "u", "ู": "u", "ำ": "am", "็": "",
      };
      if (v !== undefined && VOWELS[v] !== undefined) {
        cons += VOWELS[v];
        i++;
        while (i < s.length && TONE.has(s[i])) i++;
        // optional final consonant
        if (i < s.length && isCons(s[i]) && s[i + 1] !== undefined && !("ะัาิีึืุูำเแโใไ".includes(s[i + 1] || ""))) {
          // only treat as final when not starting a new vowel syllable
        }
        out += cons;
        continue;
      }
      // no explicit vowel: implicit 'a' (or final consonant)
      const prevEndsVowel = /[aeiou]$/.test(out);
      if (prevEndsVowel && FINAL[c]) {
        out += FINAL[c]; // closes the previous syllable
      } else {
        out += cons + (i < s.length ? "a" : "");
      }
      continue;
    }
    i++; // anything else (spaces, digits, punctuation)
  }
  return out.replace(/[^a-z]/g, "");
}

/* ─────────────── helpers ─────────────── */
const THAI_MONTH = {
  "ม.ค": 1, "ก.พ": 2, "มี.ค": 3, "เม.ย": 4, "พ.ค": 5, "มิ.ย": 6,
  "ก.ค": 7, "ส.ค": 8, "ก.ย": 9, "ต.ค": 10, "พ.ย": 11, "ธ.ค": 12,
};
function thMonthNum(m) {
  const k = String(m || "").replace(/\./g, "").trim();
  for (const [key, v] of Object.entries(THAI_MONTH)) {
    if (k === key.replace(/\./g, "")) return v;
  }
  return null;
}
// "1 ธ.ค 63" / "4 ส.ค. 68" → "2020-12-01"
function parseThaiDate(s) {
  const raw = String(s || "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{1,2})\s*([ก-ฮ.]+)\s*(\d{2,4})$/);
  if (!m) return "";
  const day = parseInt(m[1], 10);
  const mon = thMonthNum(m[2]);
  let year = parseInt(m[3], 10);
  if (!mon) return "";
  if (year < 100) year += 2500;
  const ce = year - 543;
  return `${ce}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function parseBirth(day, monTh, yearBE) {
  const d = parseInt(String(day || "").trim(), 10);
  const mon = thMonthNum(monTh);
  let y = parseInt(String(yearBE || "").trim(), 10);
  if (!d || !mon || !y) return "";
  if (y < 100) y += 2500;
  return `${y - 543}-${String(mon).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
const clean = (v) => String(v ?? "").trim();
const digits = (v) => clean(v).replace(/[^\d]/g, "");
const money = (v) => clean(v).replace(/[,\s]/g, "").replace(/\.00$/, "");
const num = (v) => { const n = parseInt(digits(v), 10); return Number.isFinite(n) ? n : 0; };

/* ─────────────── mapping tables (admin can adjust in the review sheet) ─────────────── */
const POSITION_MAP = {
  "ผู้จัดการ": "ผู้จัดการ",
  "บริหาร": "ผู้บริหาร",
  "ช่างเทคนิค": "พนักงานช่าง",
  "พขร": "พนักงานขับรถไฟฟ้า",
  "นายสถานี": "นายสถานี",
  "ผู้ช่วยนายสถานี": "ผู้ช่วยนายสถานี",
  "วิศวกร": "วิศวกร",
  "ธุรการ": "เจ้าหน้าที่ธุรการ",
};
// Department comes from the position, since the Excel's 3 broad groups don't
// match the app's affiliations one-to-one.
const DEPT_BY_POSITION = {
  "ผู้จัดการ": "ผู้บริหาร",
  "ผู้บริหาร": "ผู้บริหาร",
  "พนักงานช่าง": "งานวิศวกรรม",
  "วิศวกร": "งานวิศวกรรม",
  "เจ้าหน้าที่ธุรการ": "งานธุรการ",
  "พนักงานขับรถไฟฟ้า": "บริการ",
  "นายสถานี": "บริการ",
  "ผู้ช่วยนายสถานี": "บริการ",
};
const GENDER_MAP = { "ชาย": "ชาย", "หญิง": "หญิง" };

/* ─────────────── load ─────────────── */
const wb = XLSX.readFile(SRC);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false })
  .filter((r) => clean(r["ชื่อ"]));

// Secondary file: name → email (only used when the main file has no email)
const emailWb = XLSX.readFile(EMAIL_SRC);
const emailRows = XLSX.utils.sheet_to_json(emailWb.Sheets[emailWb.SheetNames[0]], { defval: "", raw: false });
const extraEmail = new Map();
for (const r of emailRows) {
  const nm = clean(r["ชื่อ"]).replace(/\(.*?\)/g, "").replace(/^(นาย|นางสาว|นาง)\s*/, "").replace(/\s+/g, "");
  const em = clean(r["อีเมล"]).toLowerCase();
  if (nm && em) extraEmail.set(nm, em);
}

/* ─────────────── build ─────────────── */
// Pick the romanised given name: prefer the spelling the person already uses in
// their own email address, fall back to transliteration.
function romanFirstName(thFirst, thLast, email) {
  const tFirst = translitWord(thFirst);
  const tLast = translitWord(thLast);
  const local = clean(email).split("@")[0].toLowerCase().replace(/[^a-z]/g, "");
  if (local) {
    // If the email starts with something close to the transliterated first name,
    // take that prefix as the person's own spelling.
    for (let len = Math.min(local.length, tFirst.length + 4); len >= 3; len--) {
      const cand = local.slice(0, len);
      if (cand[0] === tFirst[0] && Math.abs(cand.length - tFirst.length) <= 3) {
        const rest = local.slice(len);
        // good split: the remainder looks like the surname (or nothing left)
        if (!rest || (tLast && rest[0] === tLast[0])) return { roman: cand, source: "email" };
      }
    }
    if (local.length <= 12 && local[0] === tFirst[0]) return { roman: local, source: "email(ทั้งก้อน)" };
  }
  return { roman: tFirst, source: "ถอดเสียง" };
}

const used = new Map();
const out = [];
for (const r of rows) {
  const thFirst = clean(r["ชื่อ"]);
  const thLast = clean(r["สกุล"]);
  const nameKey = (thFirst + thLast).replace(/\s+/g, "");
  const email = clean(r["Email"]).toLowerCase() || extraEmail.get(nameKey) || "";

  const { roman, source } = romanFirstName(thFirst, thLast, email);
  const lastInitial = (translitWord(thLast)[0] || "x");
  let base = `${roman}.${lastInitial}`.replace(/[^a-z.]/g, "");
  let username = base;
  const n = (used.get(base) || 0) + 1;
  used.set(base, n);
  if (n > 1) username = `${base}${n}`;

  const posTh = clean(r["ตำแหน่ง"]);
  const position = POSITION_MAP[posTh] || posTh;
  const dept = DEPT_BY_POSITION[position] || clean(r["ฝ่าย"]);

  const addr = [
    clean(r["เลขที่"]) && `${clean(r["เลขที่"])}`,
    clean(r["หมู่"]) && `หมู่ ${clean(r["หมู่"])}`,
    clean(r["ซอย"]) && `ซ.${clean(r["ซอย"])}`,
    clean(r["ถนน"]) && `ถ.${clean(r["ถนน"])}`,
    clean(r["ตำบล"]) && `ต.${clean(r["ตำบล"])}`,
    clean(r["อำเภอ"]) && `อ.${clean(r["อำเภอ"])}`,
    clean(r["จังหวัด"]) && `จ.${clean(r["จังหวัด"])}`,
    clean(r["รหัสไปรษณีย์"]),
  ].filter(Boolean).join(" ");

  const warn = [];
  if (!email) warn.push("ไม่มีอีเมล");
  if (source !== "email") warn.push("username จากการถอดเสียง ตรวจสอบ");
  if (!POSITION_MAP[posTh]) warn.push(`ตำแหน่ง "${posTh}" ไม่มีในระบบ`);
  if (!parseThaiDate(r["วันเริ่มงาน"]) && !parseThaiDate(r["วันผ่านทดลองงาน"])) warn.push("ไม่มีวันเริ่มงาน");
  if (!digits(r["ID Card"])) warn.push("ไม่มีเลขบัตรประชาชน");
  if (digits(r["ID Card"]) && digits(r["ID Card"]).length !== 13) warn.push("เลขบัตรไม่ครบ 13 หลัก");

  out.push({
    seq: clean(r["ลำดับ"]),
    username,
    auth_email: `${username}@${USERNAME_DOMAIN}`,
    password: DEFAULT_PASSWORD,
    prefix: clean(r["__EMPTY"]),
    first_name: thFirst,
    last_name: thLast,
    nickname: clean(r["ชื่อเล่น"]),
    email, // real/contact email (may be empty)
    gender: GENDER_MAP[clean(r["เพศ"])] || "",
    national_id: digits(r["ID Card"]),
    birth_date: parseBirth(r["วันเกิด"], r["เดือนเกิด"], r["ปีเกิด"]),
    blood_group: clean(r["กรุ๊ปเลือด"]),
    phone: clean(r["เบอร์โทรศัพท์"]).split(",")[0].trim(),
    address: addr,
    home_address: addr,
    dept,
    position,
    position_source: posTh,
    dept_source: clean(r["ฝ่าย"]),
    start_date: parseThaiDate(r["วันเริ่มงาน"]) || parseThaiDate(r["วันผ่านทดลองงาน"]),
    trial_end_date: parseThaiDate(r["วันผ่านทดลองงาน"]),
    contract_end_date: parseThaiDate(r["วันสิ้นสุดสัญญาจ้าง"]),
    salary: money(r["เงินเดือน 69"]),
    bank_account: clean(r["ธนาคารกสิกร"]),
    driver_license: clean(r["ท2"]) === "มี" ? `ท.2${parseThaiDate(r["วันหมดอายุ"]) ? ` (หมดอายุ ${parseThaiDate(r["วันหมดอายุ"])})` : ""}` : "",
    marital_status: clean(r["สถานภาพ"]),
    children: num(r["จำนวนบุตร"]),
    sons: num(r["บุตรชาย"]),
    daughters: num(r["บุตรสาว"]),
    education_level: clean(r["วุฒิการศึกษา"]),
    education_major: clean(r["สาขาที่สำเร็จการศึกษา"]),
    education_school: clean(r["สถาบัน"]),
    note: clean(r["หมายเหตุ"]),
    username_source: source,
    warnings: warn.join(" · "),
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "employees-import.json"), JSON.stringify(out, null, 2), "utf8");

/* ─────────────── review workbook ─────────────── */
const reviewRows = out.map((e) => ({
  "ลำดับ": e.seq,
  "คำนำหน้า": e.prefix,
  "ชื่อ": e.first_name,
  "สกุล": e.last_name,
  "ชื่อเล่น": e.nickname,
  "USERNAME (แก้ได้)": e.username,
  "รหัสผ่าน": e.password,
  "ที่มา username": e.username_source,
  "อีเมลจริง": e.email,
  "แผนก (แมปแล้ว)": e.dept,
  "ตำแหน่ง (แมปแล้ว)": e.position,
  "ตำแหน่งในไฟล์": e.position_source,
  "ฝ่ายในไฟล์": e.dept_source,
  "วันเริ่มงาน": e.start_date,
  "วันผ่านทดลอง": e.trial_end_date,
  "เงินเดือน": e.salary,
  "บัตรประชาชน": e.national_id,
  "วันเกิด": e.birth_date,
  "เบอร์โทร": e.phone,
  "สถานภาพ": e.marital_status,
  "บุตร": e.children,
  "วุฒิ": e.education_level,
  "⚠ ต้องตรวจ": e.warnings,
}));
const rwb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(reviewRows);
ws["!cols"] = Object.keys(reviewRows[0] || {}).map((k) => ({ wch: k.includes("ต้องตรวจ") ? 46 : Math.max(12, k.length + 4) }));
XLSX.utils.book_append_sheet(rwb, ws, "ตรวจสอบก่อนนำเข้า");

const dupUsernames = [...used.entries()].filter(([, c]) => c > 1).map(([u, c]) => ({ username: u, "จำนวนซ้ำ": c }));
XLSX.utils.book_append_sheet(rwb, XLSX.utils.json_to_sheet(dupUsernames.length ? dupUsernames : [{ username: "(ไม่มีซ้ำ)", "จำนวนซ้ำ": 0 }]), "ชื่อผู้ใช้ซ้ำ");

const summary = [
  { "หัวข้อ": "จำนวนพนักงานในไฟล์", "ค่า": out.length },
  { "หัวข้อ": "username จากอีเมลจริง (แม่นยำ)", "ค่า": out.filter((e) => e.username_source.startsWith("email")).length },
  { "หัวข้อ": "username จากการถอดเสียง (ต้องตรวจ)", "ค่า": out.filter((e) => e.username_source === "ถอดเสียง").length },
  { "หัวข้อ": "ไม่มีอีเมล", "ค่า": out.filter((e) => !e.email).length },
  { "หัวข้อ": "ไม่มีวันเริ่มงาน", "ค่า": out.filter((e) => !e.start_date).length },
  { "หัวข้อ": "เลขบัตรไม่ครบ 13 หลัก", "ค่า": out.filter((e) => e.national_id.length !== 13).length },
  { "หัวข้อ": "โดเมนอีเมลสังเคราะห์", "ค่า": "@" + USERNAME_DOMAIN },
  { "หัวข้อ": "รหัสผ่านเริ่มต้น", "ค่า": DEFAULT_PASSWORD },
];
XLSX.utils.book_append_sheet(rwb, XLSX.utils.json_to_sheet(summary), "สรุป");
XLSX.writeFile(rwb, path.join(OUT_DIR, "employees-review.xlsx"));

console.log("employees:", out.length);
console.log("username from email:", out.filter((e) => e.username_source.startsWith("email")).length);
console.log("username transliterated:", out.filter((e) => e.username_source === "ถอดเสียง").length);
console.log("duplicate bases:", dupUsernames);
console.log("no start_date:", out.filter((e) => !e.start_date).length);
console.log("bad national_id:", out.filter((e) => e.national_id.length !== 13).length);
console.log("\nsample:");
out.slice(0, 12).forEach((e) => console.log(" ", e.username.padEnd(20), e.first_name, e.last_name, "|", e.position, "|", e.dept, "|", e.username_source));
console.log("\nwrote →", OUT_DIR);
