import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import type { Study } from "@/hooks/use-study";
import { BATCH, counts, nextReviewText } from "@/lib/srs";

export function DoneView({ study }: { study: Study }): React.ReactElement {
  const { show, core, seasonFilter } = study;
  const c = counts(core.progress, show, seasonFilter);
  const more = c.new > 0;
  const next = more ? null : nextReviewText(core.progress, show, seasonFilter);
  return (
    <div>
      <h2 className="font-semibold text-lg">今天完成</h2>
      <div className="mt-6 font-semibold text-[44px] tabular-nums tracking-[-0.02em]">
        {core.session.today}
        <span className="ms-2 font-medium text-lg text-muted-foreground tracking-normal">个</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground text-sm">
        <span>已掌握 {c.known}</span>
        <span>学习中 {c.learning}</span>
        <span>未学 {c.new}</span>
        {next && <span>下次复习 {next}</span>}
      </div>
      {more && (
        <Button className="mt-14 w-full gap-3" onClick={study.studyMore} size="xl">
          再学 {Math.min(BATCH, c.new)} 个<Kbd className="bg-white/16 text-white/80 pointer-coarse:hidden">Enter</Kbd>
        </Button>
      )}
    </div>
  );
}
