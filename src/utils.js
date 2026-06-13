export const TIMING_OPTIONS = ["식전", "식후", "취침 전", "기타"];

export const STATUS_LABELS = {
  DONE: "완료",
  SKIPPED: "건너뜀",
  MISSED: "미복용",
  PENDING: "대기"
};

export function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function currentTimeKey() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function formatDateKorean(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  return date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short"
  });
}

export function formatActualTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function uniqueSortedTimes(times) {
  return [...new Set(times.filter(Boolean))].sort();
}
