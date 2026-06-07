import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const appsRoot = path.join(repoRoot, "apps");

async function readSource(relativePath) {
  return fs.readFile(path.join(appsRoot, relativePath), "utf8");
}

function extractInvokedCommands(source) {
  return Array.from(source.matchAll(/invoke(?:<[^>]+>)?\(\s*["']([^"']+)["']/g))
    .map((match) => match[1])
    .filter((command) => command.startsWith("service_account_") || command.startsWith("service_usage_"));
}

test("账号池前端使用的 Tauri account/usage commands 都已注册", async () => {
  const accountClientSource = await readSource("src/lib/api/account-client.ts");
  const registrySource = await readSource("src-tauri/src/commands/registry.rs");
  const commands = [...new Set(extractInvokedCommands(accountClientSource))].sort();

  assert.ok(commands.length > 0, "未从 account-client.ts 读取到 account/usage command");
  for (const command of commands) {
    assert.match(
      registrySource,
      new RegExp(`::${command}\\b`),
      `${command} missing from Tauri invoke registry`,
    );
  }
});
