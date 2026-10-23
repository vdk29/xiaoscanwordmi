import { puzzles } from "../data/puzzles.js";
import { wordById } from "../data/words.js";
import { buildModel, key } from "./model.js";
import { validatePuzzle } from "./validator.js";
import {
  createState,
  selectEntry,
  inputLetter,
  eraseLetter,
  revealLetter,
  entrySolved,
  progress,
  incorrectCells,
} from "./engine.js";
import { readStore, saveGame } from "./storage.js";
import {
  $,
  escapeHtml as esc,
  icon,
  hydrateIcons,
  setupHelp,
  toast,
  timeLabel,
  levelNames,
} from "./ui.js";

hydrateIcons();
setupHelp();
const saved = readStore(),
  id = new URLSearchParams(location.search).get("id");
const puzzle = [...puzzles, ...saved.generated].find((p) => p?.id === id);
if (!puzzle || !validatePuzzle(puzzle, wordById).valid)
  $("#game-error").hidden = false;
else startGame(puzzle);

function startGame(puzzle) {
  const model = buildModel(puzzle, wordById);
  let state = createState(model, saved.games[puzzle.id]),
    errors = new Set(),
    cellSize = 58,
    pause = false,
    saveFailed = false;
  let lastTick = performance.now(),
    partialSecond = 0,
    previousCompleted = state.completed;
  const frame = $("#board-viewport"),
    board = $("#board");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.title = `${puzzle.title} — ксяосканвордми`;
  $("#game-main").hidden = false;
  $("#game-title").textContent = puzzle.title;
  $("#game-level").textContent =
    `${levelNames[puzzle.difficulty]} · ${puzzle.cols} × ${puzzle.rows} · ${model.entries.length} слов`;
  function arrow(entry) {
    const horizontal = entry.direction === "across";
    const straight = horizontal
      ? entry.clueCell[0] === entry.row
      : entry.clueCell[1] === entry.col;
    const path = horizontal
      ? straight
        ? "M3 12h17m-6-6 6 6-6 6"
        : "M5 3v12h15m-5-5 5 5-5 5"
      : straight
        ? "M12 3v17m-6-6 6 6 6-6"
        : "M3 5h12v15m-5-5 5 5 5-5";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
  }
  function persist() {
    saveFailed = !saveGame(puzzle.id, state);
    const status = $("#save-status");
    status.classList.toggle("failed", saveFailed);
    status.innerHTML = saveFailed
      ? "Не удалось сохранить. Проверь свободное место в браузере."
      : "<span></span> Всё сохраняется автоматически";
    if (saveFailed && !persist.warned) {
      toast(
        "Браузер не сохраняет прогресс. Проверь доступ к хранилищу и свободное место.",
      );
      persist.warned = true;
    }
  }
  board.style.setProperty("--cols", puzzle.cols);
  board.innerHTML = model.grid
    .map(
      (row, r) =>
        `<div role="row" style="display:contents">${row
          .map((cell, c) => {
            if (cell.type === "block")
              return '<div class="cell block" role="gridcell" aria-disabled="true"></div>';
            if (cell.type === "clue")
              return `<button class="cell clue" role="gridcell" data-clue="${cell.entries[0]}" aria-label="Определение: ${esc(cell.entries.map((i) => model.entries[i].clue).join("; "))}">${cell.entries.map((i) => `<span class="clue-item" data-entry="${i}">${esc(model.entries[i].clue)}<span class="arrow">${arrow(model.entries[i])}</span></span>`).join("")}</button>`;
            return `<button class="cell letter" role="gridcell" data-cell="${r},${c}" aria-label="Строка ${r + 1}, столбец ${c + 1}" tabindex="-1"></button>`;
          })
          .join("")}</div>`,
    )
    .join("");
  const cellElements = new Map(
    [...board.querySelectorAll("[data-cell]")].map((el) => [
      el.dataset.cell,
      el,
    ]),
  );
  const clueElements = [...board.querySelectorAll("[data-clue]")];
  function render() {
    const entry = model.entries[state.active],
      activeKeys = new Set(entry.cells.map((p) => key(...p))),
      cursorKey = key(...entry.cells[state.cursor]);
    const solved = model.entries.map((_, i) => entrySolved(model, state, i));
    for (const cell of model.letterCells) {
      const el = cellElements.get(cell.key),
        selected = cell.key === cursorKey;
      el.textContent = state.answers[cell.key] || "";
      el.className = `cell letter${cell.entries.length > 1 ? " crossing" : ""}${activeKeys.has(cell.key) ? " in-word" : ""}${selected ? " cursor" : ""}${cell.entries.some((i) => solved[i]) ? " correct" : ""}${errors.has(cell.key) ? " error" : ""}`;
      el.tabIndex = selected ? 0 : -1;
      el.setAttribute("aria-selected", String(selected));
      el.setAttribute(
        "aria-label",
        `${cell.key
          .split(",")
          .map(Number)
          .map((n) => n + 1)
          .join(
            ", ",
          )}: ${state.answers[cell.key] || "пусто"}${cell.entries.length > 1 ? ", пересечение" : ""}`,
      );
    }
    clueElements.forEach((el) =>
      el.classList.toggle("in-word", Number(el.dataset.clue) === state.active),
    );
    // The full definition remains readable even while the grid is zoomed out.
    $("#current-clue").textContent = entry.clue;
    $("#clue-length").textContent = `${entry.length} букв`;
    $("#clue-direction").innerHTML = arrow(entry);
    $("#current-position").textContent =
      `${state.active + 1} / ${model.entries.length}`;
    $("#answer-slots").innerHTML = entry.cells
      .map(
        ([r, c], i) =>
          `<button class="answer-slot${state.cursor === i ? " active" : ""}" data-slot="${i}" aria-label="Буква ${i + 1}: ${state.answers[key(r, c)] || "пусто"}">${state.answers[key(r, c)] || ""}</button>`,
      )
      .join("");
    const status = progress(model, state);
    $("#word-counter").textContent =
      `${status.solved} из ${model.entries.length} слов найдено`;
    $("#game-progress").textContent = `${status.percent}%`;
    $("#game-progress-fill").style.width = `${status.percent}%`;
    $("#game-timer").textContent = timeLabel(state.seconds);
    if (state.completed && !previousCompleted) victory();
    previousCompleted = state.completed;
  }
  function victory() {
    persist();
    $("#victory-stats").innerHTML =
      `<div><strong>${model.entries.length}</strong><span>слов найдено</span></div><div><strong>${timeLabel(state.seconds)}</strong><span>времени для себя</span></div><div><strong>${state.hints}</strong><span>подсказок</span></div>`;
    $("#victory-dialog").showModal();
  }
  function ensureVisible(wholeWord = false) {
    requestAnimationFrame(() => {
      const entry = model.entries[state.active],
        [r, c] = entry.cells[state.cursor],
        stride = cellSize + 1;
      let x = c * stride + 7,
        y = r * stride + 7,
        width = cellSize,
        height = cellSize;
      if (wholeWord) {
        const minR = Math.min(entry.row, entry.clueCell[0]),
          minC = Math.min(entry.col, entry.clueCell[1]);
        const maxR = Math.max(...entry.cells.map((p) => p[0])),
          maxC = Math.max(...entry.cells.map((p) => p[1]));
        if ((maxC - minC + 1) * stride < frame.clientWidth - 16) {
          x = minC * stride + 7;
          width = (maxC - minC + 1) * stride;
        }
        if ((maxR - minR + 1) * stride < frame.clientHeight - 16) {
          y = minR * stride + 7;
          height = (maxR - minR + 1) * stride;
        }
      }
      // Include the centering margin of a grid narrower than its viewport.
      x += Math.max(0, (frame.clientWidth - 14 - board.offsetWidth) / 2);
      let left = frame.scrollLeft,
        top = frame.scrollTop;
      if (x < left + 8) left = x - 8;
      else if (x + width > left + frame.clientWidth - 8)
        left = x + width - frame.clientWidth + 8;
      if (y < top + 8) top = y - 8;
      else if (y + height > top + frame.clientHeight - 8)
        top = y + height - frame.clientHeight + 8;
      frame.scrollTo({ left, top, behavior: reduced ? "instant" : "smooth" });
    });
  }
  function changeSelection(index, cursor) {
    selectEntry(model, state, index, cursor);
    render();
    persist();
    ensureVisible(cursor === undefined);
  }
  function mutate(action) {
    action();
    errors = new Set(
      [...errors].filter(
        (k) =>
          state.answers[k] &&
          state.answers[k] !==
            model.grid[Number(k.split(",")[0])][Number(k.split(",")[1])].answer,
      ),
    );
    render();
    persist();
    ensureVisible();
  }
  function type(letter) {
    mutate(() => inputLetter(model, state, letter));
  }
  function next(direction) {
    changeSelection(state.active + direction);
  }
  let drag = null,
    suppressClickUntil = 0;
  board.addEventListener("click", (event) => {
    if (performance.now() < suppressClickUntil) return;
    const clue =
      event.target.closest("[data-entry]") ||
      event.target.closest("[data-clue]");
    if (clue) {
      changeSelection(Number(clue.dataset.entry ?? clue.dataset.clue));
      return;
    }
    const el = event.target.closest("[data-cell]");
    if (!el) return;
    const [r, c] = el.dataset.cell.split(",").map(Number),
      cell = model.grid[r][c];
    let index = cell.entries.includes(state.active)
      ? state.active
      : cell.entries[0];
    const currentlySelected =
      key(...model.entries[state.active].cells[state.cursor]) ===
      el.dataset.cell;
    if (currentlySelected && cell.entries.length > 1)
      index =
        cell.entries[
          (cell.entries.indexOf(state.active) + 1) % cell.entries.length
        ];
    const cursor = model.entries[index].cells.findIndex(
      (p) => key(...p) === el.dataset.cell,
    );
    changeSelection(index, cursor);
  });
  $("#answer-slots").addEventListener("click", (event) => {
    const slot = event.target.closest("[data-slot]");
    if (slot) changeSelection(state.active, Number(slot.dataset.slot));
  });
  $("#previous-word").addEventListener("click", () => next(-1));
  $("#next-word").addEventListener("click", () => next(1));
  $("#check-button").addEventListener("click", () => {
    errors = new Set(incorrectCells(model, state));
    render();
    toast(
      errors.size
        ? `Есть ошибки: ${errors.size}. Они отмечены коралловым — попробуй другие буквы.`
        : progress(model, state).filled
          ? "Все введённые буквы верны. Продолжай!"
          : "Впиши несколько букв — и проверим.",
    );
  });
  $("#hint-button").addEventListener("click", () => {
    if (entrySolved(model, state, state.active)) {
      toast("Это слово уже разгадано. Выбери другое.");
      return;
    }
    mutate(() => revealLetter(model, state));
    toast("Одна буква нашлась. Дальше — твой ход.");
  });
  const rows = ["ЙЦУКЕНГШЩЗХЪ", "ФЫВАПРОЛДЖЭ", "ЁЯЧСМИТЬБЮ"];
  $("#keyboard").innerHTML = rows
    .map(
      (row, i) =>
        `<div class="keyboard-row">${[...row].map((ch) => `<button class="key" data-letter="${ch}" aria-label="Буква ${ch}">${ch}</button>`).join("")}${i === 2 ? `<button class="key key-erase" data-erase aria-label="Удалить букву">${icon("erase")}</button>` : ""}</div>`,
    )
    .join("");
  $("#keyboard").addEventListener("click", (event) => {
    if (pause || document.querySelector("dialog[open]")) return;
    const letter = event.target.closest("[data-letter]");
    if (letter) type(letter.dataset.letter);
    if (event.target.closest("[data-erase]"))
      mutate(() => eraseLetter(model, state));
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      pause ||
      document.querySelector("dialog[open]") ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
    )
      return;
    if (/^[а-яё]$/i.test(event.key)) {
      event.preventDefault();
      type(event.key);
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      mutate(() => eraseLetter(model, state, event.key === "Backspace"));
    } else if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      const entry = model.entries[state.active];
      const along =
        (entry.direction === "across" &&
          ["ArrowLeft", "ArrowRight"].includes(event.key)) ||
        (entry.direction === "down" &&
          ["ArrowUp", "ArrowDown"].includes(event.key));
      if (along)
        changeSelection(
          state.active,
          state.cursor +
            (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1),
        );
      else {
        const [r, c] = entry.cells[state.cursor],
          crossing = model.grid[r][c].entries.find((i) => i !== state.active);
        if (crossing !== undefined)
          changeSelection(
            crossing,
            model.entries[crossing].cells.findIndex(
              (p) => key(...p) === key(r, c),
            ),
          );
        else next(["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1);
      }
    } else if (
      event.key === "Enter" &&
      (event.target === document.body ||
        event.target.closest("#board-viewport"))
    ) {
      event.preventDefault();
      next(1);
    }
  });
  function setScale(value, anchor) {
    const old = cellSize;
    cellSize = Math.max(12, Math.min(100, value));
    const x = anchor?.x ?? frame.clientWidth / 2,
      y = anchor?.y ?? frame.clientHeight / 2;
    const left = ((frame.scrollLeft + x) * (cellSize + 1)) / (old + 1) - x,
      top = ((frame.scrollTop + y) * (cellSize + 1)) / (old + 1) - y;
    board.style.setProperty("--cell", `${cellSize}px`);
    $("#zoom-label").textContent = `${Math.round((cellSize / 58) * 100)}%`;
    frame.scrollLeft = left;
    frame.scrollTop = top;
  }
  $("#zoom-in").addEventListener("click", () => {
    setScale(cellSize + 8);
    ensureVisible();
  });
  $("#zoom-out").addEventListener("click", () => {
    setScale(cellSize - 8);
    ensureVisible();
  });
  $("#zoom-fit").addEventListener("click", () => {
    setScale(
      Math.min(72, Math.floor((frame.clientWidth - 26) / puzzle.cols) - 1),
    );
    frame.scrollTo({ left: 0, top: 0 });
  });
  let pinch = null;
  frame.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length === 2) {
        const [a, b] = event.touches,
          rect = frame.getBoundingClientRect();
        pinch = {
          distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
          size: cellSize,
          x: (a.clientX + b.clientX) / 2 - rect.left,
          y: (a.clientY + b.clientY) / 2 - rect.top,
        };
      }
    },
    { passive: true },
  );
  frame.addEventListener(
    "touchmove",
    (event) => {
      if (pinch && event.touches.length === 2) {
        event.preventDefault();
        const [a, b] = event.touches;
        setScale(
          (pinch.size *
            Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)) /
            pinch.distance,
          pinch,
        );
      }
    },
    { passive: false },
  );
  frame.addEventListener(
    "touchend",
    () => {
      pinch = null;
    },
    { passive: true },
  );
  frame.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
        const rect = frame.getBoundingClientRect();
        setScale(cellSize - event.deltaY * 0.12, {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      }
    },
    { passive: false },
  );
  frame.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button === 0)
      drag = {
        x: event.clientX,
        y: event.clientY,
        left: frame.scrollLeft,
        top: frame.scrollTop,
        moved: false,
      };
  });
  window.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (drag.moved) {
      frame.scrollLeft = drag.left - dx;
      frame.scrollTop = drag.top - dy;
      frame.classList.add("dragging");
      event.preventDefault();
    }
  });
  window.addEventListener("pointerup", () => {
    if (drag?.moved) suppressClickUntil = performance.now() + 100;
    drag = null;
    frame.classList.remove("dragging");
  });
  $("#reset-button").addEventListener("click", () =>
    $("#reset-dialog").showModal(),
  );
  $("#reset-cancel").addEventListener("click", () =>
    $("#reset-dialog").close(),
  );
  $("#reset-confirm").addEventListener("click", () => {
    state = createState(model);
    errors.clear();
    previousCompleted = false;
    partialSecond = 0;
    lastTick = performance.now();
    persist();
    render();
    $("#reset-dialog").close();
    ensureVisible(true);
    toast("Чистый лист. Начнём с первого слова.");
  });
  $("#pause-button").addEventListener("click", () => {
    tick();
    pause = true;
    persist();
    $("#pause-dialog").showModal();
  });
  $("#resume-button").addEventListener("click", () =>
    $("#pause-dialog").close(),
  );
  $("#pause-dialog").addEventListener("close", () => {
    pause = false;
    lastTick = performance.now();
  });
  $("#victory-close").addEventListener("click", () =>
    $("#victory-dialog").close(),
  );
  function tick() {
    const now = performance.now(),
      delta = now - lastTick;
    lastTick = now;
    if (
      document.hidden ||
      pause ||
      state.completed ||
      document.querySelector("dialog[open]")
    )
      return;
    partialSecond += delta;
    if (partialSecond >= 1000) {
      state.seconds += Math.floor(partialSecond / 1000);
      partialSecond %= 1000;
      $("#game-timer").textContent = timeLabel(state.seconds);
      if (state.seconds % 5 === 0) persist();
    }
  }
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      tick();
      persist();
    }
    lastTick = performance.now();
  });
  window.addEventListener("pagehide", () => {
    tick();
    persist();
  });
  window.addEventListener("resize", () => ensureVisible());
  render();
  persist();
  requestAnimationFrame(() => {
    setScale(
      innerWidth <= 700
        ? 54
        : Math.max(
            54,
            Math.min(
              67,
              Math.floor((frame.clientWidth - 30) / puzzle.cols) - 1,
            ),
          ),
    );
    ensureVisible(true);
  });
}
