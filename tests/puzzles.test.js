import test from "node:test";
import assert from "node:assert/strict";
import { puzzles } from "../data/puzzles.js";
import { words, wordById } from "../data/words.js";
import { validatePuzzle } from "../js/validator.js";
import { generatePuzzle } from "../js/generator.js";
import { buildModel, key } from "../js/model.js";
import {
  createState,
  selectEntry,
  inputLetter,
  eraseLetter,
  revealLetter,
  entrySolved,
  progress,
  incorrectCells,
} from "../js/engine.js";
import { readStore, saveGame } from "../js/storage.js";

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
};
test("dictionary: unique Russian words, nonempty definitions, correct lengths and levels", () => {
  assert.equal(wordById.size, words.length);
  words.forEach((word) => {
    assert.match(word.answer, /^[А-Я]+$/);
    assert.ok(word.clue.trim());
    assert.equal(word.length, word.answer.length);
    assert.ok([1, 2, 3].includes(word.difficulty));
    assert.ok(word.theme);
  });
});
test("catalog: 3 puzzles at each level; every layout valid and every letter covered", () => {
  assert.equal(new Set(puzzles.map((p) => p.id)).size, puzzles.length);
  for (const level of [1, 2, 3])
    assert.equal(puzzles.filter((p) => p.difficulty === level).length, 3);
  for (const puzzle of puzzles) {
    const result = validatePuzzle(puzzle, wordById);
    assert.equal(result.valid, true, JSON.stringify(result));
    assert.ok(result.crossings >= puzzle.entries.length - 1);
    const model = buildModel(puzzle, wordById);
    assert.equal(model.letterCells.length, result.letters);
    model.letterCells.forEach((cell) =>
      assert.ok(cell.entries.length >= 1 && cell.entries.length <= 2),
    );
    model.entries.forEach((e) =>
      assert.equal(model.grid[e.clueCell[0]][e.clueCell[1]].type, "clue"),
    );
  }
});
test("validator rejects wrong length, absent word, out-of-bounds cell, broken arrow, overlapping clue, letter conflict and orphan cell", () => {
  const mutations = [
    (p) => p.entries[0].length++,
    (p) => (p.entries[0].wordId = "несуществующееслово"),
    (p) => (p.entries[0].row = -1),
    (p) => (p.entries[0].clue = [0, 0]),
    (p) => (p.entries[0].clue = [p.entries[0].row, p.entries[0].col]),
    (p) => {
      p.entries[1].row = p.entries[0].row;
      p.entries[1].col = p.entries[0].col;
    },
    (p) => (p.cells = [{ type: "letter", row: 99, col: 99 }]),
  ];
  mutations.forEach((mutate) => {
    const p = structuredClone(puzzles[0]);
    mutate(p);
    assert.equal(validatePuzzle(p, wordById).valid, false);
  });
});
test("validator rejects disconnected answers and unrepresented contiguous letter runs", () => {
  const base = {
    rows: 8,
    cols: 8,
    entries: [
      {
        wordId: "кот",
        length: 3,
        row: 1,
        col: 1,
        direction: "across",
        clue: [1, 0],
      },
      {
        wordId: "лес",
        length: 3,
        row: 6,
        col: 1,
        direction: "across",
        clue: [6, 0],
      },
    ],
  };
  assert.ok(
    validatePuzzle(base, wordById).errors.includes("Изолированные слова"),
  );
  base.entries[1].row = 2;
  base.entries[1].clue = [2, 0];
  assert.ok(
    validatePuzzle(base, wordById).errors.some((e) =>
      e.startsWith("Неописанный ряд букв"),
    ),
  );
});
for (const difficulty of [1, 2, 3])
  test(`generator: deterministic valid connected level ${difficulty} grid`, () => {
    const options = {
      dictionary: wordById,
      difficulty,
      seed: 9834 + difficulty,
      attempts: 4,
    };
    const a = generatePuzzle(options),
      b = generatePuzzle(options);
    assert.deepEqual(a, b);
    assert.equal(validatePuzzle(a, wordById).valid, true);
  });
