import express from "express";
import { resolve } from "node:path";
import { createRepository } from "./db/repository.js";
import { createAdminRouter } from "./routes/admin.js";
import { createHealthRouter } from "./routes/health.js";
import { createReportsRouter } from "./routes/reports.js";
import { createSessionsRouter, fixedAnswerDefinitions } from "./routes/sessions.js";

export function createApp({ database, config }) {
  if (!database) throw new TypeError("database is required");
  if (!config?.adminExportToken) throw new TypeError("adminExportToken is required");
  const repository = createRepository(database, { allowedAnswers: fixedAnswerDefinitions() });
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb", strict: true }));
  app.use(express.static(resolve("public"), { index: "index.html" }));
  app.use("/api/health", createHealthRouter());
  app.use("/api/sessions", createSessionsRouter({
    repository,
    database,
    assessmentVersion: config.assessmentVersion
  }));
  app.use("/api/reports", createReportsRouter({ repository }));
  app.use("/api/admin", createAdminRouter({ repository, adminExportToken: config.adminExportToken }));

  app.use((_request, response) => response.status(404).json({ error: "资源不存在" }));
  app.use((error, _request, response, _next) => {
    const status = error?.type === "entity.too.large" ? 413 : 400;
    if (process.env.NODE_ENV !== "test" && status >= 500) console.error(error);
    response.status(status).json({ error: "请求数据无效" });
  });

  app.locals.repository = repository;
  app.locals.database = database;
  return app;
}
