# Phase B3: HTTPS cookies and explicit reverse proxy trust

Implemented 2026-10-28. Scope: transport configuration, session cookie attributes and proxy trust. No schema, session-token, hashing, registration-atomicity, public route/response, frontend or dependency changes. Phase B4 has not been started.

## Confirmed previous gaps

- Startup accepted HTTP WEB_ORIGIN in production and did not validate NODE_ENV. Cookie Secure depended on an exact production string; a typo could silently disable it.
- Fastify correctly defaulted to no proxy trust, but there was no explicit way to configure trusted HTTPS termination. Blindly enabling trust would allow forged forwarding metadata.
- Logout used only Path=/ when clearing the cookie. Cookie identity already matched (name/domain/path), but deletion did not repeat Secure/HttpOnly/SameSite attributes. Creation and deletion now share one policy.

## Environment policy

| Variable                | Local development                                        | Production                                                                                        |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| NODE_ENV                | Unset defaults to development; development/test accepted | Must explicitly be production. Unknown values, including prod, are rejected                       |
| WEB_ORIGIN              | Defaults to http://localhost:3000                        | Required, explicit canonical HTTPS origin, without path, credentials or trailing slash            |
| TRUSTED_PROXY_IPS (new) | Empty/unset means no trust                               | Required comma-separated exact IPv4/IPv6 socket peer addresses for the actual trusted proxy chain |
| DATABASE_URL / PORT     | Existing validation unchanged                            | Existing validation unchanged                                                                     |

No production addresses are preconfigured. TRUSTED_PROXY_IPS accepts IP literals only: no hostname, wildcard, CIDR, blanket subnet alias, boolean or numeric hop count. Unspecified addresses 0.0.0.0 and :: are rejected. Whitespace between entries is trimmed; empty entries are invalid. Prefer the smallest list that matches actual proxy egress addresses. The API defaults to development when NODE_ENV is unset because there is no reliable way to infer deployment intent; operators must explicitly set production mode. Example env files document this distinction, and actual ignored credentials/configuration were not edited.

The existing API listener remains internal HTTP; this phase does not introduce a TLS server. Production configuration therefore requires a trusted HTTPS-terminating proxy path. Missing/inconsistent production settings fail startup with sanitized configuration errors. To deploy, explicitly set NODE_ENV=production, set WEB_ORIGIN to the real browser HTTPS origin and set TRUSTED_PROXY_IPS to the real proxy peer IPs. Do not copy test/example addresses as production infrastructure.

## Cookie and request behavior

Cookie name remains romhub_session, with the same opaque token and hashed database session lookup. Both modes use HttpOnly, SameSite=Lax, Path=/ and no Domain attribute. New sessions retain Max-Age=604800 and seven-day database absolute expiry. Production always sets Secure; local HTTP development omits Secure.

Logout clears the cookie with the same HttpOnly/Secure/SameSite/Path/host-only settings, plus the cookie plugin's Max-Age=0 and epoch Expires. Database logout and owner-scoped revocation remain unchanged. Revoking a session invalidates its server record; it does not alter the existing revocation response or add cookie clearing to that route.

In production, Accounts checks Fastify's trusted request.protocol before Origin/JSON mutation checks and before authenticated user lookups. Non-HTTPS mutations and protected reads receive the existing error envelope with 403 and message HTTPS is required. Rejected registration/login requests do not create accounts/sessions or emit cookies. Public catalog/liveness/readiness routes remain available on internal HTTP; they do not set authentication cookies. No redirect is constructed from untrusted Host headers. Unknown/insecure transport never falls back to insecure production cookies.

The fixed configured browser Origin remains the authority for CORS and mutation CSRF checks; it is not derived from X-Forwarded-Host. Credentials remain enabled only with that configured origin. SameSite=None/cross-site cookie support was not added. Preserve the intended same-site/browser-facing API proxy arrangement.

Existing database sessions are not migrated, rekeyed or deleted. Valid existing tokens work when presented through the configured HTTPS path. Cookies issued by a previously insecure deployment may still be non-Secure in the browser until replaced or cleared; the server cannot inspect their stored attributes. Require HTTPS/HSTS at the edge and use normal login/logout to replace them. B3 does not force global logout.

