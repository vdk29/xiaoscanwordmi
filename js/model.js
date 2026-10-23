export const key = (r, c) => `${r},${c}`;
export const pathFor = (entry) =>
  Array.from({ length: entry.length }, (_, i) => [
    entry.row + (entry.direction === "down" ? i : 0),
    entry.col + (entry.direction === "across" ? i : 0),
  ]);
export function buildModel(puzzle, dictionary) {
  const grid = Array.from({ length: puzzle.rows }, () =>
    Array.from({ length: puzzle.cols }, () => ({ type: "block" })),
  );
  const entries = puzzle.entries.map((entry, index) => ({
    ...entry,
    index,
    ...dictionary.get(entry.wordId),
    clueCell: entry.clue,
    cells: pathFor({ ...entry, length: dictionary.get(entry.wordId).length }),
  }));
  for (const entry of entries) {
    entry.cells.forEach(([r, c], i) => {
      const cell = grid[r][c];
      grid[r][c] = {
        type: "letter",
        answer: entry.answer[i],
        entries: [...(cell.entries || []), entry.index],
        key: key(r, c),
      };
    });
    const [r, c] = entry.clueCell;
    const cell = grid[r][c];
    grid[r][c] = {
      type: "clue",
      entries: [...(cell.entries || []), entry.index],
    };
  }
  return {
    grid,
    entries,
    letterCells: grid.flat().filter((cell) => cell.type === "letter"),
  };
}
