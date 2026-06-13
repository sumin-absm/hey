import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, serializeMedicine, serializeHistory } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 4000);

const VALID_TIMINGS = new Set(["식전", "식후", "취침 전", "기타"]);
const VALID_STATUSES = new Set(["DONE", "SKIPPED", "MISSED"]);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

app.use(cors());
app.use(express.json());

function nowIso() {
  return new Date().toISOString();
}

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTimes(times) {
  const list = Array.isArray(times) ? times : [];
  return [...new Set(list.map((time) => String(time).trim()).filter((time) => TIME_PATTERN.test(time)))].sort();
}

function normalizeDate(date) {
  const value = String(date || "").trim();
  return DATE_PATTERN.test(value) ? value : todayDate();
}

function validateMedicinePayload(payload) {
  const name = String(payload.name || "").trim();
  const dosage = String(payload.dosage || "").trim();
  const frequency = Number.parseInt(payload.frequency, 10);
  const timing = VALID_TIMINGS.has(payload.timing) ? payload.timing : "기타";
  const times = normalizeTimes(payload.times);

  if (!name) {
    return { error: "약 이름을 입력해 주세요." };
  }

  if (!dosage) {
    return { error: "복용량을 입력해 주세요." };
  }

  if (times.length === 0) {
    return { error: "알림 시간을 한 개 이상 입력해 주세요." };
  }

  return {
    value: {
      name,
      dosage,
      frequency: Number.isFinite(frequency) && frequency > 0 ? frequency : times.length,
      timing,
      times,
      isImportant: payload.isImportant ? 1 : 0,
      caution: String(payload.caution || "").trim(),
      contraindication: String(payload.contraindication || "").trim()
    }
  };
}

function getMedicineById(id) {
  return db.prepare("SELECT * FROM medicines WHERE id = ?").get(id);
}

function getAllMedicines() {
  return db
    .prepare("SELECT * FROM medicines ORDER BY name COLLATE NOCASE ASC, id ASC")
    .all()
    .map(serializeMedicine);
}

function getHistoryRows(date) {
  return db
    .prepare(
      `
        SELECT h.*, m.isImportant, m.timing, m.caution, m.contraindication
        FROM medication_history h
        LEFT JOIN medicines m ON m.id = h.medicineId
        WHERE h.date = ?
      `
    )
    .all(date);
}

function getHistoryMap(rows) {
  return new Map(rows.map((row) => [`${row.medicineId}-${row.scheduledTime}`, row]));
}

function scheduleItemFromHistory(row, date) {
  return {
    id: row.id,
    medicineId: row.medicineId,
    medicineName: row.medicineName,
    name: row.medicineName,
    dosage: row.dosage,
    timing: row.timing || "기타",
    scheduledTime: row.scheduledTime,
    actualTime: row.actualTime,
    status: row.status,
    date,
    memo: row.memo || "",
    isImportant: Boolean(row.isImportant),
    caution: row.caution || "",
    contraindication: row.contraindication || "",
    createdAt: row.createdAt
  };
}

function buildScheduleForDate(date, emptyStatus = "MISSED", options = {}) {
  const historyRows = getHistoryRows(date);
  const historyMap = getHistoryMap(historyRows);
  const seenKeys = new Set();
  const activeSchedule = getAllMedicines()
    .flatMap((medicine) =>
      medicine.times.map((scheduledTime) => {
        const key = `${medicine.id}-${scheduledTime}`;
        const history = historyMap.get(`${medicine.id}-${scheduledTime}`);
        seenKeys.add(key);

        return {
          id: history?.id || null,
          medicineId: medicine.id,
          medicineName: medicine.name,
          name: medicine.name,
          dosage: medicine.dosage,
          timing: medicine.timing,
          scheduledTime,
          actualTime: history?.actualTime || null,
          status: history?.status || emptyStatus,
          date,
          memo: history?.memo || "",
          isImportant: medicine.isImportant,
          caution: medicine.caution,
          contraindication: medicine.contraindication,
          createdAt: history?.createdAt || null
        };
      })
    );

  const historyOnly = options.includeHistoryOnly
    ? historyRows.filter((row) => !seenKeys.has(`${row.medicineId}-${row.scheduledTime}`)).map((row) => scheduleItemFromHistory(row, date))
    : [];

  return [...activeSchedule, ...historyOnly].sort(
    (a, b) => a.scheduledTime.localeCompare(b.scheduledTime) || a.medicineName.localeCompare(b.medicineName)
  );
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/medicines", (req, res) => {
  res.json(getAllMedicines());
});

app.get("/api/medicines/:id", (req, res) => {
  const medicine = serializeMedicine(getMedicineById(req.params.id));

  if (!medicine) {
    return res.status(404).json({ message: "약 정보를 찾을 수 없습니다." });
  }

  res.json(medicine);
});

