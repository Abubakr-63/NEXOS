# ADR 0001 — Modular monolith and phased infrastructure

Accepted for foundation. A NestJS API owns domain behavior and PostgreSQL persistence. Next.js renders UI and proxies browser API calls. A separate BullMQ process prepares for asynchronous verification. Shared packages contain contracts and pure utilities, not duplicated business logic.

Why: the product spans many domains, but current traffic does not justify microservices. PostgreSQL and Redis are the default local dependencies; object storage and search remain opt-in until workflows need them. The tradeoff is a small initial API module to split by domain as features mature.
