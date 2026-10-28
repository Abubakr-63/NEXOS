# Android build system

Compilation is unavailable. The BullMQ worker only handles connectivity probes; it cannot compile Android. POST /api/v1/projects/:id/builds authenticates the session, checks ownership and origin, validates the persisted configuration and returns HTTP 503. No artifacts or download URLs are fabricated.

Next implementation: register one reviewed, immutable build manifest for an exact hardware variant. Include base commit, device tree, kernel source, vendor provenance, firmware requirements, patch hashes and license evidence. Execute only approved manifests in dedicated isolated Linux workers with resource/time limits, cancellation, retry-safe storage and no host secrets. Add signed artifact storage and SSE events only after lifecycle tests pass.

Compilation success, automated validation, device boot testing and hardware testing must remain separate evidence states.
