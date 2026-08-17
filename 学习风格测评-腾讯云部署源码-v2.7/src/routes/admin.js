import { Router } from "express";
import { buildCsv } from "../lib/csv.js";
import { hasValidBearerToken } from "../lib/security.js";

export function createAdminRouter({ repository, adminExportToken }) {
  const router = Router();

  router.get("/export.csv", (request, response) => {
    if (!hasValidBearerToken(request.get("authorization"), adminExportToken)) {
      return response.status(401).json({ error: "未授权" });
    }
    const csv = buildCsv(repository.listExportRows());
    response.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=learning-mode-assessment.csv",
      "Cache-Control": "no-store"
    });
    return response.send(csv);
  });

  return router;
}
