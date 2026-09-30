import { lazy, Suspense, useCallback, useEffect, useId, useRef } from "react";
import type { ReadingPassage } from "./models";
import { loadReadingPosition, saveReadingPosition } from "./readingPosition";

const MarkdownPassage = lazy(() => import("./MarkdownPassage").then((module) => ({ default: module.MarkdownPassage })));

type ReadingPassageDialogProps = {
  quizId: string;
  passage: ReadingPassage;
  purpose?: "question" | "learning";
  onClose: () => void;
};

export function ReadingPassageDialog({ quizId, passage, purpose = "question", onClose }: ReadingPassageDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef(loadReadingPosition(quizId, passage.id));
  const userScrolledRef = useRef(false);
  const restoringRef = useRef(false);
  const titleId = useId();

  const recordPosition = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const blocks = body.querySelectorAll<HTMLElement>("[data-reading-block]");
    if (!blocks.length) return;
    const bodyTop = body.getBoundingClientRect().top;
    let nearest = blocks[0];
    for (const block of blocks) {
      if (block.getBoundingClientRect().top > bodyTop + 8) break;
      nearest = block;
    }
    saveReadingPosition(quizId, passage.id, {
      block: nearest.dataset.readingBlock ?? "0",
      offset: bodyTop - nearest.getBoundingClientRect().top,
    });
  }, [quizId, passage.id]);

  const restorePosition = useCallback(() => {
    const body = bodyRef.current;
    const saved = savedRef.current;
    if (!body || !saved || userScrolledRef.current) return;
    const target = Array.from(body.querySelectorAll<HTMLElement>("[data-reading-block]")).find((block) => block.dataset.readingBlock === saved.block);
    if (!target) return;
    restoringRef.current = true;
    body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top + saved.offset;
    requestAnimationFrame(() => { restoringRef.current = false; });
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const frame = requestAnimationFrame(restorePosition);
    const observer = contentRef.current && typeof ResizeObserver !== "undefined" ? new ResizeObserver(restorePosition) : undefined;
    if (contentRef.current) observer?.observe(contentRef.current);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); recordPosition(); if (dialog.open) dialog.close(); };
  }, [recordPosition, restorePosition]);

  const handleScroll = () => {
    if (!restoringRef.current) userScrolledRef.current = true;
    recordPosition();
  };

  return (
    <dialog ref={dialogRef} className="reading-dialog" aria-labelledby={titleId} onClose={() => { recordPosition(); onClose(); }}>
      <div className="reading-dialog-header">
        <div>
          <p className="eyebrow">{purpose === "learning" ? "LEARNING MATERIAL" : "READING PASSAGE"}</p>
          <h2 id={titleId}>{passage.title}</h2>
        </div>
        <button className="secondary-button" type="button" onClick={() => dialogRef.current?.close()}>{purpose === "learning" ? "Close material" : "Close passage"}</button>
      </div>
      <div className="reading-dialog-body" ref={bodyRef} onScroll={handleScroll}>
        <div ref={contentRef} className="reading-content">
          {"format" in passage
            ? <Suspense fallback={<p>Loading reading material…</p>}><MarkdownPassage passage={passage} onMediaReady={restorePosition} /></Suspense>
            : passage.paragraphs.map((paragraph, index) => <p data-reading-block={index} key={index}>{paragraph}</p>)}
        </div>
      </div>
    </dialog>
  );
}
