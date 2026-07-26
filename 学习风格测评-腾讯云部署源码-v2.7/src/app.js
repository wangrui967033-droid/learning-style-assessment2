import express from "express";
import { resolve } from "node:path";
import { createRepository } from "./db/repository.js";
import { ApiError } from "./lib/http-errors.js";
import { createAdminRouter } from "./routes/admin.js";
import { createHealthRouter } from "./routes/health.js";
import { createReportsRouter } from "./routes/reports.js";
import { createSessionsRouter, fixedAnswerDefinitions } from "./routes/sessions.js";

export function errorMiddleware(error, _request, response, _next) {
  let status = 500;
  let publicMessage = "服务器暂时无法处理请求";
  if (error instanceof ApiError) {
    status = error.status;
    publicMessage = error.publicMessage;
  } else if (error?.type === "entity.too.large") {
    status = 413;
    publicMessage = "请求数据无效";
  } else if (error?.type === "entity.parse.failed") {
    status = 400;
    publicMessage = "请求数据无效";
  }
  if (process.env.NODE_ENV !== "test" && status >= 500) console.error(error);
  return response.status(status).json({ error: publicMessage });
}

export function createApp({ database, config }) {
  if (!database) throw new TypeError("database is required");
  if (!config?.adminExportToken) throw new TypeError("adminExportToken is required");
  if (!config?.contactExportToken) throw new TypeError("contactExportToken is required");
  if (config.adminExportToken === config.contactExportToken) throw new TypeError("export tokens must be distinct");
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
  app.use("/api/admin", createAdminRouter({
    repository,
    adminExportToken: config.adminExportToken,
    contactExportToken: config.contactExportToken
  }));

  app.use((_request, response) => response.status(404).json({ error: "资源不存在" }));
  app.use(errorMiddleware);

  app.locals.repository = repository;
  app.locals.database = database;
  return app;
}
