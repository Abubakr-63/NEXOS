import type { PrismaClient } from "@prisma/client";
import {
  catalogReviewedAt,
  curatedAndroidBases,
  curatedDevices,
  legacyDemoDeviceIds,
} from "./catalog-data";

export async function seedCatalog(db: PrismaClient) {
  return db.$transaction(
    async (tx) => {
      for (const device of curatedDevices) {
        const manufacturer = await tx.manufacturer.upsert({
          where: { name: device.manufacturer.name },
          update: {},
          create: device.manufacturer,
        });
        const previous = await tx.device.findUnique({
          where: { id: device.id },
        });
        if (
          previous &&
          (previous.codename !== device.codename ||
            previous.manufacturerId !== manufacturer.id ||
            previous.isDemo)
        )
          throw new Error(
            `Catalog identity collision for ${device.id}. No project or device was reassigned.`,
          );
        await tx.device.upsert({
          where: { id: device.id },
          update: { name: device.name },
          create: {
            id: device.id,
            slug: device.id,
            name: device.name,
            codename: device.codename,
            manufacturerId: manufacturer.id,
            isDemo: false,
          },
        });
        for (const variant of device.variants) {
          const existing = await tx.deviceVariant.findUnique({
            where: { id: variant.id },
          });
          if (
            existing &&
            (existing.deviceId !== device.id ||
              existing.modelNumber !== variant.modelNumber ||
              existing.region !== variant.region)
          )
            throw new Error(
              `Variant identity collision for ${variant.id}. No selection was reassigned.`,
            );
          const metadata = {
            ...variant,
            catalogStatus: "CATALOGED" as const,
            buildSupportStatus: "NOT_VERIFIED" as const,
            reviewedAt: catalogReviewedAt,
          };
          await tx.deviceVariant.upsert({
            where: { id: variant.id },
            update: metadata,
            create: { ...metadata, deviceId: device.id, androidVersions: [] },
          });
        }
      }
      for (const base of curatedAndroidBases) {
        const previous = await tx.androidBase.findUnique({
          where: { id: base.id },
        });
        if (
          previous &&
          (previous.name !== base.name ||
            previous.androidVersion !== base.androidVersion ||
            previous.sourceRef !== base.sourceRef)
        )
          throw new Error(
            `Android base identity collision for ${base.id}. No project was changed.`,
          );
        const values = {
          ...base,
          availability: "SOURCE_AVAILABLE" as const,
          buildSupportStatus: "NOT_VERIFIED" as const,
          reviewedAt: catalogReviewedAt,
        };
        await tx.androidBase.upsert({
          where: { id: base.id },
          create: values,
          update: values,
        });
      }
      // Retain every record and all JSON/FK references. Never create or relabel real data as demo.
      await tx.device.updateMany({
        where: {
          id: { in: legacyDemoDeviceIds },
          isDemo: true,
          deprecatedAt: null,
        },
        data: { deprecatedAt: new Date() },
      });
      return {
        devices: curatedDevices.length,
        variants: curatedDevices.reduce(
          (count, device) => count + device.variants.length,
          0,
        ),
        bases: curatedAndroidBases.length,
      };
    },
    { timeout: 30000 },
  );
}
