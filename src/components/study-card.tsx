import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Voice } from "@/components/voice";
import type { Study } from "@/hooks/use-study";
import { Sentence } from "@/lib/text";
import { cn } from "@/lib/utils";

const blurOnClick = (e: React.MouseEvent<HTMLElement>) => {
  if (e.detail > 0) e.currentTarget.blur();
};

export function StudyCard({ study }: { study: Study }): React.ReactElement | null {
  const { show, current, core, accent } = study;
  if (!current) return null;
  const [word, ipaUK, pos, meaning, sentence, source, translation, ipaUS] = show.words[current.i];
  const revealed = core.revealed;
  const ipa = accent === "us" ? ipaUS || ipaUK : ipaUK;
  const hidden = "opacity-0 blur-sm";

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Space / Enter handled globally */}
      <article
        className="cursor-pointer select-none outline-none"
        data-card=""
        onClick={() => {
          if (window.getSelection()?.toString()) return;
          study.reveal();
        }}
      >
        <div className="flex min-h-14 flex-wrap items-center gap-2">
          <h1 className="me-1 font-semibold text-[44px] leading-[1.15] tracking-[-0.02em] max-sm:text-4xl">{word}</h1>
          <Voice accent={accent} onAccent={study.setAccent} onSay={() => study.sayCurrent(true)} word={word} />
        </div>
        <div className="mt-3 text-base text-muted-foreground">
          <b className="me-3 font-medium">{pos}</b>/{ipa}/
        </div>
        <p className="mt-12 max-w-[36em] text-base leading-7 max-sm:mt-9">
          <Sentence quoted={show.quoted} text={sentence} />
        </p>
        {translation && (
          <p
            aria-hidden={!revealed}
            className={cn(
              "mt-2 max-w-[36em] text-muted-foreground text-sm leading-relaxed transition-[opacity,filter] duration-200",
              !revealed && hidden,
            )}
          >
            {translation}
          </p>
        )}
        <div className="mt-4 text-muted-foreground text-sm">
          {show.title} · {source}
        </div>
        <div
          aria-hidden={!revealed}
          className={cn("mt-10 min-h-9 font-semibold text-lg transition-[opacity,filter] duration-200", !revealed && hidden)}
        >
          {meaning}
        </div>
      </article>
      <div className="mt-14 grid grid-cols-2 gap-3">
        {!revealed ? (
          <Button
            className="col-span-2 w-full gap-3"
            key="reveal"
            onClick={(e) => {
              blurOnClick(e);
              study.reveal();
            }}
            size="xl"
            variant="outline"
          >
            显示释义<Kbd className="pointer-coarse:hidden">Space</Kbd>
          </Button>
        ) : (
          <>
            <Button
              className="w-full gap-3"
              key="forgot"
              onClick={(e) => {
                blurOnClick(e);
                study.grade(false);
              }}
              size="xl"
              variant="outline"
            >
              忘了<Kbd className="pointer-coarse:hidden">←</Kbd>
            </Button>
            <Button
              className="w-full gap-3"
              key="known"
              onClick={(e) => {
                blurOnClick(e);
                study.grade(true);
              }}
              size="xl"
            >
              记得<Kbd className="bg-white/16 text-white/80 pointer-coarse:hidden">→</Kbd>
            </Button>
          </>
        )}
      </div>
    </>
  );
}
