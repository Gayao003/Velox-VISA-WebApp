import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env file at ${envPath}`);
  }
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return env;
}

function excelDateToIso(val) {
  if (typeof val === 'number' && val > 0) {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  if (typeof val === 'string' && val.trim()) {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toISOString().slice(0, 10);
    }
  }
  return '';
}

function excelTimeToHHMM(val) {
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    const s = val.trim().toUpperCase();
    const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
    if (m) {
      let h = parseInt(m[1], 10);
      const min = m[2];
      const ap = m[3];
      if (ap === 'PM' && h < 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${min}`;
    }
    return s;
  }
  return '';
}

function sanitizeIdPart(s) {
  return String(s || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function shortHash(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 8);
}

function getDataRows(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheetName =
    wb.SheetNames.find((n) => !n.toLowerCase().startsWith('lov')) || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
}

function todayIsoManila() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function resolveDsrStationId(stationName, fileName) {
  const s = String(stationName || '').toLowerCase();
  const f = String(fileName || '').toLowerCase();
  if (s.includes('agusan 1') || f.includes('agu1')) return 'VLX-AG1';
  if (s.includes('agusan 2') || f.includes('agu2')) return 'VLX-AG2';
  return String(stationName || '').trim();
}

function parseDsrFolder(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter((f) => f.toLowerCase().endsWith('.xlsx'));
  const nowIso = new Date().toISOString();
  const records = [];

  for (const file of files) {
    const rows = getDataRows(path.join(dirPath, file));
    const headerIdx = rows.findIndex(
      (r) =>
        String(r[0] || '').trim().toLowerCase() === 'station' &&
        String(r[1] || '').trim().toLowerCase() === 'date'
    );

    if (headerIdx < 0) {
      console.warn(`[DSR] Skipping unrecognized file layout: ${file}`);
      continue;
    }

    const fileTag = shortHash(file);

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const station = String(r[0] || '').trim();
      const date = excelDateToIso(r[1]);
      const shift = String(r[2] || '').trim();
      const product = String(r[3] || '').trim();
      const totalQty = Number(r[4]) || 0;
      const creditVolume = Number(r[5]) || 0;
      const cashVolume = Number(r[6]) || 0;
      const cashlessVolume = Number(r[7]) || 0;
      const rate = Number(r[8]) || 0;
      const creditDisc = Number(r[9]) || 0;
      const cashDisc = Number(r[10]) || 0;
      const cashlessDisc = Number(r[11]) || 0;

      if (!station && !date && !product) continue;
      if (!station || !date || !product) continue;

      const stationId = resolveDsrStationId(station, file);

      records.push({
        id: `dsr_seed_${sanitizeIdPart(stationId)}_${date}_${fileTag}_${i}`,
        stationId,
        station,
        date,
        shift,
        product,
        totalQty,
        creditVolume,
        cashVolume,
        cashlessVolume,
        rate,
        creditDisc,
        cashDisc,
        cashlessDisc,
        createdBy: 'Excel Seed',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }
  return records;
}

function parseSdrFolder(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter((f) => f.toLowerCase().endsWith('.xlsx'));
  const nowIso = new Date().toISOString();
  const records = [];

  for (const file of files) {
    const rows = getDataRows(path.join(dirPath, file));
    const stationId = String(rows[0]?.[1] || rows[0]?.[2] || '').trim();
    const date = excelDateToIso(rows[1]?.[1] || rows[1]?.[2]);
    const shift = String(rows[2]?.[1] || rows[2]?.[2] || '').trim();
    const headerIdx = rows.findIndex((r) =>
      String(r[0] || '').trim().toLowerCase().includes('deposit slip ref')
    );

    if (headerIdx < 0 || !stationId || !date) {
      console.warn(`[SDR] Skipping unrecognized file layout: ${file}`);
      continue;
    }

    const fileTag = shortHash(file);

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const depositSlipRef = String(r[0] || '').trim();
      const source = String(r[1] || 'Cash Sale').trim() || 'Cash Sale';
      const rawAmount = String(r[2] ?? '').trim();
      const amount = Number(rawAmount);
      const depositType = String(r[3] || 'Cash').trim() || 'Cash';
      const bankName = String(r[4] || '').trim();
      const bankAccountNo = String(r[5] || '').trim();

      if (
        !depositSlipRef &&
        !String(r[1] || '').trim() &&
        !rawAmount &&
        !String(r[3] || '').trim() &&
        !bankName &&
        !bankAccountNo
      ) {
        continue;
      }
      if (!depositSlipRef || !rawAmount || Number.isNaN(amount)) continue;

      records.push({
        id: `sdep_seed_${sanitizeIdPart(stationId)}_${date}_${fileTag}_${i}`,
        stationId,
        date,
        shift,
        depositSlipRef,
        source,
        amount,
        depositType,
        bankName,
        bankAccountNo,
        createdBy: 'Excel Seed',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }
  return records;
}

function parseBprFolder(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter((f) => f.toLowerCase().endsWith('.xlsx'));
  const todayStr = todayIsoManila();
  const nowDay = new Date().getDay();
  const isWeekday = nowDay !== 0 && nowDay !== 6;
  const nowIso = new Date().toISOString();
  const records = [];

  for (const file of files) {
    const rows = getDataRows(path.join(dirPath, file));
    const stationId = String(rows[0]?.[2] || rows[0]?.[1] || '').trim();
    const pickUpDate = excelDateToIso(rows[1]?.[2] || rows[1]?.[1]);
    const pickUpTime = excelTimeToHHMM(rows[2]?.[2] || rows[2]?.[1]);
    const bankRepresentative = String(rows[3]?.[2] || rows[3]?.[1] || '').trim();
    const headerIdx = rows.findIndex((r) =>
      String(r[0] || '').trim().toLowerCase().includes('deposit slip ref')
    );

    if (headerIdx < 0 || !stationId || !pickUpDate) {
      console.warn(`[BPR] Skipping unrecognized file layout: ${file}`);
      continue;
    }

    // Apply Bank Pickup Registry V2 rule: past-date pickups on weekdays are Deposited
    const status = isWeekday && pickUpDate < todayStr ? 'Deposited' : 'In-transit';
    const fileTag = shortHash(file);

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const depositSlipRef = String(r[0] || '').trim();
      const depositType = String(r[1] || 'Cash').trim() || 'Cash';
      const slipAmount = Number(r[2]);
      const countedAmount = Number(r[3]);

      if (!depositSlipRef && !r[1] && !r[2] && !r[3]) continue;
      if (!depositSlipRef || Number.isNaN(slipAmount)) continue;

      records.push({
        id: `bpk_seed_${sanitizeIdPart(stationId)}_${pickUpDate}_${fileTag}_${i}`,
        stationId,
        pickUpDate,
        pickUpTime,
        bankRepresentative,
        depositSlipRef,
        depositType,
        slipAmount,
        countedAmount: Number.isNaN(countedAmount) ? slipAmount : countedAmount,
        status,
        createdBy: 'Excel Seed',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }
  return records;
}

function parseScrFolder(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter((f) => f.toLowerCase().endsWith('.xlsx'));
  const nowIso = new Date().toISOString();
  const records = [];

  for (const file of files) {
    const rows = getDataRows(path.join(dirPath, file));
    const date = excelDateToIso(rows[0]?.[1]);
    const stationId = String(rows[1]?.[1] || '').trim();
    const shift = String(rows[2]?.[1] || '').trim();
    const headerIdx = rows.findIndex(
      (r) => String(r[0] || '').trim().toLowerCase() === 'customer'
    );

    if (headerIdx < 0 || !stationId || !date) {
      console.warn(`[SCR] Skipping unrecognized file layout: ${file}`);
      continue;
    }

    const fileTag = shortHash(file);

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const customer = String(r[0] || '').trim();
      const purpose = String(r[1] || '').trim();
      const soaRef = String(r[2] || '').trim();
      const paymentType = String(r[3] || '').trim();
      const crArNo = String(r[4] ?? '').trim();
      const amount = Number(r[5]);
      const mayaPaymentRef = String(r[6] ?? '').trim();
      const checkNo = String(r[7] ?? '').trim();
      const checkDate = excelDateToIso(r[8]) || String(r[8] || '').trim();
      const issuingBank = String(r[9] || '').trim();
      const remarks = String(r[10] || '').trim();

      if (!customer && !r[5]) continue;
      if (!customer || Number.isNaN(amount)) continue;

      records.push({
        id: `scoll_seed_${sanitizeIdPart(stationId)}_${date}_${fileTag}_${i}`,
        date,
        stationId,
        shift,
        customer,
        purpose,
        depositSlipRef: '',
        soaRef,
        paymentType,
        crArNo,
        amount,
        mayaPaymentRef,
        checkNo,
        checkDate,
        issuingBank,
        remarks,
        createdBy: 'Excel Seed',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }
  return records;
}

function parseVdsrFolder(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter((f) => f.toLowerCase().endsWith('.xlsx'));
  const nowIso = new Date().toISOString();
  const records = [];

  for (const file of files) {
    const rows = getDataRows(path.join(dirPath, file));
    const stationId = String(rows[0]?.[1] || '').trim();
    const date = excelDateToIso(rows[1]?.[1]);
    const headerIdx = rows.findIndex((r) =>
      String(r[0] || '').trim().toLowerCase().includes('deposit slip ref')
    );

    if (headerIdx < 0 || !stationId || !date) {
      console.warn(`[VDSR] Skipping unrecognized file layout: ${file}`);
      continue;
    }

    const fileTag = shortHash(file);

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const depositSlipRef = String(r[0] || '').trim();
      const vdsRefNo = String(r[1] || '').trim();
      const depositDate = excelDateToIso(r[2]) || date;
      const depositTime = excelTimeToHHMM(r[3]);
      const depositType = String(r[4] || 'Cash').trim() || 'Cash';
      const amount = Number(r[5]);

      if (!depositSlipRef && !vdsRefNo && !r[2] && !r[3] && !r[4] && !r[5]) continue;
      if (!depositSlipRef || Number.isNaN(amount)) continue;

      records.push({
        id: `vds_seed_${sanitizeIdPart(stationId)}_${date}_${fileTag}_${i}`,
        stationId,
        date,
        depositSlipRef,
        vdsRefNo,
        depositDate,
        depositTime,
        depositType,
        amount,
        createdBy: 'Excel Seed',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }
  return records;
}

async function replaceSeedDocs(db, colName, seedPrefix, items) {
  const BATCH_SIZE = 400;
  const targetIds = new Set(items.map((x) => x.id));

  // Remove any stale previously-seeded docs whose IDs are no longer in the target set
  const existingSnap = await getDocs(collection(db, colName));
  const staleIds = existingSnap.docs
    .map((d) => d.id)
    .filter((id) => id.startsWith(seedPrefix) && !targetIds.has(id));

  for (let i = 0; i < staleIds.length; i += BATCH_SIZE) {
    const chunk = staleIds.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, colName, id));
    }
    await batch.commit();
  }
  if (staleIds.length > 0) {
    console.log(`  [${colName}] Removed ${staleIds.length} stale seeded doc(s)`);
  }

  let written = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.set(doc(db, colName, item.id), item, { merge: true });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  [${colName}] Committed ${written}/${items.length}`);
  }
}

async function main() {
  const dsrRecords = parseDsrFolder(path.join(ROOT, 'DSR'));
  const sdrRecords = parseSdrFolder(path.join(ROOT, 'AGU1&2 SDR - NOVEMBER'));
  const bprRecords = parseBprFolder(path.join(ROOT, 'BPR'));
  const scrRecords = parseScrFolder(path.join(ROOT, 'SCR'));
  const vdsRecords = parseVdsrFolder(path.join(ROOT, 'VDSR'));

  console.log('Parsed Excel records:');
  console.log(`  DSR  -> dsr_fuel_sales:    ${dsrRecords.length}`);
  console.log(`  SDR  -> shift_deposits:    ${sdrRecords.length}`);
  console.log(`  BPR  -> bank_pickups:      ${bprRecords.length}`);
  console.log(`  SCR  -> shift_collections: ${scrRecords.length}`);
  console.log(`  VDSR -> vds_records:       ${vdsRecords.length}`);

  const uniqueIds = new Set([
    ...dsrRecords.map((r) => r.id),
    ...sdrRecords.map((r) => r.id),
    ...bprRecords.map((r) => r.id),
    ...scrRecords.map((r) => r.id),
    ...vdsRecords.map((r) => r.id),
  ]);
  const totalParsed =
    dsrRecords.length +
    sdrRecords.length +
    bprRecords.length +
    scrRecords.length +
    vdsRecords.length;
  if (uniqueIds.size !== totalParsed) {
    throw new Error(`ID collision detected: ${uniqueIds.size} unique vs ${totalParsed} total`);
  }

  if (DRY_RUN) {
    console.log('\n--dry-run enabled; no Firestore writes performed.');
    process.exit(0);
  }

  const env = loadEnv(path.join(ROOT, '.env'));
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const db = getFirestore(app);

  console.log(`\nSeeding Cloud Firestore project "${env.VITE_FIREBASE_PROJECT_ID}"...`);
  await replaceSeedDocs(db, 'dsr_fuel_sales', 'dsr_seed_', dsrRecords);
  await replaceSeedDocs(db, 'shift_deposits', 'sdep_seed_', sdrRecords);
  await replaceSeedDocs(db, 'bank_pickups', 'bpk_seed_', bprRecords);
  await replaceSeedDocs(db, 'shift_collections', 'scoll_seed_', scrRecords);
  await replaceSeedDocs(db, 'vds_records', 'vds_seed_', vdsRecords);

  console.log('\nSeed complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
