# Security status

This is a development foundation, not a public production service.

Implemented: salted scrypt passwords; 256-bit opaque random session tokens; token digests at rest; HttpOnly, SameSite=Lax cookies (Secure in production); seven-day absolute expiry; rotation of the presented session on login; logout/revocation; session resource ownership; ADMIN audit guard; exact Origin and JSON checks on every current mutation; strict account boundary schemas; bounded catalog queries; global request throttling; Prisma parameterized queries; Fastify helmet; browser security headers; React escaped text; cookie/authorization log redaction; generic server errors; no auth secrets in localStorage. Only theme preference uses localStorage.

No unsafe Markdown/HTML rendering is exposed. No uploads, signed URLs, webhooks, tokens, or artifact downloads are exposed. The worker cannot mark an artifact verified or publish a release. Unrecognized jobs fail closed.

Before public deployment: implement email verification and recovery with expiring hashed single-use tokens, verified-account publishing gates, password/session abuse protections, configurable trusted proxies, persistent rate limits, stricter authentication throttles, dependency vulnerability review, retention/cleanup, encrypted backups, CSP/nonces, TLS and secrets provisioning, observability, security test expansion, and a complete authorization review. Secure OAuth credential encryption and PKCE/state/nonce validation are required before enabling providers.

Future upload flow: authorized draft → short-lived signed upload → private quarantine → bounded metadata/checksum validation → independently recorded malware/signature checks → explicit review/publication → signed CDN delivery. Checksums establish integrity relative to an expected value, never safety. Never bypass verification on a worker exception. Unknown compatibility stays UNKNOWN.

Log only operational metadata; do not enable request-body logging. Report vulnerabilities privately to the deployment operator; a public security contact has not been provisioned.
