import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SayButton } from "@/components/voice";
import type { Study } from "@/hooks/use-study";
import { counts, type Status, statusOf } from "@/lib/srs";
import { Sentence } from "@/lib/text";
import { cn } from "@/lib/utils";

type Filter = "all" | Status;

export function WordList({ study }: { study: Study }): React.ReactElement {
  const { show, core, accent, seasonFilter } = study;
  const [filter, setFilter] = React.useState<Filter>("all");
  const [open, setOpen] = React.useState<number | null>(null);
  const c = counts(core.progress, show, seasonFilter);
  const total = seasonFilter ? seasonFilter.size : show.words.length;
  const filters: [Filter, string, number][] = [
    ["all", "全部", total],
    ["learning", "学习中", c.learning],
    ["known", "已掌握", c.known],
    ["new", "未学", c.new],
  ];
  const rows = show.words
    .map((w, i) => ({ i, s: statusOf(core.progress, show, i), w }))
    .filter((r) => (!seasonFilter || seasonFilter.has(r.i)) && (filter === "all" || r.s === filter));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
        <h2 className="font-semibold text-lg">{show.title}</h2>
        <ToggleGroup
          aria-label="筛选"
          onValueChange={(v: unknown[]) => {
            if (v[0]) {
              setFilter(v[0] as Filter);
              setOpen(null);
            }
          }}
          size="sm"
          value={[filter]}
          variant="outline"
        >
          {filters.map(([id, label, n]) => (
            <ToggleGroupItem className="tabular-nums" key={id} value={id}>
              {label} {n}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {rows.length ? (
        <ul>
          {rows.map(({ w, i, s }) => (
            <li className="-mx-4" key={i}>
              <div className="group/row flex items-center gap-1 rounded-lg pe-2 hover:bg-accent">
                <button
                  aria-expanded={open === i}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-4 rounded-lg px-4 py-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setOpen(open === i ? null : i)}
                  type="button"
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      s === "new" && "bg-input",
                      s === "learning" && "shadow-[inset_0_0_0_2px_var(--brand)]",
                      s === "known" && "bg-brand",
                    )}
                  />
                  <span className="min-w-[9em] font-medium max-sm:min-w-[7em]">{w[0]}</span>
                  <span className="flex-1 text-muted-foreground text-sm">{w[3]}</span>
                </button>
                <SayButton
                  className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 data-playing:opacity-100 pointer-coarse:opacity-100"
                  onSay={() => study.say(w[0], true)}
                  shortcut={false}
                  word={w[0]}
                />
              </div>
              {open === i && (
                <div className="ps-10 pe-4 pb-4 text-sm leading-relaxed">
                  <div>
                    <Sentence quoted={show.quoted} text={w[4]} />
                  </div>
                  {w[6] && <div className="mt-1 text-muted-foreground">{w[6]}</div>}
                  <div className="mt-1 text-muted-foreground">
                    /{accent === "us" ? w[7] || w[1] : w[1]}/ · {w[5]}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-6 text-muted-foreground text-sm">—</div>
      )}
    </div>
  );
}
