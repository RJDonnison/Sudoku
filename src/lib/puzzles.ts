import data from "./puzzles.json";

type Puzzle = {
  id: string;
  difficulty: string;
  puzzle: string;
  solution: string;
};

const puzzles: Puzzle[] = data.puzzles;

export default puzzles;
