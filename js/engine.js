import { normalize } from "../data/words.js";
import { key } from "./model.js";
export function createState(model, saved = {}) {
  if (!saved || typeof saved !== "object") saved = {};
  const answers = {};
  for (const cell of model.letterCells) {
    const value = normalize(saved.answers?.[cell.key]);
    if (/^[А-Я]$/.test(value)) answers[cell.key] = value;
  }
  const active =
    Number.isInteger(saved.active) && model.entries[saved.active]
      ? saved.active
      : 0;
  const cursor =
    Number.isInteger(saved.cursor) &&
    saved.cursor >= 0 &&
    saved.cursor < model.entries[active].length
      ? saved.cursor
      : 0;
  return {
    answers,
    active,
    cursor,
    seconds: Number.isFinite(saved.seconds)
      ? Math.max(0, Math.floor(saved.seconds))
      : 0,
    hints: Number.isFinite(saved.hints)
      ? Math.max(0, Math.floor(saved.hints))
      : 0,
    completed: model.letterCells.every((c) => answers[c.key] === c.answer),
    startedAt: saved.startedAt || Date.now(),
  };
}
export function entrySolved(model, state, index) {
  return model.entries[index].cells.every(
    ([r, c], i) => state.answers[key(r, c)] === model.entries[index].answer[i],
  );
}
export function progress(model, state) {
  const filled = model.letterCells.filter((c) => state.answers[c.key]).length;
  const correct = model.letterCells.filter(
    (c) => state.answers[c.key] === c.answer,
  ).length;
  return {
    filled,
    correct,
    total: model.letterCells.length,
    percent: Math.round((filled / model.letterCells.length) * 100),
    solved: model.entries.filter((_, i) => entrySolved(model, state, i)).length,
  };
}
export function selectEntry(model, state, index, cursor) {
  state.active = (index + model.entries.length) % model.entries.length;
  const entry = model.entries[state.active];
  state.cursor =
    cursor === undefined
      ? Math.max(
          0,
          entry.cells.findIndex(([r, c]) => !state.answers[key(r, c)]),
        )
      : Math.max(0, Math.min(entry.length - 1, cursor));
}
export function inputLetter(model, state, letter) {
  const value = normalize(letter);
  if (!/^[А-Я]$/.test(value)) return false;
  const entry = model.entries[state.active],
    [r, c] = entry.cells[state.cursor];
  state.answers[key(r, c)] = value;
  if (state.cursor < entry.length - 1) state.cursor++;
  state.completed = model.letterCells.every(
    (cell) => state.answers[cell.key] === cell.answer,
  );
  return true;
}
export function eraseLetter(model, state, backwards = true) {
  const entry = model.entries[state.active];
  let [r, c] = entry.cells[state.cursor];
  if (!state.answers[key(r, c)] && backwards && state.cursor > 0) {
    state.cursor--;
    [r, c] = entry.cells[state.cursor];
  }
  delete state.answers[key(r, c)];
  state.completed = false;
}
export function revealLetter(model, state) {
  const entry = model.entries[state.active];
  let i = state.cursor;
  if (state.answers[key(...entry.cells[i])] === entry.answer[i])
    i = entry.cells.findIndex(
      ([r, c], j) => state.answers[key(r, c)] !== entry.answer[j],
    );
  if (i < 0) return false;
  state.answers[key(...entry.cells[i])] = entry.answer[i];
  state.hints++;
  state.cursor = Math.min(i + 1, entry.length - 1);
  state.completed = model.letterCells.every(
    (cell) => state.answers[cell.key] === cell.answer,
  );
  return true;
}
export function incorrectCells(model, state) {
  return model.letterCells
    .filter((c) => state.answers[c.key] && state.answers[c.key] !== c.answer)
    .map((c) => c.key);
}
