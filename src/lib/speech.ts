import { useSyncExternalStore } from "react";

/* Pronunciation: dictionary recordings first (no voices need to be installed),
   the browser's own speech synthesis only if a recording can't load. */
let volume = 1;
let playing: string | null = null;
const listeners = new Set<() => void>();
const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
let voices: SpeechSynthesisVoice[] = [];
let seq = 0;
let liveAudio: HTMLAudioElement | null = null;
const cache = new Map<string, HTMLAudioElement>();

function loadVoices() {
  voices = canSpeak ? window.speechSynthesis.getVoices() : [];
}
if (canSpeak) {
  loadVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}

function setPlaying(word: string | null) {
  playing = word;
  for (const l of listeners) l();
}

export function usePlayingWord(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => playing,
  );
}

export function setSpeechVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  if (liveAudio) liveAudio.volume = volume;
}

function recording(text: string, lang: string): HTMLAudioElement {
  const key = `${lang}|${text}`;
  let a = cache.get(key);
  if (!a) {
    a = new Audio(
      `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${lang === "en-US" ? 2 : 1}`,
    );
    a.preload = "auto";
    if (cache.size > 40) cache.delete(cache.keys().next().value as string);
    cache.set(key, a);
  }
  return a;
}

export function preload(text: string, lang: string): void {
  try {
    recording(text, lang);
  } catch {
    /* ignore */
  }
}

function stopAll() {
  if (liveAudio) {
    liveAudio.pause();
    liveAudio.onplaying = liveAudio.onended = liveAudio.onerror = null;
    liveAudio = null;
  }
  if (canSpeak && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) window.speechSynthesis.cancel();
}

export function stop(): void {
  seq++;
  stopAll();
  setPlaying(null);
}

function synth(text: string, lang: string, s: number, attempt = 0) {
  if (!canSpeak || s !== seq) {
    if (s === seq) setPlaying(null);
    return;
  }
  if (!voices.length) loadVoices();
  const pool = voices
    .filter((v) => v.lang === lang)
    .concat(voices.filter((v) => v.lang !== lang && v.lang?.startsWith("en")));
  const voice = pool[attempt] || null;
  const ss = window.speechSynthesis;
  if (ss.paused) ss.resume();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  if (voice) u.voice = voice;
  u.rate = 0.92;
  u.volume = volume;
  let started = false;
  const next = () => {
    if (s !== seq) return;
    if (attempt < 2 && pool.length > attempt + 1) {
      ss.cancel();
      synth(text, lang, s, attempt + 1);
    } else setPlaying(null);
  };
  u.onstart = () => {
    started = true;
    if (s === seq) setPlaying(text);
  };
  u.onend = () => {
    if (s === seq) setPlaying(null);
  };
  u.onerror = (ev) => {
    if (ev.error !== "interrupted" && ev.error !== "canceled") next();
  };
  ss.speak(u);
  window.setTimeout(() => {
    if (!started) next();
  }, 1800);
}

export function speak(text: string, lang: string): void {
  if (volume === 0) return;
  const s = ++seq;
  stopAll();
  let a: HTMLAudioElement;
  try {
    a = recording(text, lang);
  } catch {
    synth(text, lang, s);
    return;
  }
  liveAudio = a;
  a.volume = volume;
  let started = false;
  let fell = false;
  const fallback = () => {
    if (fell || s !== seq) return;
    fell = true;
    if (liveAudio === a) {
      a.pause();
      liveAudio = null;
    }
    synth(text, lang, s);
  };
  a.onplaying = () => {
    started = true;
    if (s === seq) setPlaying(text);
  };
  a.onended = () => {
    if (s === seq) setPlaying(null);
  };
  a.onerror = () => {
    cache.delete(`${lang}|${text}`);
    fallback();
  };
  try {
    a.currentTime = 0;
  } catch {
    /* ignore */
  }
  const pr = a.play();
  pr?.catch?.((err: DOMException) => {
    if (err?.name !== "AbortError") fallback();
  });
  window.setTimeout(() => {
    if (!started) fallback();
  }, 2500);
}
