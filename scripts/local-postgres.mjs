import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  chmodSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const local = resolve(root, ".local/postgres");
const data = resolve(local, "data");
const envFile = resolve(root, ".env");
const action = process.argv[2] ?? "start";
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed. Check installed PostgreSQL tools, port availability and .local/postgres/server.log. No database was deleted.`,
    );
  return result.stdout;
}
function running() {
  return (
    spawnSync("pg_ctl", ["-D", data, "status"], { stdio: "ignore" }).status ===
    0
  );
}
try {
  if (!["start", "stop", "status"].includes(action))
    throw new Error("Use start, stop or status.");
  if (action === "status") {
    console.log(
      running()
        ? "Repository PostgreSQL is running."
        : "Repository PostgreSQL is stopped.",
    );
    process.exitCode = running() ? 0 : 1;
  } else if (action === "stop") {
    if (running()) run("pg_ctl", ["-D", data, "stop", "-m", "fast"]);
    console.log(
      "Repository PostgreSQL stopped. Data and configuration are preserved.",
    );
  } else {
    if (process.platform === "win32")
      throw new Error(
        "Use WSL2, Docker Compose or an existing PostgreSQL server. This helper uses native Linux PostgreSQL tools.",
      );
    for (const binary of ["initdb", "pg_ctl", "psql"])
      run(binary, ["--version"]);
    mkdirSync(local, { recursive: true, mode: 0o700 });
    chmodSync(local, 0o700);
    if (!existsSync(resolve(data, "PG_VERSION"))) {
      if (existsSync(envFile) || process.env.DATABASE_URL)
        throw new Error(
          "DATABASE_URL or .env already exists. Configure that database or move your configuration yourself before initializing a repository database. Existing settings were not overwritten.",
        );
      if (existsSync(data))
        throw new Error(
          "An incomplete data directory exists. Inspect .local/postgres/data before retrying; it was not deleted.",
        );
      const appPassword = randomBytes(32).toString("hex");
      const adminPassword = randomBytes(32).toString("hex");
      const pwfile = resolve(local, "init-password");
      try {
        writeFileSync(pwfile, adminPassword, { mode: 0o600, flag: "wx" });
        run("initdb", [
          "-D",
          data,
          "--username=romcraft_admin",
          "--auth=scram-sha-256",
          "--pwfile",
          pwfile,
          "--encoding=UTF8",
          "--no-locale",
        ]);
        // Persist loopback-only settings so later starts use the same port.
        writeFileSync(
          resolve(data, "postgresql.auto.conf"),
          "listen_addresses = '127.0.0.1'\nport = 5433\nunix_socket_directories = ''\n",
          { mode: 0o600 },
        );
        run("pg_ctl", [
          "-D",
          data,
          "-l",
          resolve(local, "server.log"),
          "-w",
          "start",
        ]);
        run(
          "psql",
          [
            "-X",
            "-w",
            "-h",
            "127.0.0.1",
            "-p",
            "5433",
            "-U",
            "romcraft_admin",
            "-d",
            "postgres",
            "-v",
            "ON_ERROR_STOP=1",
          ],
          {
            env: { ...process.env, PGPASSWORD: adminPassword },
            input: `CREATE ROLE romcraft LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE;\nCREATE DATABASE romcraft OWNER romcraft;\n`,
          },
        );
        writeFileSync(
          envFile,
          `DATABASE_URL=postgresql://romcraft:${appPassword}@127.0.0.1:5433/romcraft?schema=public\nAPI_ORIGIN=http://127.0.0.1:4000\nWEB_ORIGIN=http://localhost:3000\nPORT=4000\n`,
          { mode: 0o600, flag: "wx" },
        );
        writeFileSync(
          resolve(local, "managed"),
          "romcraft repository PostgreSQL\n",
          { mode: 0o600 },
        );
      } finally {
        if (existsSync(pwfile)) unlinkSync(pwfile);
      }
    } else {
      if (!existsSync(resolve(local, "managed")) || !existsSync(envFile))
        throw new Error(
          "Repository database/configuration is incomplete. Inspect .local/postgres and .env; no existing data was changed.",
        );
      if (!running())
        run("pg_ctl", [
          "-D",
          data,
          "-l",
          resolve(local, "server.log"),
          "-w",
          "start",
        ]);
    }
    const configured = parseEnv(readFileSync(envFile, "utf8"));
    const url = new URL(configured.DATABASE_URL);
    if (
      url.hostname !== "127.0.0.1" ||
      url.port !== "5433" ||
      url.pathname !== "/romcraft"
    )
      throw new Error(
        ".env points to another database. Use that server's startup procedure.",
      );
    const result = run(
      "psql",
      [
        "-X",
        "-w",
        "-h",
        url.hostname,
        "-p",
        url.port,
        "-U",
        decodeURIComponent(url.username),
        "-d",
        "romcraft",
        "-Atc",
        "SELECT current_database()",
      ],
      { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) } },
    );
    if (result.trim() !== "romcraft")
      throw new Error("Unexpected database connection result.");
    console.log(
      "Verified real PostgreSQL connection on 127.0.0.1:5433. Credentials are stored only in ignored .env (mode 0600). Next run pnpm db:migrate.",
    );
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "PostgreSQL setup failed.",
  );
  console.error(
    "On Fedora, install the tools with sudo dnf install postgresql-server postgresql. This helper does not run sudo, change system services or delete databases.",
  );
  process.exitCode = 1;
}
