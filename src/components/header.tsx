import * as React from "react";
import { Icon } from "@/components/icon";
import type { IconName } from "@/components/icon-data";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { AccentToggle } from "@/components/voice";
import { SHOWS } from "@/data/shows";
import { REGIONS } from "@/data/types";
import type { Study } from "@/hooks/use-study";
import { counts } from "@/lib/srs";
import { cn } from "@/lib/utils";

function Tip({ label, render, children }: { label: React.ReactNode; render: React.ReactElement; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={render}>{children}</TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

/* Show picker: region submenus (Base UI opens them with a delay and keeps them open
   while the pointer travels toward them), current show checked. */
function ShowMenu({ study }: { study: Study }) {
  const { show, core } = study;
  return (
    <Menu>
      <MenuTrigger
        render={<Button className="min-w-0 shrink gap-1 px-3 font-semibold text-lg sm:text-lg" size="lg" variant="ghost" />}
      >
        <span className="truncate">{show.title}</span>
        <Icon className="opacity-60 transition-transform in-data-popup-open:rotate-180" name="ChevronDown" />
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-40">
        {REGIONS.map((r) => (
          <MenuSub key={r.id}>
            <MenuSubTrigger closeDelay={300} delay={90}>
              {r.title}
            </MenuSubTrigger>
            <MenuSubPopup className="min-w-60">
              <MenuRadioGroup onValueChange={(v: unknown) => study.switchShow(String(v))} value={show.id}>
                {SHOWS.filter((s) => s.region === r.id).map((s) => {
                  const c = counts(core.progress, s);
                  const started = c.known + c.learning;
                  return (
                    <MenuRadioItem closeOnClick key={s.id} value={s.id}>
                      <span className="flex w-full items-center justify-between gap-6">
                        <span>{s.title}</span>
                        <span className="font-medium text-muted-foreground/72 text-xs tabular-nums">
                          {started ? `${started}/${s.words.length}` : `${s.words.length} 词`}
                        </span>
                      </span>
                    </MenuRadioItem>
                  );
                })}
              </MenuRadioGroup>
            </MenuSubPopup>
          </MenuSub>
        ))}
      </MenuPopup>
    </Menu>
  );
}

function SoundPopover({ study }: { study: Study }) {
  const { prefs, vol, accent } = study;
  const pct = Math.round((prefs.muted ? 0 : prefs.volume) * 100);
  const name: IconName = vol === 0 ? "VolumeSlash" : vol < 0.5 ? "VolumeLow" : "VolumeHigh";
  const setVolume = (x: number) => study.setPrefs((p) => ({ ...p, muted: x === 0 ? p.muted : false, volume: Math.max(0, Math.min(1, x)) }));
  /* one preview per adjustment, at the level the learner settled on */
  const previewT = React.useRef<number | undefined>(undefined);
  const preview = () => {
    window.clearTimeout(previewT.current);
    previewT.current = window.setTimeout(() => study.sayCurrent(false), 250);
  };
  React.useEffect(() => () => window.clearTimeout(previewT.current), []);
  return (
    <Popover>
      <Tip
        label="声音"
        render={<PopoverTrigger render={<Button aria-label={vol === 0 ? "声音（已静音）" : "声音"} size="icon" variant="ghost" />} />}
      >
        <Icon name={name} />
      </Tip>
      <PopoverPopup align="end" className="w-72">
        <div className="flex items-center gap-3">
          <Toggle
            aria-label={vol === 0 ? "取消静音" : "静音"}
            onPressedChange={(muted: boolean) => {
              if (muted) study.setPrefs((p) => ({ ...p, muted: true }));
              else {
                study.setPrefs((p) => ({ ...p, muted: false, volume: p.volume > 0 ? p.volume : 0.6 }));
                preview();
              }
            }}
            pressed={vol === 0}
            size="sm"
          >
            <Icon name={name} />
          </Toggle>
          <Slider
            className="min-w-0 flex-1"
            getAriaLabel={() => "音量"}
            onValueChange={(v: number | readonly number[]) => setVolume((Array.isArray(v) ? v[0] : (v as number)) / 100)}
            largeStep={20}
            onValueCommitted={preview}
            step={5}
            value={pct}
          />
          <span className="w-7 shrink-0 text-end text-muted-foreground text-sm tabular-nums">{pct}</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-medium text-sm">发音</span>
          <AccentToggle accent={accent} onAccent={study.setAccent} />
        </div>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: Switch renders the control */}
        <label className="mt-4 flex cursor-pointer items-center justify-between gap-3">
          <span className="font-medium text-sm">翻开时自动发音</span>
          <Switch checked={prefs.speak} onCheckedChange={(on: boolean) => study.setPrefs((p) => ({ ...p, speak: on }))} />
        </label>
      </PopoverPopup>
    </Popover>
  );
}

/* Only shown for a show whose sentences carry season tags, and only once there's more than one season to choose from. */
function SeasonMenu({ study }: { study: Study }) {
  const { season, seasons, setSeason } = study;
  if (seasons.length < 2) return null;
  const label = season == null ? "全部季" : `S${season}`;
  return (
    <Menu>
      <MenuTrigger render={<Button className="shrink-0 gap-1 px-2 text-muted-foreground" size="sm" variant="ghost" />}>
        {label}
        <Icon className="opacity-60 transition-transform in-data-popup-open:rotate-180" name="ChevronDown" />
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-32">
        <MenuRadioGroup
          onValueChange={(v: unknown) => setSeason(v === "all" ? null : Number(v))}
          value={season == null ? "all" : String(season)}
        >
          <MenuRadioItem closeOnClick value="all">
            全部季
          </MenuRadioItem>
          {seasons.map((n) => (
            <MenuRadioItem closeOnClick key={n} value={String(n)}>
              第 {n} 季
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}

/* Destructive and rare: hidden in "more", press and hold to confirm, and still undoable afterwards. */
function MoreMenu({ study }: { study: Study }) {
  const [open, setOpen] = React.useState(false);
  const [holding, setHolding] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);
  const start = () => {
    window.clearTimeout(timer.current);
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      setOpen(false);
      study.resetShow();
    }, 1200);
  };
  const cancel = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Menu
      onOpenChange={(o: boolean) => {
        setOpen(o);
        if (!o) cancel();
      }}
      open={open}
    >
      <Tip
        label="更多"
        render={
          <MenuTrigger
            render={
              <Button
                aria-label="更多"
                className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/header:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
                size="icon"
                variant="ghost"
              />
            }
          />
        }
      >
        <Icon name="More" />
      </Tip>
      <MenuPopup align="end" className="w-60">
        <MenuItem
          className="relative overflow-hidden"
          closeOnClick={false}
          onKeyDown={(e: React.KeyboardEvent) => {
            if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
              e.preventDefault();
              start();
            }
          }}
          onKeyUp={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") cancel();
          }}
          onPointerDown={(e: React.PointerEvent) => {
            e.preventDefault();
            start();
          }}
          onPointerLeave={cancel}
          onPointerUp={cancel}
          variant="destructive"
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-0 origin-left scale-x-0 rounded-sm bg-destructive/8",
              holding && "scale-x-100 transition-transform duration-[1200ms] ease-linear",
            )}
          />
          <span className="relative">{holding ? "继续按住…" : `按住以重置 ${study.show.title}`}</span>
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}

export function Header({ study }: { study: Study }): React.ReactElement {
  return (
    <>
      <header className="group/header sticky top-0 z-20 flex h-18 items-center justify-between gap-4 bg-background px-8 max-sm:h-16 max-sm:gap-2 max-sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <ShowMenu study={study} />
          <SeasonMenu study={study} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <SoundPopover study={study} />
          <Tip
            label="词表"
            render={
              <Toggle
                aria-label="词表"
                onPressedChange={(on: boolean) => study.setView(on ? "list" : "study")}
                pressed={study.view === "list"}
              />
            }
          >
            <Icon name="Book" />
          </Tip>
          <MoreMenu study={study} />
        </div>
      </header>
      <Progress
        aria-label="本轮进度"
        className={cn("px-8 max-sm:px-4", study.view !== "study" && "invisible")}
        value={study.pct}
      >
        <ProgressTrack className="h-1">
          <ProgressIndicator className="bg-brand duration-300" />
        </ProgressTrack>
      </Progress>
    </>
  );
}
