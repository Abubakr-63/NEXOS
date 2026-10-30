import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppModule } from "./app";
import { createOpenAPIDocument } from "./openapi";

export function stableJSON(value: unknown): string {
  const sort = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(sort)
      : item && typeof item === "object"
        ? Object.fromEntries(
            Object.entries(item)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([key, v]) => [key, sort(v)]),
          )
        : item;
  return JSON.stringify(sort(value), null, 2) + "\n";
}
export async function generateOpenAPI() {
  // Create controllers/metadata but never initialize services, listen or query the DB.
  const app = await NestFactory.create(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { logger: false, abortOnError: false },
  );
  try {
    app.setGlobalPrefix("api/v1");
    return createOpenAPIDocument(app);
  } finally {
    await app.close();
  }
}
if (require.main === module)
  generateOpenAPI()
    .then((document) => {
      const file = resolve(process.argv[2] ?? "docs/api/openapi.json");
      writeFileSync(file, stableJSON(document));
      console.log("OpenAPI document exported.");
    })
    .catch(() => {
      console.error(
        "OpenAPI export failed. Check build and sanitized configuration.",
      );
      process.exitCode = 1;
    });
