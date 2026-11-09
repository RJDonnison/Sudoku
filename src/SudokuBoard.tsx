import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import "./SudokuBoard.css";

/* ------------------------------------------------------------------ */
/* Notes helpers                                                       */
/* ------------------------------------------------------------------ */

/** 81 bitmasks, one per cell. Bit (d - 1) set means digit d is pencilled in. */
export type Notes = readonly number[];

export const emptyNotes = (): number[] => new Array(81).fill(0);

export const hasNote = (mask: number, digit: number): boolean =>
  (mask & (1 << (digit - 1))) !== 0;

/** Returns a new notes array with `digit` toggled in cell `index`. */
export function toggleNote(notes: Notes, index: number, digit: number): number[] {
  const next = [...notes];
  next[index] ^= 1 << (digit - 1);
  return next;
}

/** Returns a new notes array with every note in cell `index` removed. */
export function clearNotes(notes: Notes, index: number): number[] {
  const next = [...notes];
  next[index] = 0;
  return next;
}

/* ------------------------------------------------------------------ */
/* Grid helpers                                                        */
/* ------------------------------------------------------------------ */

/** "1".."9" are digits; "." and "0" (and anything else) are empty. */
function parseGrid(s: string, name: string): number[] {
  if (s.length !== 81) {
    throw new Error(`SudokuBoard: "${name}" must be 81 characters, got ${s.length}`);
  }
  return Array.from(s, (ch) => (ch >= "1" && ch <= "9" ? ch.charCodeAt(0) - 48 : 0));
}

const UNITS: number[][] = (() => {
  const units: number[][] = [];
  for (let k = 0; k < 9; k++) {
    units.push(Array.from({ length: 9 }, (_, i) => k * 9 + i)); // row
    units.push(Array.from({ length: 9 }, (_, i) => i * 9 + k)); // column
    const br = Math.floor(k / 3) * 3;
    const bc = (k % 3) * 3;
    units.push(
      Array.from({ length: 9 }, (_, i) => (br + Math.floor(i / 3)) * 9 + bc + (i % 3))
    ); // box
  }
  return units;
})();

function findConflicts(values: number[]): Set<number> {
  const bad = new Set<number>();
  for (const unit of UNITS) {
    const seen = new Map<number, number>();
    for (const i of unit) {
      const d = values[i];
      if (!d) continue;
      const prev = seen.get(d);
      if (prev === undefined) seen.set(d, i);
      else {
        bad.add(i);
        bad.add(prev);
      }
    }
  }
  return bad;
}

const sameBox = (a: number, b: number) =>
  Math.floor(a / 27) === Math.floor(b / 27) && Math.floor((a % 9) / 3) === Math.floor((b % 9) / 3);

const isPeer = (a: number, b: number) =>
  a !== b && (Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9 || sameBox(a, b));

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export interface SudokuBoardProps {
  /** The original puzzle, 81 chars, "." (or "0") = empty. These cells are locked. */
  puzzle: string;
  /** Current grid including the givens, 81 chars, "." (or "0") = empty. */
  values: string;
  /** Pencil marks (81 bitmasks). Omit for none. */
  notes?: Notes;
  /** Fired when the user enters (1-9) or erases (0) a value in an editable cell. */
  onValueChange?: (index: number, digit: number) => void;
  /** Fired when the user toggles a pencil mark in an empty editable cell. */
  onNoteToggle?: (index: number, digit: number) => void;
  /** Fired when the user erases a cell that has pencil marks but no value. */
  onNotesClear?: (index: number) => void;
  /** Extra cells to tint (e.g. the cell your solver is trying). */
  highlightCells?: readonly number[];
  /** Mark duplicate digits in a row/column/box in red. Default true. */
  showConflicts?: boolean;
  /** Show the on-screen number pad. Default true. */
  showControls?: boolean;
  /** Ignore all user input. Default false. */
  disabled?: boolean;
}

