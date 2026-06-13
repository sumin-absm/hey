import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const port = 4199;
const baseUrl = `http://localhost:${port}`;
const testDb = path.join(process.cwd(), "server", "data", "test-medication.sqlite");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeTestDb() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      for (const suffix of ["", "-wal", "-shm"]) {
        fs.rmSync(`${testDb}${suffix}`, { force: true });
      }
      return;
    } catch (error) {
      if (error.code !== "EPERM" && error.code !== "EBUSY") {
        throw error;
      }
      await wait(250);
    }
  }
}

await removeTestDb();

const server = spawn(process.execPath, ["server/index.js"], {
  env: {
    ...process.env,
    PORT: String(port),
    DB_FILE: testDb,
    NODE_ENV: "test"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once("exit", resolve));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      await wait(250);
    }
  }

  throw new Error("API server did not start in time.");
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${options.method || "GET"} ${pathname} failed: ${response.status} ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

try {
  await waitForServer();

  const medicine = await request("/api/medicines", {
    method: "POST",
    body: JSON.stringify({
      name: "혈압약",
      dosage: "1정",
      frequency: 2,
      timing: "식후",
      times: ["09:00", "21:00"],
      isImportant: true,
      caution: "어지러움 확인",
      contraindication: "자몽"
    })
  });

  if (!medicine.id || medicine.times.length !== 2) {
    throw new Error("Medicine creation returned an unexpected payload.");
  }

  const today = await request("/api/today");
  if (today.length !== 2) {
    throw new Error("Today schedule did not expand medicine times.");
  }

  await request("/api/history", {
    method: "POST",
    body: JSON.stringify({
      medicineId: medicine.id,
      scheduledTime: "09:00",
      status: "DONE",
      date: todayDate()
    })
  });

  const history = await request(`/api/history?date=${todayDate()}`);
  const doneItem = history.find((item) => item.medicineId === medicine.id && item.scheduledTime === "09:00");

  if (!doneItem || doneItem.status !== "DONE") {
    throw new Error("History status was not saved.");
  }

  await request(`/api/medicines/${medicine.id}`, { method: "DELETE" });

  console.log("Smoke test passed: CRUD, today schedule, and history APIs are working.");
} finally {
  server.kill();
  await waitForExit(server);
  await removeTestDb();
}
