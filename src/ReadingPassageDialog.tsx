import { useEffect, useId, useRef } from "react";
import type { ReadingPassage } from "./models";

type ReadingPassageDialogProps = {
  passage: ReadingPassage;
  onClose: () => void;
};

export function ReadingPassageDialog({ passage, onClose }: ReadingPassageDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  return (
    <dialog ref={dialogRef} className="reading-dialog" aria-labelledby={titleId} onClose={onClose}>
      <div className="reading-dialog-header">
        <div>
          <p className="eyebrow">READING PASSAGE</p>
          <h2 id={titleId}>{passage.title}</h2>
        </div>
        <button className="secondary-button" type="button" onClick={() => dialogRef.current?.close()}>Close passage</button>
      </div>
      <div className="reading-dialog-body">
        {passage.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
    </dialog>
  );
}
