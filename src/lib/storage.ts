/* Progress and preferences live in the browser. Same keys as the original single-file version,
   so existing progress carries over untouched. */
const kv: Storage | null = (() => {
  try {
    const s = window.localStorage;
    s.setItem("__t", "1");
    s.removeItem("__t");
    return s;
  } catch {
    return null;
  }
})();
const mem: Record<string, string> = {};

export function load<T>(key: string, fallback: T): T {
  try {
    const v = kv ? kv.getItem(key) : mem[key];
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  const s = JSON.stringify(value);
  try {
    if (kv) kv.setItem(key, s);
    else mem[key] = s;
  } catch {
    mem[key] = s;
  }
}