test("generator fails safely for insufficient dictionary and invalid difficulty", () => {
  assert.throws(() => generatePuzzle({ dictionary: new Map(), difficulty: 1 }));
  assert.throws(() => generatePuzzle({ dictionary: wordById, difficulty: 4 }));
});
test("new game is empty, Russian input and Ё normalization work; selected letters can be corrected and deleted", () => {
  const model = buildModel(puzzles[0], wordById),
    state = createState(model);
  assert.equal(progress(model, state).filled, 0);
  assert.equal(state.completed, false);
  assert.equal(inputLetter(model, state, "A"), false);
  inputLetter(model, state, "ё");
  const first = key(...model.entries[0].cells[0]);
  assert.equal(state.answers[first], "Е");
  selectEntry(model, state, 0, 0);
  inputLetter(model, state, "я");
  assert.equal(state.answers[first], "Я");
  selectEntry(model, state, 0, 0);
  eraseLetter(model, state);
  assert.equal(state.answers[first], undefined);
  inputLetter(model, state, "б");
  eraseLetter(model, state);
  assert.equal(state.answers[first], undefined);
});
test("crossing cell shares a single answer between words; mistakes are detected", () => {
  const model = buildModel(puzzles[0], wordById),
    state = createState(model);
  const crossing = model.letterCells.find((c) => c.entries.length === 2),
    index = crossing.entries[0],
    entry = model.entries[index];
  const cursor = entry.cells.findIndex((p) => key(...p) === crossing.key);
  selectEntry(model, state, index, cursor);
  inputLetter(model, state, crossing.answer);
  assert.equal(incorrectCells(model, state).length, 0);
  selectEntry(model, state, index, cursor);
  inputLetter(model, state, crossing.answer === "А" ? "Б" : "А");
  assert.deepEqual(incorrectCells(model, state), [crossing.key]);
});
test("all nine puzzles can be completed through the real input engine, then edited", () => {
  for (const puzzle of puzzles) {
    const model = buildModel(puzzle, wordById),
      state = createState(model);
    for (const entry of model.entries) {
      selectEntry(model, state, entry.index, 0);
      for (const ch of entry.answer) inputLetter(model, state, ch);
      assert.ok(entrySolved(model, state, entry.index));
    }
    assert.equal(state.completed, true);
    assert.equal(progress(model, state).percent, 100);
    assert.equal(progress(model, state).solved, model.entries.length);
    assert.deepEqual(incorrectCells(model, state), []);
    eraseLetter(model, state);
    assert.equal(state.completed, false);
  }
});
test("hints only open incorrect/empty cells and count actual revealed letters", () => {
  const model = buildModel(puzzles[0], wordById),
    state = createState(model);
  const entry = model.entries[0];
  for (let i = 0; i < entry.length; i++)
    assert.equal(revealLetter(model, state), true);
  const count = state.hints;
  assert.equal(revealLetter(model, state), false);
  assert.equal(state.hints, count);
  assert.ok(entrySolved(model, state, 0));
});
test("saving and reload preserve letters, cursor, timer and hints; corruption and storage failure are safe", () => {
  const storage = memoryStorage(),
    model = buildModel(puzzles[0], wordById),
    state = createState(model);
  inputLetter(model, state, "а");
  revealLetter(model, state);
  state.seconds = 321;
  assert.equal(saveGame(puzzles[0].id, state, storage), true);
  const data = readStore(storage),
    restored = createState(model, data.games[puzzles[0].id]);
  assert.equal(data.lastPuzzle, puzzles[0].id);
  assert.deepEqual(restored, state);
  assert.deepEqual(readStore({ getItem: () => "{broken" }).games, {});
  assert.equal(
    saveGame("id", state, {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    }),
    false,
  );
  assert.equal(createState(model, null).completed, false);
  assert.equal(createState(model, { seconds: Infinity }).seconds, 0);
});

test("validator safely rejects malformed stored generated puzzles", () => {
  const p = structuredClone(puzzles[0]);
  p.entries[0] = null;
  assert.equal(validatePuzzle(p, wordById).valid, false);
  assert.equal(validatePuzzle(null, wordById).valid, false);
  assert.equal(validatePuzzle(puzzles[0], null).valid, false);
});
