const API_BASE = "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "요청을 처리하지 못했습니다.");
  }

  if (response.status === 204) return null;
  return response.json();
}

export function getMedicines() {
  return request("/api/medicines");
}

export function getMedicine(id) {
  return request(`/api/medicines/${id}`);
}

export function createMedicine(payload) {
  return request("/api/medicines", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateMedicine(id, payload) {
  return request(`/api/medicines/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteMedicine(id) {
  return request(`/api/medicines/${id}`, {
    method: "DELETE"
  });
}

export function getToday() {
  return request("/api/today");
}

export function getHistory(date) {
  return request(`/api/history?date=${date}`);
}

export function saveHistory(payload) {
  return request("/api/history", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
