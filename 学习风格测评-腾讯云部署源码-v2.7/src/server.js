import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db/database.js";

const config = loadConfig();
if (config.databasePath !== ":memory:") mkdirSync(dirname(config.databasePath), { recursive: true });
const database = openDatabase(config.databasePath);
const app = createApp({ database, config });
const server = app.listen(config.port, () => {
  console.log(`Learning Style Assessment listening on ${config.port}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
