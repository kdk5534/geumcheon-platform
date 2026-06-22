import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["js", "tests", "."];
const files = new Set();

async function collect(path, recursive = true) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) {
      if (recursive && entry.name !== "node_modules") await collect(fullPath);
      continue;
    }
    if ([".js", ".mjs"].includes(extname(entry.name))) files.add(fullPath);
  }
}

await collect("js");
await collect("tests");
await collect(".", false);

const failures = [];
for (const file of [...files].sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push(`${file}\n${result.stderr}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Syntax OK: ${files.size} files`);
