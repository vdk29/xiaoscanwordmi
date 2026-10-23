import { validatePuzzle } from "./validator.js";
import { key } from "./model.js";
export function seededRandom(seed = 1) {
  let state = Number(seed) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A bounded greedy search over connected words, with reserved in-grid clue cells.
 * Only right/down answers. A clue may sit before the word or bend from above/left.
 * Rejected layouts never reach the caller. No network or external dictionary. */
export function generatePuzzle({
  dictionary,
  difficulty = 1,
  seed = 1,
  attempts = 18,
  id = `generated-${difficulty}-${seed}`,
  title = "Новая история",
}) {
  const size = [0, 9, 13, 17][difficulty];
  if (!size || !(dictionary instanceof Map))
    throw new Error("Некорректные параметры генератора");
  const minWords = [0, 6, 12, 22][difficulty],
    random = seededRandom(seed);
  const pool = [...dictionary.values()].filter(
    (w) => w.difficulty <= difficulty && w.length >= 3 && w.length < size,
  );
  if (pool.length < minWords)
    throw new Error("Недостаточно слов для связной сетки");
  let best;
  for (
    let attempt = 0;
    attempt < Math.min(100, Math.max(1, attempts));
    attempt++
  ) {
    const letters = new Map(),
      clues = new Map(),
      used = new Set(),
      entries = [];
    const inside = (r, c) => r >= 0 && c >= 0 && r < size && c < size;
    function candidate(word, row, col, direction) {
      const dr = direction === "down" ? 1 : 0,
        dc = 1 - dr;
      let crossings = 0;
      if (
        letters.has(key(row - dr, col - dc)) ||
        letters.has(key(row + dr * word.length, col + dc * word.length))
      )
        return null;
      for (let i = 0; i < word.length; i++) {
        const r = row + dr * i,
          c = col + dc * i,
          k = key(r, c),
          old = letters.get(k);
        if (!inside(r, c) || clues.has(k)) return null;
        if (old) {
          if (old.char !== word.answer[i] || old.directions.includes(direction))
            return null;
          crossings++;
        } else if (
          letters.has(key(r - dc, c - dr)) ||
          letters.has(key(r + dc, c + dr))
        )
          return null;
      }
      if (entries.length && !crossings) return null;
      const positions = [
        [row - dr, col - dc],
        [row - dc, col - dr],
      ];
      const clue = positions.find(
        ([r, c]) =>
          inside(r, c) && !letters.has(key(r, c)) && !clues.has(key(r, c)),
      );
      if (!clue) return null;
      const weight = word.difficulty === difficulty ? 3 : 0;
      return {
        row,
        col,
        direction,
        clue,
        crossings,
        score: crossings * 35 + word.length * 1.8 + weight + random() * 7,
      };
    }
    function place(word, p) {
      const { row, col, direction, clue } = p,
        dr = direction === "down" ? 1 : 0,
        dc = 1 - dr;
      entries.push({
        wordId: word.id,
        row,
        col,
        direction,
        clue,
        length: word.length,
      });
      used.add(word.id);
      clues.set(key(...clue), true);
      for (let i = 0; i < word.length; i++) {
        const k = key(row + dr * i, col + dc * i),
          old = letters.get(k);
        letters.set(k, {
          char: word.answer[i],
          directions: [...(old?.directions || []), direction],
        });
      }
    }
    const starters = pool.filter(
      (w) => w.length >= (difficulty === 3 ? 8 : difficulty === 2 ? 6 : 4),
    );
    const first = starters[Math.floor(random() * starters.length)] || pool[0];
    place(first, {
      row: Math.floor(size / 2),
      col: Math.max(1, Math.floor((size - first.length) / 2)),
      direction: "across",
      clue: [
        Math.floor(size / 2),
        Math.max(1, Math.floor((size - first.length) / 2)) - 1,
      ],
    });
    for (let pass = 0; pass < 55; pass++) {
      let choice;
      for (const word of pool) {
        if (used.has(word.id)) continue;
        for (const [k, cell] of letters) {
          const [r, c] = k.split(",").map(Number);
          for (let i = 0; i < word.length; i++) {
            if (word.answer[i] !== cell.char) continue;
            for (const direction of ["across", "down"]) {
              if (cell.directions.includes(direction)) continue;
              const p = candidate(
                word,
                r - (direction === "down" ? i : 0),
                c - (direction === "across" ? i : 0),
                direction,
              );
              if (p && (!choice || p.score > choice.p.score))
                choice = { word, p };
            }
          }
        }
      }
      if (!choice) break;
      place(choice.word, choice.p);
    }
    // Crop unused margins, keeping every clue and every answer cell.
    const points = [...letters.keys(), ...clues.keys()].map((k) =>
      k.split(",").map(Number),
    );
    const minR = Math.min(...points.map((p) => p[0])),
      minC = Math.min(...points.map((p) => p[1]));
    const puzzle = {
      id,
      title,
      difficulty,
      rows: Math.max(...points.map((p) => p[0])) - minR + 1,
      cols: Math.max(...points.map((p) => p[1])) - minC + 1,
      entries: entries.map((e) => ({
        ...e,
        row: e.row - minR,
        col: e.col - minC,
        clue: [e.clue[0] - minR, e.clue[1] - minC],
      })),
    };
    const result = validatePuzzle(puzzle, dictionary);
    if (result.valid && (!best || result.words > best.entries.length))
      best = puzzle;
  }
  if (!best || best.entries.length < minWords)
    throw new Error(
      "Не удалось собрать качественную сетку. Попробуйте другое зерно.",
    );
  return best;
}
