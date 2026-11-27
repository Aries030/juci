import * as React from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Voice } from "@/components/voice";
import type { Study } from "@/hooks/use-study";
import { lettersOf, Sentence } from "@/lib/text";
import { cn } from "@/lib/utils";

/* Spelling on a letter wheel, after Word Forest: tap letters or swipe through them,
   or just type. Two wrong attempts reveal the answer. Only a clean spell counts. */
const MAX_ERRORS = 2;
type Phase = "typing" | "wrong" | "done" | "failed";
interface State {
  ans: string[];
  tiles: string[];
  used: number[];
  hinted: number[];
  errors: number;
  hints: number;
  phase: Phase;
  bad: number;
  prefix: number;
  finished: boolean;
}
export interface SpellHandle {
  handleKey: (e: KeyboardEvent) => boolean;
}

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let k = b.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [b[k], b[j]] = [b[j], b[k]];
  }
  return b;
}
function init(word: string): State {
  const ans = lettersOf(word);
  let order = ans.map((_, k) => k);
  for (let n = 0; n < 12; n++) {
    order = shuffle(order);
    if (ans.length < 3 || order.some((v, k) => ans[v] !== ans[k])) break;
  }
  return { ans, bad: -1, errors: 0, finished: false, hinted: [], hints: 0, phase: "typing", prefix: 0, tiles: order.map((k) => ans[k]), used: [] };
}
function geometry(n: number, avail: number) {
  let T = n <= 8 ? 56 : n <= 12 ? 48 : 40;
  let R = Math.max(T * 1.3, (n * (T + 12)) / (2 * Math.PI));
  let S = 2 * R + T;
  if (S > avail) {
    const k = avail / S;
    T = Math.max(36, Math.floor((T * k) / 4) * 4);
    R = (avail - T) / 2;
    S = avail;
  }
  const pts = Array.from({ length: n }, (_, k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / n;
    return { x: S / 2 + R * Math.cos(a), y: S / 2 + R * Math.sin(a) };
  });
  /* swipe radius: wide enough to catch a letter, narrow enough that a straight swipe never grabs the one it passes */
  const reach = Math.min(0.45 * T, 0.8 * R * (1 - Math.cos((2 * Math.PI) / n))) / T;
  return { pts, R, reach, S, T };
}

