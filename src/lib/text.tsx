import type * as React from "react";

/* "[word]" marks the target in an example sentence. */
export function Sentence({
  text,
  quoted,
  blank,
}: {
  text: string;
  quoted?: boolean;
  blank?: boolean;
}): React.ReactElement {
  const parts: React.ReactNode[] = [];
  const re = /\[(.+?)\]([.,!?;:…]*)/g;
  let last = 0;
  let m: RegExpExecArray | null = re.exec(text);
  let k = 0;
  while (m) {
    parts.push(text.slice(last, m.index));
    parts.push(
      blank ? (
        <span className="whitespace-nowrap" key={k++}>
          <span aria-label="空缺" className="blank" />
          {m[2]}
        </span>
      ) : (
        <span key={k++}>
          <mark className="bg-transparent font-semibold text-brand">{m[1]}</mark>
          {m[2]}
        </span>
      ),
    );
    last = m.index + m[0].length;
    m = re.exec(text);
  }
  parts.push(text.slice(last));
  return (
    <>
      {quoted && "“"}
      {parts}
      {quoted && "”"}
    </>
  );
}

export const lettersOf = (w: string): string[] => w.toLowerCase().replace(/[^a-z]/g, "").split("");
