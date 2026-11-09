export type Grid = number[];

export type Step =
  | {
      kind: "place";
      index: number;
      digit: number;
      reason: "single" | "hidden" | "guess";
    }
  | { kind: "backtrack"; index: number };
