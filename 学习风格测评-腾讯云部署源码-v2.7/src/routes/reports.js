import { Router } from "express";
import { buildReport, REPORT_FORMAT_VERSION } from "../domain/report-builder.js";

const MAX_TEXT_LENGTH = 1000;

function optionalText(value, name) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_TEXT_LENGTH) throw new TypeError(`${name} is invalid`);
  return value;
}

function currentScenarioPresentation(report) {
  if (report?.formatVersion !== REPORT_FORMAT_VERSION) return report;
  try {
    const counts = report.conclusion?.counts;
    const mechanisms = report.modeCards?.flatMap((card) => card.mechanisms ?? []);
    if (!Array.isArray(counts) || counts.length !== 4 || !Array.isArray(mechanisms) || mechanisms.length !== 12) return report;
    const classification = report.conclusion;
    const modeResult = {
      answeredCount: counts[0].answeredCount,
      scores: Object.fromEntries(counts.map(({ code, count }) => [code, count])),
      rates: Object.fromEntries(counts.map(({ code, rate }) => [code, rate])),
      specificScores: Object.fromEntries(mechanisms.map(({ id, selected }) => [id, selected])),
      specificOpportunities: Object.fromEntries(mechanisms.map(({ id, opportunities }) => [id, opportunities])),
      specificRates: Object.fromEntries(mechanisms.map(({ id, rate }) => [id, rate])),
      classification: {
        kind: classification.kind,
        primary: classification.primaryMode?.code ?? null,
        supporting: classification.supportingMode?.code ?? null,
        candidates: classification.candidates
      }
    };
    return buildReport({ ...report.overview, modeResult });
  } catch {
    return report;
  }
}

export function createReportsRouter({ repository }) {
  const router = Router();

  router.get("/:id", (request, response) => {
    const storedReport = repository.getReport(request.params.id);
    const report = currentScenarioPresentation(storedReport);
    if (!report) return response.status(404).json({ error: "报告不存在" });
    response.set("Cache-Control", "no-store");
    return response.json({ sessionId: request.params.id, report });
  });

  router.post("/:id/feedback", (request, response) => {
    const feedback = repository.saveFeedback(request.params.id, {
      fitRating: request.body?.fitRating,
      selfIdentifiedPreference: optionalText(request.body?.selfIdentifiedPreference, "selfIdentifiedPreference"),
      helpfulSection: optionalText(request.body?.helpfulSection, "helpfulSection"),
      confusingText: optionalText(request.body?.confusingText, "confusingText"),
      comment: optionalText(request.body?.comment, "comment")
    });
    return response.json({ feedback });
  });

  return router;
}
