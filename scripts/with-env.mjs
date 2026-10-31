import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Shell/CI values win; app-local settings override the workspace file.
const values = {};
for (const file of new Set([
  resolve(root, ".env"),
  resolve(process.cwd(), ".env"),
])) {
  if (existsSync(file))
    Object.assign(values, parseEnv(readFileSync(file, "utf8")));
}
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("Usage: with-env.mjs <command> [arguments]");
const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...values, ...process.env },
  // Native executables (especially node.exe under Program Files) must keep
  // their argument boundaries. Only Windows command shims need cmd.exe.
  shell:
    process.platform === "win32" &&
    !/\.(?:exe|com)$/i.test(command) &&
    !["node", "nodejs"].includes(command),
});
child.on("error", () => {
  console.error(
    `Unable to start ${command}. Check installed dependencies and PATH.`,
  );
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
