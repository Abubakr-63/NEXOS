# ADR 0002 — Explicit trust boundaries

Accepted. Use fictional, clearly labeled fixtures rather than partially sourced real compatibility data. Device associations never establish support. Every supported compatibility result requires an exact variant and evidence. Checksum, signature, and malware results are separate facts. Upload and publishing remain closed until their complete verification pipeline exists.

The web currently uses local demo fixtures while the API serves a separately seeded PostgreSQL catalog. This is an explicit temporary boundary, not an automatic fallback that could hide an outage. Connect them in the core MVP.
