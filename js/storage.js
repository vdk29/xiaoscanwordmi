const STORAGE_KEY = "xiaoscanwordmi:v1";
export const emptyStore = () => ({
  version: 1,
  lastPuzzle: null,
  games: {},
  generated: [],
});
export function readStore(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage.getItem(STORAGE_KEY));
    if (
      data?.version !== 1 ||
      typeof data.games !== "object" ||
      !data.games ||
      Array.isArray(data.games)
    )
      return emptyStore();
    return {
      ...emptyStore(),
      ...data,
      generated: Array.isArray(data.generated) ? data.generated : [],
    };
  } catch {
    return emptyStore();
  }
}
export function writeStore(data, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
export function saveGame(id, game, storage = globalThis.localStorage) {
  const data = readStore(storage);
  data.lastPuzzle = id;
  data.games[id] = { ...game, updatedAt: Date.now() };
  return writeStore(data, storage);
}
export function addGenerated(puzzle) {
  const data = readStore();
  // Keep all generated puzzles that have progress. Never discard an active game.
  data.generated = [
    ...data.generated.filter((p) => p.id !== puzzle.id),
    puzzle,
  ];
  return writeStore(data);
}
