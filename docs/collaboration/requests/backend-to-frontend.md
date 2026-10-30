# Backend handoff to frontend and integration coordinator

Date: 2026-10-30. Baseline: `1c7f4031306ca513d6609a57a90e999b0fee2332`.
Backend branch: `ai/codex-backend`.

Worker supervision has been hardened; there are no API, shared schema or OpenAPI changes for frontend consumption. `POST /api/v1/projects/:id/builds` continues to require authentication/project ownership and returns the existing 503. Keep displaying unavailable compilation; probe completion is never Android build success and supplies no downloadable artifact.

No frontend change is requested for this milestone. Before integration, run both branches together with isolated migrated PostgreSQL and Redis and rerun backend integration/browser checks. Backend-only focused tests pass; combined compatibility is unverified.

Coordination proposals, not implemented changes:

1. Agree on preserving LF bytes for reviewed source fixtures and exact generated OpenAPI artifacts. Existing Windows `core.autocrlf=true` changes hashes/snapshots. Any root `.gitattributes` policy needs shared ownership review.
2. Review Windows argument handling in shared `scripts/with-env.mjs`; its existing shell-based launcher fails the environment-runner unit test. Do not silently change root tooling during concurrent work.
3. Review D3's durable job/attempt/outbox proposal before exposing submission/status/cancel APIs. Agree on exact public schemas, error behavior and OpenAPI changes before either side builds those flows.

See `docs/backend/codex-backend-implementation.md` for verification results, lifecycle behavior, limitations and remaining executor/artifact requirements.
