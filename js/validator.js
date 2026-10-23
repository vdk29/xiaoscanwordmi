import { key, pathFor } from "./model.js";
/** Independent validation: never trusts generated cell data or cached answers. */
export function validatePuzzle(puzzle, dictionary) {
  const errors = [];
  if (
    !(dictionary instanceof Map) ||
    !Number.isInteger(puzzle?.rows) ||
    !Number.isInteger(puzzle?.cols) ||
    puzzle.rows < 2 ||
    puzzle.cols < 2 ||
    puzzle.rows > 40 ||
    puzzle.cols > 40 ||
    !Array.isArray(puzzle.entries) ||
    !puzzle.entries.length
  )
    return { valid: false, errors: ["Некорректный размер или пустая сетка"] };
  const letters = new Map(),
    clues = new Map(),
    paths = [],
    used = new Set();
  const inside = (r, c) =>
    Number.isInteger(r) &&
    Number.isInteger(c) &&
    r >= 0 &&
    c >= 0 &&
    r < puzzle.rows &&
    c < puzzle.cols;
  for (const [i, entry] of puzzle.entries.entries()) {
    if (!entry || typeof entry !== "object") {
      errors.push(`Слово ${i}: некорректная запись`);
      paths[i] = [];
      continue;
    }
    const word = dictionary.get(entry.wordId);
    if (
      !word ||
      !word.clue?.trim() ||
      !/^[А-Я]+$/.test(word.answer) ||
      word.length !== word.answer.length
    ) {
      errors.push(`Слово ${i}: нет корректной словарной записи`);
      paths[i] = [];
      continue;
    }
    if (used.has(entry.wordId)) errors.push(`Повтор слова ${entry.wordId}`);
    used.add(entry.wordId);
    if (!["across", "down"].includes(entry.direction))
      errors.push(`Слово ${i}: направление`);
    if (entry.length !== word.length) errors.push(`Слово ${i}: длина`);
    const cells = pathFor({ ...entry, length: word.length });
    paths[i] = cells;
    cells.forEach(([r, c], j) => {
      if (!inside(r, c)) errors.push(`Слово ${i}: выход за границу`);
      const k = key(r, c),
        old = letters.get(k);
      if (
        old &&
        (old.char !== word.answer[j] ||
          old.directions.includes(entry.direction))
      )
        errors.push(`Слово ${i}: конфликт букв или наложение`);
      letters.set(k, {
        char: word.answer[j],
        owners: [...(old?.owners || []), i],
        directions: [...(old?.directions || []), entry.direction],
      });
    });
    if (!Array.isArray(entry.clue) || !inside(...entry.clue)) {
      errors.push(`Слово ${i}: клетка определения`);
      continue;
    }
    const [cr, cc] = entry.clue,
      dr = entry.row - cr,
      dc = entry.col - cc;
    const validArrow =
      entry.direction === "across"
        ? (dr === 0 && dc === 1) || (dr === 1 && dc === 0)
        : (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    if (!validArrow) errors.push(`Слово ${i}: стрелка не ведёт к началу`);
    const ck = key(cr, cc);
    clues.set(ck, [...(clues.get(ck) || []), i]);
  }
  clues.forEach((owners, k) => {
    if (letters.has(k)) errors.push(`Определение поверх буквы ${k}`);
    if (owners.length > 2) errors.push(`Более двух определений в ${k}`);
  });
  // Every contiguous run of >=2 letters must have a corresponding complete entry.
  for (const direction of ["across", "down"]) {
    const dr = direction === "down" ? 1 : 0,
      dc = 1 - dr;
    letters.forEach((_, k) => {
      const [r, c] = k.split(",").map(Number);
      if (letters.has(key(r - dr, c - dc))) return;
      const run = [];
      let rr = r,
        cc = c;
      while (letters.has(key(rr, cc))) {
        run.push(key(rr, cc));
        rr += dr;
        cc += dc;
      }
      if (
        run.length > 1 &&
        !puzzle.entries.some(
          (e, i) =>
            e?.direction === direction &&
            paths[i].map((p) => key(...p)).join("|") === run.join("|"),
        )
      )
        errors.push(`Неописанный ряд букв ${k} ${direction}`);
    });
  }
  // All answers must be connected through actual shared letter cells.
  const visited = new Set([0]);
  let changed = true;
  while (changed) {
    changed = false;
    letters.forEach(({ owners }) => {
      if (owners.some((i) => visited.has(i)))
        owners.forEach((i) => {
          if (!visited.has(i)) {
            visited.add(i);
            changed = true;
          }
        });
    });
  }
  if (visited.size !== puzzle.entries.length)
    errors.push("Изолированные слова");
  if (Array.isArray(puzzle.cells)) {
    puzzle.cells.forEach((cell) => {
      if (cell?.type === "letter" && !letters.has(key(cell.row, cell.col)))
        errors.push("Буква без ответа");
    });
  }
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    letters: letters.size,
    crossings: [...letters.values()].filter((c) => c.owners.length === 2)
      .length,
    words: puzzle.entries.length,
  };
}
