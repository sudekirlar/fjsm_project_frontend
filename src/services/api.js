import { dbStore } from "../stores/dbStore";

const API_BASE_URL = "http://localhost:5000";

function withDb(path) {
  const db = (dbStore.db || "PG").toLowerCase();
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}db=${db}`;
}

function headers(json = false) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  h["X-DB"] = dbStore.db; // PG | MONGO
  return h;
}

export async function startSolver() {
  const response = await fetch(`${API_BASE_URL}${withDb("/api/solver/start")}`, {
    method: "POST",
    headers: headers(),
    body: "{}",
  });
  if (!response.ok) throw new Error("Failed to start solver");
  return response.json();
}

export async function startSolverWithLocks(locks = []) {
  const response = await fetch(`${API_BASE_URL}${withDb("/api/solver/start_with_locks")}`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({ locks }),
  });
  if (!response.ok) throw new Error("Failed to start solver with locks");
  return response.json();
}

export async function getSolverStatus(run_id) {
  if (!run_id) return null;
  const response = await fetch(`${API_BASE_URL}${withDb(`/api/solver/status/${run_id}`)}`, {
    headers: headers(),
  });
  if (!response.ok) return null;
  return response.json();
}

export async function getPlanGantt(run_id) {
  if (!run_id) return [];
  const response = await fetch(`${API_BASE_URL}${withDb(`/api/plans/${run_id}/gantt`)}`, {
    headers: headers(),
  });
  if (!response.ok) return [];
  return response.json();
}

export async function getRecentPlans() {
  const res = await fetch(`${API_BASE_URL}${withDb("/api/plans/recent")}`, {
    headers: headers(),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

export async function createOrder(dto) {
  const res = await fetch(`${API_BASE_URL}${withDb("/api/orders")}`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Order create failed");
  }
  return res.json();
}

function wait(ms) { return new Promise((res) => setTimeout(res, ms)); }
export async function getMetrics() { await wait(100); return {}; }
