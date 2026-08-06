#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(repoRoot, "netlify-functions", "build-info.json");

const buildInfo = {
  commit: process.env.COMMIT_REF || "unknown",
  context: process.env.CONTEXT || "unknown",
  branch: process.env.BRANCH || "unknown",
};

fs.writeFileSync(outputPath, `${JSON.stringify(buildInfo)}\n`, "utf8");
console.log(`Wrote build metadata for ${buildInfo.commit}`);
