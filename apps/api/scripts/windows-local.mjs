// Local development only: isolated cluster/data, no system service installation.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  openSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const local = resolve(root, ".local/windows-runtime");
const data = resolve(local, "postgres");
const redis = resolve(local, "redis/Redis-8.10.3-Windows-x64-msys2");
const configFile = resolve(local, "runtime.json");
const pgBin = process.env.NEXOS_PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
const action = process.argv[2] ?? "status";
const release = {
  url: "https://github.com/redis-windows/redis-windows/releases/download/8.10.3/Redis-8.10.3-Windows-x64-msys2.zip",
  sha256: "af16df340525b431e9ec8dabfd625d5e7a233f82805b5418819904ea909c447f",
};
function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: root,
    windowsHide: true,
    encoding: "utf8",
    timeout: 30000,
    ...options,
  });
  if (result.status !== 0)
    throw new Error(
      `${binary.split(/[\\/]/).at(-1)} failed; inspect local logs. No database was deleted.`,
    );
  return result.stdout;
}
function pg(command, args, options) {
  return run(resolve(pgBin, `${command}.exe`), args, options);
}
function pgRunning() {
  return (
    existsSync(resolve(data, "PG_VERSION")) &&
    spawnSync(resolve(pgBin, "pg_ctl.exe"), ["-D", data, "status"], {
      windowsHide: true,
      stdio: "ignore",
    }).status === 0
  );
}
function protect(path) {
  run("icacls.exe", [
    path,
    "/inheritance:r",
    "/grant:r",
    `${process.env.USERDOMAIN}\\${process.env.USERNAME}:(OI)(CI)F`,
    "SYSTEM:(OI)(CI)F",
  ]);
}
function config() {
  if (!existsSync(configFile))
    throw new Error(
      "Run setup first. Existing environment files are never overwritten.",
    );
  try {
    return JSON.parse(readFileSync(configFile, "utf8"));
  } catch {
    throw new Error(
      "Local runtime metadata is unreadable. Inspect private runtime.json; its contents are not logged.",
    );
  }
}
async function redisCommand(state, command) {
  return run(
    resolve(redis, "redis-cli.exe"),
    ["-h", "127.0.0.1", "-p", String(state.redisPort), ...command],
    {
      timeout: 2000,
      env: { ...process.env, REDISCLI_AUTH: state.redisPassword },
    },
  ).trim();
}
async function start(state) {
  if (!pgRunning())
    pg("pg_ctl", [
      "-D",
      data,
      "-l",
      resolve(local, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${state.pgPort}`,
      "-w",
      "start",
    ]);
  try {
    if ((await redisCommand(state, ["PING"])) === "PONG") return;
  } catch {}
  const out = openSync(resolve(local, "redis.log"), "a");
  const child = spawn(resolve(redis, "redis-server.exe"), ["redis.conf"], {
    cwd: local,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", out, out],
  });
  child.on("error", () => {});
  child.unref();
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((yes) => setTimeout(yes, 200));
    try {
      if ((await redisCommand(state, ["PING"])) === "PONG") return;
    } catch {}
  }
  throw new Error(
    "Redis did not start; inspect .local/windows-runtime/redis.log.",
  );
}
async function setup() {
  if (existsSync(configFile)) {
    await finishSetup(config());
    console.log("Existing isolated runtime started; configuration preserved.");
    return;
  }
  if (existsSync(resolve(root, ".env")) || existsSync(data))
    throw new Error(
      "Existing .env or partial cluster found. Inspect it before setup; nothing was overwritten.",
    );
  if (!existsSync(resolve(pgBin, "initdb.exe")))
    throw new Error(
      "Install PostgreSQL or set NEXOS_PG_BIN to its bin directory.",
    );
  mkdirSync(local, { recursive: true });
  protect(local);
  const state = {
    pgPort: 5433,
    redisPort: 6380,
    pgPassword: randomBytes(32).toString("hex"),
    redisPassword: randomBytes(32).toString("hex"),
    hmac: randomBytes(32).toString("hex"),
  };
  const archive = resolve(local, "redis.zip");
  if (!existsSync(archive)) {
    const response = await fetch(release.url, {
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error("Redis archive download failed.");
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()), {
      flag: "wx",
    });
  }
  if (
    createHash("sha256").update(readFileSync(archive)).digest("hex") !==
    release.sha256
  )
    throw new Error("Redis archive checksum mismatch. No executable was run.");
  const quote = (text) => `'${text.replaceAll("'", "''")}'`;
  run("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(dirname(redis))}`,
  ]);
  const passwordFile = resolve(local, "init-password");
  writeFileSync(passwordFile, state.pgPassword, { flag: "wx" });
  try {
    pg("initdb", [
      "-D",
      data,
      "-U",
      "nexos_local",
      "--encoding=UTF8",
      "--locale=C",
      "--auth=scram-sha-256",
      `--pwfile=${passwordFile}`,
    ]);
  } finally {
    unlinkSync(passwordFile);
  }
  const redisPath = local.replaceAll("\\", "/");
  writeFileSync(
    resolve(local, "redis.conf"),
    `bind 127.0.0.1\nprotected-mode yes\nport ${state.redisPort}\nrequirepass ${state.redisPassword}\ndir "${redisPath}"\nappendonly yes\nappendfilename "nexos.aof"\nmaxmemory 256mb\nmaxmemory-policy noeviction\n`,
    { flag: "wx" },
  );
  writeFileSync(configFile, JSON.stringify(state), { flag: "wx" });
  await finishSetup(state);
}
async function finishSetup(state) {
  await start(state);
  const pgEnv = { ...process.env, PGPASSWORD: state.pgPassword };
  for (const name of ["nexos_development", "nexos_test"]) {
    const found = pg(
      "psql",
      [
        "-h",
        "127.0.0.1",
        "-p",
        String(state.pgPort),
        "-U",
        "nexos_local",
        "-d",
        "postgres",
        "-tAc",
        `SELECT 1 FROM pg_database WHERE datname='${name}'`,
      ],
      { env: pgEnv },
    ).trim();
    if (found !== "1")
      pg(
        "createdb",
        [
          "-h",
          "127.0.0.1",
          "-p",
          String(state.pgPort),
          "-U",
          "nexos_local",
          name,
        ],
        { env: pgEnv },
      );
  }
  const environment = (database) =>
    `DATABASE_URL=postgresql://nexos_local:${state.pgPassword}@127.0.0.1:${state.pgPort}/${database}\nREDIS_URL=redis://:${state.redisPassword}@127.0.0.1:${state.redisPort}\nAUTH_ACCOUNT_HMAC_KEY=${state.hmac}\nRATE_LIMIT_NAMESPACE=nexos:windows:${database}\nWEB_ORIGIN=http://localhost:3000\nAPI_ORIGIN=http://127.0.0.1:4000\nPORT=4000\nNODE_ENV=development\nTRUSTED_PROXY_IPS=\n`;
  if (!existsSync(resolve(root, ".env")))
    writeFileSync(resolve(root, ".env"), environment("nexos_development"), {
      flag: "wx",
    });
  if (!existsSync(resolve(local, "test.env")))
    writeFileSync(resolve(local, "test.env"), environment("nexos_test"), {
      flag: "wx",
    });
  // A file ACL cannot use directory inheritance flags.
  run("icacls.exe", [
    resolve(root, ".env"),
    "/inheritance:r",
    "/grant:r",
    `${process.env.USERDOMAIN}\\${process.env.USERNAME}:F`,
    "SYSTEM:F",
  ]);
  console.log(
    "Isolated PostgreSQL 5433 and Redis 6380 ready. Missing local databases created; existing data/environment preserved. No migrations or seeds applied.",
  );
}
async function main() {
  if (process.platform !== "win32")
    throw new Error("This helper is Windows-only.");
  if (action === "setup") return setup();
  const state = config();
  if (action === "start") {
    await start(state);
    console.log("Isolated PostgreSQL and Redis started.");
  } else if (action === "stop") {
    // Authenticated shutdown targets this helper's private Redis instance only.
    await redisCommand(state, ["SHUTDOWN", "SAVE"]);
    if (pgRunning()) pg("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    console.log("Isolated services stopped; data preserved.");
  } else if (action === "status") {
    console.log(
      `PostgreSQL: ${pgRunning() ? "running" : "stopped"}; Redis: ${await redisCommand(state, ["PING"]).catch(() => "unavailable")}`,
    );
  } else throw new Error("Use setup, start, stop or status.");
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
