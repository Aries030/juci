import * as React from "react";
import { DoneView } from "@/components/done-view";
import { Header } from "@/components/header";
import { type SpellHandle, SpellCard } from "@/components/spell-card";
import { StudyCard } from "@/components/study-card";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WordList } from "@/components/word-list";
import { useStudy } from "@/hooks/use-study";

export default function App(): React.ReactElement {
  const study = useStudy();
  const spellRef = React.useRef<SpellHandle>(null);
  const studyRef = React.useRef(study);
  studyRef.current = study;

  /* Keyboard: letters always mean spelling, never shortcuts. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = studyRef.current;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input,textarea,[contenteditable],[data-slot=popover-popup],[data-slot=menu-popup]")) return;
      if (document.querySelector("[data-slot=menu-popup],[data-slot=popover-popup]")) return;
      const k = e.key;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (k === "z" || k === "Z")) {
        if (st.canUndo()) {
          e.preventDefault();
          st.undo();
        }
        return;
      }
      if (mod || e.altKey) return;
      if (k === "Escape" && st.view === "list") {
        st.setView("study");
        return;
      }
      if (st.view !== "study") return;
      const cur = st.core.session.queue[0];
      if (!cur) {
        if (k === "Enter") {
          e.preventDefault();
          st.studyMore();
        }
        return;
      }
      if (k === "ArrowUp") {
        e.preventDefault();
        st.sayCurrent(true);
        return;
      }
      if (t?.closest?.("[data-slot=toggle-group]") && k.startsWith("Arrow")) return;
      if (cur.k === "spell") {
        if (spellRef.current?.handleKey(e)) e.preventDefault();
        return;
      }
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ae.tagName === "BUTTON" && (k === " " || k === "Enter")) return;
      if (k === " " || k === "Enter") {
        e.preventDefault();
        st.reveal();
      } else if (k === "ArrowRight" || k === "2") {
        e.preventDefault();
        st.grade(true);
      } else if (k === "ArrowLeft" || k === "1") {
        e.preventDefault();
        st.grade(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { current, core, view } = study;
  return (
    <TooltipProvider delay={500}>
      <ToastProvider position="bottom-center">
        <Header study={study} />
        <main className="mx-auto max-w-[672px] px-8 pt-18 pb-40 max-sm:px-5 max-sm:pt-12 max-sm:pb-34">
          {view === "list" ? (
            <WordList study={study} />
          ) : (
            <div className="card-in" key={`${core.session.show}-${core.epoch}`}>
              {!current ? (
                <DoneView study={study} />
              ) : current.k === "spell" ? (
                <SpellCard ref={spellRef} study={study} />
              ) : (
                <StudyCard study={study} />
              )}
            </div>
          )}
        </main>
      </ToastProvider>
    </TooltipProvider>
  );
}
