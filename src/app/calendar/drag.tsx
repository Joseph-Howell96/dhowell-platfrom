"use client";

/**
 * Dragging a job from one day to another.
 *
 * Three small pieces that wrap what the calendar already draws, rather than a
 * rewrite of it: the board holds which job is in the air, a day takes a drop,
 * and a chip can be picked up. The calendar itself stays server-rendered.
 *
 * Dragging is a mouse gesture and nothing else, so it is never the only way to
 * do this: opening a job and changing its date does the same thing, and always
 * did. This is a shortcut for the common case, not a new road to it.
 *
 * A job already on an invoice cannot be picked up at all. Refusing it at the
 * hand rather than at the end of the drag is the honest way round - being
 * allowed to drag something and then told no is worse than not being able to
 * lift it.
 */
import { createContext, useContext, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { rescheduleJob } from "@/lib/job-actions";

type Board = {
  /** The job currently being dragged, or null. */
  carrying: string | null;
  pickUp: (jobId: string) => void;
  putDown: () => void;
  /** Move the carried job to this day. */
  dropOn: (date: string) => void;
  busy: boolean;
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
  const [busy, startTransition] = useTransition();

  const board: Board = {
    carrying,
    busy,
    pickUp: (jobId) => {
      setProblem(null);
      setCarrying(jobId);
    },
    putDown: () => setCarrying(null),
    dropOn: (date) => {
      const jobId = carrying;
      setCarrying(null);
      if (!jobId) return;
      startTransition(async () => {
        // A reason coming back means it did not happen. Saying so is the
        // whole point: a job that silently stays put looks like a bug.
        const reason = await rescheduleJob(jobId, date);
        setProblem(reason);
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
  const live = board.carrying !== null;

  return (
    <div
      className={`${className} ${
        over && live ? "outline outline-2 -outline-offset-2 outline-accent" : ""
      }`}
      onDragOver={(event) => {
        if (!live) return;
        // Without this the browser refuses the drop, and the job springs back
        // with no explanation.
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (!live) return;
        event.preventDefault();
        setOver(false);
        board.dropOn(date);
      }}
    >
      {children}
    </div>
  );
}

/** A job chip, which can be picked up unless it has been invoiced. */
export function DraggableJob({
  jobId,
  movable,
  children,
}: {
  jobId: string;
  /** False once the job is on an invoice. */
  movable: boolean;
  children: ReactNode;
}) {
  const board = useBoard();
  const lifted = board.carrying === jobId;

  return (
    <div
      draggable={movable}
      onDragStart={(event) => {
        if (!movable) return;
        // Something has to be on the clipboard or Firefox will not start the
        // drag at all; the id is also what a drop outside would carry.
        event.dataTransfer.setData("text/plain", jobId);
        event.dataTransfer.effectAllowed = "move";
        board.pickUp(jobId);
      }}
      onDragEnd={() => board.putDown()}
      className={`${movable ? "cursor-grab active:cursor-grabbing" : ""} ${
        lifted ? "opacity-40" : ""
      }`}
    >
      {children}
    </div>
  );
}
