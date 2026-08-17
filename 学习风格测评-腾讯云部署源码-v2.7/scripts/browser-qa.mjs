import { mkdir } from "node:fs/promises";
import { getCoreQuestions, getScienceQuestions } from "../src/domain/question-bank.js";

// Manual end-to-end QA: run against a locally started server when visual verification is needed.

const PLAYWRIGHT_PATH = "/Users/raywong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3100";
const OUTPUT_DIR = process.env.QA_OUTPUT_DIR ?? "/tmp/lsa-v2-browser-qa";
const FIXED_BY_PROMPT = new Map(
  [...getCoreQuestions(), ...getScienceQuestions()].map((question) => [question.prompt, question])
);

const { chromium } = await import(PLAYWRIGHT_PATH);
await mkdir(OUTPUT_DIR, { recursive: true });

function rawScaleValue(question, mode) {
  if (mode === "balanced" || question.kind !== "preference") return 4;
  const scoredValue = question.preference === "V" ? 5 : 1;
  return question.direction === "reverse" ? 6 - scoredValue : scoredValue;
}

async function fillBasicInfo(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.locator("#startButton").click();
  await page.locator('input[name="grade"][value="高三"]').check();
  await page.locator('input[name="specialtyDirection"][value="美术设计"]').check();
  await page.locator('input[name="scoreBand"][value="450至500"]').check();
  await page.locator('input[name="foreignLanguage"][value="英语"]').check();
  await page.locator("#targetSubject").selectOption("数学");
  await page.locator("#createSessionButton").click();
  await page.locator("#assessmentView:not([hidden])").waitFor();
}

async function answerVisiblePage(page, { mode, calibration }) {
  const cards = page.locator(".question-card");
  const cardCount = await cards.count();
  const expected = calibration ? 2 : 3;
  if (cardCount !== expected) throw new Error(`expected ${expected} questions, got ${cardCount}`);

  for (let index = 0; index < cardCount; index += 1) {
    const card = cards.nth(index);
    if (calibration) {
      await card.locator('input[type="radio"]').first().check();
      continue;
    }
    const prompt = (await card.locator(".question-prompt").textContent())?.trim();
    const question = FIXED_BY_PROMPT.get(prompt);
    if (!question) throw new Error(`unknown public question prompt: ${prompt}`);
    await card.locator(`input[type="radio"][value="${rawScaleValue(question, mode)}"]`).check();
  }
}

async function reportMetrics(page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    sectionCount: document.querySelectorAll("[data-report-section]").length,
    sevenDayCount: document.querySelectorAll("#sevenDayPlan > li").length,
    radarAxes: document.querySelector("#preferenceRadar")?.getAttribute("aria-label") ?? "",
    canvasInk: (() => {
      const canvas = document.querySelector("#preferenceRadar");
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let colored = 0;
      for (let index = 0; index < data.length; index += 16) {
        if (data[index + 3] > 0 && (data[index] < 245 || data[index + 1] < 245 || data[index + 2] < 245)) colored += 1;
      }
      return colored;
    })(),
    subjectContext: document.querySelector("#subjectContext")?.textContent.trim() ?? "",
    recommendationLogic: document.querySelector("#recommendationLogic")?.textContent.trim() ?? "",
    priorityAction: document.querySelector("#priorityAction")?.textContent.trim() ?? ""
  }));
}

function assertReport(metrics) {
  if (metrics.scrollWidth > metrics.innerWidth) throw new Error("horizontal overflow detected");
  if (metrics.sectionCount !== 11 || metrics.sevenDayCount !== 7 || metrics.canvasInk < 100) {
    throw new Error("report content or radar did not render completely");
  }
  if ([metrics.subjectContext, metrics.recommendationLogic].includes(metrics.priorityAction)) {
    throw new Error("priority action duplicates the subject explanation");
  }
}

async function runPath(browser, { mode, expectCalibration, captureReport }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await fillBasicInfo(page);

  let fixedPages = 0;
  let calibrationPages = 0;
  let usedCalibration = false;

  for (let step = 0; step < 24 && !page.url().includes("report.html"); step += 1) {
    if (await page.locator("#confirmView:not([hidden])").count()) {
      usedCalibration = true;
      await page.locator("#confirmButton").click();
      await page.locator("#assessmentView:not([hidden])").waitFor();
    }

    if (await page.locator("#assessmentView:not([hidden])").count()) {
      await answerVisiblePage(page, { mode, calibration: usedCalibration });
      if (usedCalibration) calibrationPages += 1;
      else fixedPages += 1;
      await page.locator("#nextButton").click();
      await page.waitForTimeout(80);
    }
  }

  await page.waitForURL(/\/report\.html\?id=/, { timeout: 15_000 });
  await page.locator("#reportDocument:not([hidden])").waitFor({ timeout: 15_000 });
  const reportUrl = page.url();
  const sessionId = new URL(reportUrl).searchParams.get("id");
  const mobileMetrics = await reportMetrics(page);

  if (fixedPages !== 14) throw new Error(`expected 14 fixed pages, got ${fixedPages}`);
  if (usedCalibration !== expectCalibration) throw new Error(`expected calibration=${expectCalibration}, got ${usedCalibration}`);
  if (calibrationPages !== (expectCalibration ? 2 : 0)) {
    throw new Error(`expected ${expectCalibration ? 2 : 0} calibration pages, got ${calibrationPages}`);
  }
  assertReport(mobileMetrics);

  if (captureReport) {
    await page.screenshot({ path: `${OUTPUT_DIR}/report-mobile.png`, fullPage: true });
    await page.locator('input[name="fitRating"][value="4"]').check();
    await page.locator('textarea[name="comment"]').fill("浏览器端到端验收");
    await page.locator("#submitFeedback").click();
    await page.locator("#feedbackSuccess:not([hidden])").waitFor();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#reportDocument:not([hidden])").waitFor();
    const desktopMetrics = await reportMetrics(page);
    assertReport(desktopMetrics);
    await page.screenshot({ path: `${OUTPUT_DIR}/report-desktop.png`, fullPage: true });
    await page.pdf({ path: `${OUTPUT_DIR}/report-a4.pdf`, format: "A4", printBackground: true });
    await context.close();
    return { sessionId, reportUrl, fixedPages, calibrationPages, usedCalibration, mobileMetrics, desktopMetrics, feedbackSubmitted: true };
  }

  await context.close();
  return { sessionId, reportUrl, fixedPages, calibrationPages, usedCalibration, mobileMetrics, feedbackSubmitted: false };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME_PATH,
  args: ["--no-sandbox"]
});

try {
  const calibrated = await runPath(browser, { mode: "balanced", expectCalibration: true, captureReport: true });
  const direct = await runPath(browser, { mode: "clear-visual", expectCalibration: false, captureReport: false });
  console.log(JSON.stringify({
    calibrated,
    direct,
    outputs: {
      mobile: `${OUTPUT_DIR}/report-mobile.png`,
      desktop: `${OUTPUT_DIR}/report-desktop.png`,
      pdf: `${OUTPUT_DIR}/report-a4.pdf`
    }
  }, null, 2));
} finally {
  await browser.close();
}
