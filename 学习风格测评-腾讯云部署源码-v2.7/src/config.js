export function loadConfig(env = process.env) {
  if (!env.ADMIN_EXPORT_TOKEN) throw new Error("ADMIN_EXPORT_TOKEN is required");
  return {
    port: Number(env.PORT || 3000),
    databasePath: env.DATABASE_PATH || "./data/assessment.sqlite",
    adminExportToken: env.ADMIN_EXPORT_TOKEN,
    publicBaseUrl: env.PUBLIC_BASE_URL || "http://localhost:3000"
  };
}
