# November 2, 2026 — existing ROM local download demo

Implemented in NEXOS-codex on ai/codex-backend. D6/compilation and unrelated D5.1 work are paused. Existing uncommitted D5.1 package/lockfile/test/handoff edits are preserved and excluded from this demo commit. No migration, seed, PostgreSQL record mutation, frontend implementation, shared contract, external ROM download or archive upload occurred.

## Source inspection

The existing file is read directly, never modified/regenerated:

`C:\Users\admin\Downloads\PixelExperience_Plus_mojito-11.0-20211009-1327-OFFICIAL.zip`

- Size: **1,375,104,164 bytes**.
- SHA-256: **39807bfa2b0a0c8569b37f745bcdeb14c0a1c8530f7e5f997a93b058c044f215**.
- ZIP opened read-only with .NET ZipArchive; five unique entries: Android OTA metadata, care_map.pb, payload.bin, payload_properties.txt, embedded otacert. No executable/archive content was extracted or run.
- Metadata: `pre-device=mojito,sunny`; `post-build=Redmi/mojito/mojito:11/RQ3A.211001.001/1327:userdebug/release-keys`; SDK30; security patch2021-10-01; timestamp1633786003 = **2021-10-09T13:26:43Z**. This supports the date and Android/device family independently of the filename.
- Read-only payload streaming SHA-256 equals the payload-properties FILE_HASH `OK0BySb99oilcFsB2ZqCiqAWZ2BRu/YXpg8fow2iwmg=`; payload length1375099403 matches FILE_SIZE. These are self-consistency checks, not publisher authentication.

The [PixelExperience device wiki](https://wiki.pixelexperience.org/devices/mojito/) identifies mojito as Redmi Note10, and the [historical project file listing](https://sourceforge.net/projects/pixelexperiencerom/files/mojito/) lists the exact Plus Android11 filename/date. No external ZIP was downloaded and no trusted upstream SHA-256/signature chain was established. The embedded certificate and OFFICIAL filename do not establish authenticity. Whole-archive fingerprint and payload consistency are verified; a full independent publisher-signature/CRC/security audit is not claimed.

The archive itself explicitly targets sunny, supporting this **metadata-targeted** local demo for Xiaomi Redmi Note10 **4G**, sunny. It does not establish installation safety, exact regional firmware compatibility or suitability for the user's individual hardware. Note10 5G/Pro are different devices; RAM4GB/storage128GB do not prove compatibility. Only the one dedicated sunny/PixelExperience Plus/Android11 tuple is allowed. All build/flash eligibility remains conservative; no flashing automation exists.

Redistribution rights, bundled component licenses and original publisher authenticity were **not verified**. Local demonstration of the user's existing archive is the entire scope. Public deployment needs a separate provenance/security/redistribution review. The old 2021 patch level must not be advertised as current or secure for daily use.

## Implementation and startup

`prebuilt-rom.ts` defines a single fixed source/filename/size/hash/selection allowlist. No URL, database value, environment file path or HTTP input can select an arbitrary file. Every metadata/download request reopens a regular non-symlink file and hashes its contents; downloads stream from that verified open descriptor from offset zero with backpressure and automatic close. Size/stat changes during verification fail closed. A concurrent hostile local writer is outside this trusted-local-file demo boundary; the archive must not be edited while serving it.

`PrebuiltRomController` reuses **Accounts.user**, authenticating before selection/file lookup. It requires explicit process opt-in plus development mode and a direct loopback socket; forwarded/proxy, remote and cross-origin requests are rejected. The controller is absent unless opted-in and is excluded from the published Swagger contract. Normal authentication/origin/cookie policy is unchanged. Missing/invalid selections return404, missing file404, failed integrity/read503, unauthorized401, nonlocal/cross-origin/proxy403. Paths/errors never expose local filesystem details.

Exact metadata/download URLs, selection strings, headers and UI instructions are in the [Gemini handoff](../collaboration/requests/prebuilt-rom-demo.md). Use direct **http://localhost:4000**, not a Next rewrite; browser cookies are host scoped across ports and existing credentialed CORS handles metadata fetches from localhost3000. The button must be explicit; use browser navigation instead of buffering 1.38GB into JavaScript.

From NEXOS-codex, only if the API is not already running:

```powershell
$env:NEXOS_LOCAL_PREBUILT_DEMO = '1'
node --env-file=.env apps/api/dist/main.js
```

The opt-in is process-local; `.env` is not changed. Do not run a duplicate API. Production mode ignores opt-in and does not register this feature. The source ZIP stays outside Git; no new infrastructure/package is needed. Header hash/size are verification metadata, not ROM authenticity claims. Range/resume and installation are not offered.

## Focused verification

- API TypeScript production compilation and API lint (existing tsc --noEmit script): passed. Root TypeScript noEmit passed.
- Focused prebuilt/password/session/shared-contract/OpenAPI unit checks: **16 passed**, zero failed/skipped. They cover exact identifiers, unknown fields/traversal, unsupported5G/other codename, no-opt-in/production/remote/proxy denial, verified open-file bytes and missing/tampered files. Existing public OpenAPI output is unchanged.
- **Complete real Edge browser download passed**: explicit link click, correct attachment filename, actual downloaded size1375104164 and exact source SHA-256 above. Browser streamed to a private ACL-inherited local verification directory outside Git; its temporary download was removed on browser close. No archive was uploaded/committed.
- Browser exercised the real compiled controller and real Accounts.user/session-digest logic with a deliberately **in-memory session repository**. Missing auth401, bad identifier404, rejected Origin403, metadata200 and full file download passed. No PostgreSQL/session/audit rows were created. This does not claim a new successful real-account login was executed; that would write session/audit records and was deliberately avoided.
- The initial private browser harness needed its HTML response Content-Type corrected and switched to compiled Nest classes for decorator support. Those were harness issues; no security check was relaxed. Final full download succeeded.
- Live API health/readiness **200/200**, anonymous auth/me/projects and prebuilt access **401**, login invalid-body validation **400**. Successful login/project write flows were not rerun against PostgreSQL under the no-record-modification requirement. Existing password/session contracts and OpenAPI regression tests passed.
- Automatic approval review rejected a combined launch/check command before execution; separate narrowly scoped launch and verification commands succeeded. The final API runs with process-local demo opt-in; no .env change or duplicate listener was introduced.
- The read-only comparison with the earlier D5.1 snapshot observed concurrent application activity (audit14→15, revisions4→5, two project rows updated, session count7 unchanged with updated metadata). Users7/projects2/migrations4 and durable rows0 remain unchanged. This task issued no PostgreSQL mutations and did not undo those independent application changes; the .env hash still matches.

Required notice is returned in metadata verbatim: **“This is an existing prebuilt ROM archive. NEXOS did not compile this file, and your selected customizations are not included.”** Gemini must display it beside the action. Frontend integration remains Gemini-owned; this backend commit does not add its button.