export function SudokuBoard({
  puzzle,
  values,
  notes,
  onValueChange,
  onNoteToggle,
  onNotesClear,
  highlightCells,
  showConflicts = true,
  showControls = true,
  disabled = false,
}: SudokuBoardProps) {
  const givens = useMemo(() => parseGrid(puzzle, "puzzle"), [puzzle]);
  const vals = useMemo(() => parseGrid(values, "values"), [values]);
  const conflicts = useMemo(
    () => (showConflicts ? findConflicts(vals) : new Set<number>()),
    [vals, showConflicts]
  );
  const highlights = useMemo(() => new Set(highlightCells ?? []), [highlightCells]);

  const [selected, setSelected] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedDigit = selected !== null ? vals[selected] : 0;

  function enter(digit: number, forceNote = false) {
    if (disabled || selected === null || givens[selected]) return;
    if (pencil || forceNote) {
      if (vals[selected] === 0) onNoteToggle?.(selected, digit);
    } else {
      // Pressing the same digit again clears the cell.
      onValueChange?.(selected, vals[selected] === digit ? 0 : digit);
    }
  }

  function erase() {
    if (disabled || selected === null || givens[selected]) return;
    if (vals[selected] !== 0) onValueChange?.(selected, 0);
    else if (notes && notes[selected]) onNotesClear?.(selected);
  }

  function move(dr: number, dc: number) {
    setSelected((s) => {
      if (s === null) return 0;
      const r = Math.min(8, Math.max(0, Math.floor(s / 9) + dr));
      const c = Math.min(8, Math.max(0, (s % 9) + dc));
      return r * 9 + c;
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // e.code so Shift+1 still reads as digit 1 (Shift = pencil mark).
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) {
      e.preventDefault();
      enter(Number(m[1]), e.shiftKey);
      return;
    }

    switch (e.key) {
      case "ArrowUp": e.preventDefault(); move(-1, 0); break;
      case "ArrowDown": e.preventDefault(); move(1, 0); break;
      case "ArrowLeft": e.preventDefault(); move(0, -1); break;
      case "ArrowRight": e.preventDefault(); move(0, 1); break;
      case "Backspace":
      case "Delete":
      case "0":
        e.preventDefault();
        erase();
        break;
      case "p":
      case "P":
        setPencil((p) => !p);
        break;
      case "Escape":
        setSelected(null);
        break;
    }
  }

  return (
    <div className="sd-wrap">
      <div
        ref={rootRef}
        className="sd-board"
        role="group"
        aria-label="Sudoku board"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {vals.map((v, i) => {
          const r = Math.floor(i / 9);
          const c = i % 9;
          const mask = notes?.[i] ?? 0;

          const cls = ["sd-cell"];
          if (c % 3 === 2 && c !== 8) cls.push("sd-cell--box-r");
          if (r % 3 === 2 && r !== 8) cls.push("sd-cell--box-b");
          if (c === 8) cls.push("sd-cell--last-c");
          if (r === 8) cls.push("sd-cell--last-r");
          if (givens[i]) cls.push("sd-cell--given");
          else if (v) cls.push("sd-cell--entry");
          if (selected !== null) {
            if (i === selected) cls.push("sd-cell--selected");
            else if (isPeer(selected, i)) cls.push("sd-cell--peer");
            if (selectedDigit && v === selectedDigit && i !== selected) cls.push("sd-cell--same");
          }
          if (highlights.has(i)) cls.push("sd-cell--hl");
          if (conflicts.has(i)) cls.push("sd-cell--bad");

          return (
            <div
              key={i}
              className={cls.join(" ")}
              aria-label={`Row ${r + 1}, column ${c + 1}, ${v ? v : "empty"}`}
              onClick={() => {
                setSelected(i);
                rootRef.current?.focus();
              }}
            >
              {v ? (
                v
              ) : mask ? (
                <div className="sd-notes">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <span
                      key={d}
                      className={selectedDigit === d && hasNote(mask, d) ? "sd-note--match" : undefined}
                    >
                      {hasNote(mask, d) ? d : ""}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {showControls && (
        <div className="sd-controls">
          <div className="sd-pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                type="button"
                className="sd-btn"
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()} // keep keyboard focus on the board
                onClick={() => enter(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="sd-tools">
            <button
              type="button"
              className={"sd-btn sd-btn--wide" + (pencil ? " sd-btn--on" : "")}
              aria-pressed={pencil}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setPencil((p) => !p)}
            >
              ✎ Pencil {pencil ? "on" : "off"} (P)
            </button>
            <button
              type="button"
              className="sd-btn sd-btn--wide"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={erase}
            >
              ⌫ Erase
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SudokuBoard;
