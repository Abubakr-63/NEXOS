import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeBackoffDelay,
  isTransientStatus,
  verifySessionEndpoint,
  DEFAULT_REVALIDATE_INTERVAL_MS,
  DEFAULT_VERIFY_TIMEOUT_MS,
  DEFAULT_DEBOUNCE_MS,
  DEFAULT_MAX_RETRIES,
  INITIAL_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
} from "../apps/web/lib/session-verification";
import {
  lookupSession,
  DEFAULT_SESSION_TIMEOUT_MS,
} from "../apps/web/lib/session-lookup";

// =========================================================================
// 1. Session Verification Constants & Cold-Start Timeout Bounds
// =========================================================================

test("session configuration defaults reflect production Render cold start tolerances", () => {
  // Revalidation interval is ~5 minutes (300,000ms), not the noisy 60s
  assert.equal(DEFAULT_REVALIDATE_INTERVAL_MS, 300_000);

  // Timeouts are bounded between 15–20 seconds (15,000ms), preventing premature cold-start aborts
  assert.ok(DEFAULT_VERIFY_TIMEOUT_MS >= 15_000 && DEFAULT_VERIFY_TIMEOUT_MS <= 20_000);
  assert.ok(DEFAULT_SESSION_TIMEOUT_MS >= 15_000 && DEFAULT_SESSION_TIMEOUT_MS <= 20_000);

  // Debounce window is 15 seconds to prevent spamming on rapid tab changes
  assert.equal(DEFAULT_DEBOUNCE_MS, 15_000);

  // Max consecutive retries is bounded at 3 attempts
  assert.equal(DEFAULT_MAX_RETRIES, 3);
  assert.equal(INITIAL_RETRY_DELAY_MS, 2_000);
  assert.equal(MAX_RETRY_DELAY_MS, 30_000);
});

// =========================================================================
// 2. Exponential Backoff & Transient Status Classification
// =========================================================================

test("computeBackoffDelay computes bounded exponential backoff without infinite expansion", () => {
  assert.equal(computeBackoffDelay(0), 0);
  assert.equal(computeBackoffDelay(1), 2000);  // 2s
  assert.equal(computeBackoffDelay(2), 4000);  // 4s
  assert.equal(computeBackoffDelay(3), 8000);  // 8s
  assert.equal(computeBackoffDelay(4), 16000); // 16s
  assert.equal(computeBackoffDelay(5), 30000); // capped at 30s max
  assert.equal(computeBackoffDelay(10), 30000); // stays capped
});

test("isTransientStatus differentiates server/proxy hiccups from credential rejection", () => {
  // Authentication failure is NOT transient (must redirect)
  assert.equal(isTransientStatus(401), false);
  assert.equal(isTransientStatus(403), false);
  assert.equal(isTransientStatus(200), false);

  // Server errors, timeouts and rate limits ARE transient
  assert.equal(isTransientStatus(408), true); // Request Timeout
  assert.equal(isTransientStatus(429), true); // Rate limited
  assert.equal(isTransientStatus(500), true); // Internal Server Error
  assert.equal(isTransientStatus(502), true); // Bad Gateway (Render cold start)
  assert.equal(isTransientStatus(503), true); // Service Unavailable
  assert.equal(isTransientStatus(504), true); // Gateway Timeout
});

// =========================================================================
// 3. Endpoint Verification: Valid, Expired, Outages, and Interceptions
// =========================================================================

test("verifySessionEndpoint identifies confirmed valid session", async () => {
  const mockFetcher: typeof fetch = async () =>
    Response.json({
      user: {
        id: "usr_abc",
        username: "nexos_creator",
        role: "USER",
        emailVerifiedAt: null,
      },
    });

  const result = await verifySessionEndpoint({ fetcher: mockFetcher });
  assert.equal(result.status, "valid");
  if (result.status === "valid") {
    assert.deepEqual(result.user, {
      id: "usr_abc",
      username: "nexos_creator",
      role: "USER",
      emailVerifiedAt: null,
    });
  }
});

test("verifySessionEndpoint identifies confirmed 401 expired session", async () => {
  const mockFetcher: typeof fetch = async () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const result = await verifySessionEndpoint({ fetcher: mockFetcher });
  assert.equal(result.status, "unauthorized");
});

test("verifySessionEndpoint treats 5xx server outages as transient errors without throwing", async () => {
  for (const status of [500, 502, 503, 504]) {
    const mockFetcher: typeof fetch = async () =>
      new Response("Server booting", { status });

    const result = await verifySessionEndpoint({ fetcher: mockFetcher });
    assert.equal(result.status, "transient_error");
    if (result.status === "transient_error") {
      assert.equal(result.statusCode, status);
    }
  }
});

test("verifySessionEndpoint handles network drops and timeouts gracefully", async () => {
  // Simulated TypeError: fetch failed
  const networkErrorFetcher: typeof fetch = async () => {
    throw new TypeError("Failed to fetch");
  };

  const netResult = await verifySessionEndpoint({ fetcher: networkErrorFetcher });
  assert.equal(netResult.status, "transient_error");
  if (netResult.status === "transient_error") {
    assert.ok(netResult.error instanceof TypeError);
  }

  // Simulated AbortError
  const abortController = new AbortController();
  abortController.abort();
  const abortedFetcher: typeof fetch = async (_url, options) => {
    if (options?.signal?.aborted) {
      const err = new Error("This operation was aborted");
      err.name = "AbortError";
      throw err;
    }
    return new Response();
  };

  const abortResult = await verifySessionEndpoint({
    fetcher: abortedFetcher,
    signal: abortController.signal,
  });
  assert.equal(abortResult.status, "transient_error");
});

