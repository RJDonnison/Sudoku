import { useEffect, useMemo, useState } from "react";
import Puzzles from "./lib/puzzles";
import { SudokuBoard } from "./SudokuBoard";
import { solve, applySteps, initState } from "./lib/solver";
import type { Step } from "./lib/types";
import "./App.css";

const gridToString = (g: number[]) => g.map((d) => d || ".").join("");

function describe(s: Step | undefined): string {
  if (!s) return "Start: no moves yet";
  const r = Math.floor(s.index / 9) + 1;
  const c = (s.index % 9) + 1;
  if (s.kind === "backtrack") return `Backtrack: cleared row ${r}, col ${c}`;
  return `Placed ${s.digit} at row ${r}, col ${c} (${s.reason === "single" ? "only candidate" : "guess"})`;
}

export default function App() {
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [step, setStep] = useState(0); // how many steps have been applied
  const [playing, setPlaying] = useState(false);
  const [delay, setDelay] = useState(120); // ms between steps
  const [showCandidates, setShowCandidates] = useState(false);

  const entry = Puzzles[puzzleIdx];
  const start = useMemo(() => [...entry.puzzle].map(Number), [entry]);
  const steps = useMemo(() => solve(start), [start]);

  const grid = useMemo(
    () => applySteps(start, steps.slice(0, step)),
    [start, steps, step],
  );
  const notes = useMemo(
    () => (showCandidates ? initState(grid).c : undefined),
    [grid, showCandidates],
  );
  const last = step > 0 ? steps[step - 1] : undefined;

  const { guesses, backtracks } = useMemo(() => {
    let g = 0;
    let b = 0;
    for (let i = 0; i < step; i++) {
      const s = steps[i];
      if (s.kind === "backtrack") b++;
      else if (s.reason === "guess") g++;
    }
    return { guesses: g, backtracks: b };
  }, [steps, step]);

  const atEnd = step >= steps.length;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => setStep((s) => Math.min(s + 1, steps.length)),
      delay,
    );
    return () => clearInterval(id);
  }, [playing, delay, steps.length]);

  useEffect(() => {
    if (atEnd) setPlaying(false);
  }, [atEnd]);

  function pickPuzzle(i: number) {
    setPuzzleIdx(i);
    setStep(0);
    setPlaying(false);
  }

  function togglePlay() {
    if (playing) return setPlaying(false);
    if (atEnd) setStep(0); // replay from the start
    setPlaying(true);
  }

  const go = (n: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(steps.length, n)));
  };

  return (
    <div className="app">
      <select
        value={puzzleIdx}
        onChange={(e) => pickPuzzle(Number(e.target.value))}
      >
        {Puzzles.map((p, i) => (
          <option key={p.id} value={i}>
            {p.id} ({p.difficulty})
          </option>
        ))}
      </select>

      <SudokuBoard
        puzzle={entry.puzzle}
        values={gridToString(grid)}
        notes={notes}
        highlightCells={last ? [last.index] : []}
        showControls={false}
        disabled
      />

      <div className="status">
        <strong>
          Step {step} / {steps.length}
        </strong>
        <span>{describe(last)}</span>
        <span className="muted">
          {guesses} guesses · {backtracks} backtracks so far
        </span>
      </div>

      <input
        className="scrub"
        type="range"
        min={0}
        max={steps.length}
        value={step}
        onChange={(e) => go(Number(e.target.value))}
        aria-label="Solver step"
      />

      <div className="row">
        <button onClick={() => go(0)} title="Back to start">
          ⏮
        </button>
        <button
          onClick={() => go(step - 1)}
          disabled={step === 0}
          title="Step back"
        >
          ◀
        </button>
        <button onClick={togglePlay} className="primary">
          {playing ? "Pause" : atEnd ? "Replay" : "Play"}
        </button>
        <button
          onClick={() => go(step + 1)}
          disabled={atEnd}
          title="Step forward"
        >
          ▶
        </button>
        <button onClick={() => go(steps.length)} title="Jump to solution">
          ⏭
        </button>
      </div>

      <div className="row">
        <label>
          Speed
          <select
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
          >
            <option value={500}>Slow</option>
            <option value={120}>Normal</option>
            <option value={30}>Fast</option>
            <option value={5}>Very fast</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showCandidates}
            onChange={(e) => setShowCandidates(e.target.checked)}
          />{" "}
          Show candidates
        </label>
      </div>
    </div>
  );
}
