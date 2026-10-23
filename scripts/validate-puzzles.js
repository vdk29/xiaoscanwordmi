import { puzzles } from "../data/puzzles.js";
import { wordById } from "../data/words.js";
import { validatePuzzle } from "../js/validator.js";
let failed = false;
for (const p of puzzles) {
  const result = validatePuzzle(p, wordById);
  console.log(
    `${result.valid ? "✓" : "✗"} ${p.id}: ${p.title} — ${result.words} слов, ${result.crossings} пересечений`,
    result.errors.join("; "),
  );
  failed ||= !result.valid;
}
process.exitCode = failed ? 1 : 0;
