import { Router } from "express";
import { buildContactCsv, buildCsv } from "../lib/csv.js";
import { NotFoundError } from "../lib/http-errors.js";
import { hasValidBearerToken } from "../lib/security.js";
import { publicReportView } from "./report-view.js";

export function createAdminRouter({ repository, adminExportToken, contactExportToken }) {
  const router = Router();

  router.get("/reports/:token.json", (request, response) => {
    if (!hasValidBearerToken(request.get("authorization"), adminExportToken)) {
      return response.status(401).json({ error: "未授权" });
    }
    const record = repository.getPublicReportByAccessToken(request.params.token);
    if (!record) throw new NotFoundError("assessment report not found");
    const report = publicReportView(record.report, {
      studentName: record.studentName,
      phoneNumber: record.phoneNumber
    });
    response.set({
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=learning-style-report.json",
      "Cache-Control": "no-store"
    });
    return response.json({ report });
  });

  router.get("/export.csv", (request, response) => {
    if (!hasValidBearerToken(request.get("authorization"), adminExportToken)) {
      return response.status(401).json({ error: "未授权" });
    }
    const csv = buildCsv(repository.listExportRows());
    response.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=learning-style-assessment.csv",
      "Cache-Control": "no-store"
    });
    return response.send(csv);
  });

  router.get("/contacts.csv", (request, response) => {
    if (!hasValidBearerToken(request.get("authorization"), contactExportToken)) {
      return response.status(401).json({ error: "未授权" });
    }
    const csv = buildContactCsv(repository.listContactExportRows());
    response.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=learning-style-contacts.csv",
      "Cache-Control": "no-store"
    });
    return response.send(csv);
  });

  return router;
}
