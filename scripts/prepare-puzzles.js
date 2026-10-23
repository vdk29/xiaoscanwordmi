import { writeFileSync } from "node:fs";
import { words, wordById } from "../data/words.js";
import { generatePuzzle } from "../js/generator.js";
import { validatePuzzle } from "../js/validator.js";
const titles = [
  "На лёгкой волне",
  "Пауза на чай",
  "Маленькие открытия",
  "Поймать мысль",
  "Вокруг света",
  "В своём ритме",
  "Дело тонкое",
  "Игра смыслов",
  "За горизонтом",
];
const puzzles = [];
for (let i = 0; i < titles.length; i++) {
  const difficulty = Math.floor(i / 3) + 1;
  const puzzle = generatePuzzle({
    dictionary: wordById,
    difficulty,
    seed: 174 + i * 811,
    attempts: 24,
    id: `collection-${i + 1}`,
    title: titles[i],
  });
  puzzle.number = i + 1;
  puzzles.push(puzzle);
  console.log(
    puzzle.title,
    puzzle.rows,
    puzzle.cols,
    validatePuzzle(puzzle, wordById),
  );
}
writeFileSync(
  new URL("../data/puzzles.js", import.meta.url),
  `// Предварительно собранные и проверенные сетки. Не генерируются при открытии.\nexport const puzzles = ${JSON.stringify(puzzles, null, 2)};\n`,
);
console.log("Dictionary:", words.length);
