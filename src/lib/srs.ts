import type { Show } from "@/data/types";

export const DAY = 864e5;
export const INTERVALS = [0, 1, 2, 4, 8, 16, 32].map((d) => d * DAY);
export const MASTERED_BOX = 4;
export const BATCH = 10;
export const REQUEUE_GAP = 3;

export type Entry = { box: number; due: number; seen: number };
export type Progress = Record<string, Record<number, Entry>>;
export type Item = { i: number; k: "recall" | "spell" };
export type Session = { show: string; queue: Item[]; total: number; done: number; today: number };
export type Status = "new" | "learning" | "known";

export const entryOf = (p: Progress, showId: string, i: number): Entry | undefined => p[showId]?.[i];

export function withEntry(p: Progress, showId: string, i: number, e: Entry | undefined): Progress {
  const forShow = { ...(p[showId] || {}) };
  if (e) forShow[i] = e;
  else delete forShow[i];
  return { ...p, [showId]: forShow };
}

export function statusOf(p: Progress, show: Show, i: number): Status {
  const e = entryOf(p, show.id, i);
  if (!e) return "new";
  return e.box >= MASTERED_BOX ? "known" : "learning";
}

export function counts(p: Progress, show: Show, filter?: Set<number> | null): Record<Status, number> {
  const c = { known: 0, learning: 0, new: 0 };
  show.words.forEach((_, i) => {
    if (filter && !filter.has(i)) return;
    c[statusOf(p, show, i)]++;
  });
  return c;
}

/* The system decides what to study: words that are due first (oldest first),
   then up to BATCH new words. New words are recognised first, then spelled. */
export function buildSession(p: Progress, show: Show, today = 0, filter?: Set<number> | null): Session {
  const now = Date.now();
  const due: number[] = [];
  const fresh: number[] = [];
  show.words.forEach((_, i) => {
    if (filter && !filter.has(i)) return;
    const e = entryOf(p, show.id, i);
    if (!e) fresh.push(i);
    else if (e.due <= now) due.push(i);
  });
  due.sort((a, b) => (entryOf(p, show.id, a)?.due ?? 0) - (entryOf(p, show.id, b)?.due ?? 0));
  const queue: Item[] = due
    .map((i) => ({ i, k: ((entryOf(p, show.id, i)?.box ?? 0) >= 1 ? "spell" : "recall") as Item["k"] }))
    .concat(fresh.slice(0, BATCH).map((i) => ({ i, k: "recall" as const })));
  return { done: 0, queue, show: show.id, today, total: queue.length };
}

export function requeue(queue: Item[], item: Item): Item[] {
  const q = queue.slice();
  q.splice(Math.min(REQUEUE_GAP, q.length), 0, item);
  return q;
}

export function nextReviewText(p: Progress, show: Show, filter?: Set<number> | null): string | null {
  const now = Date.now();
  const next = Object.entries(p[show.id] || {})
    .filter(([i]) => !filter || filter.has(Number(i)))
    .map(([, e]) => e.due)
    .filter((d) => d > now)
    .sort((a, b) => a - b)[0];
  if (!next) return null;
  const d = Math.round((next - now) / DAY);
  if (d <= 0) return "今天稍后";
  if (d === 1) return "明天";
  return `${d} 天后`;
}
