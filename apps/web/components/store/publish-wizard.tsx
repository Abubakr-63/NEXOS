"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { UserProjectForPublish as Project } from "@/lib/store-adapter";
import {
  getUserProjectsForPublish,
  validatePublishPayload,
  submitPublishProject,
  type PublishProjectPayload,
} from "@/lib/store-adapter";
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function PublishWizard() {
  const { t } = useTranslation("store");

  const [step, setStep] = useState(0);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState("");

  const [formData, setFormData] = useState<Partial<PublishProjectPayload>>({
    projectId: "",
    title: "",
    description: "",
    tags: ["aosp", "custom-rom"],
    visibility: "public",
  });
  const [tagInput, setTagInput] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    message: string;
    requiresBackend: boolean;
  } | null>(null);

  // Fetch real user projects from backend
  useEffect(() => {
    getUserProjectsForPublish()
      .then((items) => {
        setUserProjects(items);
        setFormData((prev) => {
          if (items.length > 0 && !prev.projectId) {
            const first = items[0];
            return {
              ...prev,
              projectId: first.id,
              title: first.name,
              description: first.description || "",
            };
          }
          return prev;
        });
      })
      .catch((err) => {
        setProjectsError(err instanceof Error ? err.message : "Failed to load projects");
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  const selectedProject = userProjects.find((p) => p.id === formData.projectId);

  function nextStep() {
    if (step === 0 && !formData.projectId) {
      setValidationErrors({ projectId: t("selectProjectRequired") });
      return;
    }
    if (step === 1) {
      const stepErrors: Record<string, string> = {};
      if (!formData.title?.trim() || formData.title.trim().length < 3) {
        stepErrors.title = t("titleMinLength");
      }
      if (!formData.description?.trim() || formData.description.trim().length < 10) {
        stepErrors.description = t("descriptionMinLength");
      }
      if (Object.keys(stepErrors).length > 0) {
        setValidationErrors(stepErrors);
        return;
      }
    }
    setValidationErrors({});
    setStep((s) => Math.min(3, s + 1));
  }

  function prevStep() {
    setValidationErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  function handleAddTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (val && !formData.tags?.includes(val)) {
        setFormData((prev) => ({
          ...prev,
          tags: [...(prev.tags || []), val],
        }));
      }
      setTagInput("");
    }
  }

  function handleRemoveTag(tag: string) {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((t) => t !== tag),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const val = validatePublishPayload(formData);
    if (!val.valid) {
      setValidationErrors(val.errors);
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitPublishProject(formData as PublishProjectPayload);
      setSubmitResult({
        message: res.message,
        requiresBackend: res.requiresBackend,
      });
    } catch (err) {
      setValidationErrors({ submit: err instanceof Error ? err.message : "Submission failed" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="store-page">
      <div className="mb-6">
        <Link href="/store" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={16} />
          <span>{t("backToStore")}</span>
        </Link>
      </div>

      <div className="publish-wizard-card">
        {/* Header */}
        <div className="mb-6 text-center">
          <span className="craft-kicker">{t("publishWizardKicker")}</span>
          <h1 className="text-2xl font-bold text-white mt-1">{t("publishWizardTitle")}</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            {t("publishWizardSubtitle")}
          </p>
        </div>

        {/* Stepper indicator */}
        <div className="wizard-stepper" aria-label="Publishing steps">
          {[t("stepSelectProject"), t("stepDetails"), t("stepVisibility"), t("stepReview")].map(
            (label, idx) => (
              <div
                key={label}
                className={`wizard-step-node ${step === idx ? "active" : step > idx ? "completed" : ""}`}
              >
                <div className="step-circle">{step > idx ? <CheckCircle2 size={18} /> : idx + 1}</div>
                <span className="step-label">{label}</span>
              </div>
            ),
          )}
        </div>

        {submitResult ? (
          /* Result notification */
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400">
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">{t("backendPendingTitle")}</h3>
            <p className="text-sm text-slate-300 max-w-lg mx-auto mb-6 leading-relaxed">
              {submitResult.message}
            </p>
            <div className="p-4 bg-slate-900/60 rounded-xl border border-white/10 text-left max-w-md mx-auto text-xs text-slate-400 mb-6">
              <span className="font-semibold text-slate-300 block mb-1">Contract summary prepared:</span>
              <span>Project: {selectedProject?.name}</span><br />
              <span>Target: {selectedProject?.variantId}</span><br />
              <span>Visibility: {formData.visibility}</span><br />
              <span>Status: Preserved safely as private project</span>
            </div>
            <div className="flex justify-center gap-3">
              <Link href="/store" className="store-btn primary">
                {t("returnToStore")}
              </Link>
              <Link href="/projects" className="store-btn secondary">
                {t("viewMyProjects")}
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Step 0: Select Project */}
            {step === 0 && (
              <div className="space-y-4">
                <label className="craft-field">
                  <span>{t("selectProjectLabel")}</span>
                  {loadingProjects ? (
                    <p className="text-xs text-slate-400">{t("loadingUserProjects")}</p>
                  ) : projectsError ? (
                    <p className="text-xs text-rose-400">{projectsError}</p>
                  ) : userProjects.length === 0 ? (
                    <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5 text-center">
                      <p className="text-sm text-slate-300 mb-3">{t("noDraftsToPublish")}</p>
                      <Link href="/projects/new" className="store-btn primary inline-flex">
                        {t("createRomPrompt")}
                      </Link>
                    </div>
                  ) : (
                    <select
                      className="store-select w-full"
                      value={formData.projectId}
                      onChange={(e) => {
                        const chosen = userProjects.find((p) => p.id === e.target.value);
                        setFormData((prev) => ({
                          ...prev,
                          projectId: e.target.value,
                          title: chosen ? chosen.name : prev.title,
                          description: chosen ? chosen.description : prev.description,
                        }));
                      }}
                    >
                      <option value="">{t("chooseAProject")}</option>
                      {userProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (v{p.revision}) · {p.variantId}
                        </option>
                      ))}
                    </select>
                  )}
                </label>

                {validationErrors.projectId && (
                  <p className="text-xs text-rose-400">{validationErrors.projectId}</p>
                )}

                {selectedProject && (
                  <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2 text-sky-400 font-semibold">
                      <Smartphone size={14} />
                      <span>{selectedProject.variantId}</span>
                    </div>
                    <p>Preset: {selectedProject.preset} · Base: {selectedProject.base}</p>
                    <p>Applications: {selectedProject.apps.join(", ") || "None"}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Public Title & Description */}
            {step === 1 && (
              <div className="space-y-4">
                <label className="craft-field">
                  <span>{t("publicTitleLabel")}</span>
                  <input
                    type="text"
                    maxLength={60}
                    value={formData.title || ""}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t("publicTitlePlaceholder")}
                    required
                  />
                </label>
                {validationErrors.title && (
                  <p className="text-xs text-rose-400">{validationErrors.title}</p>
                )}

                <label className="craft-field">
                  <span>{t("publicDescriptionLabel")}</span>
                  <textarea
                    rows={4}
                    maxLength={1000}
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t("publicDescriptionPlaceholder")}
                    required
                  />
                </label>
                {validationErrors.description && (
                  <p className="text-xs text-rose-400">{validationErrors.description}</p>
                )}
              </div>
            )}

            {/* Step 2: Visibility & Tags */}
            {step === 2 && (
              <div className="space-y-4">
                <label className="craft-field">
                  <span>{t("visibilityLabel")}</span>
                  <select
                    className="store-select w-full"
                    value={formData.visibility}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        visibility: e.target.value as "public" | "unlisted",
                      })
                    }
                  >
                    <option value="public">{t("visibilityPublic")}</option>
                    <option value="unlisted">{t("visibilityUnlisted")}</option>
                  </select>
                </label>

                <label className="craft-field">
                  <span>{t("tagsLabel")}</span>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder={t("tagsPlaceholder")}
                  />
                  <small className="text-xs text-slate-400 block mt-1">
                    {t("tagsHint")}
                  </small>
                </label>

                {formData.tags && formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-xs text-sky-300"
                      >
                        #{tag}
                        <button
                          type="button"
                          className="hover:text-rose-400"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review and Confirm */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="truthful-notice-banner">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>{t("truthfulPublishNoticeTitle")}</strong>
                    <p className="mt-1 text-xs">
                      {t("truthfulPublishNoticeText")}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-900/60 rounded-xl border border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">{t("reviewTitle")}</span>
                    <span className="font-semibold text-slate-200">{formData.title}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">{t("reviewProject")}</span>
                    <span className="text-slate-200">{selectedProject?.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">{t("reviewTarget")}</span>
                    <span className="text-slate-200">{selectedProject?.variantId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">{t("reviewVisibility")}</span>
                    <span className="capitalize text-slate-200">{formData.visibility}</span>
                  </div>
                </div>

                {validationErrors.submit && (
                  <p className="text-xs text-rose-400">{validationErrors.submit}</p>
                )}
              </div>
            )}

            {/* Step Navigation Actions */}
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-white/10">
              <button
                type="button"
                className="store-btn secondary"
                onClick={prevStep}
                disabled={step === 0 || submitting}
              >
                <ArrowLeft size={16} />
                <span>{t("previousStep")}</span>
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  className="store-btn primary"
                  onClick={nextStep}
                >
                  <span>{t("continue")}</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  className="store-btn primary"
                  disabled={submitting}
                >
                  <Upload size={16} />
                  <span>{submitting ? t("submittingPublish") : t("confirmAndPublish")}</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