app.post("/api/medicines", (req, res) => {
  const { value, error } = validateMedicinePayload(req.body);

  if (error) {
    return res.status(400).json({ message: error });
  }

  const createdAt = nowIso();
  const result = db
    .prepare(
      `
        INSERT INTO medicines
          (name, dosage, frequency, timing, times, isImportant, caution, contraindication, createdAt, updatedAt)
        VALUES
          (@name, @dosage, @frequency, @timing, @times, @isImportant, @caution, @contraindication, @createdAt, @updatedAt)
      `
    )
    .run({
      ...value,
      times: JSON.stringify(value.times),
      createdAt,
      updatedAt: createdAt
    });

  res.status(201).json(serializeMedicine(getMedicineById(result.lastInsertRowid)));
});

app.put("/api/medicines/:id", (req, res) => {
  const existing = getMedicineById(req.params.id);

  if (!existing) {
    return res.status(404).json({ message: "약 정보를 찾을 수 없습니다." });
  }

  const { value, error } = validateMedicinePayload(req.body);

  if (error) {
    return res.status(400).json({ message: error });
  }

  db.prepare(
    `
      UPDATE medicines
      SET name = @name,
          dosage = @dosage,
          frequency = @frequency,
          timing = @timing,
          times = @times,
          isImportant = @isImportant,
          caution = @caution,
          contraindication = @contraindication,
          updatedAt = @updatedAt
      WHERE id = @id
    `
  ).run({
    ...value,
    id: req.params.id,
    times: JSON.stringify(value.times),
    updatedAt: nowIso()
  });

  res.json(serializeMedicine(getMedicineById(req.params.id)));
});

app.delete("/api/medicines/:id", (req, res) => {
  const existing = getMedicineById(req.params.id);

  if (!existing) {
    return res.status(404).json({ message: "약 정보를 찾을 수 없습니다." });
  }

  db.prepare("DELETE FROM medicines WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

app.get("/api/history", (req, res) => {
  const date = normalizeDate(req.query.date);
  res.json(buildScheduleForDate(date, "MISSED", { includeHistoryOnly: true }));
});

app.post("/api/history", (req, res) => {
  const medicineId = Number.parseInt(req.body.medicineId, 10);
  const medicine = getMedicineById(medicineId);
  const scheduledTime = String(req.body.scheduledTime || "").trim();
  const status = String(req.body.status || "").trim();
  const date = normalizeDate(req.body.date);

  if (!medicine) {
    return res.status(404).json({ message: "약 정보를 찾을 수 없습니다." });
  }

  if (!TIME_PATTERN.test(scheduledTime)) {
    return res.status(400).json({ message: "올바른 알림 시간이 필요합니다." });
  }

  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ message: "올바른 복약 상태가 필요합니다." });
  }

  const actualTime = status === "MISSED" ? null : nowIso();
  const createdAt = nowIso();

  db.prepare(
    `
      INSERT INTO medication_history
        (medicineId, medicineName, dosage, scheduledTime, actualTime, status, date, memo, createdAt)
      VALUES
        (@medicineId, @medicineName, @dosage, @scheduledTime, @actualTime, @status, @date, @memo, @createdAt)
      ON CONFLICT(medicineId, scheduledTime, date) DO UPDATE SET
        medicineName = excluded.medicineName,
        dosage = excluded.dosage,
        actualTime = excluded.actualTime,
        status = excluded.status,
        memo = excluded.memo
    `
  ).run({
    medicineId,
    medicineName: medicine.name,
    dosage: medicine.dosage,
    scheduledTime,
    actualTime,
    status,
    date,
    memo: String(req.body.memo || "").trim(),
    createdAt
  });

  const row = db
    .prepare(
      `
        SELECT h.*, m.isImportant, m.timing, m.caution, m.contraindication
        FROM medication_history h
        LEFT JOIN medicines m ON m.id = h.medicineId
        WHERE h.medicineId = ? AND h.scheduledTime = ? AND h.date = ?
      `
    )
    .get(medicineId, scheduledTime, date);

  res.status(201).json(serializeHistory(row));
});

app.get("/api/today", (req, res) => {
  res.json(buildScheduleForDate(todayDate(), "PENDING"));
});

const distPath = path.resolve(__dirname, "..", "dist");
app.use(express.static(distPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  res.sendFile(path.join(distPath, "index.html"), (error) => {
    if (error) {
      res.status(404).send("Frontend build not found. Run npm run build first.");
    }
  });
});

app.listen(PORT, () => {
  console.log(`Medication API server running on http://localhost:${PORT}`);
});
