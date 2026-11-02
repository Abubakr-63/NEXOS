"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  DEFAULT_REVALIDATE_INTERVAL_MS,
  DEFAULT_VERIFY_TIMEOUT_MS,
  DEFAULT_DEBOUNCE_MS,
  DEFAULT_MAX_RETRIES,
  computeBackoffDelay,
  verifySessionEndpoint,
} from "@/lib/session-verification";
import "./workspace-session.css";

export type WorkspaceSessionProps = {
  children: React.ReactNode;
  revalidateIntervalMs?: number;
  timeoutMs?: number;
  debounceMs?: number;
  maxRetries?: number;
  fetcher?: typeof fetch;
  onUnauthorized?: () => void;
  onStatusChange?: (status: "healthy" | "rechecking" | "degraded") => void;
};

/**
 * Production-quality session observer for the authorized workspace.
 *
 * Initial authorization is strictly enforced by server components (requireWorkspaceSession).
 * This component runs quiet background revalidation without full-screen loading flashes,
 * preserves unsaved editing state in Studio and builder forms, handles Render cold starts,
 * debounces visibility events, and applies bounded exponential backoff for transient failures.
 */
export function WorkspaceSession({
  children,
  revalidateIntervalMs = DEFAULT_REVALIDATE_INTERVAL_MS,
  timeoutMs = DEFAULT_VERIFY_TIMEOUT_MS,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  fetcher = fetch,
  onUnauthorized,
  onStatusChange,
}: WorkspaceSessionProps) {
  const router = useRouter();
  const { t } = useTranslation("auth");

  const [connectionStatus, setConnectionStatus] = useState<
    "healthy" | "rechecking" | "degraded"
  >("healthy");

  const activeRef = useRef(true);
  const isCheckingRef = useRef(false);
  const lastCheckTimeRef = useRef(0);
  const consecutiveFailuresRef = useRef(0);
  const inFlightControllerRef = useRef<AbortController | null>(null);
  const deadlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const executeCheckRef = useRef<() => void>(() => {});

  const updateStatus = useCallback(
    (newStatus: "healthy" | "rechecking" | "degraded") => {
      setConnectionStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange],
  );

  const executeCheck = useCallback(async () => {
    if (!activeRef.current) return;
    if (isCheckingRef.current) return;

    isCheckingRef.current = true;
    lastCheckTimeRef.current = Date.now();

    // Cancel any existing in-flight controller
    if (inFlightControllerRef.current) {
      inFlightControllerRef.current.abort();
      inFlightControllerRef.current = null;
    }
    if (deadlineTimerRef.current) {
      clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }

    const controller = new AbortController();
    inFlightControllerRef.current = controller;

    // Set bounded timeout (15-20s for Render cold starts)
    deadlineTimerRef.current = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const result = await verifySessionEndpoint({
        fetcher,
        signal: controller.signal,
      });

      if (!activeRef.current || inFlightControllerRef.current !== controller) {
        return;
      }

      // Only confirmed 401 responses or an explicitly invalid session trigger login redirect
      if (result.status === "unauthorized") {
        consecutiveFailuresRef.current = 0;
        if (onUnauthorized) {
          onUnauthorized();
        } else {
          router.replace("/login");
          router.refresh();
        }
        return;
      }

      if (result.status === "valid") {
        // Success: reset transient failure count and clear degraded warning
        consecutiveFailuresRef.current = 0;
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        updateStatus("healthy");
        return;
      }

      // Transient failure (network error, timeout, 5xx server error, or rate limit)
      handleTransientFailure();
    } catch {
      if (!activeRef.current || inFlightControllerRef.current !== controller) {
        return;
      }
      handleTransientFailure();
    } finally {
      if (deadlineTimerRef.current) {
        clearTimeout(deadlineTimerRef.current);
        deadlineTimerRef.current = null;
      }
      isCheckingRef.current = false;
    }

    function handleTransientFailure() {
      consecutiveFailuresRef.current += 1;
      const attempt = consecutiveFailuresRef.current;

      if (attempt <= maxRetries) {
        // Bounded exponential backoff: 2s, 4s, 8s...
        const delay = computeBackoffDelay(attempt);
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
        }
        retryTimerRef.current = setTimeout(() => {
          if (activeRef.current && !document.hidden) {
            void executeCheckRef.current();
          }
        }, delay);
      } else {
        // Reached max retries: do not loop infinitely!
        // Mark as degraded to show non-blocking indicator while keeping workspace mounted.
        updateStatus("degraded");
        // Will revalidate at next periodic interval or tab return.
      }
    }
  }, [fetcher, maxRetries, onUnauthorized, router, timeoutMs, updateStatus]);

  useEffect(() => {
    executeCheckRef.current = executeCheck;
  }, [executeCheck]);

  useEffect(() => {
    activeRef.current = true;
    lastCheckTimeRef.current = Date.now();

    const handleVisibilityOrNavigation = () => {
      if (document.hidden) return;
      const elapsed = Date.now() - lastCheckTimeRef.current;
      // Debounce duplicate checks triggered by rapid tab switches or navigation
      if (elapsed >= debounceMs && !isCheckingRef.current) {
        void executeCheck();
      }
    };

    // Periodic revalidation (default ~5 minutes)
    const intervalId = setInterval(() => {
      if (!document.hidden) {
        void executeCheck();
      }
    }, revalidateIntervalMs);

    document.addEventListener("visibilitychange", handleVisibilityOrNavigation);
    window.addEventListener("popstate", handleVisibilityOrNavigation);

    return () => {
      activeRef.current = false;
      clearInterval(intervalId);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityOrNavigation,
      );
      window.removeEventListener("popstate", handleVisibilityOrNavigation);

      if (inFlightControllerRef.current) {
        inFlightControllerRef.current.abort();
        inFlightControllerRef.current = null;
      }
      if (deadlineTimerRef.current) {
        clearTimeout(deadlineTimerRef.current);
        deadlineTimerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [debounceMs, executeCheck, revalidateIntervalMs]);

  return (
    <>
      {connectionStatus === "degraded" && (
        <aside
          className="workspace-reconnecting-banner"
          role="status"
          aria-live="polite"
        >
          <span className="reconnecting-dot" />
          <span>{t("sessionReconnecting")}</span>
        </aside>
      )}
      {children}
    </>
  );
}
