import {
  assessVirtualTarget,
  virtualTargetEvidenceSchema,
} from "@rom-hub/contracts";

// Reviewed source declarations, not a complete source lock or a build attestation.
const candidate = virtualTargetEvidenceSchema.parse({
  version: 1,
  selection: {
    candidateId: "aosp16-r4-cuttlefish-x86_64-userdebug-v1",
    kind: "VIRTUAL",
    androidVersion: "16",
    sourceRef: "refs/tags/android-16.0.0_r4",
    product: "aosp_cf_x86_64_only_phone",
    releaseConfig: "aosp_current",
    buildVariant: "userdebug",
    architecture: "x86_64",
    customization: "UPSTREAM_BASELINE",
  },
  manifestRepository: "https://android.googlesource.com/platform/manifest",
  manifestCommit: "15128c9e27cfa599c48d294babd39286ee8f1426",
  resolvedRelease: "bp4a",
  checkedAt: "2026-10-29T00:00:00.000Z",
  state: "DECLARATIONS_VERIFIED",
  observations: [
    {
      file: "manifest.xml",
      sha256:
        "19db4af44aa74ea4ed07bf602f5805476bab1c821d59ba818031022280ae055f",
      gitBlob: "c762144b403e50fd20bdcf9ca7fdb7d7663f6c06",
      repository: "https://android.googlesource.com/platform/manifest",
      commit: "15128c9e27cfa599c48d294babd39286ee8f1426",
      path: "default.xml",
    },
    {
      file: "AndroidProducts.mk",
      sha256:
        "20fd7172104365e9bc7522d2252820e05b49e87ce80933943cc4c8b380057e5c",
      gitBlob: "ff5f2cc4605cd84ed1def1983592e27bcdea9bb4",
      repository: "https://android.googlesource.com/device/google/cuttlefish",
      commit: "4d368849922b04124e66b1aad48f93b3209f3c8d",
      path: "AndroidProducts.mk",
    },
    {
      file: "aosp_cf.mk",
      sha256:
        "d3cb6e7285bebc1048b94d717769efabe4d6dd9117b5eb810eed7f68c96ba2cd",
      gitBlob: "ab01b8a544ae23e281e39f5856a1ca0173167170",
      repository: "https://android.googlesource.com/device/google/cuttlefish",
      commit: "4d368849922b04124e66b1aad48f93b3209f3c8d",
      path: "vsoc_x86_64_only/phone/aosp_cf.mk",
    },
    {
      file: "BoardConfig.mk",
      sha256:
        "2184f51c63ac1338a8496ec78ffddc21eaa54f0b482999e8a15585a995a6f909",
      gitBlob: "7b2de1e82f788b88c89c1cc7d557fc679b1df993",
      repository: "https://android.googlesource.com/device/google/cuttlefish",
      commit: "4d368849922b04124e66b1aad48f93b3209f3c8d",
      path: "vsoc_x86_64_only/BoardConfig.mk",
    },
    {
      file: "release_config_map.textproto",
      sha256:
        "9698b58890e07de5dcd13b2f881b2b569d13b2ccbc62552d3553ef4105438773",
      gitBlob: "c521ec77d9e9d617c5369a12208896f9acca81c0",
      repository: "https://android.googlesource.com/platform/build/release",
      commit: "0998133091794b56253fd6bd5c33ed0e0e5bd9de",
      path: "release_config_map.textproto",
    },
    {
      file: "bp4a.textproto",
      sha256:
        "3f0a1de927826a70b2165ea6b2b378b87a78995d30645b44e741d82b5792871a",
      gitBlob: "c6325d779825283742de2d4aff40e910abd37ff0",
      repository: "https://android.googlesource.com/platform/build/release",
      commit: "0998133091794b56253fd6bd5c33ed0e0e5bd9de",
      path: "release_configs/bp4a.textproto",
    },
    {
      file: "envsetup.sh",
      sha256:
        "a0634c0972cd9ca00195ed134844b9eea1d00313642c4169594433c736604ab6",
      gitBlob: "e34a365f6a0522827c4e90b6c50a0e06d0173d75",
      repository: "https://android.googlesource.com/platform/build",
      commit: "b815dded1eafbf06191a6ae306956bb6ed6fb415",
      path: "envsetup.sh",
    },
  ],
});

export function assessCuttlefishCandidate(
  selection: unknown,
  asOf = new Date(),
) {
  return assessVirtualTarget(selection, candidate, asOf);
}

/** Return a copy so callers cannot mutate the process-wide reviewed registry. */
export function getCuttlefishCandidate() {
  return structuredClone(candidate);
}
