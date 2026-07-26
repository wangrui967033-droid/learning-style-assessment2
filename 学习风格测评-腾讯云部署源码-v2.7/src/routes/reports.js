import { Router } from "express";
import { NotFoundError, ValidationError } from "../lib/http-errors.js";
import { publicReportView } from "./report-view.js";

const MAX_TEXT_LENGTH = 1000;

function optionalText(value, name) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_TEXT_LENGTH) throw new ValidationError(`${name} is invalid`);
  return value;
}

export function createReportsRouter({ repository }) {
  const router = Router();

  router.get("/:token", (request, response) => {
    const record = repository.getPublicReportByAccessToken(request.params.token);
    if (!record) throw new NotFoundError("assessment report not found");
    response.set("Cache-Control", "no-store");
    return response.json({
      report: publicReportView(record.report, {
        studentName: record.studentName,
        phoneNumber: record.phoneNumber
      })
    });
  });

  router.post("/:token/feedback", (request, response) => {
    const feedback = repository.saveFeedbackByAccessToken(request.params.token, {
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
