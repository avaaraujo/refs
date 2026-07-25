export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min atrás`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h atrás`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d atrás`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}sem atrás`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mês atrás`;
  const year = Math.floor(day / 365);
  return `${year}ano${year > 1 ? "s" : ""} atrás`;
}
