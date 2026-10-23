import { generatePuzzle } from "./generator.js";
import { wordById } from "../data/words.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      puzzle: generatePuzzle({
        dictionary: wordById,
        ...data,
        attempts: 12,
        id: `generated-${data.difficulty}-${data.seed}`,
        title: "Свежая мысль",
      }),
    });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
