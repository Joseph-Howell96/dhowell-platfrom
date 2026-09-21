"use client";

/**
 * Saving the invoice somewhere you choose.
 *
 * Three ways, because no one way exists everywhere, and the right one is
 * whichever the device in your hand actually has:
 *
 *   - A computer running Chrome or Edge has a real Save As box, so the file
 *     can go straight into the client's folder.
 *   - An iPad has no such thing and never will - iOS gives a web page no way
 *     to open a folder picker at all. What it does give is the share sheet,
 *     and "Save to Files" on that sheet leads to exactly the same folders.
 *     It also leads to Mail and AirDrop, which is how an invoice actually
 *     reaches a client.
 *   - Anything else gets an ordinary download, landing wherever that browser
 *     has been told to put things.
 *
 * Underneath it is a plain download link, which works in every browser and
 * would work with no JavaScript at all. The click is only intercepted when
 * there is something better to offer.
 */
import { useRef, useState } from "react";

/** Chrome and Edge on a computer. Genuinely absent almost everywhere else. */
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
  title,
}: {
  /** The address the PDF comes from. */
  href: string;
  /** What to call it when it is saved. */
  fileName: string;
  /** What to call it on a share sheet. */
  title: string;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /**
   * The file, fetched early.
   *
   * Held in a ref rather than state because it must not cause a redraw, and
   * fetched on the way down of the press rather than on the click itself.
   * That is not an optimisation. iOS will only open a share sheet as the
   * direct result of a tap, and an `await` sitting between the tap and the
   * asking breaks that chain - the sheet never appears and the browser
   * reports permission denied. Starting the fetch a moment earlier means the
   * file is usually in hand by the time the finger lifts.
   */
  const fetching = useRef<Promise<Blob> | null>(null);

  function start() {
    fetching.current ??= fetch(`${href}?download`).then((response) => {
      if (!response.ok) throw new Error(`The server said ${response.status}.`);
      return response.blob();
    });
  }

  async function save(event: React.MouseEvent<HTMLAnchorElement>) {
    const picker = (
      globalThis as unknown as { showSaveFilePicker?: SaveFilePicker }
    ).showSaveFilePicker;
    const canShareFiles = typeof navigator !== "undefined" && "canShare" in navigator;

    // Nothing better than the link itself. Let it be a link.
    if (!picker && !canShareFiles) return;

    event.preventDefault();
    setProblem(null);
    setBusy(true);
    try {
      start();
      const pdf = (await fetching.current) as Blob;
      const file = new File([pdf], fileName, { type: "application/pdf" });

      // A real Save As first where there is one: picking the folder yourself
      // beats a sheet you have to go through to get to the same place.
      if (picker) {
        const handle = await picker({
          suggestedName: fileName,
          types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(pdf);
        await writable.close();
        return;
      }

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return;
      }

      // Neither, after all. Fall back to what the link would have done.
      window.open(`${href}?download`, "_self");
    } catch (error) {
      // Closing the Save box or the share sheet is a decision, not a fault,
      // and telling somebody who just pressed Cancel that it failed is how an
      // app loses their trust.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setProblem("Could not save it. Try “Open on its own”, then share from there.");
    } finally {
      setBusy(false);
      // Thrown away so a second press fetches a fresh copy - the invoice may
      // have been corrected in between.
      fetching.current = null;
    }
  }

  return (
    <>
      <a
        href={`${href}?download`}
        download={fileName}
        onPointerDown={start}
        onClick={save}
        aria-busy={busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover aria-busy:opacity-50"
      >
        {busy ? "Saving…" : "Save as…"}
      </a>
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </>
  );
}
