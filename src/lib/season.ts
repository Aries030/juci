import type { Show } from "@/data/types";

/* Clarkson's Farm sentences are tagged "S#E# · Episode title"; season filtering
   works for any show whose source field follows that pattern. */
const RE = /^S(\d+)E\d+/;

export function seasonOf(show: Show, i: number): number | null {
  const m = RE.exec(show.words[i][5]);
  return m ? Number(m[1]) : null;
}

export function seasonsOf(show: Show): number[] {
  const set = new Set<number>();
  show.words.forEach((_, i) => {
    const s = seasonOf(show, i);
    if (s != null) set.add(s);
  });
  return [...set].sort((a, b) => a - b);
}

export function seasonIndices(show: Show, season: number): Set<number> {
  const out = new Set<number>();
  show.words.forEach((_, i) => {
    if (seasonOf(show, i) === season) out.add(i);
  });
  return out;
}
