# November 2 local prebuilt download — Gemini handoff

Backend only; no frontend implementation or shared Zod/OpenAPI contract was changed. This demo never builds/customizes a ROM or writes projects/jobs. Do not auto-download on selection.

## Exact selection and endpoints

Use these **exact dedicated demo identifiers**, independently of existing database IDs:

```json
{"manufacturer":"xiaomi","device":"redmi-note-10-4g","codename":"sunny","rom":"pixelexperience-plus","android":"11"}
```

Only map the actual Xiaomi Redmi Note 10 **4G / sunny** UI option to this tuple. Never infer it from partial display-name matching. Note 10 5G, Pro, other codenames/ROMs/Android versions are unavailable. RAM4GB/storage128GB are device specifications, not compatibility proof. If the UI lacks ROM/version selection, Gemini needs only an explicit PixelExperience Plus / Android11 option for this one device plus an availability section/button.

Artifact ID: `pixel-experience-plus-mojito-android11-20211009`.

Metadata: authenticated **GET**

`http://localhost:4000/api/v1/prebuilt-roms/pixel-experience-plus-mojito-android11-20211009?manufacturer=xiaomi&device=redmi-note-10-4g&codename=sunny&rom=pixelexperience-plus&android=11`

Fetch metadata once the exact selection is complete, with **credentials:include**, using localhost consistently (same browser hostname as frontend3000). Existing host-only HttpOnly session cookies work across ports. Existing backend CORS allows exactly http://localhost:3000 with credentials. **Call the direct localhost4000 API, not Next's `/api/v1` proxy**: this deliberately local-only feature rejects forwarded/proxy requests and remote sockets. Do not alter the general application proxy.

If metadata200, show **“Prebuilt ROM available”** and an explicit anchor/button **“Download PixelExperience Plus — Android 11”**. Its href is the identical direct URL with `/download` appended after the artifact ID, before `?`. The download is an authenticated **GET**. Use ordinary browser navigation/anchor, not fetch→Blob: the real archive is 1,375,104,164 bytes, so buffering it in frontend memory is inappropriate. Do not attempt to set Cookie headers or read the HttpOnly token in JavaScript.

Download headers: application/zip; attachment with fixed filename `PixelExperience_Plus_mojito-11.0-20211009-1327-OFFICIAL.zip`; Content-Length1375104164; Content-Encoding:identity; Cache-Control:private,no-store; X-Content-Type-Options:nosniff; X-Artifact-SHA256:`39807bfa2b0a0c8569b37f745bcdeb14c0a1c8530f7e5f997a93b058c044f215`; Accept-Ranges:none. No partial/resume support is offered. Browser uses the attachment filename.

## Displayed evidence and limitations

Metadata exposes buildDate2021-10-09, Android11, securityPatch2021-10-01, size/hash and the exact selection. OTA metadata explicitly lists `mojito,sunny`; installation compatibility is **not verified**, publisher authenticity and redistribution rights are **not verified**. Do not show a green “compatible for flashing” label or set existing build/flash eligibility true.

Display verbatim:

> This is an existing prebuilt ROM archive. NEXOS did not compile this file, and your selected customizations are not included.

Also display the metadata warning: historical Android11 archive, not assessed as current or secure for daily use; no installation/flashing offered. Any unrelated project customizations are absent from this file. No fake compilation progress/download artifact should be invented.

401: sign in through the existing flow. 403: nonlocal/proxied/cross-origin access denied. 404: unsupported ID/selection, feature disabled or file missing — show unavailable. 503: artifact cannot be read/verified or its size/hash changed — show unavailable and contact the local operator; never substitute another file. Other combinations must not show a download action. Do not silently retry large downloads.

The operator must explicitly enable `NEXOS_LOCAL_PREBUILT_DEMO=1` on the development API process. Production mode never registers these routes. No public deployment is approved. See [inspection and verification report](../../backend/prebuilt-rom-local-demo.md).