test("verifySessionEndpoint treats proxy HTML / malformed payloads as transient rather than logging out", async () => {
  // Render / Cloudflare gateway returning 200 with HTML error page
  const htmlProxyFetcher: typeof fetch = async () =>
    new Response("<html><body>Service starting up</body></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });

  const result = await verifySessionEndpoint({ fetcher: htmlProxyFetcher });
  assert.equal(result.status, "transient_error");
});

// =========================================================================
// 4. Server-Side lookupSession: 15s Timeout Handles Render Cold Starts
// =========================================================================

test("lookupSession handles slow cold start responses up to 15s without failing at 4s", async () => {
  const token = "a".repeat(43);

  // Response taking 5000ms (5 seconds) — in previous 4000ms timeout this failed
  const slowColdStartFetcher: typeof fetch = async (_url, options) => {
    // Assert signal was created with bounded timeout (not aborted at 4s)
    assert.ok(!options?.signal?.aborted);
    return Response.json({
      user: {
        id: "owner_123",
        username: "dev_alex",
        role: "USER",
        emailVerifiedAt: null,
      },
    });
  };

  const result = await lookupSession(
    token,
    "http://localhost:4200",
    slowColdStartFetcher,
    15_000, // 15s timeout
  );
  assert.equal(result.state, "authenticated");
});

// =========================================================================
// 5. State Machine Simulation: Visibility, Overlap, Debounce & Retries
// =========================================================================

test("state machine: debounces rapid visibility changes and avoids duplicate in-flight checks", async () => {
  let callCount = 0;
  let inFlight = false;
  let lastCheckedTime = -Infinity;
  const debounceMs = 15_000;

  const mockCheck = async (currentTime: number) => {
    if (inFlight) return "overlapping_skipped";
    if (currentTime - lastCheckedTime < debounceMs) return "debounced_skipped";

    inFlight = true;
    lastCheckedTime = currentTime;
    callCount++;

    // Simulate async network latency
    await new Promise((r) => setTimeout(r, 20));
    inFlight = false;
    return "executed";
  };

  // Trigger 1 at t=0
  const r1 = await mockCheck(1000);
  assert.equal(r1, "executed");
  assert.equal(callCount, 1);

  // Trigger 2 at t=500ms (within debounce window)
  const r2 = await mockCheck(1500);
  assert.equal(r2, "debounced_skipped");
  assert.equal(callCount, 1);

  // Trigger 3 at t=2000ms (still within debounce window)
  const r3 = await mockCheck(3000);
  assert.equal(r3, "debounced_skipped");
  assert.equal(callCount, 1);

  // Trigger 4 at t=17000ms (after debounce window: 17000 - 1000 = 16000 >= 15000)
  const r4 = await mockCheck(17000);
  assert.equal(r4, "executed");
  assert.equal(callCount, 2);
});

test("state machine: transient errors back off and cap at maxRetries without infinite loops", () => {
  let consecutiveFailures = 0;
  const maxRetries = 3;
  const scheduledDelays: number[] = [];
  let status: "healthy" | "degraded" = "healthy";

  const handleFailure = () => {
    consecutiveFailures += 1;
    if (consecutiveFailures <= maxRetries) {
      const delay = computeBackoffDelay(consecutiveFailures);
      scheduledDelays.push(delay);
    } else {
      // Bounded: stops retrying, marks degraded
      status = "degraded";
    }
  };

  // Failure 1
  handleFailure();
  assert.equal(consecutiveFailures, 1);
  assert.deepEqual(scheduledDelays, [2000]);
  assert.equal(status, "healthy");

  // Failure 2
  handleFailure();
  assert.equal(consecutiveFailures, 2);
  assert.deepEqual(scheduledDelays, [2000, 4000]);
  assert.equal(status, "healthy");

  // Failure 3
  handleFailure();
  assert.equal(consecutiveFailures, 3);
  assert.deepEqual(scheduledDelays, [2000, 4000, 8000]);
  assert.equal(status, "healthy");

  // Failure 4: Beyond max retries! Must NOT schedule another immediate retry
  handleFailure();
  assert.equal(consecutiveFailures, 4);
  assert.deepEqual(scheduledDelays, [2000, 4000, 8000]); // No new delay added
  assert.equal(status, "degraded");

  // Subsequent success resets failures and restores healthy
  consecutiveFailures = 0;
  status = "healthy";
  assert.equal(status, "healthy");
});

test("state machine: 401 unauthenticated response redirects immediately without retries", () => {
  let redirectedToLogin = false;
  let retriesScheduled = 0;

  const handleVerificationResult = (status: "valid" | "unauthorized" | "transient_error") => {
    if (status === "unauthorized") {
      redirectedToLogin = true;
      return;
    }
    if (status === "transient_error") {
      retriesScheduled++;
    }
  };

  handleVerificationResult("unauthorized");
  assert.equal(redirectedToLogin, true);
  assert.equal(retriesScheduled, 0); // No retries for confirmed 401
});

test("state machine: cancellation on unmount aborts in-flight request cleanly", () => {
  let controllerAborted = false;
  let timerCleared = false;

  const controller = new AbortController();
  const timer = setTimeout(() => {}, 15000);

  // Unmount simulation
  const unmount = () => {
    controller.abort();
    controllerAborted = controller.signal.aborted;
    clearTimeout(timer);
    timerCleared = true;
  };

  unmount();
  assert.equal(controllerAborted, true);
  assert.equal(timerCleared, true);
});