## Proxy trust and operator requirements

Fastify receives either trustProxy=false or the validated exact-IP list. Socket peer trust controls whether X-Forwarded-Proto and X-Forwarded-Host are used. Client IP resolution walks X-Forwarded-For only through the trusted portion of the chain, stopping at the first untrusted hop. The RFC Forwarded header is not interpreted by this implementation. No custom forwarding-header parser is introduced.

Operators must:

1. Terminate real browser HTTPS at their chosen proxy. Redirect external HTTP to HTTPS and configure HSTS as appropriate there. No TLS certificates or production proxy topology are provisioned by this change.
2. Restrict backend network access to trusted proxies/management health checks. An IP allowlist does not authenticate a proxy or encrypt the proxy-to-API link. Use a private/protected upstream path; evaluate authenticated/encrypted upstream transport separately when the network is not trusted.
3. Overwrite/strip client-supplied X-Forwarded-Proto, X-Forwarded-Host and X-Forwarded-For at the trusted ingress. Only append validated addresses at subsequent trusted hops. Sanitize Forwarded too so another downstream component cannot interpret spoofed metadata. A trusted proxy forwarding attacker-controlled headers can defeat any application trust policy.
4. Configure the addresses actually seen on API sockets, including any intermediary Next.js server used for /api rewrites. An edge proxy's address alone is insufficient when the API socket peer is Next.js. Each trusted intermediary must preserve a validated external scheme; simply copying arbitrary incoming forwarding headers is unsafe. Never add all application clients or broad networks to make a failing chain work.
5. Verify the real chain end to end: HTTPS login/registration/logout, cookie attributes, Origin forwarding, client-IP resolution, HTTP rejection and direct-client spoof rejection. These local tests do not validate a production network or certificates.

Dynamic proxy address discovery, arbitrary CIDRs and hop-count trust require a separately reviewed deployment design. Do not enable blanket trust as a workaround. This phase changes IP attribution when proxies are explicitly configured but does not implement new rate limits or persistent throttler storage.

Reference behavior: [Fastify v5 trustProxy](https://fastify.dev/docs/v5.6.x/Reference/Server/#trustproxy) and [Fastify cookie options](https://github.com/fastify/fastify-cookie#sending), also checked against installed source.

## Tests and files

- apps/api/src/config.ts: mode/HTTPS/proxy validation and shared cookie attributes.
- apps/api/src/main.ts: validated proxy trust passed to Fastify.
- apps/api/src/app.ts: production transport enforcement and matching logout attributes; B1/B2 flows preserved.
- .env.example and apps/api/.env.example: explicit local defaults and production requirements.
- tests/infrastructure.test.ts: existing validator regression adapted to new configuration output.
- tests/transport.test.ts: local/production cookie creation/deletion, invalid production config, untrusted/trusted X-Forwarded metadata and bounded XFF chain.
- tests/api.integration.ts: real production-mode Nest/Fastify/PostgreSQL registration/login/logout/revocation, spoofed peer/HTTP rejection, matching Secure deletion, fixed-origin CORS/CSRF regression.
- This document.

Proxy tests use Fastify injection with test-only socket addresses and headers; no external HTTPS infrastructure is required. The production auth test uses actual PostgreSQL and cleans up only its uniquely named fixture account/audits. No schema changes, triggers, reset or production trust exceptions are used.

Executed successfully for B3:

- `pnpm typecheck` and `pnpm lint` (repository workspace checks, including web ESLint).
- `pnpm test`: **20 unit tests passed**.
- `pnpm test:integration`: **6 integration tests passed** against local PostgreSQL, including B1/B2 regressions and production-mode trusted/untrusted transport tests.
- `pnpm test:e2e`: **6 Chromium E2E tests passed**, including local HTTP authentication/session/project flows through the Next proxy.
- `pnpm build`: **7 workspace build tasks successful**.
- `git diff --check`: clean.

All requested commands ran. No live TLS handshake, external reverse proxy, production address ownership, network ACL, HSTS configuration or production forwarding chain was validated. Production operators must verify those separately before exposing the service. The development API is restored after E2E verification.
