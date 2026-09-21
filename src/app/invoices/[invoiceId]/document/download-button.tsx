"use client";

/**
 * Saving the PDF somewhere of your choosing.
 *
 * Browsers do not agree on whether a page may ask where a file should go.
 * Chrome and Edge on a computer have a picker we can open - the real Save As,
 * so a file can go straight into the client's folder. Safari, and everything
 * on an iPad, have no such thing at all: the file goes where that browser has
 * been told to put things, usually Downloads, and no amount of code changes
 * it.
 *
 * So this is a plain download link first and foremost - which works in every
 * browser, and would work with no JavaScript at all - and the click is only
 * intercepted where there is a genuine Save As to offer instead. Written the
 * other way round, as a button that navigates, it would be a worse link
 * pretending to be a better one.
 */
import { useState } from "react";

/**
 * What Chrome and Edge offer and the others do not. Typed here because it is
 * genuinely absent from most browsers, so it cannot be assumed to exist.
 */
type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

export default function DownloadButton({
  href,
  fileName,
}: {
  /** The address the PDF comes from. */
  href: string;
  /** What to call it when it is saved. */
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function maybePick(event: React.MouseEvent<HTMLAnchorElement>) {
    const picker = (
      globalThis as unknown as { showSaveFilePicker?: SaveFilePicker }
    ).showSaveFilePicker;

    // Read at click time rather than at render, so the server and the browser
    // draw the same thing to begin with and nothing has to be guessed about
    // the browser before it arrives. No picker: let the link be a link.
    if (!picker) return;

    event.preventDefault();
    setProblem(null);
    setBusy(true);
    try {
      // Fetched before the picker opens, so a slow build does not leave
      // somebody staring at a Save box that has not got the file yet.
      const response = await fetch(`${href}?download`);
      if (!response.ok) throw new Error(`The server said ${response.status}.`);
      const pdf = await response.blob();

      const handle = await picker({
        suggestedName: fileName,
        types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(pdf);
      await writable.close();
    } catch (error) {
      // Closing the Save box is a decision, not a fault, and saying "could not
      // save" to somebody who just pressed Cancel is how an app loses trust.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setProblem("Could not save it. Try again, or use “Open on its own”.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a
        href={`${href}?download`}
        download={fileName}
        onClick={maybePick}
        aria-busy={busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover aria-busy:opacity-50"
      >
        {busy ? "Saving…" : "Download"}
      </a>
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </>
  );
}
