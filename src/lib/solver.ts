import type { Grid, Step } from "./types";

const ALL = 0x1ff;

export const UNITS: number[][] = (() => {
  const units: number[][] = [];
  for (let k = 0; k < 9; k++) {
    units.push(Array.from({ length: 9 }, (_, i) => k * 9 + i));
    units.push(Array.from({ length: 9 }, (_, i) => i * 9 + k));
    const br = Math.floor(k / 3) * 3;
    const bc = (k % 3) * 3;
    units.push(
      Array.from(
        { length: 9 },
        (_, i) => (br + Math.floor(i / 3)) * 9 + bc + (i % 3),
      ),
    );
  }
  return units;
})();

export const UNITS_OF: number[][][] = Array.from({ length: 81 }, (_, i) =>
  UNITS.filter((u) => u.includes(i)),
);

export const PEERS: number[][] = UNITS_OF.map((units, i) =>
  [...new Set(units.flat())].filter((p) => p !== i),
);

export interface State {
  g: Grid;
  c: number[]; // candidate bitmasks
}

const popcount = (n: number) => {
  let k = 0;
  while (n) {
    n &= n - 1;
    k++;
  }
  return k;
};

function computeCell(g: Grid, i: number): number {
  if (g[i]) return 0;
  let mask = ALL;
  for (const p of PEERS[i]) if (g[p]) mask &= ~(1 << (g[p] - 1));
  return mask;
}

export function initState(start: Grid): State {
  const g = [...start];
  return { g, c: g.map((_, i) => computeCell(g, i)) };
}

export function place(st: State, i: number, d: number): boolean {
  const bit = 1 << (d - 1);
  st.g[i] = d;
  st.c[i] = 0;
  for (const p of PEERS[i]) {
    if (st.c[p] & bit) {
      st.c[p] &= ~bit;
      if (st.c[p] === 0) return false;
    }
  }
  return true;
}

export function unplace(st: State, i: number): void {
  st.g[i] = 0;
  st.c[i] = computeCell(st.g, i);
  for (const p of PEERS[i]) st.c[p] = computeCell(st.g, p);
}

function findHiddenSingles(st: State): [number, number] | null | false {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << (d - 1);
      let count = 0;
      let where = -1;
      let alreadyPlaced = false;
      for (const i of unit) {
        if (st.g[i] === d) {
          alreadyPlaced = true;
          break;
        }
        if (st.c[i] & bit) {
          count++;
          where = i;
        }
      }
      if (alreadyPlaced) continue;
      if (count === 0) return false;
      if (count === 1) return [where, d];
    }
  }
  return null;
}

// Cheep propagation
function propagate(st: State, steps: Step[], placed: number[]): boolean {
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < 81; i++) {
      const m = st.c[i];
      if (st.g[i] === 0 && m !== 0 && (m & (m - 1)) === 0) {
        const d = 32 - Math.clz32(m);
        steps.push({ kind: "place", index: i, digit: d, reason: "single" });
        placed.push(i);
        if (!place(st, i, d)) return false;
        progress = true;
      }
    }

    if (progress) continue;

    const hs = findHiddenSingles(st);
    if (hs === false) return false;
    if (hs) {
      const [i, d] = hs;
      steps.push({ kind: "place", index: i, digit: d, reason: "hidden" });
      placed.push(i);
      if (!place(st, i, d)) return false;
      progress = true;
    }
  }

  return true;
}

function search(st: State, steps: Step[], placed: number[]): boolean {
  if (!propagate(st, steps, placed)) return false;

  // Guess
  // Cell with the fewest candidates (all >= 2 after propagation)
  let best = -1;
  let bestN = 10;
  for (let i = 0; i < 81; i++) {
    if (st.g[i] !== 0) continue;
    const n = popcount(st.c[i]);
    if (n === 0) return false;
    if (n < bestN) {
      best = i;
      bestN = n;
    }
  }
  if (best === -1) return true;

  const mask = st.c[best];
  for (let d = 1; d <= 9; d++) {
    if (!(mask & (1 << (d - 1)))) continue;

    const depth = placed.length;
    const child: State = { g: st.g.slice(), c: st.c.slice() };
    steps.push({ kind: "place", index: best, digit: d, reason: "guess" });
    placed.push(best);

    if (place(child, best, d) && search(child, steps, placed)) {
      st.g = child.g;
      st.c = child.c;
      return true;
    }
    while (placed.length > depth) {
      steps.push({ kind: "backtrack", index: placed.pop()! });
    }
  }
  return false;
}

export function solve(start: Grid): Step[] {
  const steps: Step[] = [];
  search(initState(start), steps, []);
  return steps;
}

export function applySteps(start: Grid, steps: Step[]): Grid {
  const g = [...start];
  for (const s of steps) g[s.index] = s.kind === "place" ? s.digit : 0;
  return g;
}
