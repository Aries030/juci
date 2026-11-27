import type * as React from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import type { Accent } from "@/hooks/use-study";
import { usePlayingWord } from "@/lib/speech";
import { cn } from "@/lib/utils";

/* mouse clicks shouldn't leave focus on a control, so Space keeps meaning "reveal" */
const blurOnClick = (e: React.MouseEvent<HTMLElement>) => {
  if (e.detail > 0) {
    const el = e.currentTarget;
    window.setTimeout(() => el.blur(), 0);
  }
};

export function SayButton({
  word,
  onSay,
  size = "icon",
  className,
  shortcut = true,
}: {
  word: string;
  onSay: () => void;
  size?: "icon" | "icon-sm";
  className?: string;
  shortcut?: boolean;
}): React.ReactElement {
  const playing = usePlayingWord() === word;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="发音"
            className={cn("text-muted-foreground data-playing:bg-accent data-playing:text-brand", className)}
            data-playing={playing ? "" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              blurOnClick(e);
              onSay();
            }}
            size={size}
            variant="ghost"
          />
        }
      >
        <Icon name="VolumeHigh" />
      </TooltipTrigger>
      <TooltipPopup>
        <span className="flex items-center gap-2">
          发音
          {shortcut && <Kbd className="pointer-coarse:hidden">↑</Kbd>}
        </span>
      </TooltipPopup>
    </Tooltip>
  );
}

export function AccentToggle({
  accent,
  onAccent,
  size = "sm",
}: {
  accent: Accent;
  onAccent: (a: Accent) => void;
  size?: "sm" | "default";
}): React.ReactElement {
  return (
    <ToggleGroup
      aria-label="发音"
      onValueChange={(v: unknown[]) => onAccent(((v[0] as Accent | undefined) ?? accent) as Accent)}
      size={size}
      value={[accent]}
      variant="outline"
    >
      <ToggleGroupItem aria-label="英音" onClick={blurOnClick} value="uk">
        英
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="美音" onClick={blurOnClick} value="us">
        美
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function Voice({
  word,
  accent,
  onSay,
  onAccent,
}: {
  word: string;
  accent: Accent;
  onSay: () => void;
  onAccent: (a: Accent) => void;
}): React.ReactElement {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: stops clicks reaching the card
    <span className="voice inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <SayButton onSay={onSay} word={word} />
      <AccentToggle accent={accent} onAccent={onAccent} />
    </span>
  );
}
