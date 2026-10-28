import { PrismaClient } from "@prisma/client";
import { seedCatalog } from "./catalog-seed";
const db = new PrismaClient();
seedCatalog(db)
  .then((result) =>
    console.log(
      `Seeded ${result.devices} real devices, ${result.variants} identified variants and ${result.bases} source-only Android bases. All ROMCRAFT builds remain NOT_VERIFIED. Legacy demo records were retained and deprecated; user projects were not changed.`,
    ),
  )
  .catch(() => {
    console.error(
      "Catalog seed failed. Check database access and identity collisions. No destructive reset was performed.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
