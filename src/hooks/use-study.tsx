import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import { toastManager } from "@/components/ui/toast";
import { SHOWS } from "@/data/shows";
import type { Show } from "@/data/types";
import { load, save } from "@/lib/storage";
import { preload, setSpeechVolume, speak, stop } from "@/lib/speech";
import {
  buildSession,
  entryOf,
  INTERVALS,
  type Entry,
  type Item,
  type Progress,
  requeue,
  type Session,
  withEntry,
} from "@/lib/srs";

export type Accent = "uk" | "us";
export interface Prefs {
  show: string;
  speak: boolean;
  volume: number;
  muted: boolean;
  accent: Accent | null;
}
const DEFAULT_PREFS: Prefs = { accent: null, muted: false, show: "clarksons-farm", speak: true, volume: 1 };

export const showById = (id: string): Show => SHOWS.find((s) => s.id === id) || SHOWS[0];

interface Core {
  progress: Progress;
  session: Session;
  revealed: boolean;
  /* bumps whenever the card on screen changes, so cards remount fresh */
  epoch: number;
}
interface Snapshot {
  show: string;
  i: number;
  before: Entry | undefined;
  session: Session;
}

export const UNDO_KEY =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? "⌘Z"
    : "Ctrl Z";

export function useStudy() {
  const [prefs, setPrefsState] = useState<Prefs>(() => ({ ...DEFAULT_PREFS, ...load<Partial<Prefs>>("jc.prefs", {}) }));
  const prefsRef = useRef(prefs);
  const setPrefs = useCallback((fn: (p: Prefs) => Prefs) => {
    const next = fn(prefsRef.current);
    prefsRef.current = next;
    setPrefsState(next);
  }, []);

  const [core, setCore] = useState<Core>(() => {
    const progress = load<Progress>("jc.progress", {});
    return { epoch: 0, progress, revealed: false, session: buildSession(progress, showById(prefsRef.current.show)) };
  });
  const coreRef = useRef(core);
  const commit = useCallback((next: Core) => {
    coreRef.current = next;
    setCore(next);
  }, []);

  const sessions = useRef<Record<string, Session>>({});
  const history = useRef<Snapshot[]>([]);
  const lastToast = useRef<string | null>(null);
  const [view, setView] = useState<"study" | "list">("study");

  useEffect(() => save("jc.prefs", prefs), [prefs]);
  useEffect(() => save("jc.progress", core.progress), [core.progress]);

  const vol = prefs.muted ? 0 : Math.max(0, Math.min(1, prefs.volume));
  useEffect(() => {
    setSpeechVolume(vol);
    if (vol === 0) stop();
  }, [vol]);

  const show = showById(core.session.show);
  const current: Item | undefined = core.session.queue[0];
  const accent: Accent = prefs.accent ?? (show.lang === "en-US" ? "us" : "uk");
  const lang = accent === "us" ? "en-US" : "en-GB";

  useEffect(() => {
    if (current) preload(show.words[current.i][0], lang);
  }, [current, show, lang]);

  /* ---------- sound ---------- */
  const say = useCallback((word: string, explicit: boolean, langOverride?: string) => {
    const p = prefsRef.current;
    const v = p.muted ? 0 : p.volume;
    if (v === 0) {
      if (!explicit) return;
      const volume = p.volume > 0 ? p.volume : 0.6;
      setPrefs((q) => ({ ...q, muted: false, volume }));
      setSpeechVolume(volume);
    }
    const s = showById(coreRef.current.session.show);
    const a = p.accent ?? (s.lang === "en-US" ? "us" : "uk");
    speak(word, langOverride || (a === "us" ? "en-US" : "en-GB"));
  }, [setPrefs]);

  const sayCurrent = useCallback((explicit: boolean) => {
    const c = coreRef.current;
    const it = c.session.queue[0];
    if (it) say(showById(c.session.show).words[it.i][0], explicit);
  }, [say]);

  const setAccent = useCallback((a: Accent, play = true) => {
    setPrefs((p) => ({ ...p, accent: a }));
    if (play) {
      const c = coreRef.current;
      const it = c.session.queue[0];
      if (it) say(showById(c.session.show).words[it.i][0], true, a === "us" ? "en-US" : "en-GB");
    }
  }, [say, setPrefs]);

  /* ---------- toast with undo ---------- */
  const undoRef = useRef<() => void>(() => {});
  const notify = useCallback((title: string, onUndo?: () => void) => {
    if (lastToast.current) toastManager.close(lastToast.current);
    lastToast.current = toastManager.add({
      actionProps: {
        children: (
          <>
            撤销
            <Kbd className="pointer-coarse:hidden">{UNDO_KEY}</Kbd>
          </>
        ),
        onClick: () => (onUndo || undoRef.current)(),
      },
      timeout: 5000,
      title,
    });
  }, []);
  const dismissToast = useCallback(() => {
    if (lastToast.current) toastManager.close(lastToast.current);
    lastToast.current = null;
  }, []);

  /* ---------- study actions ---------- */
  const snapshot = (c: Core, i: number) => {
    history.current.push({ before: entryOf(c.progress, c.session.show, i), i, session: c.session, show: c.session.show });
  };

  const reveal = useCallback((force?: boolean) => {
    const c = coreRef.current;
    const it = c.session.queue[0];
    if (!it || it.k !== "recall") return;
    const revealed = force ?? !c.revealed;
    if (revealed === c.revealed) return;
    commit({ ...c, revealed });
    if (revealed && prefsRef.current.speak) sayCurrent(false);
  }, [commit, sayCurrent]);

  const grade = useCallback((remembered: boolean) => {
    const c = coreRef.current;
    const it = c.session.queue[0];
    if (!it || it.k !== "recall") return;
    snapshot(c, it.i);
    const before = entryOf(c.progress, c.session.show, it.i);
    const e: Entry = { box: 0, due: Date.now(), seen: (before?.seen ?? 0) + 1 };
    const queue = requeue(c.session.queue.slice(1), { i: it.i, k: remembered ? "spell" : "recall" });
    commit({
      epoch: c.epoch + 1,
      progress: withEntry(c.progress, c.session.show, it.i, e),
      revealed: false,
      session: { ...c.session, queue },
    });
    notify(remembered ? "记得 · 稍后拼写" : "忘了 · 稍后再出现");
  }, [commit, notify]);

  const finishSpell = useCallback((i: number, clean: boolean) => {
    const c = coreRef.current;
    const it = c.session.queue[0];
    if (!it || it.k !== "spell" || it.i !== i) return;
    snapshot(c, i);
    const before = entryOf(c.progress, c.session.show, i);
    const e: Entry = before ? { ...before } : { box: 0, due: 0, seen: 0 };
    e.seen++;
    let session: Session = { ...c.session, queue: c.session.queue.slice(1) };
    if (clean) {
      e.box = Math.min(e.box + 1, INTERVALS.length - 1);
      e.due = Date.now() + INTERVALS[e.box];
      session = { ...session, done: session.done + 1, today: session.today + 1 };
    } else {
      e.box = 0;
      e.due = Date.now();
      session = { ...session, queue: requeue(session.queue, { i, k: "spell" }) };
    }
    commit({ epoch: c.epoch + 1, progress: withEntry(c.progress, c.session.show, i, e), revealed: false, session });
    notify(clean ? "拼对了" : "稍后再拼一次");
  }, [commit, notify]);

  const undo = useCallback(() => {
    const h = history.current.pop();
    if (!h) return;
    const c = coreRef.current;
    if (h.show !== c.session.show) {
      sessions.current[c.session.show] = c.session;
      setPrefs((p) => ({ ...p, show: h.show }));
    }
    const first = h.session.queue[0];
    commit({
      epoch: c.epoch + 1,
      progress: withEntry(c.progress, h.show, h.i, h.before),
      revealed: first?.k === "recall",
      session: h.session,
    });
    dismissToast();
    setView("study");
  }, [commit, dismissToast, setPrefs]);
  undoRef.current = undo;

  const switchShow = useCallback((id: string) => {
    const c = coreRef.current;
    if (id === c.session.show) return;
    stop();
    sessions.current[c.session.show] = c.session;
    const session = sessions.current[id] || buildSession(c.progress, showById(id));
    setPrefs((p) => ({ ...p, show: id }));
    commit({ ...c, epoch: c.epoch + 1, revealed: false, session });
  }, [commit, setPrefs]);

  const studyMore = useCallback(() => {
    const c = coreRef.current;
    commit({ ...c, epoch: c.epoch + 1, revealed: false, session: buildSession(c.progress, showById(c.session.show), c.session.today) });
  }, [commit]);

  const resetShow = useCallback(() => {
    const c = coreRef.current;
    const id = c.session.show;
    const saved = c.progress[id] || {};
    const prevSession = c.session;
    const progress = { ...c.progress, [id]: {} };
    history.current = history.current.filter((h) => h.show !== id);
    commit({ epoch: c.epoch + 1, progress, revealed: false, session: buildSession(progress, showById(id)) });
    notify(`已重置 ${showById(id).title}`, () => {
      const n = coreRef.current;
      const restored = { ...n.progress, [id]: saved };
      if (n.session.show === id) commit({ ...n, epoch: n.epoch + 1, progress: restored, revealed: false, session: prevSession });
      else {
        sessions.current[id] = prevSession;
        commit({ ...n, progress: restored });
      }
      dismissToast();
    });
  }, [commit, dismissToast, notify]);

  const pct = core.session.total ? (core.session.done / core.session.total) * 100 : 100;

  return useMemo(
    () => ({
      accent,
      canUndo: () => history.current.length > 0,
      core,
      current,
      finishSpell,
      grade,
      lang,
      pct,
      prefs,
      resetShow,
      reveal,
      say,
      sayCurrent,
      setAccent,
      setPrefs,
      setView,
      show,
      studyMore,
      switchShow,
      undo,
      view,
      vol,
    }),
    [accent, core, current, finishSpell, grade, lang, pct, prefs, resetShow, reveal, say, sayCurrent, setAccent, setPrefs, show, studyMore, switchShow, undo, view, vol],
  );
}

export type Study = ReturnType<typeof useStudy>;
