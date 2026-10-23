import { puzzles } from "../data/puzzles.js";
import { wordById } from "../data/words.js";
import { buildModel } from "./model.js";
import { createState, progress } from "./engine.js";
import { readStore, addGenerated } from "./storage.js";
import { validatePuzzle } from "./validator.js";
import {
  $,
  escapeHtml as esc,
  icon,
  hydrateIcons,
  setupHelp,
  toast,
  levelNames,
} from "./ui.js";
let currentLevel = "all",
  data = readStore();
const models = new Map();
const allPuzzles = [
  ...puzzles,
  ...data.generated.filter((p) => validatePuzzle(p, wordById).valid),
];
function modelFor(p) {
  if (!models.has(p.id)) models.set(p.id, buildModel(p, wordById));
  return models.get(p.id);
}
function info(p) {
  const model = modelFor(p),
    state = createState(model, data.games[p.id]);
  return { ...progress(model, state), completed: state.completed, state };
}
function miniature(p) {
  const model = modelFor(p);
  return `<div class="mini-board" style="--mini-cols:${p.cols};--mini-rows:${p.rows}" aria-hidden="true">${model.grid
    .flat()
    .map(
      (cell) =>
        `<i class="mini-${cell.type}">${cell.type === "clue" ? (model.entries[cell.entries[0]].direction === "across" ? "→" : "↓") : ""}</i>`,
    )
    .join("")}</div>`;
}
function card(p, index) {
  const status = info(p),
    started = Boolean(data.games[p.id]),
    label = status.completed
      ? "Разгадан"
      : started
        ? "Продолжить"
        : "Разгадать";
  const minutes = Math.ceil(
    p.entries.length *
      (p.difficulty === 1 ? 0.65 : p.difficulty === 2 ? 1 : 1.4),
  );
  return `<article class="puzzle-card" style="--card-delay:${Math.min(index, 8) * 35}ms"><a href="game.html?id=${encodeURIComponent(p.id)}" class="card-link" aria-label="${label}: ${esc(p.title)}"><div class="card-preview palette-${p.difficulty}"><span class="card-number">№ ${String(p.number || allPuzzles.indexOf(p) + 1).padStart(2, "0")}</span><span class="level-badge badge-${p.difficulty}"><i></i> ${levelNames[p.difficulty]}</span>${miniature(p)}${status.completed ? `<span class="solved-sticker">${icon("check")} Разгадан</span>` : ""}</div><div class="card-body"><div class="card-meta"><span>${p.cols} × ${p.rows}</span><span>·</span><span>${p.entries.length} слов</span><span>·</span><span>${icon("clock")} ~${minutes} мин</span></div><h4>${esc(p.title)}</h4><p>${["", "Знакомые слова, приятные открытия.", "Чуть больше мыслей. Чуть ярче открытия.", "Для тех, кто любит докопаться до слова."][p.difficulty]}</p><div class="card-bottom"><span class="card-cta">${label} ${icon("arrow")}</span><span class="card-progress">${started ? `${status.percent}% <i><b style="width:${status.percent}%"></b></i>` : "Чистый лист"}</span></div></div></a></article>`;
}
function renderCatalog() {
  const status = $("#status-filter").value;
  const selected = allPuzzles.filter(
    (p) =>
      (currentLevel === "all" || p.difficulty === Number(currentLevel)) &&
      (status === "all" ||
        (status === "completed" && info(p).completed) ||
        (status === "started" && data.games[p.id] && !info(p).completed) ||
        (status === "new" && !data.games[p.id])),
  );
  $("#puzzle-grid").innerHTML = selected.length
    ? selected.map(card).join("")
    : '<div class="empty-state"><span>✳</span><h4>Здесь пока чистый лист</h4><p>Выбери другую сложность или измени фильтр прогресса.</p></div>';
  $("#result-count").textContent = selected.length;
  $(".filter-count").textContent = allPuzzles.length;
}
function renderProgress() {
  let completed = 0,
    found = 0,
    seconds = 0;
  allPuzzles.forEach((p) => {
    const status = info(p);
    completed += Number(status.completed);
    found += status.solved;
    seconds += status.state.seconds;
  });
  $("#stat-completed").textContent = completed;
  $("#stat-words").textContent = found;
  $("#stat-time").textContent = Math.floor(seconds / 60);
  const unfinished = allPuzzles
    .filter((p) => data.games[p.id] && !info(p).completed)
    .sort(
      (a, b) =>
        (data.games[b.id].updatedAt || 0) - (data.games[a.id].updatedAt || 0),
    );
  if (unfinished.length) {
    const p = unfinished[0],
      status = info(p),
      section = $("#continue-section");
    section.hidden = false;
    section.innerHTML = `<span class="continue-icon">${icon("play")}</span><div><span class="eyebrow">СЛОВА ТЕБЯ ДОЖДАЛИСЬ</span><h3>${esc(p.title)}</h3></div><div class="continue-meter"><span>${status.percent}% заполнено</span><i><b style="width:${status.percent}%"></b></i></div><a class="button primary" href="game.html?id=${encodeURIComponent(p.id)}">Продолжить ${icon("arrow")}</a>`;
  }
}
document.querySelectorAll("[data-level]").forEach((button) =>
  button.addEventListener("click", () => {
    currentLevel = button.dataset.level;
    document.querySelectorAll("[data-level]").forEach((b) => {
      b.classList.toggle("active", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    });
    renderCatalog();
  }),
);
$("#status-filter").addEventListener("change", renderCatalog);
$("#generate-button").addEventListener("click", async () => {
  const button = $("#generate-button");
  button.disabled = true;
  button.textContent = "Собираем слова…";
  try {
    const difficulty = Number($("#generate-level").value),
      seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const puzzle = await new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("./generator-worker.js", import.meta.url),
        { type: "module" },
      );
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(
          new Error(
            "Не удалось подобрать сетку за отведённое время. Попробуй ещё раз.",
          ),
        );
      }, 30000);
      worker.onmessage = (event) => {
        clearTimeout(timeout);
        worker.terminate();
        event.data.error
          ? reject(new Error(event.data.error))
          : resolve(event.data.puzzle);
      };
      worker.onerror = () => {
        clearTimeout(timeout);
        worker.terminate();
        reject(
          new Error(
            "Не удалось собрать сетку. Готовые сканворды доступны в каталоге.",
          ),
        );
      };
      worker.postMessage({ difficulty, seed });
    });
    if (!validatePuzzle(puzzle, wordById).valid)
      throw new Error("Сетка не прошла проверку. Попробуй ещё раз.");
    if (!addGenerated(puzzle))
      throw new Error(
        "Не удалось сохранить новую сетку. Освободи место в хранилище браузера.",
      );
    location.href = `game.html?id=${encodeURIComponent(puzzle.id)}`;
  } catch (error) {
    toast(error.message);
    button.disabled = false;
    button.innerHTML = `Новый сканворд ${icon("plus")}`;
  }
});
hydrateIcons();
setupHelp();
renderCatalog();
renderProgress();
