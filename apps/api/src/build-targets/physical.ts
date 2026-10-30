import type { PrismaClient } from "@prisma/client";
import {
  assessPhysicalDraft,
  romConfigurationSchema,
} from "@rom-hub/contracts";

/** Internal read-only assessment; deliberately leaves the existing v1 contract untouched. */
export async function assessCatalogDraft(
  db: Pick<PrismaClient, "deviceVariant">,
  configuration: unknown,
  claimedIdentity?: unknown,
) {
  const input = romConfigurationSchema.safeParse(configuration);
  if (!input.success)
    return assessPhysicalDraft(configuration, null, claimedIdentity);
  const variant = await db.deviceVariant.findUnique({
    where: { id: input.data.variantId },
    include: { device: true },
  });
  return assessPhysicalDraft(
    configuration,
    variant
      ? {
          manufacturerId: variant.device.manufacturerId,
          deviceId: variant.deviceId,
          variantId: variant.id,
          modelNumber: variant.modelNumber,
          region: variant.region,
          codename: variant.device.codename,
          hardwareVariant: variant.hardwareVariant,
          deprecated: variant.device.deprecatedAt !== null,
          isDemo: variant.device.isDemo,
        }
      : null,
    claimedIdentity,
  );
}
