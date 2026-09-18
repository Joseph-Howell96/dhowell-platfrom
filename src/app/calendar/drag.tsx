"use client";

/**
 * Dragging a job from one day to another.
 *
 * Two pieces wrapped around what the calendar already draws, rather than a
 * rewrite of it: a chip that can be picked up, and a day that takes a drop.
 * The calendar itself stays server-rendered.
 *
 * Dragging is a mouse gesture and nothing else, so it is never the only way to
 * do this: opening a job and changing its date does the same thing, and always
 * did. This is a shortcut for the common case, not a new road to it.
 *
 * Two things here are deliberate and were arrived at the hard way:
 *
 * The chip itself carries "draggable", rather than a wrapper around it. A
 * draggable box holding a link that says draggable="false" works in Chrome,
 * which walks up to the nearest draggable ancestor, and does nothing at all in
 * Safari, which does not.
 *
 * A day decides whether to accept a drop by looking at what the drag is
 * carrying, not at anything React is holding. The types on a drag are readable
 * while it is in the air even when the data is not, so this works even where
 * the two ends of the gesture cannot share state.
 */
import { createContext, useContext, useState, useTransition } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { rescheduleJob } from "@/lib/job-actions";

/** Our own flavour of drag, so a day ignores anything else dropped on it. */
const JOB = "application/x-dennis-job";

type Board = {
  /** The job in the air, for dimming the chip it came from. */
  carrying: string | null;
  pickUp: (jobId: string) => void;
  putDown: () => void;
  move: (jobId: string, date: string) => void;
};

const BoardContext = createContext<Board | null>(null);

function useBoard(): Board {
  const board = useContext(BoardContext);
  if (!board) throw new Error("Used outside the calendar board");
  return board;
}

export function DragBoard({ children }: { children: ReactNode }) {
  const [carrying, setCarrying] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const board: Board = {
    carrying,
    pickUp: (jobId) => {
      setProblem(null);
      setCarrying(jobId);
    },
    putDown: () => setCarrying(null),
    move: (jobId, date) => {
      setCarrying(null);
      startTransition(async () => {
        // A reason coming back means it did not happen. Saying so is the
        // whole point: a job that silently stays put looks like a bug.
        setProblem(await rescheduleJob(jobId, date));
      });
    },
  };

  return (
    <BoardContext.Provider value={board}>
      {problem ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {problem}
        </p>
      ) : null}
      {children}
    </BoardContext.Provider>
  );
}

/** Is this drag carrying one of our jobs? */
function carriesJob(types: readonly string[]): boolean {
  return types.includes(JOB);
}

/** A day of the calendar, which a job can be dropped onto. */
export function DropDay({
  date,
  className,
  children,
}: {
  date: string;
  className: string;
  children: ReactNode;
}) {
  const board = useBoard();
  const [over, setOver] = useState(false);

  return (
    <div
      className={`${className} ${
        over ? "outline outline-2 -outline-offset-2 outline-accent" : ""
      }`}
      onDragOver={(event) => {
        if (!carriesJob(event.dataTransfer.types)) return;
        // Without this the browser refuses the drop, and the job springs back
        // with no explanation.
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (!carriesJob(event.dataTransfer.types)) return;
        event.preventDefault();
        setOver(false);
        const jobId =
          event.dataTransfer.getData(JOB) ||
          event.dataTransfer.getData("text/plain");
        if (jobId) board.move(jobId, date);
      }}
    >
      {children}
    </div>
  );
}

/**
 * A job on the calendar: a link to it, which can also be picked up and moved
 * unless it has been invoiced.
 *
 * Refusing it at the hand rather than at the end of the drag is the honest way
 * round - being allowed to drag something and then told no is worse than not
 * being able to lift it. The server refuses as well, for the page that was
 * already open when the invoice was raised somewhere else.
 */
export function JobChip({
  jobId,
  title,
  className,
  movable,
  children,
}: {
  jobId: string;
  title: string;
  className: string;
  /** False once the job is on an invoice. */
  movable: boolean;
  children: ReactNode;
}) {
  const board = useBoard();
  const lifted = board.carrying === jobId;

  return (
    <Link
      href={`/calendar/${jobId}`}
      title={title}
      draggable={movable}
      onDragStart={(event) => {
        if (!movable) {
          event.preventDefault();
          return;
        }
        // Our own type is what a day looks for. text/plain as well, because a
        // drag with nothing on it at all does not start in every browser.
        event.dataTransfer.setData(JOB, jobId);
        event.dataTransfer.setData("text/plain", jobId);
        event.dataTransfer.effectAllowed = "move";
        board.pickUp(jobId);
      }}
      onDragEnd={() => board.putDown()}
      className={`${className} ${movable ? "cursor-grab active:cursor-grabbing" : ""} ${
        lifted ? "opacity-40" : ""
      }`}
    >
      {children}
    </Link>
  );
}
