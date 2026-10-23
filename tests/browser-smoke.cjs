// Optional browser QA. Install Playwright separately, then run this file.
// BASE_URL defaults to the static server started with `npm run dev`.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium, devices, webkit } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const base = (process.env.BASE_URL || "http://127.0.0.1:4173/").replace(
  /\/?$/,
  "/",
);
let checks = 0;
const ok = (message) => {
  checks++;
  console.log(`✓ ${message}`);
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage(),
    errors = [];
  const cdp = await context.newCDPSession(page);
  const russianKey = async (letter) => {
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: letter,
      text: letter,
      unmodifiedText: letter,
    });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: letter });
  };
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(base);
  await page.waitForSelector(".puzzle-card");
  assert.equal(await page.locator(".puzzle-card").count(), 9);
  for (const level of [1, 2, 3]) {
    await page.locator(`[data-level="${level}"]`).click();
    assert.equal(await page.locator(".puzzle-card").count(), 3);
    assert.ok(
      (await page.locator(".level-badge").allTextContents()).every((s) =>
        s.includes(["", "Лёгкий", "Средний", "Сложный"][level]),
      ),
    );
  }
  ok("catalog and all three difficulty filters");
  await page.locator('[data-level="all"]').click();
  for (const number of [1, 4, 7]) {
    await page.goto(`${base}game.html?id=collection-${number}`);
    await page.waitForSelector(".cell.letter");
    assert.equal(await page.locator("#game-progress").textContent(), "0%");
    assert.ok(
      (await page.locator(".cell.letter").allTextContents()).every(
        (s) => s === "",
      ),
    );
    assert.equal(
      await page.locator(".arrow svg").count(),
      await page.locator(".cell.clue").count(),
    );
  }
  ok(
    "all levels start empty, with in-cell definitions and SVG direction arrows",
  );
  await page.goto(`${base}game.html?id=collection-1`);
  await page.waitForSelector(".cell.cursor");
  const data = await page.evaluate(async () => {
    const { puzzles } = await import("./data/puzzles.js"),
      { wordById } = await import("./data/words.js");
    return puzzles[0].entries.map((e) => ({
      ...e,
      answer: wordById.get(e.wordId).answer,
    }));
  });
  const first = data[0],
    firstKey = `${first.row},${first.col}`;
  await page.locator('[data-letter="Я"]').click();
  assert.equal(
    await page.locator(`[data-cell="${firstKey}"]`).textContent(),
    "Я",
  );
  await page.locator("[data-erase]").click();
  assert.equal(
    await page.locator(`[data-cell="${firstKey}"]`).textContent(),
    "",
  );
  await russianKey(first.answer[0]);
  assert.equal(
    await page.locator(`[data-cell="${firstKey}"]`).textContent(),
    first.answer[0],
  );
  await page.reload();
  await page.waitForSelector(".cell.cursor");
  assert.equal(
    await page.locator(`[data-cell="${firstKey}"]`).textContent(),
    first.answer[0],
  );
  await page.locator(`[data-cell="${firstKey}"]`).evaluate((el) => el.click());
  await russianKey("Я");
  await page.locator("#check-button").click();
  assert.ok((await page.locator(".cell.error").count()) > 0);
  await page.locator("#hint-button").click();
  assert.ok(
    (await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("xiaoscanwordmi:v1")).games[
          "collection-1"
        ].hints,
    )) > 0,
  );
  ok(
    "virtual/physical Russian input, erase, correction, checking, hint and reload",
  );
  const crossing = await page
    .locator(".cell.crossing")
    .first()
    .getAttribute("data-cell");
  await page.locator(`[data-cell="${crossing}"]`).evaluate((el) => el.click());
  const clueBefore = await page.locator("#current-clue").textContent();
  await page.locator(`[data-cell="${crossing}"]`).evaluate((el) => el.click());
  assert.notEqual(
    await page.locator("#current-clue").textContent(),
    clueBefore,
  );
  ok("repeated click on crossing switches selected answer");
  await page.locator("[data-help]").click();
  assert.ok(await page.locator("#help-dialog").evaluate((el) => el.open));
  await page.locator("#help-dialog [data-close]").click();
  await page.locator("#pause-button").click();
  const time = await page.locator("#game-timer").textContent();
  await page.waitForTimeout(1300);
  assert.equal(await page.locator("#game-timer").textContent(), time);
  await page.locator("#resume-button").click();
  ok("help and pause dialog");
  await page.locator("#reset-button").click();
  await page.locator("#reset-cancel").click();
  assert.ok(
    await page
      .locator(".cell.letter")
      .evaluateAll((els) => els.some((el) => el.textContent)),
  );
  await page.locator("#reset-button").click();
  await page.locator("#reset-confirm").click();
  assert.equal(await page.locator("#game-progress").textContent(), "0%");
  for (let index = 0; index < data.length; index++) {
    await page.locator(`[data-clue="${index}"]`).evaluate((el) => el.click());
    await page.locator('[data-slot="0"]').evaluate((el) => el.click());
    for (const letter of data[index].answer) await russianKey(letter);
  }
  assert.ok(await page.locator("#victory-dialog").evaluate((el) => el.open));
  assert.equal(await page.locator("#game-progress").textContent(), "100%");
  await page.locator("#victory-close").click();
  await page.reload();
  await page.waitForSelector(".cell.letter");
  assert.equal(
    await page.locator("#victory-dialog").evaluate((el) => el.open),
    false,
  );
  await page.goto(base);
  await page.waitForSelector(".puzzle-card");
  assert.equal(await page.locator("#stat-completed").textContent(), "1");
  await page.locator("#status-filter").selectOption("completed");
  assert.equal(await page.locator(".puzzle-card").count(), 1);
  ok(
    "reset/cancel, full solution via keyboard, victory, reload and completed catalog",
  );
  await page.locator("#status-filter").selectOption("all");
  await page.locator("#generate-level").selectOption("3");
  await page.locator("#generate-button").click();
  await page.waitForURL(/game.html\?id=generated-3-/, { timeout: 35000 });
  await page.waitForSelector(".cell.letter");
  assert.equal(await page.locator("#game-progress").textContent(), "0%");
  await page.goto(base);
  await page.waitForSelector(".puzzle-card");
  assert.equal(await page.locator(".puzzle-card").count(), 10);
  assert.equal(await page.locator("#continue-section").isVisible(), true);
  ok("worker generation, generated-puzzle persistence and continue link");
  await page.goto(`${base}game.html?id=missing`);
  assert.equal(await page.locator("#game-error").isVisible(), true);
  ok("unknown puzzle fails gracefully");
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
  ]) {
    const mobile = await browser.newContext({
        viewport,
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
      }),
      p = await mobile.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base);
    await p.waitForSelector(".puzzle-card");
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p.goto(`${base}game.html?id=collection-7`);
    await p.waitForSelector(".cell.letter");
    const layout = await p.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      screen: innerWidth,
      height: innerHeight,
      keys: document.querySelector("#keyboard").getBoundingClientRect().bottom,
      board: document.querySelector("#board-viewport").clientHeight,
    }));
    assert.ok(layout.width <= layout.screen, JSON.stringify(layout));
    assert.ok(layout.keys <= layout.height + 1, JSON.stringify(layout));
    assert.ok(layout.board >= 65, JSON.stringify(layout));
    await p.locator('[data-letter="А"]').tap();
    assert.ok(
      (await p.locator(".cell.letter").allTextContents()).includes("А"),
    );
    const before = await p
      .locator(".cell.letter")
      .first()
      .evaluate((el) => el.clientWidth);
    await p.locator("#zoom-in").tap();
    assert.ok(
      (await p
        .locator(".cell.letter")
        .first()
        .evaluate((el) => el.clientWidth)) > before,
    );
    await p.locator("#zoom-fit").tap();
    assert.ok(
      await p
        .locator("#board-viewport")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
    );
    await mobile.close();
    ok(
      `mobile layout, tap input and zoom at ${viewport.width}×${viewport.height}`,
    );
  }
  // All relative resources must also load with a repository prefix, as on Pages.
  const nested = await browser.newContext({ reducedMotion: "reduce" });
  await nested.route("**/repository-prefix/**", async (route) => {
    const response = await route.fetch({
      url: route.request().url().replace("/repository-prefix/", "/"),
    });
    await route.fulfill({ response });
  });
  const nestedPage = await nested.newPage();
  nestedPage.on("pageerror", (e) => errors.push(e.message));
  await nestedPage.goto(`${base}repository-prefix/`);
  await nestedPage.waitForSelector(".puzzle-card");
  await nestedPage.locator(".card-link").first().click();
  await nestedPage.waitForSelector(".cell.letter");
  assert.ok(nestedPage.url().includes("/repository-prefix/game.html"));
  ok("GitHub Pages repository-prefix URLs");
  await nested.close();
  assert.deepEqual(errors, []);
  ok("no JavaScript or console errors");
  console.log(`Browser checks passed: ${checks}`);
  console.log(
    `WebKit binary available: ${fs.existsSync(webkit.executablePath())}`,
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
