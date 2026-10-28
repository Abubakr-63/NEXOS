import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // All seed records are fictional, flagged isDemo, and use stable IDs.
  const rows = [
    {
      id: "demo-atlas",
      maker: "Atlas Mobile",
      slug: "atlas-one",
      name: "Atlas One",
      codename: "atlas",
      model: "AT-100",
      region: "Global",
    },
    {
      id: "demo-nova",
      maker: "Nova Devices",
      slug: "nova-7",
      name: "Nova 7",
      codename: "nova7",
      model: "NV-700",
      region: "Europe",
    },
    {
      id: "demo-orion",
      maker: "Orion Mobile",
      slug: "orion-pro",
      name: "Orion Pro",
      codename: "orion",
      model: "OR-200",
      region: "Global",
    },
  ];
  for (const row of rows) {
    const manufacturer = await db.manufacturer.upsert({
      where: { slug: row.id },
      update: {},
      create: { id: `${row.id}-maker`, slug: row.id, name: row.maker },
    });
    await db.device.upsert({
      where: { id: row.id },
      update: {},
      create: {
        id: row.id,
        manufacturerId: manufacturer.id,
        slug: row.slug,
        name: row.name,
        codename: row.codename,
        isDemo: true,
        variants: {
          create: {
            id: `${row.id}-variant`,
            modelNumber: row.model,
            region: row.region,
            androidVersions: [],
          },
        },
      },
    });
  }
  for (const [slug, name, kind] of [
    ["aurora-os", "Aurora OS", "ROM"],
    ["nebula", "Nebula", "ROM"],
    ["ember-recovery", "Ember Recovery", "RECOVERY"],
    ["flux-kernel", "Flux Kernel", "KERNEL"],
    ["zenith", "Zenith OS", "ROM"],
    ["lumen", "Lumen OS", "ROM"],
  ] as const) {
    await db.project.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name,
        kind,
        description:
          "Fictional demonstration project. Not available for installation.",
        isDemo: true,
      },
    });
  }
  console.log(
    "Seeded fictional demonstration catalog. No accounts, releases, or compatibility claims were created.",
  );
}
main().finally(() => db.$disconnect());