export function SpellCard({ study, ref }: { study: Study; ref?: React.Ref<SpellHandle> }): React.ReactElement | null {
  const { show, current, accent } = study;
  const index = current?.i ?? 0;
  const [word, , pos, meaning, sentence, source, translation] = show.words[index];
  const sRef = React.useRef<State | null>(null);
  if (!sRef.current) sRef.current = init(word);
  const s = sRef.current;
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  const timers = React.useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const boxRef = React.useRef<HTMLElement>(null);
  const slotsRef = React.useRef<HTMLDivElement>(null);
  const wheelRef = React.useRef<HTMLDivElement>(null);
  const lineRef = React.useRef<SVGPolylineElement>(null);
  const drag = React.useRef<number | null>(null);
  const [avail, setAvail] = React.useState(600);

  React.useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setAvail(Math.min(el.clientWidth || 600, 608));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  React.useEffect(() => {
    if (study.prefs.speak) study.sayCurrent(false);
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = s.ans.length;
  const geo = geometry(n, Math.min(avail, 360));
  const geoRef = React.useRef(geo);
  geoRef.current = geo;

  const typed = () => s.used.map((t) => s.tiles[t]);
  const firstWrong = () => {
    const ty = typed();
    for (let k = 0; k < ty.length; k++) if (ty[k] !== s.ans[k]) return k;
    return -1;
  };
  const nudge = (el: HTMLElement | null) => {
    if (!el) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  };
  const finish = (clean: boolean) => {
    if (s.finished) return;
    s.finished = true;
    study.finishSpell(index, clean);
  };
  const check = () => {
    const w = firstWrong();
    if (w < 0) {
      if (!s.errors && !s.hints) {
        s.phase = "done";
        bump();
        study.sayCurrent(false);
        later(() => finish(true), 900);
      } else {
        s.phase = "failed";
        s.prefix = s.ans.length;
        bump();
        study.sayCurrent(false);
      }
      return;
    }
    s.errors++;
    s.phase = "wrong";
    s.bad = w;
    bump();
    nudge(slotsRef.current);
    later(() => {
      s.bad = -1;
      if (s.errors >= MAX_ERRORS) {
        s.phase = "failed";
        s.prefix = w;
        study.sayCurrent(false);
      } else {
        s.phase = "typing";
        s.used = s.used.slice(0, w);
        s.hinted = s.hinted.filter((k) => k < w);
      }
      bump();
    }, 560);
  };
  const addTile = (t: number) => {
    if (s.phase !== "typing" || t < 0 || s.used.includes(t) || s.used.length >= n) return;
    s.used.push(t);
    bump();
    if (s.used.length === n) check();
  };
  const removeLast = () => {
    if (s.phase !== "typing" || !s.used.length) return;
    s.used.pop();
    s.hinted = s.hinted.filter((k) => k < s.used.length);
    bump();
  };
  const typeKey = (ch: string) => {
    if (s.phase !== "typing") return;
    const t = s.tiles.findIndex((l, k) => l === ch && !s.used.includes(k));
    if (t < 0) nudge(wheelRef.current);
    else addTile(t);
  };
  const hint = () => {
    if (s.phase !== "typing") return;
    const w = firstWrong();
    if (w >= 0) {
      s.used = s.used.slice(0, w);
      s.hinted = s.hinted.filter((k) => k < w);
    }
    const need = s.ans[s.used.length];
    if (need == null) return;
    const t = s.tiles.findIndex((l, k) => l === need && !s.used.includes(k));
    s.hints++;
    s.hinted.push(s.used.length);
    addTile(t);
  };

  React.useImperativeHandle(ref, () => ({
    handleKey(e: KeyboardEvent) {
      const k = e.key;
      if (s.phase === "failed") {
        if (k === "Enter" || k === " ") {
          finish(false);
          return true;
        }
        return false;
      }
      if (s.phase === "done") {
        if (k === "Enter") {
          finish(true);
          return true;
        }
        return false;
      }
      if (k === "Backspace") {
        removeLast();
        return true;
      }
      if (k === "/" || k === "?") {
        hint();
        return true;
      }
      let ch = k.length === 1 && /[a-z]/i.test(k) ? k.toLowerCase() : null;
      if (!ch && (k === "Process" || k === "Unidentified")) {
        const m = /^Key([A-Z])$/.exec(e.code || "");
        if (m) ch = m[1].toLowerCase();
      }
      if (ch) {
        typeKey(ch);
        return true;
      }
      return k === " ";
    },
  }));

  /* drawing the swipe line */
  const drawPath = (pt?: { x: number; y: number }) => {
    const line = lineRef.current;
    if (!line) return;
    const g = geoRef.current;
    const pts = s.phase === "failed" ? [] : s.used.map((k) => g.pts[k]);
    if (pt && pts.length) pts.push(pt);
    line.setAttribute("points", pts.length > 1 ? pts.map((p) => `${p.x},${p.y}`).join(" ") : "");
  };
  React.useLayoutEffect(() => drawPath());

  const tileAt = (x: number, y: number, reach = 0.55) => {
    const el = wheelRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const g = geoRef.current;
    let best: number | null = null;
    let bd = Number.POSITIVE_INFINITY;
    g.pts.forEach((p, k) => {
      const d = Math.hypot(p.x - (x - r.left), p.y - (y - r.top));
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    return bd <= g.T * reach ? best : null;
  };
  const rel = (e: React.PointerEvent) => {
    const r = (wheelRef.current as HTMLDivElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-back]")) return;
    if (s.phase !== "typing") return;
    const t = tileAt(e.clientX, e.clientY);
    if (t == null) return;
    e.preventDefault();
    if (s.used.includes(t)) {
      if (t === s.used[s.used.length - 1]) removeLast();
      return;
    }
    drag.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    addTile(t);
    if (s.phase === "typing") drawPath(rel(e));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current !== e.pointerId || s.phase !== "typing") return;
    const t = tileAt(e.clientX, e.clientY, geoRef.current.reach);
    if (t != null) {
      if (!s.used.includes(t)) addTile(t);
      else if (t === s.used[s.used.length - 2]) removeLast();
    }
    if (s.phase === "typing") drawPath(rel(e));
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current !== e.pointerId) return;
    drag.current = null;
    if (e.type === "pointerup" && s.phase === "typing") {
      const t = tileAt(e.clientX, e.clientY);
      if (t != null && !s.used.includes(t)) addTile(t);
    }
    drawPath();
  };

  if (!current) return null;

  /* slots: each word of a phrase stays on one line; a phrase that doesn't fit wraps between words */
  const parts = word.split(" ");
  const oneLine = n + (parts.length - 1) * 3;
  const fit = (m: number) => (avail - (m - 1) * 4) / m;
  let sw = fit(oneLine);
  if (sw < 20 && parts.length > 1) sw = fit(Math.max(...parts.map((p) => lettersOf(p).length)));
  sw = sw >= 16 ? Math.min(32, Math.floor(sw / 4) * 4) : Math.max(10, Math.floor(sw));
  const sf = Math.max(14, Math.min(28, Math.round((sw * 0.9) / 2) * 2));
  const failed = s.phase === "failed";
  const solved = s.phase === "done" || failed;
  const shown = failed ? s.ans : typed();
  let k = 0;

  return (
    <>
      <article className="cursor-default" ref={boxRef}>
        <div className="flex min-h-10 flex-wrap items-center gap-2 font-semibold text-lg leading-snug">
          <span className="me-1">
            <b className="me-2 font-medium text-muted-foreground text-sm">{pos}</b>
            {meaning}
          </span>
          <Voice accent={accent} onAccent={study.setAccent} onSay={() => study.sayCurrent(true)} word={word} />
        </div>
        <p className="mt-6 max-w-[36em] text-base leading-7">
          <Sentence blank={!solved} quoted={show.quoted} text={sentence} />
        </p>
        {translation && <p className="mt-2 max-w-[36em] text-muted-foreground text-sm leading-relaxed">{translation}</p>}
        <div className="mt-4 text-muted-foreground text-sm">
          {show.title} · {source}
        </div>
        <div
          aria-live="polite"
          className={cn("slots", s.phase === "done" && "ok")}
          ref={slotsRef}
          style={{ "--sf": `${sf}px`, "--sw": `${sw}px` } as React.CSSProperties}
        >
          {parts.map((p, pi) => (
            <span className="flex gap-1 whitespace-nowrap" key={`${p}-${pi}`}>
              {lettersOf(p).map(() => {
                const idx = k++;
                return (
                  <span
                    className={cn(
                      "slot",
                      idx < shown.length && "filled",
                      s.phase === "typing" && idx === shown.length && "next",
                      s.phase === "wrong" && idx >= s.bad && "bad",
                      s.hinted.includes(idx) && "hinted",
                      failed && idx >= s.prefix && "given",
                    )}
                    key={idx}
                  >
                    {shown[idx] || ""}
                  </span>
                );
              })}
            </span>
          ))}
        </div>
      </article>
      <div
        aria-hidden="true"
        className={cn("wheel", solved && "idle")}
        onPointerCancel={onPointerEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        ref={wheelRef}
        style={{ "--tf": `${geo.T >= 48 ? 22 : 18}px`, height: geo.S, width: geo.S } as React.CSSProperties}
      >
        <svg height={geo.S} width={geo.S}>
          <polyline ref={lineRef} />
        </svg>
        {s.tiles.map((l, t) => {
          const p = geo.pts[t];
          return (
            <span
              className={cn("tile", s.used.includes(t) && !failed && "on")}
              // biome-ignore lint/suspicious/noArrayIndexKey: tiles are positional
              key={t}
              style={{ height: geo.T, left: p.x - geo.T / 2, top: p.y - geo.T / 2, width: geo.T }}
            >
              {l}
            </span>
          );
        })}
        {s.phase === "typing" && s.used.length > 0 && (
          <Button
            aria-label="删除"
            className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 text-muted-foreground"
            data-back=""
            onClick={removeLast}
            size="icon"
            variant="ghost"
          >
            <Icon name="Backspace" />
          </Button>
        )}
      </div>
      <div className="mt-10">
        {failed ? (
          <Button className="w-full gap-3" key="next" onClick={() => finish(false)} size="xl">
            继续<Kbd className="bg-white/16 text-white/80 pointer-coarse:hidden">Enter</Kbd>
          </Button>
        ) : (
          <Button
            className={cn("w-full gap-3", s.phase === "done" && "invisible")}
            key="hint"
            onClick={(e) => {
              if (e.detail > 0) e.currentTarget.blur();
              hint();
            }}
            size="xl"
            tabIndex={s.phase === "done" ? -1 : undefined}
            variant="outline"
          >
            提示<Kbd className="pointer-coarse:hidden">/</Kbd>
          </Button>
        )}
      </div>
    </>
  );
}
