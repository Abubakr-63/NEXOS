import { createRequire } from "node:module";
import { seedCatalog } from "../../../packages/database/prisma/catalog-seed.ts";

const requireApi = createRequire(new URL("../package.json", import.meta.url));
const { PrismaClient, Prisma } = requireApi("@prisma/client");
let url;
try {
  url = new URL(process.env.DATABASE_URL ?? "invalid:");
} catch {
  throw new Error(
    "A valid isolated DATABASE_URL is required; its value is not logged.",
  );
}
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "5433" ||
  !["/nexos_development", "/nexos_test"].includes(url.pathname)
)
  throw new Error(
    "Only the isolated Windows local databases may be initialized.",
  );
const db = new PrismaClient();
try {
  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate = model.name[0].toLowerCase() + model.name.slice(1);
    if (await db[delegate].count())
      throw new Error(
        "Refusing to seed a populated database. Existing records are preserved.",
      );
  }
  const result = await seedCatalog(db);
  console.log(
    `Initialized empty local catalog: ${result.devices} devices, ${result.variants} variants, ${result.bases} bases. Build support remains unverified.`,
  );
} finally {
  await db.$disconnect();
}
