import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import {
  ANALYSIS_EVIDENCE_EVENT,
  consumePendingAnalysisEvidence,
  type AnalysisEvidence,
} from "./analysisBridge";

import {
  rasadyarDataService,
  type RasadyarAnalysisQualityAssessment,
  type RasadyarAnalysisRevision,
  type RasadyarAuditEvent,
  type RasadyarCaseReadinessAssessment,
  type RasadyarEvidenceRelationshipRegister,
  type RasadyarEvidenceRelationshipReviewStatus,
  type RasadyarEvidenceTraceabilityRecord,
  type RasadyarHumanReviewDecision,
  type RasadyarHumanReviewRecord,
  type RasadyarHumanReviewSection,
  type RasadyarHumanReviewSectionKey,
  type RasadyarMachineAnalysisDraft,
  type RasadyarStructuredAssessment,
} from "../../core/rasadyar-data";

import {
  calculateStructuredCompleteness,
  createEmptyStructuredAssessment,
  normalizeStructuredAssessment,
  synchronizeStructuredAssessment,
} from "./structuredAnalysis";

import {
  generateEvidenceAnalysisDraft,
} from "./analysisDraftEngine";

import {
  HUMAN_REVIEW_SECTIONS,
  calculateHumanReviewProgress,
  canCompleteHumanReview,
  createHumanReviewRecord,
  getAnalystSectionValue,
  getMachineSectionValue,
  isMachineDraftStale,
  normalizeHumanReviewRecord,
  reviewDecisionLabel,
} from "./humanReview";

import {
  calculateAnalysisQuality,
  qualityLevelLabel,
  reviewReadinessLabel,
} from "./analysisQuality";

import {
  applyMachineCitationSuggestions,
  calculateTraceabilityCoverage,
  clearEvidenceTraceability,
  normalizeEvidenceTraceability,
  setEvidenceTraceabilityNote,
  toggleEvidenceTraceabilityLink,
} from "./evidenceTraceability";

import {
  appendCaseAuditEvent,
  auditEventLabel,
  qualityTrend,
  recordAnalysisRevision,
  revisionActionLabel,
} from "./analysisHistory";

import {
  evidenceRelationshipSummary,
  evidenceRelationshipTypeLabel,
  isEvidenceRelationshipScanStale,
  scanEvidenceRelationships,
  updateEvidenceRelationshipNote,
  updateEvidenceRelationshipReview,
} from "./evidenceRelationship";

import {
  calculateCaseReadiness,
  caseReadinessCheckStatusLabel,
  caseReadinessStatusLabel,
} from "./caseReadiness";

import {
  sourceKindDefaultDomain,
} from "./sourceIntake";

type AnalysisStatus = "draft" | "review" | "completed";

type EvidenceItem = AnalysisEvidence & {
  id: string;
};

type DraftEvidenceKind =
  | "map"
  | "manual"
  | "alert"
  | "news";

function normalizeDraftEvidenceKind(
  kind: EvidenceItem["kind"]
): DraftEvidenceKind {
  if (
    kind === "map" ||
    kind === "manual" ||
    kind === "alert" ||
    kind === "news"
  ) {
    return kind;
  }

  /*
   * The draft engine currently understands four generic evidence classes.
   * Preserve newer/specialized evidence (weather, etc.) by presenting it to
   * the draft engine as manual evidence instead of dropping it.
   */
  return "manual";
}

type AnalysisItem = {
  id: string;
  title: string;
  analysisType: string;
  region: string;
  timeRange: string;
  domain: string;
  description: string;
  findings: string;
  probability: string;
  impact: string;
  confidence: string;
  likelyScenario: string;
  worstScenario: string;
  bestScenario: string;
  recommendations: string;
  structuredAssessment: RasadyarStructuredAssessment;
  machineDraft?: RasadyarMachineAnalysisDraft;
  humanReview?: RasadyarHumanReviewRecord;
  qualityAssessment?: RasadyarAnalysisQualityAssessment;
  evidenceTraceability?: RasadyarEvidenceTraceabilityRecord;
  evidenceRelationshipRegister?: RasadyarEvidenceRelationshipRegister;
  readinessAssessment?: RasadyarCaseReadinessAssessment;
  revisionNumber?: number;
  revisionHistory?: RasadyarAnalysisRevision[];
  auditTrail?: RasadyarAuditEvent[];
  evidence: EvidenceItem[];
  status: AnalysisStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

function createId(prefix = "analysis") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyForm() {
  return {
    title: "",
    analysisType: "تهدید",
    region: "جهانی",
    timeRange: "7 روز",
    domain: "نظامی",
    description: "",
    findings: "",
    probability: "متوسط",
    impact: "متوسط",
    confidence: "متوسط",
    likelyScenario: "",
    worstScenario: "",
    bestScenario: "",
    recommendations: "",
    structuredAssessment: createEmptyStructuredAssessment(),
    machineDraft: undefined as RasadyarMachineAnalysisDraft | undefined,
    humanReview: undefined as RasadyarHumanReviewRecord | undefined,
    qualityAssessment: undefined as RasadyarAnalysisQualityAssessment | undefined,
    evidenceTraceability: undefined as RasadyarEvidenceTraceabilityRecord | undefined,
    evidenceRelationshipRegister: undefined as RasadyarEvidenceRelationshipRegister | undefined,
    evidence: [] as EvidenceItem[],
  };
}

function loadAnalyses(): AnalysisItem[] {
  const items =
    rasadyarDataService.analysisCases.load<AnalysisItem>();

  return items.map(
    (
      item
    ) => ({
      ...item,

      structuredAssessment:
        normalizeStructuredAssessment(
          item.structuredAssessment,
          {
            findings:
              item.findings || "",

            confidence:
              item.confidence || "متوسط",

            likelyScenario:
              item.likelyScenario || "",

            worstScenario:
              item.worstScenario || "",

            bestScenario:
              item.bestScenario || "",
          }
        ),

      machineDraft:
        item.machineDraft,

      humanReview:
        normalizeHumanReviewRecord(
          item.humanReview,
          item.machineDraft?.draftId
        ),

      qualityAssessment:
        item.qualityAssessment,

      evidenceRelationshipRegister:
        item.evidenceRelationshipRegister,

      evidenceTraceability:
        normalizeEvidenceTraceability(
          item.evidenceTraceability,
          (
            Array.isArray(
              item.evidence
            )
              ? item.evidence
              : []
          ).map(
            (
              evidenceItem
            ) =>
              evidenceItem.id
          ),
          item.createdBy ||
            "system",
          item.createdByName ||
            item.createdBy ||
            "system"
        ),

      evidence:
        Array.isArray(
          item.evidence
        )
          ? item.evidence
          : [],
    })
  );
}


function saveAnalyses(
  items:
    AnalysisItem[]
): boolean {
  return (
    rasadyarDataService.analysisCases.save(
      items
    ).ok
  );
}


function calculateRisk(probability: string, impact: string) {
  const values: Record<string, number> = {
    کم: 1,
    متوسط: 2,
    زیاد: 3,
    "بسیار زیاد": 4,
  };

  const score = (values[probability] || 1) * (values[impact] || 1);

  if (score >= 12) return "بحرانی";
  if (score >= 8) return "زیاد";
  if (score >= 4) return "متوسط";
  return "کم";
}

function statusLabel(status: AnalysisStatus) {
  if (status === "draft") return "پیش‌نویس";
  if (status === "review") return "در حال بررسی";
  return "تکمیل‌شده";
}

function evidenceKindLabel(kind: EvidenceItem["kind"]) {
  if (kind === "news") return "خبر";
  if (kind === "live-stream") return "پخش زنده";
  if (kind === "map") return "رویداد نقشه";
  if (kind === "alert") return "هشدار";
  if (kind === "infrastructure") return "زیرساخت";
  if (kind === "sanctions") return "تحریم";
  if (kind === "radiation") return "پرتویی";
  if (kind === "economic") return "اقتصادی";
  if (kind === "cyber") return "سایبری";
  if (kind === "aviation") return "هوانوردی";
  if (kind === "maritime") return "دریایی";
  if (kind === "weather") return "هواشناسی";
  return "شاهد دستی";
}


function archiveKindLabel(
  kind: EvidenceItem["archive"] extends infer T
    ? T extends { snapshotKind?: infer K }
      ? K
      : never
    : never
) {
  if (kind === "video-frame") {
    return "فریم واقعی ثبت‌شده";
  }

  if (kind === "youtube-thumbnail") {
    return "تصویر مرجع ویدئو";
  }

  if (kind === "metadata-card") {
    return "کارت آرشیوی منبع";
  }

  return "آرشیو شاهد";
}


function evidenceExists(
  evidence: EvidenceItem[],
  incoming: EvidenceItem
) {
  return evidence.some(
    (item) =>
      item.id === incoming.id ||
      (item.title === incoming.title &&
        item.source === incoming.source &&
        item.timestamp === incoming.timestamp)
  );
}

function addEvidenceToFormValue(
  current: ReturnType<typeof createEmptyForm>,
  incoming: EvidenceItem
) {
  if (evidenceExists(current.evidence, incoming)) {
    return current;
  }

  const next = {
    ...current,
    evidence: [incoming, ...current.evidence],
  };

  if (!current.title.trim()) {
    next.title = incoming.title;
  }

  if (incoming.country && current.region === "جهانی") {
    next.region = incoming.country;
  } else if (incoming.region && current.region === "جهانی") {
    next.region = incoming.region;
  }

  const routedDomain =
    sourceKindDefaultDomain(
      incoming.kind
    );

  if (
    current.domain ===
      "نظامی" &&
    routedDomain !==
      "عمومی"
  ) {
    next.domain =
      routedDomain;
  }

  if (
    !current.description.trim() &&
    (
      incoming.description ||
      incoming.summary
    )
  ) {
    next.description =
      incoming.description ||
      incoming.summary ||
      "";
  }

  return next;
}

function analysisToForm(item: AnalysisItem) {
  return {
    title: item.title,
    analysisType: item.analysisType,
    region: item.region,
    timeRange: item.timeRange,
    domain: item.domain,
    description: item.description,
    findings: item.findings,
    probability: item.probability,
    impact: item.impact,
    confidence: item.confidence,
    likelyScenario: item.likelyScenario,
    worstScenario: item.worstScenario,
    bestScenario: item.bestScenario,
    recommendations: item.recommendations,
    structuredAssessment:
      normalizeStructuredAssessment(
        item.structuredAssessment,
        {
          findings:
            item.findings || "",

          confidence:
            item.confidence || "متوسط",

          likelyScenario:
            item.likelyScenario || "",

          worstScenario:
            item.worstScenario || "",

          bestScenario:
            item.bestScenario || "",
        }
      ),
    machineDraft:
      item.machineDraft,
    humanReview:
      normalizeHumanReviewRecord(
        item.humanReview,
        item.machineDraft?.draftId
      ),
    qualityAssessment:
      item.qualityAssessment,
    evidenceRelationshipRegister:
      item.evidenceRelationshipRegister,
    evidenceTraceability:
      normalizeEvidenceTraceability(
        item.evidenceTraceability,
        (
          item.evidence ||
          []
        ).map(
          (
            evidenceItem
          ) =>
            evidenceItem.id
        ),
        item.createdBy ||
          "system",
        item.createdByName ||
          item.createdBy ||
          "system"
      ),
    evidence: item.evidence || [],
  };
}

export default function AnalysisCenter() {
  const auth = useAuth();
  const user = auth?.user;

  const isSuperAdmin = user?.role === "superadmin";
  const isAnalyst = user?.role === "analyst";

  const [analyses, setAnalyses] = useState<AnalysisItem[]>(() => loadAnalyses());
  const [form, setForm] = useState(createEmptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | AnalysisStatus>("all");
  const [message, setMessage] = useState("");

  const [isGeneratingDraft, setIsGeneratingDraft] =
    useState(false);

  const [draftPreview, setDraftPreview] =
    useState<RasadyarMachineAnalysisDraft | null>(null);

  const [showHumanReview, setShowHumanReview] =
    useState(false);

  /*
   * Evidence routing workflow:
   * incoming evidence is staged first. The analyst must explicitly choose
   * whether it creates a new analysis case or joins an existing case.
   */
  const [incomingEvidence, setIncomingEvidence] =
    useState<EvidenceItem | null>(null);

  const [evidenceRoute, setEvidenceRoute] =
    useState<"new" | "existing">("new");

  const [evidenceTargetId, setEvidenceTargetId] =
    useState("");

  /*
   * openAnalysisWithEvidence keeps a pending copy and also dispatches an event.
   * On a newly mounted AnalysisCenter both can arrive with the same evidence.
   * This set prevents the routing dialog from appearing twice.
   */
  const seenIncomingEvidenceIds = useRef<Set<string>>(new Set());

  const queueEvidence = (incoming: EvidenceItem) => {
    if (seenIncomingEvidenceIds.current.has(incoming.id)) {
      return;
    }

    seenIncomingEvidenceIds.current.add(incoming.id);
    setIncomingEvidence(incoming);
    setEvidenceRoute("new");
    setEvidenceTargetId("");
    setMessage("شاهد جدید دریافت شد؛ پرونده مقصد را مشخص کنید.");
  };

  useEffect(() => {
    const pending = consumePendingAnalysisEvidence();

    if (pending) {
      queueEvidence(pending as EvidenceItem);
    }

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<EvidenceItem>;

      if (customEvent.detail) {
        queueEvidence(customEvent.detail);
      }
    };

    window.addEventListener(ANALYSIS_EVIDENCE_EVENT, handler);

    return () => {
      window.removeEventListener(ANALYSIS_EVIDENCE_EVENT, handler);
    };
  }, []);

  const visibleAnalyses = useMemo(() => {
    if (!user) return [];

    let list = isSuperAdmin
      ? analyses
      : analyses.filter((item) => item.createdBy === user.username);

    if (tab !== "all") {
      list = list.filter((item) => item.status === tab);
    }

    return list;
  }, [analyses, isSuperAdmin, tab, user]);


  const eligibleEvidenceTargets = useMemo(() => {
    if (!user) return [];

    const accessible = isSuperAdmin
      ? analyses
      : analyses.filter((item) => item.createdBy === user.username);

    /*
     * پرونده تکمیل‌شده مبنای گزارش و سابقه تصمیم است و نباید با شاهد
     * جدید به‌صورت ضمنی تغییر کند. برای شاهد جدید فقط پرونده‌های باز
     * (پیش‌نویس / در حال بررسی) قابل انتخاب هستند.
     */
    return accessible.filter((item) => item.status !== "completed");
  }, [analyses, isSuperAdmin, user]);

  useEffect(() => {
    if (!incomingEvidence || evidenceRoute !== "existing") {
      return;
    }

    if (
      evidenceTargetId &&
      eligibleEvidenceTargets.some((item) => item.id === evidenceTargetId)
    ) {
      return;
    }

    if (
      editingId &&
      eligibleEvidenceTargets.some((item) => item.id === editingId)
    ) {
      setEvidenceTargetId(editingId);
      return;
    }

    setEvidenceTargetId(eligibleEvidenceTargets[0]?.id || "");
  }, [
    incomingEvidence,
    evidenceRoute,
    evidenceTargetId,
    eligibleEvidenceTargets,
    editingId,
  ]);

  if (!auth || !user) {
    return <div style={messageBoxStyle}>خطای احراز هویت</div>;
  }

  if (!isSuperAdmin && !isAnalyst) {
    return <div style={messageBoxStyle}>دسترسی به مرکز تحلیل مجاز نیست.</div>;
  }

  const changeField = (
    key: Exclude<
      keyof ReturnType<typeof createEmptyForm>,
      "evidence" | "structuredAssessment" | "machineDraft" | "humanReview" | "qualityAssessment" | "evidenceTraceability" | "evidenceRelationshipRegister"
    >,
    value: string
  ) => {
    const invalidatesHumanReview =
      key === "findings" ||
      key === "confidence" ||
      key === "likelyScenario" ||
      key === "worstScenario" ||
      key === "bestScenario";

    setForm(
      (
        current
      ) => ({
        ...current,

        [key]:
          value,

        humanReview:
          invalidatesHumanReview
            ? undefined
            : current.humanReview,
      })
    );
  };

  type AssessmentTextField =
    | "situationSummary"
    | "actorsFactors"
    | "drivers"
    | "warningIndicators"
    | "informationGaps"
    | "assumptions"
    | "implications"
    | "analyticalJudgment";

  const changeAssessmentField = (
    key:
      AssessmentTextField,
    value:
      string
  ) => {
    setForm(
      (
        current
      ) => ({
        ...current,

        structuredAssessment: {
          ...current.structuredAssessment,

          [key]:
            value,
        },

        humanReview:
          undefined,
      })
    );
  };

  const changeScenarioIndicator = (
    scenario:
      "likely" | "worst" | "best",
    value:
      string
  ) => {
    setForm(
      (
        current
      ) => ({
        ...current,

        structuredAssessment: {
          ...current.structuredAssessment,

          scenarios: {
            ...current.structuredAssessment.scenarios,

            [scenario]: {
              ...current.structuredAssessment.scenarios[
                scenario
              ],

              indicators:
                value,
            },
          },
        },

        humanReview:
          undefined,
      })
    );
  };

  const changeActionField = (
    key:
      keyof RasadyarStructuredAssessment["actions"],
    value:
      string
  ) => {
    setForm(
      (
        current
      ) => ({
        ...current,

        structuredAssessment: {
          ...current.structuredAssessment,

          actions: {
            ...current.structuredAssessment.actions,

            [key]:
              value,
          },
        },

        humanReview:
          undefined,
      })
    );
  };

  const generateMachineDraft = async () => {
    if (
      form.evidence.length ===
      0
    ) {
      setMessage(
        "برای تولید پیش‌نویس تحلیلی حداقل یک شاهد باید به پرونده متصل باشد."
      );

      return;
    }

    setIsGeneratingDraft(
      true
    );

    setMessage(
      "موتور تحلیل در حال بررسی شواهد پرونده است..."
    );

    try {
      const draft =
        await generateEvidenceAnalysisDraft(
          {
            caseTitle:
              form.title,

            description:
              form.description,

            region:
              form.region,

            domain:
              form.domain,

            confidence:
              form.confidence,

            evidence:
              form.evidence.map(
                (item) => ({
                  ...item,
                  kind:
                    normalizeDraftEvidenceKind(
                      item.kind
                    ),
                })
              ),
          }
        );

      setDraftPreview(
        draft
      );

      setForm(
        (
          current
        ) => ({
          ...current,

          machineDraft:
            draft,

          humanReview:
            undefined,
        })
      );

      setShowHumanReview(
        false
      );

      setMessage(
        draft.engineMode ===
          "browser-ml-hybrid"
          ? "پیش‌نویس تحلیلی با مدل محلی مرورگر و قواعد مبتنی بر شواهد تولید شد. قبل از اعمال، آن را بررسی کنید."
          : "پیش‌نویس تحلیلی محلی و مبتنی بر شواهد تولید شد. مدل ML مرورگر در دسترس نبود؛ قبل از اعمال، خروجی را بررسی کنید."
      );
    } catch (
      error
    ) {
      console.error(
        "[AnalysisCenter] Machine draft generation failed:",
        error
      );

      setMessage(
        "تولید پیش‌نویس تحلیلی انجام نشد."
      );
    } finally {
      setIsGeneratingDraft(
        false
      );
    }
  };


  const applyMachineDraft = (
    mode:
      "fill-empty"
      | "replace"
  ) => {
    const draft =
      draftPreview ||
      form.machineDraft;

    if (
      !draft
    ) {
      setMessage(
        "پیش‌نویس ماشینی برای اعمال وجود ندارد."
      );

      return;
    }

    if (
      mode ===
      "replace"
    ) {
      const confirmed =
        window.confirm(
          "ساختار تحلیلی فعلی با پیش‌نویس ماشینی جایگزین شود؟ فیلدهای ساختاریافته و سناریوهای فعلی بازنویسی خواهند شد."
        );

      if (
        !confirmed
      ) {
        return;
      }
    }

    setForm(
      (
        current
      ) => {
        const generated =
          draft.assessment;

        const fill = (
          existing:
            string,
          incoming:
            string
        ) =>
          mode ===
            "replace"
            ? incoming
            : (
                existing.trim()
                  ? existing
                  : incoming
              );

        const nextFindings =
          fill(
            current.findings,
            generated.keyPoints
          );

        const nextLikely =
          fill(
            current.likelyScenario,
            generated.scenarios.likely.narrative
          );

        const nextWorst =
          fill(
            current.worstScenario,
            generated.scenarios.worst.narrative
          );

        const nextBest =
          fill(
            current.bestScenario,
            generated.scenarios.best.narrative
          );

        const nextConfidence =
          mode ===
            "replace"
            ? generated.confidence
            : current.confidence;

        const currentStructured =
          current.structuredAssessment;

        const merged:
          RasadyarStructuredAssessment = {
          situationSummary:
            fill(
              currentStructured.situationSummary,
              generated.situationSummary
            ),

          keyPoints:
            nextFindings,

          actorsFactors:
            fill(
              currentStructured.actorsFactors,
              generated.actorsFactors
            ),

          drivers:
            fill(
              currentStructured.drivers,
              generated.drivers
            ),

          warningIndicators:
            fill(
              currentStructured.warningIndicators,
              generated.warningIndicators
            ),

          confidence:
            nextConfidence,

          informationGaps:
            fill(
              currentStructured.informationGaps,
              generated.informationGaps
            ),

          assumptions:
            fill(
              currentStructured.assumptions,
              generated.assumptions
            ),

          implications:
            fill(
              currentStructured.implications,
              generated.implications
            ),

          analyticalJudgment:
            fill(
              currentStructured.analyticalJudgment,
              generated.analyticalJudgment
            ),

          scenarios: {
            likely: {
              narrative:
                nextLikely,

              indicators:
                fill(
                  currentStructured.scenarios.likely.indicators,
                  generated.scenarios.likely.indicators
                ),
            },

            worst: {
              narrative:
                nextWorst,

              indicators:
                fill(
                  currentStructured.scenarios.worst.indicators,
                  generated.scenarios.worst.indicators
                ),
            },

            best: {
              narrative:
                nextBest,

              indicators:
                fill(
                  currentStructured.scenarios.best.indicators,
                  generated.scenarios.best.indicators
                ),
            },
          },

          actions: {
            immediate:
              fill(
                currentStructured.actions.immediate,
                generated.actions.immediate
              ),

            shortTerm:
              fill(
                currentStructured.actions.shortTerm,
                generated.actions.shortTerm
              ),

            mediumTerm:
              fill(
                currentStructured.actions.mediumTerm,
                generated.actions.mediumTerm
              ),

            monitoringRequirements:
              fill(
                currentStructured.actions.monitoringRequirements,
                generated.actions.monitoringRequirements
              ),
          },
        };

        return {
          ...current,

          findings:
            nextFindings,

          confidence:
            nextConfidence,

          likelyScenario:
            nextLikely,

          worstScenario:
            nextWorst,

          bestScenario:
            nextBest,

          structuredAssessment:
            synchronizeStructuredAssessment(
              merged,
              {
                findings:
                  nextFindings,

                confidence:
                  nextConfidence,

                likelyScenario:
                  nextLikely,

                worstScenario:
                  nextWorst,

                bestScenario:
                  nextBest,
              }
            ),

          machineDraft:
            draft,

          humanReview:
            undefined,
        };
      }
    );

    setMessage(
      mode ===
        "replace"
        ? "پیش‌نویس ماشینی روی ساختار تحلیل اعمال شد. تحلیلگر باید خروجی را بازبینی و سپس پرونده را ذخیره کند."
        : "پیش‌نویس ماشینی فقط در فیلدهای خالی اعمال شد. تحلیلگر باید خروجی را بازبینی و سپس پرونده را ذخیره کند."
    );
  };


  const currentMachineDraftIsStale =
    isMachineDraftStale(
      form.machineDraft,
      form.evidence.map(
        (
          item
        ) =>
          item.id
      )
    );


  const activeHistoryItem =
    editingId
      ? analyses.find(
          (
            item
          ) =>
            item.id ===
            editingId
        )
      : undefined;


  const currentRelationshipScanStale =
    isEvidenceRelationshipScanStale(
      form.evidenceRelationshipRegister,
      form.evidence.map(
        (
          item
        ) =>
          item.id
      )
    );


  const currentRelationshipSummary =
    evidenceRelationshipSummary(
      form.evidenceRelationshipRegister
    );


  const currentQualityAssessment =
    calculateAnalysisQuality(
      {
        analystConfidence:
          form.confidence,

        structuredAssessment:
          synchronizeStructuredAssessment(
            form.structuredAssessment,
            {
              findings:
                form.findings,

              confidence:
                form.confidence,

              likelyScenario:
                form.likelyScenario,

              worstScenario:
                form.worstScenario,

              bestScenario:
                form.bestScenario,
            }
          ),

        evidence:
          form.evidence,

        machineDraft:
          form.machineDraft,

        humanReview:
          form.humanReview,

        evidenceTraceability:
          form.evidenceTraceability,
      }
    );


  const currentReadinessAssessment =
    calculateCaseReadiness(
      {
        evidence:
          form.evidence,

        structuredAssessment:
          synchronizeStructuredAssessment(
            form.structuredAssessment,
            {
              findings:
                form.findings,

              confidence:
                form.confidence,

              likelyScenario:
                form.likelyScenario,

              worstScenario:
                form.worstScenario,

              bestScenario:
                form.bestScenario,
            }
          ),

        qualityAssessment:
          currentQualityAssessment,

        machineDraft:
          form.machineDraft,

        humanReview:
          form.humanReview,

        evidenceTraceability:
          form.evidenceTraceability,

        evidenceRelationshipRegister:
          form.evidenceRelationshipRegister,

        revisionNumber:
          activeHistoryItem?.revisionNumber,

        auditEventCount:
          activeHistoryItem?.auditTrail?.length ||
          0,
      }
    );


  const createOrGetHumanReview = (
    current:
      ReturnType<typeof createEmptyForm>
  ): RasadyarHumanReviewRecord | undefined => {
    if (
      !current.machineDraft
    ) {
      return undefined;
    }

    return (
      normalizeHumanReviewRecord(
        current.humanReview,
        current.machineDraft.draftId
      ) ||
      createHumanReviewRecord(
        current.machineDraft.draftId,
        user.username,
        user.name ||
          user.username
      )
    );
  };


  const setHumanReviewDecision = (
    sectionKey:
      RasadyarHumanReviewSectionKey,
    decision:
      RasadyarHumanReviewDecision
  ) => {
    setForm(
      (
        current
      ) => {
        const review =
          createOrGetHumanReview(
            current
          );

        if (
          !review
        ) {
          return current;
        }

        const now =
          new Date().toISOString();

        const previous =
          review.sections[
            sectionKey
          ];

        const section:
          RasadyarHumanReviewSection = {
          decision,

          note:
            previous?.note ||
            "",

          reviewedAt:
            now,

          reviewedBy:
            user.username,
        };

        return {
          ...current,

          humanReview: {
            ...review,

            status:
              "in-progress",

            completedAt:
              undefined,

            updatedAt:
              now,

            reviewedBy:
              user.username,

            reviewedByName:
              user.name ||
              user.username,

            sections: {
              ...review.sections,

              [sectionKey]:
                section,
            },
          },
        };
      }
    );

    setMessage(
      "تصمیم بازبینی ثبت شد؛ برای ثبت دائم، پرونده را ذخیره کنید."
    );
  };


  const setHumanReviewSectionNote = (
    sectionKey:
      RasadyarHumanReviewSectionKey,
    note:
      string
  ) => {
    setForm(
      (
        current
      ) => {
        const review =
          createOrGetHumanReview(
            current
          );

        if (
          !review
        ) {
          return current;
        }

        const now =
          new Date().toISOString();

        const previous =
          review.sections[
            sectionKey
          ];

        return {
          ...current,

          humanReview: {
            ...review,

            status:
              "in-progress",

            completedAt:
              undefined,

            updatedAt:
              now,

            reviewedBy:
              user.username,

            reviewedByName:
              user.name ||
              user.username,

            sections: {
              ...review.sections,

              [sectionKey]: {
                decision:
                  previous?.decision ||
                  "needs-review",

                note,

                reviewedAt:
                  now,

                reviewedBy:
                  user.username,
              },
            },
          },
        };
      }
    );
  };


  const setHumanReviewOverallNote = (
    value:
      string
  ) => {
    setForm(
      (
        current
      ) => {
        const review =
          createOrGetHumanReview(
            current
          );

        if (
          !review
        ) {
          return current;
        }

        return {
          ...current,

          humanReview: {
            ...review,

            overallNote:
              value,

            status:
              "in-progress",

            completedAt:
              undefined,

            updatedAt:
              new Date().toISOString(),

            reviewedBy:
              user.username,

            reviewedByName:
              user.name ||
              user.username,
          },
        };
      }
    );
  };


  const completeHumanReview = () => {
    if (
      !form.machineDraft
    ) {
      setMessage(
        "پیش‌نویس ماشینی برای بازبینی وجود ندارد."
      );

      return;
    }

    if (
      currentMachineDraftIsStale
    ) {
      setMessage(
        "ترکیب شواهد پرونده بعد از تولید پیش‌نویس تغییر کرده است. ابتدا پیش‌نویس ماشینی را دوباره تولید کنید."
      );

      return;
    }

    const review =
      createOrGetHumanReview(
        form
      );

    if (
      !review
    ) {
      return;
    }

    const progress =
      calculateHumanReviewProgress(
        review
      );

    if (
      !canCompleteHumanReview(
        review
      )
    ) {
      setForm(
        (
          current
        ) => ({
          ...current,

          humanReview:
            review,
        })
      );

      setMessage(
        `بازبینی هنوز کامل نیست؛ ${progress.unresolved} بخش باید تعیین تکلیف شود و گزینه «نیازمند بررسی بیشتر» نیز باید رفع شود.`
      );

      setShowHumanReview(
        true
      );

      return;
    }

    const now =
      new Date().toISOString();

    setForm(
      (
        current
      ) => ({
        ...current,

        humanReview: {
          ...review,

          status:
            "completed",

          reviewedBy:
            user.username,

          reviewedByName:
            user.name ||
            user.username,

          updatedAt:
            now,

          completedAt:
            now,
        },
      })
    );

    setMessage(
      "بازبینی انسانی تکمیل شد. برای ثبت دائم، پرونده را ذخیره یا برای بررسی ارسال کنید."
    );
  };


  const toggleTraceabilityEvidence = (
    sectionKey:
      RasadyarHumanReviewSectionKey,
    evidenceId:
      string,
    selected:
      boolean
  ) => {
    setForm(
      (
        current
      ) => ({
        ...current,

        evidenceTraceability:
          toggleEvidenceTraceabilityLink(
            current.evidenceTraceability,
            sectionKey,
            evidenceId,
            selected,
            current.evidence.map(
              (
                item
              ) =>
                item.id
            ),
            user.username,
            user.name ||
              user.username
          ),

        qualityAssessment:
          undefined,
      })
    );
  };


  const updateTraceabilityNote = (
    sectionKey:
      RasadyarHumanReviewSectionKey,
    note:
      string
  ) => {
    setForm(
      (
        current
      ) => ({
        ...current,

        evidenceTraceability:
          setEvidenceTraceabilityNote(
            current.evidenceTraceability,
            sectionKey,
            note,
            current.evidence.map(
              (
                item
              ) =>
                item.id
            ),
            user.username,
            user.name ||
              user.username
          ),

        qualityAssessment:
          undefined,
      })
    );
  };


  const applyMachineTraceabilitySuggestions = () => {
    if (
      !form.machineDraft
    ) {
      setMessage(
        "پیش‌نویس ماشینی برای پیشنهاد استناد وجود ندارد."
      );

      return;
    }

    if (
      !form.machineDraft.evidenceCitations
    ) {
      setMessage(
        "این پیش‌نویس پیشنهاد استناد بخشی ندارد؛ یک پیش‌نویس جدید تولید کنید."
      );

      return;
    }

    setForm(
      (
        current
      ) => ({
        ...current,

        evidenceTraceability:
          applyMachineCitationSuggestions(
            current.evidenceTraceability,
            current.machineDraft!,
            current.evidence.map(
              (
                item
              ) =>
                item.id
            ),
            user.username,
            user.name ||
              user.username
          ),

        qualityAssessment:
          undefined,
      })
    );

    setMessage(
      "پیشنهادهای استناد ماشینی فقط در بخش‌های فاقد استناد اعمال شد؛ تحلیلگر باید آنها را بررسی کند."
    );
  };


  const clearTraceabilityMatrix = () => {
    const confirmed =
      window.confirm(
        "همه پیوندهای استنادی این پرونده پاک شوند؟"
      );

    if (
      !confirmed
    ) {
      return;
    }

    setForm(
      (
        current
      ) => ({
        ...current,

        evidenceTraceability:
          clearEvidenceTraceability(
            user.username,
            user.name ||
              user.username
          ),

        qualityAssessment:
          undefined,
      })
    );

    setMessage(
      "ماتریس استناد پاک شد. برای ثبت دائم، پرونده را ذخیره کنید."
    );
  };


  const runEvidenceRelationshipScan = () => {
    if (
      form.evidence.length <
      2
    ) {
      setMessage(
        "برای اسکن تعارض و هم‌پوشانی حداقل دو شاهد لازم است."
      );

      return;
    }

    const register =
      scanEvidenceRelationships(
        form.evidence,
        form.evidenceRelationshipRegister
      );

    setForm(
      (
        current
      ) => ({
        ...current,

        evidenceRelationshipRegister:
          register,

        qualityAssessment:
          undefined,
      })
    );

    const summary =
      evidenceRelationshipSummary(
        register
      );

    setMessage(
      summary.total >
        0
        ? `اسکن محلی شواهد انجام شد؛ ${summary.total} الگوی نیازمند توجه شناسایی شد. یافته‌ها باید توسط تحلیلگر بازبینی شوند.`
        : "اسکن محلی انجام شد و الگوی برجسته‌ای برای بازبینی شناسایی نشد."
    );
  };


  const setRelationshipReviewStatus = (
    findingId:
      string,
    reviewStatus:
      RasadyarEvidenceRelationshipReviewStatus
  ) => {
    if (
      !form.evidenceRelationshipRegister
    ) {
      return;
    }

    setForm(
      (
        current
      ) => ({
        ...current,

        evidenceRelationshipRegister:
          current.evidenceRelationshipRegister
            ? updateEvidenceRelationshipReview(
                current.evidenceRelationshipRegister,
                findingId,
                reviewStatus,
                user.username
              )
            : undefined,

        qualityAssessment:
          undefined,
      })
    );

    setMessage(
      "وضعیت بازبینی یافته ثبت شد؛ برای ثبت دائم، پرونده را ذخیره کنید."
    );
  };


  const setRelationshipAnalystNote = (
    findingId:
      string,
    analystNote:
      string
  ) => {
    if (
      !form.evidenceRelationshipRegister
    ) {
      return;
    }

    setForm(
      (
        current
      ) => ({
        ...current,

        evidenceRelationshipRegister:
          current.evidenceRelationshipRegister
            ? updateEvidenceRelationshipNote(
                current.evidenceRelationshipRegister,
                findingId,
                analystNote,
                user.username
              )
            : undefined,

        qualityAssessment:
          undefined,
      })
    );
  };


  const persist = (items: AnalysisItem[]) => {
    const saved =
      saveAnalyses(
        items
      );

    if (
      !saved
    ) {
      setMessage(
        "ذخیره پرونده تحلیل انجام نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید."
      );

      return false;
    }

    setAnalyses(
      items
    );

    return true;
  };

  const resetForm = () => {
    setForm(createEmptyForm());
    setEditingId(null);
    setDraftPreview(null);
    setShowHumanReview(false);
    setMessage("");
  };

  const routeIncomingEvidence = () => {
    if (!incomingEvidence) {
      return;
    }

    if (evidenceRoute === "new") {
      const nextForm = addEvidenceToFormValue(
        createEmptyForm(),
        incomingEvidence
      );

      setForm(nextForm);
      setEditingId(null);
      setIncomingEvidence(null);
      setEvidenceTargetId("");
      setMessage(
        "پرونده تحلیل جدید با شاهد ورودی آماده شد. شرح مسئله را تکمیل و پرونده را ذخیره کنید."
      );
      return;
    }

    if (!evidenceTargetId) {
      setMessage("یک پرونده موجود را انتخاب کنید.");
      return;
    }

    const target = eligibleEvidenceTargets.find(
      (item) => item.id === evidenceTargetId
    );

    if (!target) {
      setMessage("پرونده انتخاب‌شده در دسترس نیست.");
      return;
    }

    if (evidenceExists(target.evidence || [], incomingEvidence)) {
      setIncomingEvidence(null);
      setEditingId(target.id);
      setForm(analysisToForm(target));
      setMessage("این شاهد قبلاً در پرونده انتخاب‌شده وجود دارد.");
      return;
    }

    const updatedTargetBase: AnalysisItem = {
      ...target,

      evidence: [
        incomingEvidence,
        ...(target.evidence || []),
      ],

      /*
       * Evidence changed; previous Human Review no longer applies.
       * Machine Draft remains historical and may become stale.
       */
      humanReview:
        undefined,

      qualityAssessment:
        undefined,

      updatedAt:
        new Date().toISOString(),
    };

    const revisionResult =
      recordAnalysisRevision(
        updatedTargetBase,
        target,
        "evidence-added",
        {
          username:
            user.username,

          name:
            user.name ||
            user.username,
        }
      );

    const updatedTarget: AnalysisItem = {
      ...updatedTargetBase,

      revisionNumber:
        revisionResult.revisionNumber,

      revisionHistory:
        revisionResult.revisionHistory,

      auditTrail:
        revisionResult.auditTrail,
    };

    const updatedAnalyses = analyses.map((item) =>
      item.id === target.id ? updatedTarget : item
    );

    persist(updatedAnalyses);

    setIncomingEvidence(null);
    setEvidenceTargetId("");
    setEditingId(updatedTarget.id);
    setForm(analysisToForm(updatedTarget));
    setMessage("شاهد به پرونده موجود اضافه شد و پرونده برای ادامه تحلیل باز شد.");
  };

  const discardIncomingEvidence = () => {
    setIncomingEvidence(null);
    setEvidenceTargetId("");
    setEvidenceRoute("new");
    setMessage("افزودن شاهد لغو شد.");
  };

  const removeEvidence = (id: string) => {
    setForm(
      (
        current
      ) => {
        const nextEvidence =
          current.evidence.filter(
            (
              item
            ) =>
              item.id !==
              id
          );

        return {
          ...current,

          evidence:
            nextEvidence,

          humanReview:
            undefined,

          evidenceTraceability:
            normalizeEvidenceTraceability(
              current.evidenceTraceability,
              nextEvidence.map(
                (
                  item
                ) =>
                  item.id
              ),
              user.username,
              user.name ||
                user.username
            ),

          qualityAssessment:
            undefined,
        };
      }
    );

    setShowHumanReview(
      false
    );
  };

  const saveAnalysis = (status: AnalysisStatus) => {
    setMessage("");

    if (!form.title.trim()) {
      setMessage("عنوان تحلیل را وارد کنید.");
      return;
    }

    if (!form.description.trim()) {
      setMessage("شرح مسئله را وارد کنید.");
      return;
    }

    /*
     * P4-Step1.2:
     * ارسال برای «بررسی» باید مرحله‌ای برای تکمیل و کنترل کیفیت باشد،
     * نه مرحله‌ای که فقط پرونده تقریباً کامل اجازه ورود به آن را داشته باشد.
     *
     * بنابراین Readiness / Human Review / Machine Draft در این مرحله
     * advisory هستند و فقط در داشبورد نمایش داده می‌شوند.
     *
     * تنها شرط محتوایی افزوده برای ارسال به بررسی:
     * پرونده حداقل یک شاهد داشته باشد.
     */
    if (
      status ===
        "review" &&
      form.evidence.length ===
        0
    ) {
      setMessage(
        "برای ارسال پرونده به بررسی، حداقل یک شاهد لازم است."
      );

      return;
    }

    const synchronizedAssessment =
      synchronizeStructuredAssessment(
        form.structuredAssessment,
        {
          findings:
            form.findings,

          confidence:
            form.confidence,

          likelyScenario:
            form.likelyScenario,

          worstScenario:
            form.worstScenario,

          bestScenario:
            form.bestScenario,
        }
      );

    const normalizedTraceability =
      normalizeEvidenceTraceability(
        form.evidenceTraceability,
        form.evidence.map(
          (
            item
          ) =>
            item.id
        ),
        user.username,
        user.name ||
          user.username
      );

    const qualityAssessment =
      calculateAnalysisQuality(
        {
          analystConfidence:
            form.confidence,

          structuredAssessment:
            synchronizedAssessment,

          evidence:
            form.evidence,

          machineDraft:
            form.machineDraft,

          humanReview:
            form.humanReview,

          evidenceTraceability:
            normalizedTraceability,
        }
      );

    const readinessAssessment =
      calculateCaseReadiness(
        {
          evidence:
            form.evidence,

          structuredAssessment:
            synchronizedAssessment,

          qualityAssessment,

          machineDraft:
            form.machineDraft,

          humanReview:
            form.humanReview,

          evidenceTraceability:
            normalizedTraceability,

          evidenceRelationshipRegister:
            form.evidenceRelationshipRegister,

          revisionNumber:
            activeHistoryItem?.revisionNumber,

          auditEventCount:
            activeHistoryItem?.auditTrail?.length ||
            0,
        }
      );

    const synchronizedForm = {
      ...form,

      structuredAssessment:
        synchronizedAssessment,

      evidenceTraceability:
        normalizedTraceability,

      qualityAssessment,

      readinessAssessment,
    };

    const now = new Date().toISOString();

    if (editingId) {
      const existing = analyses.find((item) => item.id === editingId);

      if (!existing) {
        setMessage("تحلیل موردنظر یافت نشد.");
        return;
      }

      if (!isSuperAdmin && existing.createdBy !== user.username) {
        setMessage("اجازه ویرایش این تحلیل را ندارید.");
        return;
      }

      const updatedCaseBase: AnalysisItem = {
        ...existing,
        ...synchronizedForm,
        status,
        updatedAt:
          now,
      };

      const revisionResult =
        recordAnalysisRevision(
          updatedCaseBase,
          existing,
          status ===
            "review"
            ? "sent-review"
            : "draft-saved",
          {
            username:
              user.username,

            name:
              user.name ||
              user.username,
          }
        );

      const finalReadiness =
        calculateCaseReadiness(
          {
            evidence:
              updatedCaseBase.evidence,

            structuredAssessment:
              updatedCaseBase.structuredAssessment,

            qualityAssessment:
              updatedCaseBase.qualityAssessment!,

            machineDraft:
              updatedCaseBase.machineDraft,

            humanReview:
              updatedCaseBase.humanReview,

            evidenceTraceability:
              updatedCaseBase.evidenceTraceability,

            evidenceRelationshipRegister:
              updatedCaseBase.evidenceRelationshipRegister,

            revisionNumber:
              revisionResult.revisionNumber,

            auditEventCount:
              revisionResult.auditTrail.length,
          }
        );

      const updatedCase: AnalysisItem = {
        ...updatedCaseBase,

        readinessAssessment:
          finalReadiness,

        revisionNumber:
          revisionResult.revisionNumber,

        revisionHistory:
          revisionResult.revisionHistory,

        auditTrail:
          revisionResult.auditTrail,
      };

      const updated = analyses.map((item) =>
        item.id === editingId
          ? updatedCase
          : item
      );

      persist(updated);
      setForm(synchronizedForm);

      setMessage(
        status === "review"
          ? finalReadiness.readyForFinalReview
            ? "تحلیل برای بررسی ارسال شد؛ پرونده از نظر شاخص‌های آمادگی نیز در وضعیت مناسب قرار دارد."
            : `تحلیل برای بررسی ارسال شد؛ امتیاز آمادگی فعلی ${finalReadiness.score}/100 است. موارد تکمیلی صرفاً به‌صورت راهنما در داشبورد آمادگی نمایش داده می‌شوند.`
          : "تغییرات تحلیل ذخیره شد."
      );

      return;
    }

    const analysisBase: AnalysisItem = {
      id: createId(),
      ...synchronizedForm,
      status,
      createdBy: user.username,
      createdByName: user.name || user.username,
      createdAt: now,
      updatedAt: now,
    };

    const revisionResult =
      recordAnalysisRevision(
        analysisBase,
        undefined,
        "created",
        {
          username:
            user.username,

          name:
            user.name ||
            user.username,
        }
      );

    const finalReadiness =
      calculateCaseReadiness(
        {
          evidence:
            analysisBase.evidence,

          structuredAssessment:
            analysisBase.structuredAssessment,

          qualityAssessment:
            analysisBase.qualityAssessment!,

          machineDraft:
            analysisBase.machineDraft,

          humanReview:
            analysisBase.humanReview,

          evidenceTraceability:
            analysisBase.evidenceTraceability,

          evidenceRelationshipRegister:
            analysisBase.evidenceRelationshipRegister,

          revisionNumber:
            revisionResult.revisionNumber,

          auditEventCount:
            revisionResult.auditTrail.length,
        }
      );

    const analysis: AnalysisItem = {
      ...analysisBase,

      readinessAssessment:
        finalReadiness,

      revisionNumber:
        revisionResult.revisionNumber,

      revisionHistory:
        revisionResult.revisionHistory,

      auditTrail:
        revisionResult.auditTrail,
    };

    persist([analysis, ...analyses]);
    setEditingId(analysis.id);
    setForm(synchronizedForm);

    setMessage(
      status === "review"
        ? finalReadiness.readyForFinalReview
          ? "تحلیل برای بررسی ارسال شد؛ پرونده از نظر شاخص‌های آمادگی نیز در وضعیت مناسب قرار دارد."
          : `تحلیل برای بررسی ارسال شد؛ امتیاز آمادگی فعلی ${finalReadiness.score}/100 است. موارد تکمیلی صرفاً به‌صورت راهنما در داشبورد آمادگی نمایش داده می‌شوند.`
        : "پیش‌نویس تحلیل ذخیره شد."
    );
  };

  const editAnalysis = (item: AnalysisItem) => {
    if (!isSuperAdmin && item.createdBy !== user.username) return;

    setEditingId(item.id);
    setForm(analysisToForm(item));
    setDraftPreview(null);
    setShowHumanReview(false);

    setMessage("تحلیل برای ویرایش باز شد.");
  };

  const deleteAnalysis = (item: AnalysisItem) => {
    if (!isSuperAdmin && item.createdBy !== user.username) return;

    const confirmed = window.confirm(`تحلیل «${item.title}» حذف شود؟`);
    if (!confirmed) return;

    persist(analyses.filter((analysis) => analysis.id !== item.id));

    if (editingId === item.id) {
      resetForm();
    }

    setMessage("تحلیل حذف شد.");
  };

  const approveAnalysis = (item: AnalysisItem) => {
    if (!isSuperAdmin) return;

    const approvedBase: AnalysisItem = {
      ...item,

      status:
        "completed" as AnalysisStatus,

      updatedAt:
        new Date().toISOString(),
    };

    const revisionResult =
      recordAnalysisRevision(
        approvedBase,
        item,
        "approved",
        {
          username:
            user.username,

          name:
            user.name ||
            user.username,
        }
      );

    const approvedReadiness =
      approvedBase.qualityAssessment
        ? calculateCaseReadiness(
            {
              evidence:
                approvedBase.evidence,

              structuredAssessment:
                approvedBase.structuredAssessment,

              qualityAssessment:
                approvedBase.qualityAssessment,

              machineDraft:
                approvedBase.machineDraft,

              humanReview:
                approvedBase.humanReview,

              evidenceTraceability:
                approvedBase.evidenceTraceability,

              evidenceRelationshipRegister:
                approvedBase.evidenceRelationshipRegister,

              revisionNumber:
                revisionResult.revisionNumber,

              auditEventCount:
                revisionResult.auditTrail.length,
            }
          )
        : approvedBase.readinessAssessment;

    const approved: AnalysisItem = {
      ...approvedBase,

      readinessAssessment:
        approvedReadiness,

      revisionNumber:
        revisionResult.revisionNumber,

      revisionHistory:
        revisionResult.revisionHistory,

      auditTrail:
        revisionResult.auditTrail,
    };

    const updated = analyses.map((analysis) =>
      analysis.id === item.id
        ? approved
        : analysis
    );

    persist(updated);
    setMessage("تحلیل تأیید و تکمیل شد.");
  };

  const convertToReport = (item: AnalysisItem) => {
  if (!isSuperAdmin) return;

  try {
    const reports =
      rasadyarDataService.reports.load<any>();

    /*
     * جلوگیری از ساخت گزارش تکراری
     */
    const exists = reports.some(
      (report: any) =>
        report.analysisId === item.id ||
        report.sourceAnalysisId === item.id
    );

    if (exists) {
      setMessage(
        "برای این تحلیل قبلاً گزارش ساخته شده است."
      );
      return;
    }

    /*
     * تبدیل مقادیر مختلف به متن
     */
    const toText = (
      value: unknown
    ): string => {
      if (!value) return "";

      if (typeof value === "string") {
        return value;
      }

      if (Array.isArray(value)) {
        return value
          .map((entry) =>
            typeof entry === "string"
              ? entry
              : JSON.stringify(entry)
          )
          .join("\n");
      }

      if (typeof value === "object") {
        try {
          return JSON.stringify(
            value,
            null,
            2
          );
        } catch {
          return "";
        }
      }

      return String(value);
    };

    const description =
      toText(item.description);

    const findings =
      toText(item.findings);

    const recommendations =
      toText(item.recommendations);

    /*
     * ساخت متن اولیه گزارش
     */
    const contentParts: string[] = [];

    if (description) {
      contentParts.push(
        `شرح و زمینه تحلیل\n${description}`
      );
    }

    if (findings) {
      contentParts.push(
        `یافته‌های کلیدی\n${findings}`
      );
    }

    if (recommendations) {
      contentParts.push(
        `پیشنهادها و اقدامات\n${recommendations}`
      );
    }

    const now =
      new Date().toISOString();

    const structuredAssessment =
      synchronizeStructuredAssessment(
        item.structuredAssessment ||
          createEmptyStructuredAssessment(),
        {
          findings:
            item.findings,

          confidence:
            item.confidence,

          likelyScenario:
            item.likelyScenario,

          worstScenario:
            item.worstScenario,

          bestScenario:
            item.bestScenario,
        }
      );

    const qualityAssessment =
      calculateAnalysisQuality(
        {
          analystConfidence:
            item.confidence,

          structuredAssessment,

          evidence:
            Array.isArray(
              item.evidence
            )
              ? item.evidence
              : [],

          machineDraft:
            item.machineDraft,

          humanReview:
            item.humanReview,

          evidenceTraceability:
            item.evidenceTraceability,
        }
      );

    const readinessAssessment =
      calculateCaseReadiness(
        {
          evidence:
            Array.isArray(
              item.evidence
            )
              ? item.evidence
              : [],

          structuredAssessment,

          qualityAssessment,

          machineDraft:
            item.machineDraft,

          humanReview:
            item.humanReview,

          evidenceTraceability:
            item.evidenceTraceability,

          evidenceRelationshipRegister:
            item.evidenceRelationshipRegister,

          revisionNumber:
            item.revisionNumber,

          auditEventCount:
            item.auditTrail?.length ||
            0,
        }
      );

    const evidenceSnapshot =
      JSON.parse(
        JSON.stringify(
          Array.isArray(
            item.evidence
          )
            ? item.evidence
            : []
        )
      );

    /*
     * ساخت گزارش سازگار با ReportCenter
     */
    const report = {
      id: createId("report"),

      title: item.title,

      summary:
        structuredAssessment.situationSummary ||
        description,

      content:
        contentParts.join(
          "\n\n"
        ),

      status: "draft",

      /*
       * اتصال گزارش به تحلیل مبنا
       */
      analysisId: item.id,

      sourceAnalysisId: item.id,

      sourceAnalysisTitle:
        item.title,

      sourceAnalysisSnapshot: {
        id:
          item.id,

        title:
          item.title,

        analysisType:
          item.analysisType,

        region:
          item.region,

        timeRange:
          item.timeRange,

        domain:
          item.domain,

        description:
          item.description,

        findings:
          item.findings,

        probability:
          item.probability,

        impact:
          item.impact,

        confidence:
          item.confidence,

        riskLevel:
          calculateRisk(
            item.probability,
            item.impact
          ),

        likelyScenario:
          item.likelyScenario,

        worstScenario:
          item.worstScenario,

        bestScenario:
          item.bestScenario,

        recommendations:
          item.recommendations,

        structuredAssessment,

        machineDraft:
          item.machineDraft
            ? JSON.parse(
                JSON.stringify(
                  item.machineDraft
                )
              )
            : undefined,

        humanReview:
          item.humanReview
            ? JSON.parse(
                JSON.stringify(
                  item.humanReview
                )
              )
            : undefined,

        qualityAssessment:
          JSON.parse(
            JSON.stringify(
              qualityAssessment
            )
          ),

        evidenceTraceability:
          item.evidenceTraceability
            ? JSON.parse(
                JSON.stringify(
                  item.evidenceTraceability
                )
              )
            : undefined,

        evidenceRelationshipRegister:
          item.evidenceRelationshipRegister
            ? JSON.parse(
                JSON.stringify(
                  item.evidenceRelationshipRegister
                )
              )
            : undefined,

        readinessAssessment:
          JSON.parse(
            JSON.stringify(
              readinessAssessment
            )
          ),

        revisionNumber:
          item.revisionNumber,

        revisionHistory:
          item.revisionHistory
            ? JSON.parse(
                JSON.stringify(
                  item.revisionHistory
                )
              )
            : undefined,

        auditTrail:
          item.auditTrail
            ? JSON.parse(
                JSON.stringify(
                  item.auditTrail
                )
              )
            : undefined,

        status:
          item.status,

        createdBy:
          item.createdBy,

        createdByName:
          item.createdByName,

        createdAt:
          item.createdAt,

        updatedAt:
          item.updatedAt,

        snapshotAt:
          now,
      },

      /*
       * انتقال شواهد
       */
      evidence:
        evidenceSnapshot,

      evidenceSnapshotAt:
        now,

      createdFromAnalysisAt:
        now,

      createdAt: now,

      updatedAt: now,

      publishedAt:
        undefined,

      /*
       * این فیلدها را نیز برای
       * سازگاری و توسعه بعدی نگه می‌داریم.
       */
      findings:
        item.findings,

      recommendations:
        item.recommendations,
    };

    /*
     * ذخیره در مرکز گزارش‌ها
     */
    const updatedReports = [
      report,
      ...reports,
    ];

    const reportSaved =
      rasadyarDataService.reports.save(
        updatedReports
      );

    if (
      !reportSaved.ok
    ) {
      setMessage(
        "ذخیره گزارش انجام نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید."
      );

      return;
    }

    const auditUpdate =
      appendCaseAuditEvent(
        item,
        "report-created",
        {
          username:
            user.username,

          name:
            user.name ||
            user.username,
        },
        "گزارش پیش‌نویس از پرونده تحلیل ایجاد شد.",
        {
          reportId:
            report.id,

          reportStatus:
            report.status,
        }
      );

    const analysesWithAudit =
      analyses.map(
        (
          analysisItem
        ) =>
          analysisItem.id ===
            item.id
            ? {
                ...analysisItem,

                auditTrail:
                  auditUpdate.auditTrail,
              }
            : analysisItem
      );

    persist(
      analysesWithAudit
    );

    setMessage(
      "گزارش پیش‌نویس از تحلیل ایجاد شد."
    );

    /*
     * باز کردن مرکز گزارش‌ها
     */
    window.dispatchEvent(
      new CustomEvent(
        "rasadyar:open-report-center"
      )
    );
  } catch (error) {
    console.error(
      "Convert analysis to report failed:",
      error
    );

    setMessage(
      "خطا در تبدیل تحلیل به گزارش."
    );
  }
};

  return (
    <div dir="rtl" style={containerStyle}>
      {/* Sticky toolbar. Outer panel already shows the title "مرکز تحلیل". */}
      <div style={stickyToolbarStyle}>
        <div>
          <strong>محیط پرونده‌های تحلیل راهبردی</strong>
          <div style={subTitleStyle}>
            مدیریت پرونده، شواهد، ارزیابی ریسک، سناریو و پیشنهاد اقدام
          </div>
        </div>

        <button onClick={resetForm} style={greenButton}>
          + پرونده جدید
        </button>
      </div>

      <div style={tabsStyle}>
        <Tab active={tab === "all"} onClick={() => setTab("all")}>
          همه
        </Tab>

        <Tab active={tab === "draft"} onClick={() => setTab("draft")}>
          پیش‌نویس
        </Tab>

        <Tab active={tab === "review"} onClick={() => setTab("review")}>
          در حال بررسی
        </Tab>

        <Tab active={tab === "completed"} onClick={() => setTab("completed")}>
          تکمیل‌شده
        </Tab>
      </div>

      {message && <div style={noticeStyle}>{message}</div>}

      {incomingEvidence && (
        <div style={evidenceRoutingPanelStyle}>
          <div style={evidenceRoutingHeaderStyle}>
            <div>
              <div style={evidenceRoutingEyebrowStyle}>شاهد ورودی جدید</div>
              <strong style={evidenceRoutingTitleStyle}>
                {incomingEvidence.title}
              </strong>

              <div style={metaStyle}>
                {evidenceKindLabel(incomingEvidence.kind)}
                {incomingEvidence.source
                  ? ` | ${incomingEvidence.source}`
                  : ""}
                {incomingEvidence.timestamp
                  ? ` | ${new Date(incomingEvidence.timestamp).toLocaleString(
                      "fa-IR"
                    )}`
                  : ""}
              </div>
            </div>

            <span style={evidenceRoutingBadgeStyle}>
              انتخاب پرونده مقصد
            </span>
          </div>

          {incomingEvidence.summary && (
            <div style={evidenceRoutingSummaryStyle}>
              {incomingEvidence.summary}
            </div>
          )}

          <div style={evidenceRouteOptionsStyle}>
            <button
              type="button"
              onClick={() => setEvidenceRoute("new")}
              style={evidenceRouteOptionStyle(evidenceRoute === "new")}
            >
              <strong>ایجاد پرونده تحلیل جدید</strong>
              <span style={evidenceRouteOptionHintStyle}>
                یک پرونده تازه با همین شاهد ایجاد می‌شود و اطلاعات اولیه به‌صورت
                خودکار تکمیل خواهد شد.
              </span>
            </button>

            <button
              type="button"
              disabled={eligibleEvidenceTargets.length === 0}
              onClick={() => setEvidenceRoute("existing")}
              style={evidenceRouteOptionStyle(
                evidenceRoute === "existing",
                eligibleEvidenceTargets.length === 0
              )}
            >
              <strong>افزودن به پرونده موجود</strong>
              <span style={evidenceRouteOptionHintStyle}>
                شاهد به یکی از پرونده‌های قابل دسترس شما اضافه می‌شود.
              </span>
            </button>
          </div>

          {evidenceRoute === "existing" && (
            <Field label="پرونده مقصد">
              <select
                style={inputStyle}
                value={evidenceTargetId}
                onChange={(event) => setEvidenceTargetId(event.target.value)}
              >
                {eligibleEvidenceTargets.length === 0 ? (
                  <option value="">پرونده‌ای برای انتخاب وجود ندارد</option>
                ) : (
                  eligibleEvidenceTargets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} — {statusLabel(item.status)}
                    </option>
                  ))
                )}
              </select>
            </Field>
          )}

          <div style={evidenceRoutingActionsStyle}>
            <button
              type="button"
              style={greenButton}
              onClick={routeIncomingEvidence}
              disabled={
                evidenceRoute === "existing" &&
                (!evidenceTargetId || eligibleEvidenceTargets.length === 0)
              }
            >
              {evidenceRoute === "new"
                ? "ساخت پرونده و افزودن شاهد"
                : "افزودن شاهد به پرونده"}
            </button>

            <button
              type="button"
              style={grayButton}
              onClick={discardIncomingEvidence}
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      <div style={panelStyle}>
        <h3 style={sectionTitleStyle}>
          {editingId ? "ویرایش پرونده تحلیل" : "پرونده تحلیل جدید"}
        </h3>

        <div style={responsiveGrid}>
         <Field label="عنوان تحلیل">
  <input
    dir="auto"
    style={inputStyle}
    value={form.title}
    onChange={(e) =>
      changeField("title", e.target.value)
    }
    placeholder="عنوان تحلیل..."
  />
</Field>

          <Field label="نوع تحلیل">
            <select
              style={inputStyle}
              value={form.analysisType}
              onChange={(e) => changeField("analysisType", e.target.value)}
            >
              <option>تهدید</option>
              <option>بحران</option>
              <option>کشور</option>
              <option>زیرساخت</option>
              <option>روند</option>
              <option>سناریو</option>
            </select>
          </Field>

          <Field label="منطقه / کشور">
            <input
              style={inputStyle}
              value={form.region}
              onChange={(e) => changeField("region", e.target.value)}
              placeholder="جهانی / منطقه / کشور"
            />
          </Field>

          <Field label="بازه زمانی">
            <select
              style={inputStyle}
              value={form.timeRange}
              onChange={(e) => changeField("timeRange", e.target.value)}
            >
              <option>24 ساعت</option>
              <option>7 روز</option>
              <option>30 روز</option>
              <option>90 روز</option>
            </select>
          </Field>

          <Field label="حوزه">
            <select
              style={inputStyle}
              value={form.domain}
              onChange={(e) => changeField("domain", e.target.value)}
            >
              <option>نظامی</option>
              <option>سایبری</option>
              <option>اقتصادی</option>
              <option>انرژی</option>
              <option>زیرساخت</option>
              <option>حمل‌ونقل</option>
              <option>پرتویی</option>
              <option>زیستی</option>
              <option>اجتماعی</option>
              <option>طبیعی</option>
            </select>
          </Field>

          <Field label="اطمینان تحلیلگر">
            <select
              style={inputStyle}
              value={form.confidence}
              onChange={(e) => changeField("confidence", e.target.value)}
            >
              <option>کم</option>
              <option>متوسط</option>
              <option>زیاد</option>
              <option>بسیار زیاد</option>
            </select>
          </Field>
        </div>

        <Field label="شرح مسئله">
          <textarea
            style={textareaStyle}
            value={form.description}
            onChange={(e) => changeField("description", e.target.value)}
            placeholder="وضعیت موجود، بازیگران، محرک‌ها و مسئله اصلی..."
          />
        </Field>

        <Field label="یافته‌های کلیدی">
          <textarea
            style={textareaStyle}
            value={form.findings}
            onChange={(e) => changeField("findings", e.target.value)}
            placeholder="هر یافته کلیدی را در یک خط بنویسید..."
          />
        </Field>

        <section style={structuredSectionStyle}>
          <div style={structuredSectionHeaderStyle}>
            <div>
              <div style={structuredEyebrowStyle}>
                P3 / Structured Analysis
              </div>

              <h3 style={structuredTitleStyle}>
                ارزیابی تحلیلی ساختاریافته
              </h3>

              <div style={structuredHintStyle}>
                یافته‌های کلیدی و سطح اطمینان از فیلدهای موجود پرونده
                به‌صورت خودکار در مدل ساختاریافته همگام می‌شوند.
              </div>
            </div>

            <div style={structuredHeaderActionsStyle}>
              <span style={completenessBadgeStyle}>
                تکمیل ساختار:{" "}
                {calculateStructuredCompleteness(
                  synchronizeStructuredAssessment(
                    form.structuredAssessment,
                    {
                      findings: form.findings,
                      confidence: form.confidence,
                      likelyScenario: form.likelyScenario,
                      worstScenario: form.worstScenario,
                      bestScenario: form.bestScenario,
                    }
                  )
                )}
                %
              </span>

              <button
                type="button"
                style={machineDraftButtonStyle}
                disabled={
                  isGeneratingDraft ||
                  form.evidence.length === 0
                }
                onClick={() => {
                  void generateMachineDraft();
                }}
              >
                {isGeneratingDraft
                  ? "در حال تحلیل..."
                  : "تولید پیش‌نویس از شواهد"}
              </button>

              {form.machineDraft && !draftPreview && (
                <button
                  type="button"
                  style={machineDraftSecondaryButtonStyle}
                  onClick={() =>
                    setDraftPreview(
                      form.machineDraft || null
                    )
                  }
                >
                  نمایش آخرین پیش‌نویس
                </button>
              )}

              {form.machineDraft && (
                <>
                  <button
                    type="button"
                    style={humanReviewButtonStyle}
                    onClick={() =>
                      setShowHumanReview(
                        (
                          current
                        ) =>
                          !current
                      )
                    }
                  >
                    {showHumanReview
                      ? "بستن مقایسه ماشین / تحلیلگر"
                      : "مقایسه ماشین / تحلیلگر"}
                  </button>

                  <span
                    style={
                      form.humanReview?.status === "completed"
                        ? humanReviewCompletedBadgeStyle
                        : humanReviewProgressBadgeStyle
                    }
                  >
                    {form.humanReview?.status === "completed"
                      ? "بازبینی انسانی: تکمیل"
                      : `بازبینی انسانی: ${
                          calculateHumanReviewProgress(
                            normalizeHumanReviewRecord(
                              form.humanReview,
                              form.machineDraft!.draftId
                            )
                          ).resolved
                        }/${HUMAN_REVIEW_SECTIONS.length}`}
                  </span>
                </>
              )}
            </div>
          </div>

          {form.evidence.length === 0 && (
            <div style={machineDraftEmptyHintStyle}>
              برای فعال‌شدن موتور پیش‌نویس، ابتدا حداقل یک شاهد به پرونده متصل کنید.
            </div>
          )}

          {draftPreview && (
            <div style={machinePreviewStyle}>
              <div style={machinePreviewHeaderStyle}>
                <div>
                  <div style={machinePreviewEyebrowStyle}>
                    پیش‌نویس ماشینی — برای تصمیم نهایی معتبر نیست
                  </div>

                  <strong style={machinePreviewTitleStyle}>
                    پیش‌نمایش تحلیل تولیدشده از شواهد
                  </strong>

                  <div style={machinePreviewMetaStyle}>
                    موتور: {draftPreview.engineVersion}
                    {" | "}
                    حالت:{" "}
                    {draftPreview.engineMode === "browser-ml-hybrid"
                      ? "ML محلی مرورگر + قواعد تحلیلی"
                      : "قواعد محلی مبتنی بر شواهد"}
                    {" | "}
                    شواهد: {draftPreview.evidenceIds.length}
                    {" | "}
                    زمان:{" "}
                    {new Date(
                      draftPreview.generatedAt
                    ).toLocaleString("fa-IR")}
                  </div>
                </div>

                <span style={machinePreviewBadgeStyle}>
                  نیازمند تأیید تحلیلگر
                </span>
              </div>

              {draftPreview.note && (
                <div style={machinePreviewNoteStyle}>
                  {draftPreview.note}
                </div>
              )}

              <div style={machinePreviewGridStyle}>
                <MachinePreviewField
                  label="خلاصه وضعیت"
                  value={draftPreview.assessment.situationSummary}
                />

                <MachinePreviewField
                  label="بازیگران / عوامل"
                  value={draftPreview.assessment.actorsFactors}
                />

                <MachinePreviewField
                  label="محرک‌ها"
                  value={draftPreview.assessment.drivers}
                />

                <MachinePreviewField
                  label="شاخص‌های هشدار"
                  value={draftPreview.assessment.warningIndicators}
                />

                <MachinePreviewField
                  label="شکاف‌های اطلاعاتی"
                  value={draftPreview.assessment.informationGaps}
                />

                <MachinePreviewField
                  label="جمع‌بندی ماشینی"
                  value={draftPreview.assessment.analyticalJudgment}
                />
              </div>

              <div style={machinePreviewActionsStyle}>
                <button
                  type="button"
                  style={greenButton}
                  onClick={() =>
                    applyMachineDraft(
                      "fill-empty"
                    )
                  }
                >
                  اعمال فقط در فیلدهای خالی
                </button>

                <button
                  type="button"
                  style={grayButton}
                  onClick={() =>
                    applyMachineDraft(
                      "replace"
                    )
                  }
                >
                  جایگزینی ساختار با پیش‌نویس
                </button>

                <button
                  type="button"
                  style={machineDraftSecondaryButtonStyle}
                  onClick={() =>
                    setDraftPreview(
                      null
                    )
                  }
                >
                  بستن پیش‌نمایش
                </button>
              </div>
            </div>
          )}

          {form.machineDraft &&
            currentMachineDraftIsStale && (
              <div style={humanReviewStaleStyle}>
                ترکیب شواهد پرونده با شواهدی که پیش‌نویس ماشینی بر اساس آنها
                تولید شده یکسان نیست. این پیش‌نویس برای بازبینی نهایی معتبر
                نیست؛ ابتدا «تولید پیش‌نویس از شواهد» را دوباره اجرا کنید.
              </div>
            )}

          {showHumanReview &&
            form.machineDraft && (
              <div style={humanReviewPanelStyle}>
                <div style={humanReviewPanelHeaderStyle}>
                  <div>
                    <div style={humanReviewEyebrowStyle}>
                      Human-in-the-loop Review
                    </div>

                    <strong style={humanReviewPanelTitleStyle}>
                      مقایسه تحلیل ماشینی و ارزیابی تحلیلگر
                    </strong>

                    <div style={humanReviewPanelMetaStyle}>
                      Draft ID:{" "}
                      <span dir="ltr">
                        {form.machineDraft.draftId}
                      </span>
                      {" | "}
                      پیشرفت حل اختلاف‌ها:{" "}
                      {
                        calculateHumanReviewProgress(
                          normalizeHumanReviewRecord(
                            form.humanReview,
                            form.machineDraft.draftId
                          )
                        ).percent
                      }
                      %
                    </div>
                  </div>

                  <span style={humanReviewSafetyBadgeStyle}>
                    تصمیم نهایی با تحلیلگر
                  </span>
                </div>

                <div style={humanReviewIntroStyle}>
                  برای هر بخش، خروجی ماشین را با متن فعلی تحلیلگر مقایسه و
                  یکی از وضعیت‌های بازبینی را ثبت کنید. گزینه «نیازمند بررسی
                  بیشتر» بازبینی را باز نگه می‌دارد و اجازه تکمیل نهایی نمی‌دهد.
                </div>

                <div style={humanReviewListStyle}>
                  {HUMAN_REVIEW_SECTIONS.map(
                    (
                      reviewSection
                    ) => (
                      <HumanReviewComparisonCard
                        key={reviewSection.key}
                        label={reviewSection.label}
                        machineValue={
                          getMachineSectionValue(
                            form.machineDraft!,
                            reviewSection.key
                          )
                        }
                        analystValue={
                          getAnalystSectionValue(
                            synchronizeStructuredAssessment(
                              form.structuredAssessment,
                              {
                                findings: form.findings,
                                confidence: form.confidence,
                                likelyScenario: form.likelyScenario,
                                worstScenario: form.worstScenario,
                                bestScenario: form.bestScenario,
                              }
                            ),
                            reviewSection.key
                          )
                        }
                        review={
                          normalizeHumanReviewRecord(
                            form.humanReview,
                            form.machineDraft!.draftId
                          )?.sections[
                            reviewSection.key
                          ]
                        }
                        disabled={
                          currentMachineDraftIsStale
                        }
                        onDecision={(
                          decision
                        ) =>
                          setHumanReviewDecision(
                            reviewSection.key,
                            decision
                          )
                        }
                        onNote={(
                          note
                        ) =>
                          setHumanReviewSectionNote(
                            reviewSection.key,
                            note
                          )
                        }
                      />
                    )
                  )}
                </div>

                <Field label="یادداشت کلی بازبینی">
                  <textarea
                    style={smallTextareaStyle}
                    value={
                      normalizeHumanReviewRecord(
                        form.humanReview,
                        form.machineDraft.draftId
                      )?.overallNote || ""
                    }
                    disabled={
                      currentMachineDraftIsStale
                    }
                    onChange={(e) =>
                      setHumanReviewOverallNote(
                        e.target.value
                      )
                    }
                    placeholder="اختلاف‌های مهم، دلایل پذیرش/رد و ملاحظات تحلیلگر..."
                  />
                </Field>

                <div style={humanReviewFooterStyle}>
                  <div style={humanReviewFooterMetaStyle}>
                    وضعیت فعلی:{" "}
                    {form.humanReview?.status === "completed"
                      ? "تکمیل‌شده"
                      : "در حال بازبینی"}
                    {" | "}
                    بخش‌های تعیین‌تکلیف‌شده:{" "}
                    {
                      calculateHumanReviewProgress(
                        normalizeHumanReviewRecord(
                          form.humanReview,
                          form.machineDraft.draftId
                        )
                      ).resolved
                    }
                    /
                    {HUMAN_REVIEW_SECTIONS.length}
                  </div>

                  <button
                    type="button"
                    style={greenButton}
                    disabled={
                      currentMachineDraftIsStale
                    }
                    onClick={
                      completeHumanReview
                    }
                  >
                    تکمیل بازبینی انسانی
                  </button>
                </div>
              </div>
            )}

          <Field label="خلاصه وضعیت">
            <textarea
              style={textareaStyle}
              value={form.structuredAssessment.situationSummary}
              onChange={(e) =>
                changeAssessmentField(
                  "situationSummary",
                  e.target.value
                )
              }
              placeholder="تصویر فشرده و مدیریتی از وضعیت فعلی، روند و مسئله اصلی..."
            />
          </Field>

          <div style={structuredGridStyle}>
            <Field label="بازیگران / عوامل مؤثر">
              <textarea
                style={smallTextareaStyle}
                value={form.structuredAssessment.actorsFactors}
                onChange={(e) =>
                  changeAssessmentField(
                    "actorsFactors",
                    e.target.value
                  )
                }
                placeholder="بازیگران، ذی‌نفعان، عوامل داخلی و خارجی مؤثر..."
              />
            </Field>

            <Field label="محرک‌ها">
              <textarea
                style={smallTextareaStyle}
                value={form.structuredAssessment.drivers}
                onChange={(e) =>
                  changeAssessmentField(
                    "drivers",
                    e.target.value
                  )
                }
                placeholder="محرک‌های اصلی تغییر، تشدید یا کاهش وضعیت..."
              />
            </Field>

            <Field label="نشانه‌ها و شاخص‌های هشدار">
              <textarea
                style={smallTextareaStyle}
                value={form.structuredAssessment.warningIndicators}
                onChange={(e) =>
                  changeAssessmentField(
                    "warningIndicators",
                    e.target.value
                  )
                }
                placeholder="نشانه‌هایی که تغییر وضعیت یا تشدید تهدید را نشان می‌دهند..."
              />
            </Field>

            <Field label="شکاف‌های اطلاعاتی">
              <textarea
                style={smallTextareaStyle}
                value={form.structuredAssessment.informationGaps}
                onChange={(e) =>
                  changeAssessmentField(
                    "informationGaps",
                    e.target.value
                  )
                }
                placeholder="چه اطلاعاتی برای افزایش اطمینان تحلیل هنوز در دسترس نیست؟"
              />
            </Field>

            <Field label="فرضیات تحلیل">
              <textarea
                style={smallTextareaStyle}
                value={form.structuredAssessment.assumptions}
                onChange={(e) =>
                  changeAssessmentField(
                    "assumptions",
                    e.target.value
                  )
                }
                placeholder="فرضیات کلیدی که تحلیل بر آنها استوار است..."
              />
            </Field>

            <Field label="پیامدهای محتمل">
              <textarea
                style={smallTextareaStyle}
                value={form.structuredAssessment.implications}
                onChange={(e) =>
                  changeAssessmentField(
                    "implications",
                    e.target.value
                  )
                }
                placeholder="پیامدهای عملیاتی، راهبردی، زیرساختی یا اجتماعی..."
              />
            </Field>
          </div>

          <Field label="جمع‌بندی تحلیلی">
            <textarea
              style={textareaStyle}
              value={form.structuredAssessment.analyticalJudgment}
              onChange={(e) =>
                changeAssessmentField(
                  "analyticalJudgment",
                  e.target.value
                )
              }
              placeholder="قضاوت نهایی تحلیلگر بر پایه شواهد، عدم‌قطعیت‌ها و روندهای مشاهده‌شده..."
            />
          </Field>
        </section>

        <div style={responsiveGrid}>
          <Field label="احتمال">
            <select
              style={inputStyle}
              value={form.probability}
              onChange={(e) => changeField("probability", e.target.value)}
            >
              <option>کم</option>
              <option>متوسط</option>
              <option>زیاد</option>
              <option>بسیار زیاد</option>
            </select>
          </Field>

          <Field label="شدت پیامد">
            <select
              style={inputStyle}
              value={form.impact}
              onChange={(e) => changeField("impact", e.target.value)}
            >
              <option>کم</option>
              <option>متوسط</option>
              <option>زیاد</option>
              <option>بسیار زیاد</option>
            </select>
          </Field>

          <Field label="سطح ریسک">
            <div style={riskBoxStyle}>
              {calculateRisk(form.probability, form.impact)}
            </div>
          </Field>
        </div>

        <h3 style={sectionTitleStyle}>شواهد و منابع</h3>

        {form.evidence.length === 0 ? (
          <div style={emptyEvidenceStyle}>
            هنوز خبری یا رویدادی به این تحلیل متصل نشده است.
          </div>
        ) : (
          <div style={evidenceListStyle}>
            {form.evidence.map((item) => {
              const archive = item.archive;

              const primarySourceUrl =
                archive?.originalUrl || item.url;

              return (
                <div key={item.id} style={evidenceCardStyle}>
                  <div style={cardTopStyle}>
                    <div style={{ minWidth: 0 }}>
                      <strong>{item.title}</strong>

                      <div style={metaStyle}>
                        {evidenceKindLabel(item.kind)}
                        {item.source ? ` | ${item.source}` : ""}
                        {item.country ? ` | ${item.country}` : ""}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeEvidence(item.id)}
                      style={redButton}
                    >
                      حذف شاهد
                    </button>
                  </div>

                  {archive ? (
                    <div style={archiveBlockStyle}>
                      {archive.snapshotDataUrl ? (
                        <div style={archiveImageWrapStyle}>
                          <img
                            src={archive.snapshotDataUrl}
                            alt={`تصویر آرشیوی ${item.title}`}
                            style={archiveImageStyle}
                          />

                          <span style={archiveImageBadgeStyle}>
                            {archiveKindLabel(archive.snapshotKind)}
                          </span>
                        </div>
                      ) : (
                        <div style={archiveMissingImageStyle}>
                          تصویر آرشیوی در دسترس نیست؛ فراداده شاهد حفظ شده است.
                        </div>
                      )}

                      <div style={archiveDetailsStyle}>
                        <div style={archiveDetailsHeaderStyle}>
                          <strong style={{ color: "#d1fae5" }}>
                            سند آرشیوی شاهد
                          </strong>

                          <span style={archiveStatusBadgeStyle}>
                            ثبت‌شده
                          </span>
                        </div>

                        <div style={archiveMetaGridStyle}>
                          <ArchiveMeta
                            label="زمان آرشیو"
                            value={
                              archive.archivedAt
                                ? new Date(
                                    archive.archivedAt
                                  ).toLocaleString("fa-IR")
                                : "—"
                            }
                          />

                          <ArchiveMeta
                            label="شبکه / منبع"
                            value={
                              archive.channelName ||
                              item.source ||
                              "—"
                            }
                          />

                          <ArchiveMeta
                            label="وضعیت پخش"
                            value={archive.playbackState || "—"}
                          />

                          <ArchiveMeta
                            label="شناسه آرشیو"
                            value={archive.archiveId || "—"}
                            dir="ltr"
                          />

                          {archive.videoId && (
                            <ArchiveMeta
                              label="Video ID"
                              value={archive.videoId}
                              dir="ltr"
                            />
                          )}

                          {archive.channelId && (
                            <ArchiveMeta
                              label="Channel ID"
                              value={archive.channelId}
                              dir="ltr"
                            />
                          )}
                        </div>

                        {archive.note && (
                          <div style={archiveNoteStyle}>
                            {archive.note}
                          </div>
                        )}

                        <div style={archiveActionsStyle}>
                          {primarySourceUrl && (
                            <a
                              href={primarySourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={archivePrimaryLinkStyle}
                            >
                              باز کردن منبع اصلی
                            </a>
                          )}

                          {archive.streamUrl &&
                            archive.streamUrl !== primarySourceUrl && (
                              <a
                                href={archive.streamUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={archiveSecondaryLinkStyle}
                              >
                                مشاهده نشانی جریان
                              </a>
                            )}

                          {archive.archiveId && (
                            <button
                              type="button"
                              style={archiveCopyButtonStyle}
                              onClick={() => {
                                void navigator.clipboard
                                  ?.writeText(archive.archiveId)
                                  .then(() => {
                                    setMessage(
                                      "شناسه آرشیو شاهد کپی شد."
                                    );
                                  })
                                  .catch(() => {
                                    setMessage(
                                      "امکان کپی خودکار شناسه آرشیو وجود ندارد."
                                    );
                                  });
                              }}
                            >
                              کپی شناسه آرشیو
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={legacyEvidenceNoticeStyle}>
                      این شاهد قبل از فعال‌شدن لایه آرشیو ثبت شده است؛ اطلاعات
                      منبع و زمان همچنان در پرونده حفظ می‌شوند.
                    </div>
                  )}

                  {item.summary && (
                    <div style={evidenceSummaryStyle}>{item.summary}</div>
                  )}

                  {(typeof item.lat === "number" ||
                    typeof item.lon === "number" ||
                    item.timestamp) && (
                    <div style={metaStyle}>
                      {item.timestamp
                        ? `زمان ثبت شاهد: ${new Date(
                            item.timestamp
                          ).toLocaleString("fa-IR")}`
                        : ""}

                      {typeof item.lat === "number" &&
                      typeof item.lon === "number"
                        ? ` | مختصات: ${item.lat.toFixed(
                            4
                          )}, ${item.lon.toFixed(4)}`
                        : ""}
                    </div>
                  )}

                  {!archive && item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      style={linkStyle}
                    >
                      مشاهده منبع
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <section style={traceabilityPanelStyle}>
          <div style={traceabilityHeaderStyle}>
            <div>
              <div style={traceabilityEyebrowStyle}>
                P3 / Evidence Traceability
              </div>

              <h3 style={traceabilityTitleStyle}>
                ردیابی شواهد و ماتریس استناد تحلیلی
              </h3>

              <div style={traceabilityHintStyle}>
                برای هر بخش تحلیلی مشخص کنید کدام شواهد مبنای تحلیل بوده‌اند.
                این پیوند به معنی اثبات صحت ادعا نیست؛ فقط مسیر استناد و
                بازبینی پرونده را قابل ردیابی می‌کند.
              </div>
            </div>

            <div style={traceabilityHeaderActionsStyle}>
              <span style={traceabilityCoverageBadgeStyle}>
                پوشش:{" "}
                {
                  calculateTraceabilityCoverage(
                    form.evidenceTraceability
                  ).percent
                }
                %
              </span>

              {form.machineDraft?.evidenceCitations && (
                <button
                  type="button"
                  style={traceabilityMachineButtonStyle}
                  onClick={
                    applyMachineTraceabilitySuggestions
                  }
                >
                  پیشنهاد استناد ماشین
                </button>
              )}

              <button
                type="button"
                style={traceabilityClearButtonStyle}
                disabled={
                  !form.evidenceTraceability
                }
                onClick={
                  clearTraceabilityMatrix
                }
              >
                پاک‌کردن ماتریس
              </button>
            </div>
          </div>

          {form.evidence.length === 0 ? (
            <div style={traceabilityEmptyStyle}>
              برای ساخت ماتریس استناد، ابتدا شاهد به پرونده متصل کنید.
            </div>
          ) : (
            <div style={traceabilitySectionListStyle}>
              {HUMAN_REVIEW_SECTIONS.map(
                (
                  section
                ) => {
                  const linkedIds =
                    form.evidenceTraceability?.sections[
                      section.key
                    ]?.evidenceIds ||
                    [];

                  return (
                    <details
                      key={section.key}
                      style={traceabilityDetailsStyle}
                    >
                      <summary style={traceabilitySummaryStyle}>
                        <span>
                          {section.label}
                        </span>

                        <span style={traceabilitySummaryCountStyle}>
                          {linkedIds.length} شاهد مرتبط
                        </span>
                      </summary>

                      <div style={traceabilityDetailsBodyStyle}>
                        <div style={traceabilityEvidenceGridStyle}>
                          {form.evidence.map(
                            (
                              evidenceItem,
                              evidenceIndex
                            ) => {
                              const selected =
                                linkedIds.includes(
                                  evidenceItem.id
                                );

                              return (
                                <label
                                  key={evidenceItem.id}
                                  style={
                                    selected
                                      ? traceabilityEvidenceSelectedStyle
                                      : traceabilityEvidenceOptionStyle
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={(event) =>
                                      toggleTraceabilityEvidence(
                                        section.key,
                                        evidenceItem.id,
                                        event.target.checked
                                      )
                                    }
                                  />

                                  <span style={traceabilityEvidenceTextStyle}>
                                    <strong>
                                      [{evidenceIndex + 1}]{" "}
                                      {evidenceItem.title}
                                    </strong>

                                    <small style={traceabilityEvidenceMetaStyle}>
                                      {evidenceKindLabel(
                                        evidenceItem.kind
                                      )}
                                      {evidenceItem.source
                                        ? ` | ${evidenceItem.source}`
                                        : ""}
                                      {evidenceItem.archive?.archiveId
                                        ? ` | Archive: ${evidenceItem.archive.archiveId}`
                                        : ""}
                                    </small>
                                  </span>
                                </label>
                              );
                            }
                          )}
                        </div>

                        <textarea
                          style={traceabilityNoteStyle}
                          value={
                            form.evidenceTraceability?.sections[
                              section.key
                            ]?.note ||
                            ""
                          }
                          onChange={(event) =>
                            updateTraceabilityNote(
                              section.key,
                              event.target.value
                            )
                          }
                          placeholder="یادداشت استنادی تحلیلگر؛ این شاهد کدام بخش تحلیل را پشتیبانی یا محدود می‌کند؟"
                        />
                      </div>
                    </details>
                  );
                }
              )}
            </div>
          )}

          {form.evidenceTraceability?.machineSuggestedFromDraftId && (
            <div style={traceabilityMachineNoticeStyle}>
              بخشی از پیوندها با پیشنهاد ماشین تکمیل شده‌اند؛ Draft ID:{" "}
              <span dir="ltr">
                {form.evidenceTraceability.machineSuggestedFromDraftId}
              </span>
              . تأیید نهایی این استنادها با تحلیلگر است.
            </div>
          )}
        </section>

        <section style={relationshipPanelStyle}>
          <div style={relationshipHeaderStyle}>
            <div>
              <div style={relationshipEyebrowStyle}>
                P3 / Evidence Consistency & Conflict Review
              </div>

              <h3 style={relationshipTitleStyle}>
                بازبینی تعارض، هم‌پوشانی و استقلال شواهد
              </h3>

              <div style={relationshipHintStyle}>
                این اسکن محلی فقط الگوهای زبانی و فراداده‌ای را برای توجه
                تحلیلگر علامت‌گذاری می‌کند و راستی‌آزمایی مستقل یا اثبات
                تعارض واقعی محسوب نمی‌شود.
              </div>
            </div>

            <div style={relationshipHeaderActionsStyle}>
              <span style={relationshipStatBadgeStyle}>
                یافته‌ها: {currentRelationshipSummary.total}
              </span>

              <span style={relationshipStatBadgeStyle}>
                بازبینی‌نشده: {currentRelationshipSummary.unreviewed}
              </span>

              {currentRelationshipSummary.highOpen > 0 && (
                <span style={relationshipHighBadgeStyle}>
                  مهمِ باز: {currentRelationshipSummary.highOpen}
                </span>
              )}

              <button
                type="button"
                style={relationshipScanButtonStyle}
                disabled={
                  form.evidence.length < 2
                }
                onClick={
                  runEvidenceRelationshipScan
                }
              >
                اسکن تعارض و هم‌پوشانی
              </button>
            </div>
          </div>

          {currentRelationshipScanStale && (
            <div style={relationshipStaleStyle}>
              مجموعه شواهد پرونده بعد از آخرین اسکن تغییر کرده است؛ برای
              ارزیابی معتبر، اسکن را دوباره اجرا کنید.
            </div>
          )}

          {!form.evidenceRelationshipRegister ? (
            <div style={relationshipEmptyStyle}>
              هنوز اسکن رابطه میان شواهد انجام نشده است. حداقل دو شاهد داشته
              باشید و «اسکن تعارض و هم‌پوشانی» را اجرا کنید.
            </div>
          ) : form.evidenceRelationshipRegister.findings.length === 0 ? (
            <div style={relationshipEmptyStyle}>
              در اسکن فعلی الگوی برجسته‌ای شناسایی نشد. این نتیجه به معنی
              نبود تعارض واقعی نیست.
            </div>
          ) : (
            <div style={relationshipFindingListStyle}>
              {form.evidenceRelationshipRegister.findings.map(
                (
                  finding
                ) => (
                  <EvidenceRelationshipFindingCard
                    key={finding.findingId}
                    finding={finding}
                    evidence={form.evidence}
                    disabled={
                      currentRelationshipScanStale
                    }
                    onStatus={(
                      status
                    ) =>
                      setRelationshipReviewStatus(
                        finding.findingId,
                        status
                      )
                    }
                    onNote={(
                      note
                    ) =>
                      setRelationshipAnalystNote(
                        finding.findingId,
                        note
                      )
                    }
                  />
                )
              )}
            </div>
          )}

          {form.evidenceRelationshipRegister && (
            <div style={relationshipFooterStyle}>
              <span>
                موتور: {form.evidenceRelationshipRegister.scanVersion}
              </span>

              <span>
                آخرین اسکن:{" "}
                {new Date(
                  form.evidenceRelationshipRegister.scannedAt
                ).toLocaleString("fa-IR")}
              </span>
            </div>
          )}
        </section>

        <section style={analysisQualityPanelStyle}>
          <div style={analysisQualityHeaderStyle}>
            <div>
              <div style={analysisQualityEyebrowStyle}>
                P3 / Analysis Quality
              </div>

              <h3 style={analysisQualityTitleStyle}>
                کیفیت و اطمینان پرونده تحلیل
              </h3>

              <div style={analysisQualityHintStyle}>
                این ارزیابی کیفیت فرایند تحلیل، کفایت داده و کنترل‌های انسانی
                را می‌سنجد؛ امتیاز بالا به معنای اثبات صحت رویداد واقعی نیست.
              </div>
            </div>

            <div style={analysisQualityScoreWrapStyle}>
              <div style={analysisQualityScoreStyle}>
                {currentQualityAssessment.overallScore}
                <span style={analysisQualityScoreUnitStyle}>/100</span>
              </div>

              <div style={analysisQualityLevelStyle}>
                {qualityLevelLabel(
                  currentQualityAssessment.qualityLevel
                )}
              </div>
            </div>
          </div>

          <div style={analysisQualitySummaryGridStyle}>
            <QualitySummaryItem
              label="وضعیت آمادگی"
              value={
                reviewReadinessLabel(
                  currentQualityAssessment.reviewReadiness
                )
              }
            />

            <QualitySummaryItem
              label="قدرت شواهد"
              value={`${currentQualityAssessment.evidenceStrengthScore}/100`}
            />

            <QualitySummaryItem
              label="اطمینان تحلیلگر"
              value={currentQualityAssessment.analystConfidence}
            />

            <QualitySummaryItem
              label="اطمینان پیشنهادی مبتنی بر شواهد"
              value={currentQualityAssessment.suggestedEvidenceConfidence}
            />

            <QualitySummaryItem
              label="وضعیت پیش‌نویس ماشینی"
              value={
                currentQualityAssessment.machineDraftStale
                  ? "قدیمی / نیازمند بازتولید"
                  : form.machineDraft
                    ? "همگام با شواهد"
                    : "فاقد پیش‌نویس ماشینی"
              }
            />

            <QualitySummaryItem
              label="توافق ماشین / تحلیلگر"
              value={
                typeof currentQualityAssessment.machineAnalystAgreementRate ===
                  "number"
                  ? `${currentQualityAssessment.machineAnalystAgreementRate}%`
                  : "غیرقابل محاسبه"
              }
            />

            <QualitySummaryItem
              label="پوشش استناد تحلیلی"
              value={`${currentQualityAssessment.traceabilityCoverageScore}%`}
            />
          </div>

          <div style={analysisQualityDimensionsStyle}>
            {currentQualityAssessment.dimensions.map(
              (
                qualityDimension
              ) => (
                <QualityDimensionCard
                  key={qualityDimension.key}
                  dimension={qualityDimension}
                />
              )
            )}
          </div>

          <div style={analysisQualityNotesGridStyle}>
            <div style={analysisQualityNoteBoxStyle}>
              <strong style={analysisQualityNoteTitleStyle}>
                نقاط قوت
              </strong>

              {currentQualityAssessment.strengths.length ? (
                currentQualityAssessment.strengths.map(
                  (
                    item
                  ) => (
                    <div
                      key={item}
                      style={analysisQualityPositiveLineStyle}
                    >
                      • {item}
                    </div>
                  )
                )
              ) : (
                <div style={analysisQualityMutedLineStyle}>
                  هنوز مؤلفه‌ای با امتیاز قوی ثبت نشده است.
                </div>
              )}
            </div>

            <div style={analysisQualityNoteBoxStyle}>
              <strong style={analysisQualityNoteTitleStyle}>
                ملاحظات و محدودیت‌ها
              </strong>

              {currentQualityAssessment.cautions.length ? (
                currentQualityAssessment.cautions.map(
                  (
                    item
                  ) => (
                    <div
                      key={item}
                      style={analysisQualityCautionLineStyle}
                    >
                      • {item}
                    </div>
                  )
                )
              ) : (
                <div style={analysisQualityMutedLineStyle}>
                  ملاحظه بحرانی از معیارهای فعلی استخراج نشد.
                </div>
              )}
            </div>
          </div>

          <div style={analysisQualityFooterStyle}>
            <span>
              نسخه ارزیابی: {currentQualityAssessment.version}
            </span>

            <span>
              وضعیت:{" "}
              {currentQualityAssessment.readyForReview
                ? "قابل طرح برای بررسی نهایی"
                : "نیازمند تکمیل قبل از بررسی نهایی"}
            </span>
          </div>
        </section>

        <section style={readinessPanelStyle}>
          <div style={readinessHeaderStyle}>
            <div>
              <div style={readinessEyebrowStyle}>
                P3 / Final Case Readiness
              </div>

              <h3 style={readinessTitleStyle}>
                داشبورد آمادگی پرونده برای بررسی نهایی
              </h3>

              <div style={readinessHintStyle}>
                این داشبورد همه کنترل‌های P3 را یکجا جمع می‌کند. «آماده بودن»
                به معنی آماده‌بودن فرایند تحلیل برای بررسی است، نه اثبات صحت
                محتوای رویداد.
              </div>
            </div>

            <div style={readinessScoreBoxStyle}>
              <div style={readinessScoreStyle}>
                {currentReadinessAssessment.score}
                <span style={readinessScoreUnitStyle}>/100</span>
              </div>

              <div style={readinessStatusStyle}>
                {caseReadinessStatusLabel(
                  currentReadinessAssessment.status
                )}
              </div>
            </div>
          </div>

          <div style={readinessChecksGridStyle}>
            {currentReadinessAssessment.checks.map(
              (
                readinessCheck
              ) => (
                <ReadinessCheckCard
                  key={readinessCheck.key}
                  readinessCheck={readinessCheck}
                />
              )
            )}
          </div>

          <div style={readinessSummaryGridStyle}>
            <div style={readinessSummaryBoxStyle}>
              <strong style={readinessSummaryTitleStyle}>
                موانع
              </strong>

              {currentReadinessAssessment.blockers.length ? (
                currentReadinessAssessment.blockers.map(
                  (
                    item
                  ) => (
                    <div
                      key={item}
                      style={readinessBlockerLineStyle}
                    >
                      • {item}
                    </div>
                  )
                )
              ) : (
                <div style={readinessPositiveLineStyle}>
                  مانع سخت برای بررسی نهایی ثبت نشده است.
                </div>
              )}
            </div>

            <div style={readinessSummaryBoxStyle}>
              <strong style={readinessSummaryTitleStyle}>
                موارد نیازمند توجه
              </strong>

              {currentReadinessAssessment.warnings.length ? (
                currentReadinessAssessment.warnings.map(
                  (
                    item
                  ) => (
                    <div
                      key={item}
                      style={readinessWarningLineStyle}
                    >
                      • {item}
                    </div>
                  )
                )
              ) : (
                <div style={readinessPositiveLineStyle}>
                  هشدار باز مهمی از معیارهای فعلی استخراج نشد.
                </div>
              )}
            </div>

            <div style={readinessSummaryBoxStyle}>
              <strong style={readinessSummaryTitleStyle}>
                نقاط قوت
              </strong>

              {currentReadinessAssessment.strengths.length ? (
                currentReadinessAssessment.strengths.map(
                  (
                    item
                  ) => (
                    <div
                      key={item}
                      style={readinessPositiveLineStyle}
                    >
                      • {item}
                    </div>
                  )
                )
              ) : (
                <div style={readinessMutedLineStyle}>
                  هنوز مؤلفه‌ای با وضعیت قوی ثبت نشده است.
                </div>
              )}
            </div>
          </div>

          <div style={readinessFooterStyle}>
            <span>
              نسخه موتور: {currentReadinessAssessment.version}
            </span>

            <span>
              نتیجه نهایی:{" "}
              {currentReadinessAssessment.readyForFinalReview
                ? "پرونده می‌تواند برای بررسی نهایی ارسال شود."
                : "پرونده قبل از بررسی نهایی نیازمند تکمیل است."}
            </span>
          </div>
        </section>

        <section style={historyPanelStyle}>
          <div style={historyHeaderStyle}>
            <div>
              <div style={historyEyebrowStyle}>
                P3 / Revision History & Audit
              </div>

              <h3 style={historyTitleStyle}>
                تاریخچه نسخه‌ها و ممیزی پرونده
              </h3>

              <div style={historyHintStyle}>
                نسخه‌ها فقط خلاصه تحلیلی، شناسه شواهد، کیفیت و کنترل‌های
                بازبینی را نگه می‌دارند و تصاویر آرشیوی را دوباره تکثیر نمی‌کنند.
              </div>
            </div>

            <div style={historyHeaderStatsStyle}>
              <span style={historyStatBadgeStyle}>
                نسخه: {activeHistoryItem?.revisionNumber || 0}
              </span>

              <span style={historyStatBadgeStyle}>
                رخداد ممیزی: {activeHistoryItem?.auditTrail?.length || 0}
              </span>
            </div>
          </div>

          {!activeHistoryItem ? (
            <div style={historyEmptyStyle}>
              پس از اولین ذخیره پرونده، تاریخچه نسخه‌ها در این بخش ایجاد می‌شود.
            </div>
          ) : (
            <>
              <div style={historyTrendStyle}>
                <strong style={historySubTitleStyle}>
                  روند امتیاز کیفیت
                </strong>

                <div style={historyTrendChipsStyle}>
                  {qualityTrend(
                    activeHistoryItem.revisionHistory
                  ).length ? (
                    qualityTrend(
                      activeHistoryItem.revisionHistory
                    )
                      .slice(-10)
                      .map(
                        (
                          point
                        ) => (
                          <span
                            key={`${point.sequence}-${point.createdAt}`}
                            style={historyTrendChipStyle}
                            title={new Date(
                              point.createdAt
                            ).toLocaleString("fa-IR")}
                          >
                            v{point.sequence}: {point.score}
                          </span>
                        )
                      )
                  ) : (
                    <span style={historyMutedStyle}>
                      هنوز نسخه‌ای دارای امتیاز کیفیت ذخیره نشده است.
                    </span>
                  )}
                </div>
              </div>

              <div style={historyColumnsStyle}>
                <div style={historyColumnStyle}>
                  <strong style={historySubTitleStyle}>
                    نسخه‌های تحلیل
                  </strong>

                  <div style={historyRevisionListStyle}>
                    {(
                      activeHistoryItem.revisionHistory ||
                      []
                    )
                      .slice()
                      .reverse()
                      .map(
                        (
                          revision
                        ) => (
                          <AnalysisRevisionCard
                            key={revision.revisionId}
                            revision={revision}
                          />
                        )
                      )}
                  </div>
                </div>

                <div style={historyColumnStyle}>
                  <strong style={historySubTitleStyle}>
                    Audit Trail
                  </strong>

                  <div style={historyAuditListStyle}>
                    {(
                      activeHistoryItem.auditTrail ||
                      []
                    )
                      .slice()
                      .reverse()
                      .slice(0, 30)
                      .map(
                        (
                          event
                        ) => (
                          <AuditTrailRow
                            key={event.eventId}
                            event={event}
                          />
                        )
                      )}

                    {!activeHistoryItem.auditTrail?.length && (
                      <div style={historyMutedStyle}>
                        رخداد ممیزی ثبت نشده است.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <h3 style={sectionTitleStyle}>ارزیابی سناریویی</h3>

        <div style={scenarioGridStyle}>
          <div style={scenarioCardStyle}>
            <div style={scenarioCardHeaderStyle}>سناریوی محتمل</div>

            <Field label="شرح سناریو">
              <textarea
                style={smallTextareaStyle}
                value={form.likelyScenario}
                onChange={(e) =>
                  changeField(
                    "likelyScenario",
                    e.target.value
                  )
                }
                placeholder="محتمل‌ترین مسیر تحول وضعیت..."
              />
            </Field>

            <Field label="شاخص‌های تحقق">
              <textarea
                style={smallTextareaStyle}
                value={
                  form.structuredAssessment.scenarios.likely.indicators
                }
                onChange={(e) =>
                  changeScenarioIndicator(
                    "likely",
                    e.target.value
                  )
                }
                placeholder="چه نشانه‌هایی تحقق این سناریو را تأیید می‌کنند؟"
              />
            </Field>
          </div>

          <div style={scenarioCardStyle}>
            <div style={scenarioCardHeaderStyle}>سناریوی بدبینانه</div>

            <Field label="شرح سناریو">
              <textarea
                style={smallTextareaStyle}
                value={form.worstScenario}
                onChange={(e) =>
                  changeField(
                    "worstScenario",
                    e.target.value
                  )
                }
                placeholder="مسیر تشدید یا وضعیت با بیشترین پیامد منفی..."
              />
            </Field>

            <Field label="شاخص‌های تحقق">
              <textarea
                style={smallTextareaStyle}
                value={
                  form.structuredAssessment.scenarios.worst.indicators
                }
                onChange={(e) =>
                  changeScenarioIndicator(
                    "worst",
                    e.target.value
                  )
                }
                placeholder="نشانه‌های ورود به سناریوی بدبینانه..."
              />
            </Field>
          </div>

          <div style={scenarioCardStyle}>
            <div style={scenarioCardHeaderStyle}>سناریوی خوش‌بینانه</div>

            <Field label="شرح سناریو">
              <textarea
                style={smallTextareaStyle}
                value={form.bestScenario}
                onChange={(e) =>
                  changeField(
                    "bestScenario",
                    e.target.value
                  )
                }
                placeholder="مسیر کاهش تهدید، کنترل وضعیت یا بهبود شرایط..."
              />
            </Field>

            <Field label="شاخص‌های تحقق">
              <textarea
                style={smallTextareaStyle}
                value={
                  form.structuredAssessment.scenarios.best.indicators
                }
                onChange={(e) =>
                  changeScenarioIndicator(
                    "best",
                    e.target.value
                  )
                }
                placeholder="نشانه‌های حرکت به سمت سناریوی خوش‌بینانه..."
              />
            </Field>
          </div>
        </div>

        <h3 style={sectionTitleStyle}>پیشنهاد اقدام</h3>

        <Field label="پیشنهادهای پدافند غیرعامل">
          <textarea
            style={textareaStyle}
            value={form.recommendations}
            onChange={(e) => changeField("recommendations", e.target.value)}
            placeholder="اقدامات پیشنهادی، الزامات تاب‌آوری، پایش و تداوم خدمت..."
          />
        </Field>

        <div style={actionPlanStyle}>
          <Field label="اقدام فوری">
            <textarea
              style={smallTextareaStyle}
              value={form.structuredAssessment.actions.immediate}
              onChange={(e) =>
                changeActionField(
                  "immediate",
                  e.target.value
                )
              }
              placeholder="اقداماتی که باید بلافاصله انجام شوند..."
            />
          </Field>

          <Field label="اقدام کوتاه‌مدت">
            <textarea
              style={smallTextareaStyle}
              value={form.structuredAssessment.actions.shortTerm}
              onChange={(e) =>
                changeActionField(
                  "shortTerm",
                  e.target.value
                )
              }
              placeholder="اقدامات طی روزها یا هفته‌های آینده..."
            />
          </Field>

          <Field label="اقدام میان‌مدت">
            <textarea
              style={smallTextareaStyle}
              value={form.structuredAssessment.actions.mediumTerm}
              onChange={(e) =>
                changeActionField(
                  "mediumTerm",
                  e.target.value
                )
              }
              placeholder="اقدامات اصلاحی، توسعه‌ای یا تاب‌آورساز میان‌مدت..."
            />
          </Field>

          <Field label="الزامات پایش">
            <textarea
              style={smallTextareaStyle}
              value={
                form.structuredAssessment.actions.monitoringRequirements
              }
              onChange={(e) =>
                changeActionField(
                  "monitoringRequirements",
                  e.target.value
                )
              }
              placeholder="چه شاخص‌ها، منابع یا رخدادهایی باید به‌طور مستمر پایش شوند؟"
            />
          </Field>
        </div>

        <div style={actionRowStyle}>
          <button style={grayButton} onClick={() => saveAnalysis("draft")}>
            ذخیره پیش‌نویس
          </button>

          <button style={greenButton} onClick={() => saveAnalysis("review")}>
            ارسال برای بررسی
          </button>
        </div>
      </div>

      <div style={panelStyle}>
        <h3 style={sectionTitleStyle}>
          {isSuperAdmin ? "همه پرونده‌های تحلیل" : "پرونده‌های تحلیل من"}
        </h3>

        {visibleAnalyses.length === 0 ? (
          <div style={emptyListStyle}>پرونده تحلیلی ثبت نشده است.</div>
        ) : (
          visibleAnalyses.map((item) => (
            <div key={item.id} style={analysisCardStyle}>
              <div style={cardTopStyle}>
                <div>
                  <strong>{item.title}</strong>
                  <div style={metaStyle}>
                    {item.domain} | {item.region} | ریسک:{" "}
                    {calculateRisk(item.probability, item.impact)} | شواهد:{" "}
                    {item.evidence?.length || 0} | ساختار تحلیلی:{" "}
                    {calculateStructuredCompleteness(
                      normalizeStructuredAssessment(
                        item.structuredAssessment,
                        {
                          findings: item.findings,
                          confidence: item.confidence,
                          likelyScenario: item.likelyScenario,
                          worstScenario: item.worstScenario,
                          bestScenario: item.bestScenario,
                        }
                      )
                    )}
                    %
                    {item.machineDraft
                      ? ` | بازبینی AI: ${
                          item.humanReview?.status === "completed"
                            ? "تکمیل"
                            : "باز"
                        }`
                      : ""}
                    {" | آمادگی: "}
                    {caseReadinessStatusLabel(
                      item.readinessAssessment?.status ||
                      "needs-attention"
                    )}
                    {" | کیفیت: "}
                    {(
                      item.qualityAssessment ||
                      calculateAnalysisQuality({
                        analystConfidence: item.confidence,
                        structuredAssessment:
                          normalizeStructuredAssessment(
                            item.structuredAssessment,
                            {
                              findings: item.findings,
                              confidence: item.confidence,
                              likelyScenario: item.likelyScenario,
                              worstScenario: item.worstScenario,
                              bestScenario: item.bestScenario,
                            }
                          ),
                        evidence: item.evidence || [],
                        machineDraft: item.machineDraft,
                        humanReview: item.humanReview,
                        evidenceTraceability: item.evidenceTraceability,
                      })
                    ).overallScore}
                    /100
                  </div>
                </div>

                <span style={statusBadgeStyle}>{statusLabel(item.status)}</span>
              </div>

              <div style={cardActionsStyle}>
                <button style={smallButton} onClick={() => editAnalysis(item)}>
                  ویرایش
                </button>

                {isSuperAdmin && item.status === "review" && (
                  <button
                    style={smallButton}
                    onClick={() => approveAnalysis(item)}
                  >
                    تأیید تحلیل
                  </button>
                )}

                {isSuperAdmin && item.status === "completed" && (
                  <button
                    style={smallButton}
                    onClick={() => convertToReport(item)}
                  >
                    تبدیل به گزارش
                  </button>
                )}

                <button style={redButton} onClick={() => deleteAnalysis(item)}>
                  حذف
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ReadinessCheckCard({
  readinessCheck,
}: {
  readinessCheck:
    RasadyarCaseReadinessAssessment["checks"][number];
}) {
  const style =
    readinessCheck.status ===
      "pass"
      ? readinessCheckPassStyle
      : readinessCheck.status ===
          "block"
        ? readinessCheckBlockStyle
        : readinessCheck.status ===
            "warning"
          ? readinessCheckWarningStyle
          : readinessCheckNaStyle;

  return (
    <div style={style}>
      <div style={readinessCheckHeaderStyle}>
        <strong style={readinessCheckTitleStyle}>
          {readinessCheck.label}
        </strong>

        <span style={readinessCheckStatusStyle}>
          {caseReadinessCheckStatusLabel(
            readinessCheck.status
          )}
        </span>
      </div>

      <div style={readinessCheckScoreStyle}>
        {readinessCheck.status === "not-applicable"
          ? "N/A"
          : `${readinessCheck.score}/100`}
      </div>

      <div style={readinessCheckDetailStyle}>
        {readinessCheck.detail}
      </div>
    </div>
  );
}


function EvidenceRelationshipFindingCard({
  finding,
  evidence,
  disabled,
  onStatus,
  onNote,
}: {
  finding:
    RasadyarEvidenceRelationshipRegister["findings"][number];

  evidence:
    EvidenceItem[];

  disabled:
    boolean;

  onStatus:
    (
      status:
        RasadyarEvidenceRelationshipReviewStatus
    ) => void;

  onNote:
    (
      note:
        string
    ) => void;
}) {
  const relatedEvidence =
    finding.evidenceIds
      .map(
        (
          id
        ) =>
          evidence.find(
            (
              item
            ) =>
              item.id ===
              id
          )
      )
      .filter(
        (
          item
        ): item is EvidenceItem =>
          Boolean(
            item
          )
      );

  return (
    <div style={relationshipFindingCardStyle}>
      <div style={relationshipFindingHeaderStyle}>
        <div>
          <strong style={relationshipFindingTitleStyle}>
            {finding.title}
          </strong>

          <div style={relationshipFindingMetaStyle}>
            {evidenceRelationshipTypeLabel(
              finding.type
            )}
            {" | "}
            شدت:{" "}
            {finding.severity === "high"
              ? "زیاد"
              : finding.severity === "medium"
                ? "متوسط"
                : "کم"}
          </div>
        </div>

        <select
          style={relationshipStatusSelectStyle}
          disabled={disabled}
          value={finding.reviewStatus}
          onChange={(event) =>
            onStatus(
              event.target
                .value as
                RasadyarEvidenceRelationshipReviewStatus
            )
          }
        >
          <option value="unreviewed">
            بازبینی‌نشده
          </option>

          <option value="accepted">
            یافته تأیید شد
          </option>

          <option value="resolved">
            بررسی و حل شد
          </option>

          <option value="dismissed">
            تشخیص رد شد
          </option>

          <option value="needs-review">
            نیازمند بررسی بیشتر
          </option>
        </select>
      </div>

      <div style={relationshipReasonStyle}>
        {finding.reason}
      </div>

      <div style={relationshipEvidenceRefsStyle}>
        {relatedEvidence.map(
          (
            item,
            index
          ) => (
            <div
              key={item.id}
              style={relationshipEvidenceRefStyle}
            >
              <strong>
                [{index + 1}] {item.title}
              </strong>

              <small style={relationshipEvidenceRefMetaStyle}>
                {evidenceKindLabel(
                  item.kind
                )}
                {item.source
                  ? ` | ${item.source}`
                  : ""}
                {item.country || item.region
                  ? ` | ${item.country || item.region}`
                  : ""}
                {item.timestamp
                  ? ` | ${new Date(item.timestamp).toLocaleString("fa-IR")}`
                  : ""}
              </small>
            </div>
          )
        )}
      </div>

      <textarea
        style={relationshipNoteStyle}
        disabled={disabled}
        value={finding.analystNote}
        onChange={(event) =>
          onNote(
            event.target.value
          )
        }
        placeholder="یادداشت تحلیلگر؛ آیا این تعارض/هم‌پوشانی واقعی است؟ استقلال منابع چگونه ارزیابی می‌شود؟"
      />
    </div>
  );
}


function AnalysisRevisionCard({
  revision,
}: {
  revision:
    RasadyarAnalysisRevision;
}) {
  const qualityScore =
    revision.snapshot
      .qualityAssessment
      ?.overallScore;

  return (
    <details style={historyRevisionCardStyle}>
      <summary style={historyRevisionSummaryStyle}>
        <span>
          نسخه {revision.sequence} —{" "}
          {revisionActionLabel(
            revision.action
          )}
        </span>

        <span style={historyRevisionScoreStyle}>
          کیفیت:{" "}
          {typeof qualityScore === "number"
            ? `${qualityScore}/100`
            : "—"}
        </span>
      </summary>

      <div style={historyRevisionBodyStyle}>
        <div style={historyRevisionMetaStyle}>
          {revision.actorName} |{" "}
          {new Date(
            revision.createdAt
          ).toLocaleString("fa-IR")}
          {" | "}
          وضعیت: {revision.snapshot.status}
          {" | "}
          شواهد: {revision.snapshot.evidenceIds.length}
        </div>

        <div style={historyChangeListStyle}>
          {revision.changeSummary.map(
            (
              change
            ) => (
              <div
                key={change}
                style={historyChangeLineStyle}
              >
                • {change}
              </div>
            )
          )}
        </div>

        <div style={historyRevisionPreviewGridStyle}>
          <HistoryPreviewField
            label="عنوان"
            value={revision.snapshot.title}
          />

          <HistoryPreviewField
            label="اطمینان"
            value={revision.snapshot.confidence}
          />

          <HistoryPreviewField
            label="خلاصه وضعیت"
            value={
              revision.snapshot
                .structuredAssessment
                ?.situationSummary ||
              revision.snapshot.description
            }
          />

          <HistoryPreviewField
            label="جمع‌بندی تحلیلی"
            value={
              revision.snapshot
                .structuredAssessment
                ?.analyticalJudgment ||
              revision.snapshot.findings
            }
          />
        </div>

        <div style={historyHashStyle}>
          Snapshot Hash:{" "}
          <span dir="ltr">
            {revision.snapshotHash}
          </span>
        </div>
      </div>
    </details>
  );
}


function HistoryPreviewField({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div style={historyPreviewFieldStyle}>
      <span style={historyPreviewLabelStyle}>
        {label}
      </span>

      <div
        dir="auto"
        style={historyPreviewValueStyle}
      >
        {value || "—"}
      </div>
    </div>
  );
}


function AuditTrailRow({
  event,
}: {
  event:
    RasadyarAuditEvent;
}) {
  return (
    <div style={historyAuditRowStyle}>
      <div style={historyAuditTopStyle}>
        <strong style={historyAuditLabelStyle}>
          {auditEventLabel(
            event.eventType
          )}
        </strong>

        <span style={historyAuditTimeStyle}>
          {new Date(
            event.createdAt
          ).toLocaleString("fa-IR")}
        </span>
      </div>

      <div style={historyAuditDetailStyle}>
        {event.detail}
      </div>

      <div style={historyAuditActorStyle}>
        توسط: {event.actorName}
      </div>
    </div>
  );
}


function QualitySummaryItem({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div style={qualitySummaryItemStyle}>
      <span style={qualitySummaryLabelStyle}>
        {label}
      </span>

      <strong style={qualitySummaryValueStyle}>
        {value}
      </strong>
    </div>
  );
}


function QualityDimensionCard({
  dimension,
}: {
  dimension:
    RasadyarAnalysisQualityAssessment["dimensions"][number];
}) {
  return (
    <div style={qualityDimensionCardStyle}>
      <div style={qualityDimensionTopStyle}>
        <strong style={qualityDimensionLabelStyle}>
          {dimension.label}
        </strong>

        <span
          style={
            dimension.applicable
              ? qualityDimensionScoreStyle
              : qualityDimensionNaStyle
          }
        >
          {dimension.applicable
            ? `${dimension.score}/100`
            : "N/A"}
        </span>
      </div>

      <div style={qualityBarTrackStyle}>
        <div
          style={{
            ...qualityBarFillStyle,
            width: `${
              dimension.applicable
                ? dimension.score
                : 0
            }%`,
          }}
        />
      </div>

      <div style={qualityDimensionDetailStyle}>
        {dimension.detail}
      </div>

      {dimension.weight === 0 && dimension.applicable && (
        <div style={qualityInformationalStyle}>
          شاخص اطلاعاتی — در امتیاز کلی وزن ندارد
        </div>
      )}
    </div>
  );
}


function HumanReviewComparisonCard({
  label,
  machineValue,
  analystValue,
  review,
  disabled,
  onDecision,
  onNote,
}: {
  label:
    string;

  machineValue:
    string;

  analystValue:
    string;

  review?:
    RasadyarHumanReviewSection;

  disabled:
    boolean;

  onDecision:
    (
      decision:
        RasadyarHumanReviewDecision
    ) => void;

  onNote:
    (
      note:
        string
    ) => void;
}) {
  return (
    <section style={humanReviewCardStyle}>
      <div style={humanReviewCardHeaderStyle}>
        <strong style={humanReviewCardTitleStyle}>
          {label}
        </strong>

        <select
          style={humanReviewSelectStyle}
          disabled={disabled}
          value={review?.decision || ""}
          onChange={(event) => {
            const value =
              event.target.value as
                | ""
                | RasadyarHumanReviewDecision;

            if (
              value
            ) {
              onDecision(
                value
              );
            }
          }}
        >
          <option value="">
            انتخاب وضعیت بازبینی
          </option>

          <option value="accepted">
            تأیید تحلیلگر
          </option>

          <option value="edited">
            اصلاح‌شده توسط تحلیلگر
          </option>

          <option value="rejected">
            رد تحلیل ماشینی
          </option>

          <option value="needs-review">
            نیازمند بررسی بیشتر
          </option>
        </select>
      </div>

      <div style={humanReviewCompareGridStyle}>
        <div style={humanReviewMachineColumnStyle}>
          <span style={humanReviewColumnLabelStyle}>
            تحلیل ماشینی
          </span>

          <div
            dir="auto"
            style={humanReviewCompareTextStyle}
          >
            {machineValue || "—"}
          </div>
        </div>

        <div style={humanReviewAnalystColumnStyle}>
          <span style={humanReviewColumnLabelStyle}>
            ارزیابی فعلی تحلیلگر
          </span>

          <div
            dir="auto"
            style={humanReviewCompareTextStyle}
          >
            {analystValue || "—"}
          </div>
        </div>
      </div>

      <div style={humanReviewDecisionLineStyle}>
        وضعیت:{" "}
        <strong>
          {reviewDecisionLabel(
            review?.decision
          )}
        </strong>
      </div>

      <textarea
        dir="auto"
        style={humanReviewNoteInputStyle}
        disabled={disabled}
        value={review?.note || ""}
        onChange={(event) =>
          onNote(
            event.target.value
          )
        }
        placeholder="یادداشت تحلیلگر درباره دلیل پذیرش، اصلاح یا رد..."
      />
    </section>
  );
}


function MachinePreviewField({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div style={machinePreviewFieldStyle}>
      <span style={machinePreviewFieldLabelStyle}>
        {label}
      </span>

      <div
        dir="auto"
        style={machinePreviewFieldValueStyle}
      >
        {value || "—"}
      </div>
    </div>
  );
}


function ArchiveMeta({
  label,
  value,
  dir = "rtl",
}: {
  label: string;
  value: string;
  dir?: "rtl" | "ltr";
}) {
  return (
    <div style={archiveMetaItemStyle}>
      <span style={archiveMetaLabelStyle}>{label}</span>

      <span
        dir={dir}
        style={{
          ...archiveMetaValueStyle,
          textAlign: dir === "ltr" ? "left" : "right",
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} style={tabButtonStyle(active)}>
      {children}
    </button>
  );
}

const readinessPanelStyle: React.CSSProperties = {
  margin: "16px 0 18px",
  padding: 14,
  border: "1px solid rgba(45,212,191,.18)",
  borderRadius: 10,
  background:
    "linear-gradient(180deg, rgba(8,42,39,.50), rgba(6,18,17,.72))",
};

const readinessHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
  marginBottom: 12,
};

const readinessEyebrowStyle: React.CSSProperties = {
  marginBottom: 4,
  color: "#5eead4",
  fontSize: 8,
  fontWeight: 800,
};

const readinessTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#f0fdfa",
  fontSize: 15,
};

const readinessHintStyle: React.CSSProperties = {
  maxWidth: 780,
  marginTop: 5,
  color: "#94a3b8",
  fontSize: 8,
  lineHeight: 1.9,
};

const readinessScoreBoxStyle: React.CSSProperties = {
  flex: "0 0 auto",
  minWidth: 112,
  padding: "10px 12px",
  border: "1px solid rgba(45,212,191,.22)",
  borderRadius: 9,
  textAlign: "center",
  background: "rgba(13,148,136,.10)",
};

const readinessScoreStyle: React.CSSProperties = {
  color: "#ccfbf1",
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1,
};

const readinessScoreUnitStyle: React.CSSProperties = {
  marginRight: 2,
  color: "#5eead4",
  fontSize: 9,
  fontWeight: 700,
};

const readinessStatusStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#99f6e4",
  fontSize: 8,
  fontWeight: 700,
};

const readinessChecksGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 8,
};

const readinessCheckBaseStyle: React.CSSProperties = {
  minWidth: 0,
  padding: 9,
  borderRadius: 8,
  background: "rgba(2,12,12,.48)",
};

const readinessCheckPassStyle: React.CSSProperties = {
  ...readinessCheckBaseStyle,
  border: "1px solid rgba(52,211,153,.18)",
};

const readinessCheckWarningStyle: React.CSSProperties = {
  ...readinessCheckBaseStyle,
  border: "1px solid rgba(251,191,36,.18)",
};

const readinessCheckBlockStyle: React.CSSProperties = {
  ...readinessCheckBaseStyle,
  border: "1px solid rgba(248,113,113,.24)",
  background: "rgba(69,10,10,.15)",
};

const readinessCheckNaStyle: React.CSSProperties = {
  ...readinessCheckBaseStyle,
  border: "1px solid rgba(148,163,184,.10)",
  opacity: 0.76,
};

const readinessCheckHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const readinessCheckTitleStyle: React.CSSProperties = {
  color: "#e2e8f0",
  fontSize: 9,
};

const readinessCheckStatusStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 7,
  whiteSpace: "nowrap",
};

const readinessCheckScoreStyle: React.CSSProperties = {
  marginTop: 7,
  color: "#99f6e4",
  fontSize: 13,
  fontWeight: 800,
};

const readinessCheckDetailStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#94a3b8",
  fontSize: 8,
  lineHeight: 1.75,
};

const readinessSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 8,
  marginTop: 10,
};

const readinessSummaryBoxStyle: React.CSSProperties = {
  padding: 9,
  border: "1px solid rgba(148,163,184,.09)",
  borderRadius: 7,
  background: "rgba(2,10,10,.38)",
};

const readinessSummaryTitleStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "#ccfbf1",
  fontSize: 9,
};

const readinessBlockerLineStyle: React.CSSProperties = {
  color: "#fecaca",
  fontSize: 8,
  lineHeight: 1.8,
};

const readinessWarningLineStyle: React.CSSProperties = {
  color: "#fde68a",
  fontSize: 8,
  lineHeight: 1.8,
};

const readinessPositiveLineStyle: React.CSSProperties = {
  color: "#a7f3d0",
  fontSize: 8,
  lineHeight: 1.8,
};

const readinessMutedLineStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 8,
  lineHeight: 1.8,
};

const readinessFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
  paddingTop: 9,
  borderTop: "1px solid rgba(45,212,191,.09)",
  color: "#64748b",
  fontSize: 7,
};

const relationshipPanelStyle: React.CSSProperties = {
  margin: "16px 0 18px",
  padding: 14,
  border: "1px solid rgba(251,146,60,.17)",
  borderRadius: 10,
  background:
    "linear-gradient(180deg, rgba(46,26,10,.48), rgba(16,12,8,.70))",
};

const relationshipHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 11,
};

const relationshipEyebrowStyle: React.CSSProperties = {
  marginBottom: 4,
  color: "#fdba74",
  fontSize: 8,
  fontWeight: 800,
};

const relationshipTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#fff7ed",
  fontSize: 14,
};

const relationshipHintStyle: React.CSSProperties = {
  maxWidth: 780,
  marginTop: 5,
  color: "#94a3b8",
  fontSize: 8,
  lineHeight: 1.9,
};

const relationshipHeaderActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 6,
  flexWrap: "wrap",
};

const relationshipStatBadgeStyle: React.CSSProperties = {
  padding: "5px 8px",
  border: "1px solid rgba(251,146,60,.16)",
  borderRadius: 999,
  color: "#fed7aa",
  background: "rgba(124,45,18,.10)",
  fontSize: 8,
  whiteSpace: "nowrap",
};

const relationshipHighBadgeStyle: React.CSSProperties = {
  ...relationshipStatBadgeStyle,
  border: "1px solid rgba(248,113,113,.24)",
  color: "#fecaca",
  background: "rgba(127,29,29,.14)",
};

const relationshipScanButtonStyle: React.CSSProperties = {
  minHeight: 31,
  padding: "6px 10px",
  border: "1px solid rgba(251,146,60,.26)",
  borderRadius: 7,
  color: "#ffedd5",
  background: "rgba(154,52,18,.16)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 8,
};

const relationshipStaleStyle: React.CSSProperties = {
  marginBottom: 10,
  padding: "8px 9px",
  border: "1px solid rgba(248,113,113,.20)",
  borderRadius: 7,
  color: "#fecaca",
  background: "rgba(127,29,29,.11)",
  fontSize: 8,
  lineHeight: 1.8,
};

const relationshipEmptyStyle: React.CSSProperties = {
  padding: "10px 11px",
  border: "1px dashed rgba(251,146,60,.14)",
  borderRadius: 7,
  color: "#64748b",
  fontSize: 9,
  lineHeight: 1.8,
};

const relationshipFindingListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const relationshipFindingCardStyle: React.CSSProperties = {
  padding: 10,
  border: "1px solid rgba(148,163,184,.09)",
  borderRadius: 8,
  background: "rgba(18,12,7,.48)",
};

const relationshipFindingHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 9,
  marginBottom: 7,
};

const relationshipFindingTitleStyle: React.CSSProperties = {
  display: "block",
  color: "#ffedd5",
  fontSize: 9,
};

const relationshipFindingMetaStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#fb923c",
  fontSize: 7,
};

const relationshipStatusSelectStyle: React.CSSProperties = {
  minWidth: 155,
  minHeight: 30,
  padding: "5px 7px",
  border: "1px solid rgba(251,146,60,.18)",
  borderRadius: 6,
  color: "#e2e8f0",
  background: "#17120e",
  fontFamily: "inherit",
  fontSize: 8,
  outline: "none",
};

const relationshipReasonStyle: React.CSSProperties = {
  marginBottom: 8,
  padding: "7px 8px",
  border: "1px solid rgba(251,146,60,.08)",
  borderRadius: 6,
  color: "#cbd5e1",
  background: "rgba(124,45,18,.06)",
  fontSize: 8,
  lineHeight: 1.8,
};

const relationshipEvidenceRefsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 6,
};

const relationshipEvidenceRefStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
  padding: "7px 8px",
  border: "1px solid rgba(148,163,184,.08)",
  borderRadius: 6,
  color: "#e2e8f0",
  background: "rgba(2,6,10,.28)",
  fontSize: 8,
  lineHeight: 1.6,
};

const relationshipEvidenceRefMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 7,
  overflowWrap: "anywhere",
};

const relationshipNoteStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 62,
  boxSizing: "border-box",
  marginTop: 8,
  padding: "7px 8px",
  border: "1px solid rgba(148,163,184,.10)",
  borderRadius: 6,
  color: "#e2e8f0",
  background: "rgba(12,8,5,.55)",
  fontFamily: "inherit",
  fontSize: 8,
  lineHeight: 1.8,
  resize: "vertical",
};

const relationshipFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 9,
  paddingTop: 8,
  borderTop: "1px solid rgba(251,146,60,.08)",
  color: "#64748b",
  fontSize: 7,
};

const historyPanelStyle: React.CSSProperties = {
  margin: "16px 0 18px",
  padding: 14,
  border: "1px solid rgba(244,114,182,.14)",
  borderRadius: 10,
  background:
    "linear-gradient(180deg, rgba(40,18,34,.42), rgba(12,10,14,.68))",
};

const historyHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 11,
};

const historyEyebrowStyle: React.CSSProperties = {
  marginBottom: 4,
  color: "#f9a8d4",
  fontSize: 8,
  fontWeight: 800,
};

const historyTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#fdf2f8",
  fontSize: 14,
};

const historyHintStyle: React.CSSProperties = {
  maxWidth: 760,
  marginTop: 5,
  color: "#94a3b8",
  fontSize: 8,
  lineHeight: 1.9,
};

const historyHeaderStatsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 6,
  flexWrap: "wrap",
};

const historyStatBadgeStyle: React.CSSProperties = {
  padding: "5px 8px",
  border: "1px solid rgba(244,114,182,.18)",
  borderRadius: 999,
  color: "#fbcfe8",
  background: "rgba(131,24,67,.10)",
  fontSize: 8,
  whiteSpace: "nowrap",
};

const historyEmptyStyle: React.CSSProperties = {
  padding: "10px 11px",
  border: "1px dashed rgba(244,114,182,.13)",
  borderRadius: 7,
  color: "#64748b",
  fontSize: 9,
};

const historyTrendStyle: React.CSSProperties = {
  marginBottom: 10,
  padding: 9,
  border: "1px solid rgba(148,163,184,.08)",
  borderRadius: 7,
  background: "rgba(15,10,15,.35)",
};

const historySubTitleStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#f5d0fe",
  fontSize: 9,
};

const historyTrendChipsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const historyTrendChipStyle: React.CSSProperties = {
  padding: "4px 7px",
  border: "1px solid rgba(244,114,182,.13)",
  borderRadius: 999,
  color: "#e9d5ff",
  background: "rgba(88,28,135,.10)",
  fontSize: 8,
};

const historyColumnsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 10,
};

const historyColumnStyle: React.CSSProperties = {
  minWidth: 0,
};

const historyRevisionListStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  maxHeight: 560,
  overflowY: "auto",
  paddingLeft: 2,
};

const historyRevisionCardStyle: React.CSSProperties = {
  border: "1px solid rgba(148,163,184,.09)",
  borderRadius: 7,
  background: "rgba(15,12,18,.46)",
  overflow: "hidden",
};

const historyRevisionSummaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "9px 10px",
  color: "#f1f5f9",
  cursor: "pointer",
  fontSize: 9,
  fontWeight: 700,
};

const historyRevisionScoreStyle: React.CSSProperties = {
  color: "#f9a8d4",
  fontSize: 8,
  whiteSpace: "nowrap",
};

const historyRevisionBodyStyle: React.CSSProperties = {
  padding: "0 10px 10px",
  borderTop: "1px solid rgba(148,163,184,.07)",
};

const historyRevisionMetaStyle: React.CSSProperties = {
  paddingTop: 8,
  color: "#64748b",
  fontSize: 7,
  lineHeight: 1.8,
};

const historyChangeListStyle: React.CSSProperties = {
  marginTop: 7,
};

const historyChangeLineStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: 8,
  lineHeight: 1.8,
};

const historyRevisionPreviewGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 7,
  marginTop: 8,
};

const historyPreviewFieldStyle: React.CSSProperties = {
  minWidth: 0,
  padding: 8,
  border: "1px solid rgba(148,163,184,.08)",
  borderRadius: 6,
  background: "rgba(2,6,10,.30)",
};

const historyPreviewLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 5,
  color: "#94a3b8",
  fontSize: 7,
};

const historyPreviewValueStyle: React.CSSProperties = {
  color: "#e2e8f0",
  fontSize: 8,
  lineHeight: 1.8,
  whiteSpace: "pre-wrap",
  maxHeight: 100,
  overflowY: "auto",
};

const historyHashStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#475569",
  fontSize: 7,
};

const historyAuditListStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  maxHeight: 560,
  overflowY: "auto",
};

const historyAuditRowStyle: React.CSSProperties = {
  padding: 9,
  border: "1px solid rgba(148,163,184,.08)",
  borderRadius: 7,
  background: "rgba(15,12,18,.36)",
};

const historyAuditTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const historyAuditLabelStyle: React.CSSProperties = {
  color: "#f5d0fe",
  fontSize: 8,
};

const historyAuditTimeStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 7,
};

const historyAuditDetailStyle: React.CSSProperties = {
  marginTop: 5,
  color: "#cbd5e1",
  fontSize: 8,
  lineHeight: 1.7,
};

const historyAuditActorStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 7,
};

const historyMutedStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 8,
  lineHeight: 1.8,
};

const traceabilityPanelStyle: React.CSSProperties = {
  margin: "16px 0 18px",
  padding: 14,
  border: "1px solid rgba(56,189,248,.17)",
  borderRadius: 10,
  background:
    "linear-gradient(180deg, rgba(7,27,38,.60), rgba(5,15,20,.72))",
};

const traceabilityHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 11,
};

const traceabilityEyebrowStyle: React.CSSProperties = {
  marginBottom: 4,
  color: "#7dd3fc",
  fontSize: 8,
  fontWeight: 800,
};

const traceabilityTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#e0f2fe",
  fontSize: 14,
};

const traceabilityHintStyle: React.CSSProperties = {
  maxWidth: 760,
  marginTop: 5,
  color: "#94a3b8",
  fontSize: 8,
  lineHeight: 1.9,
};

const traceabilityHeaderActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 7,
  flexWrap: "wrap",
};

const traceabilityCoverageBadgeStyle: React.CSSProperties = {
  padding: "5px 8px",
  border: "1px solid rgba(56,189,248,.20)",
  borderRadius: 999,
  color: "#bae6fd",
  background: "rgba(12,74,110,.12)",
  fontSize: 8,
  whiteSpace: "nowrap",
};

const traceabilityMachineButtonStyle: React.CSSProperties = {
  minHeight: 31,
  padding: "6px 10px",
  border: "1px solid rgba(96,165,250,.28)",
  borderRadius: 7,
  color: "#dbeafe",
  background: "rgba(30,64,175,.18)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 8,
};

const traceabilityClearButtonStyle: React.CSSProperties = {
  minHeight: 31,
  padding: "6px 10px",
  border: "1px solid rgba(248,113,113,.18)",
  borderRadius: 7,
  color: "#fecaca",
  background: "rgba(127,29,29,.10)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 8,
};

const traceabilityEmptyStyle: React.CSSProperties = {
  padding: "10px 11px",
  border: "1px dashed rgba(56,189,248,.15)",
  borderRadius: 7,
  color: "#64748b",
  fontSize: 9,
};

const traceabilitySectionListStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
};

const traceabilityDetailsStyle: React.CSSProperties = {
  border: "1px solid rgba(148,163,184,.10)",
  borderRadius: 7,
  background: "rgba(2,10,15,.45)",
  overflow: "hidden",
};

const traceabilitySummaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "9px 10px",
  color: "#dbeafe",
  cursor: "pointer",
  fontSize: 9,
  fontWeight: 700,
};

const traceabilitySummaryCountStyle: React.CSSProperties = {
  color: "#7dd3fc",
  fontSize: 8,
  fontWeight: 600,
};

const traceabilityDetailsBodyStyle: React.CSSProperties = {
  padding: "0 10px 10px",
  borderTop: "1px solid rgba(148,163,184,.07)",
};

const traceabilityEvidenceGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 7,
  paddingTop: 9,
};

const traceabilityEvidenceOptionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 7,
  minWidth: 0,
  padding: "8px 9px",
  border: "1px solid rgba(148,163,184,.09)",
  borderRadius: 7,
  background: "rgba(15,23,42,.24)",
  cursor: "pointer",
};

const traceabilityEvidenceSelectedStyle: React.CSSProperties = {
  ...traceabilityEvidenceOptionStyle,
  border: "1px solid rgba(56,189,248,.24)",
  background: "rgba(14,116,144,.12)",
};

const traceabilityEvidenceTextStyle: React.CSSProperties = {
  display: "grid",
  minWidth: 0,
  gap: 4,
  color: "#e2e8f0",
  fontSize: 8,
  lineHeight: 1.6,
};

const traceabilityEvidenceMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 7,
  overflowWrap: "anywhere",
};

const traceabilityNoteStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 62,
  boxSizing: "border-box",
  marginTop: 8,
  padding: "7px 8px",
  border: "1px solid rgba(148,163,184,.10)",
  borderRadius: 6,
  color: "#e2e8f0",
  background: "rgba(2,10,15,.55)",
  fontFamily: "inherit",
  fontSize: 8,
  lineHeight: 1.8,
  resize: "vertical",
};

const traceabilityMachineNoticeStyle: React.CSSProperties = {
  marginTop: 9,
  padding: "7px 8px",
  border: "1px solid rgba(96,165,250,.12)",
  borderRadius: 6,
  color: "#bfdbfe",
  background: "rgba(30,64,175,.07)",
  fontSize: 7,
  lineHeight: 1.8,
};

const analysisQualityPanelStyle: React.CSSProperties = {
  margin: "16px 0 18px",
  padding: 14,
  border: "1px solid rgba(34,197,94,.18)",
  borderRadius: 10,
  background:
    "linear-gradient(180deg, rgba(8,31,21,.62), rgba(6,16,12,.72))",
};

const analysisQualityHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
  marginBottom: 12,
};

const analysisQualityEyebrowStyle: React.CSSProperties = {
  marginBottom: 4,
  color: "#86efac",
  fontSize: 8,
  fontWeight: 800,
};

const analysisQualityTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#f0fdf4",
  fontSize: 15,
};

const analysisQualityHintStyle: React.CSSProperties = {
  maxWidth: 760,
  marginTop: 5,
  color: "#94a3b8",
  fontSize: 8,
  lineHeight: 1.9,
};

const analysisQualityScoreWrapStyle: React.CSSProperties = {
  flex: "0 0 auto",
  minWidth: 96,
  padding: "9px 11px",
  border: "1px solid rgba(52,211,153,.20)",
  borderRadius: 9,
  textAlign: "center",
  background: "rgba(20,83,45,.13)",
};

const analysisQualityScoreStyle: React.CSSProperties = {
  color: "#d1fae5",
  fontSize: 23,
  fontWeight: 900,
  lineHeight: 1,
};

const analysisQualityScoreUnitStyle: React.CSSProperties = {
  marginRight: 2,
  color: "#6ee7b7",
  fontSize: 9,
  fontWeight: 700,
};

const analysisQualityLevelStyle: React.CSSProperties = {
  marginTop: 5,
  color: "#a7f3d0",
  fontSize: 8,
};

const analysisQualitySummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 7,
  marginBottom: 10,
};

const qualitySummaryItemStyle: React.CSSProperties = {
  padding: "8px 9px",
  border: "1px solid rgba(148,163,184,.10)",
  borderRadius: 7,
  background: "rgba(2,12,8,.42)",
};

const qualitySummaryLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 4,
  color: "#64748b",
  fontSize: 8,
};

const qualitySummaryValueStyle: React.CSSProperties = {
  color: "#dbe7e0",
  fontSize: 9,
};

const analysisQualityDimensionsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 8,
};

const qualityDimensionCardStyle: React.CSSProperties = {
  minWidth: 0,
  padding: 9,
  border: "1px solid rgba(148,163,184,.10)",
  borderRadius: 8,
  background: "rgba(3,12,9,.52)",
};

const qualityDimensionTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 7,
};

const qualityDimensionLabelStyle: React.CSSProperties = {
  color: "#e2e8f0",
  fontSize: 9,
};

const qualityDimensionScoreStyle: React.CSSProperties = {
  color: "#a7f3d0",
  fontSize: 9,
  fontWeight: 800,
};

const qualityDimensionNaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 8,
};

const qualityBarTrackStyle: React.CSSProperties = {
  height: 5,
  overflow: "hidden",
  borderRadius: 999,
  background: "rgba(148,163,184,.10)",
};

const qualityBarFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "currentColor",
  color: "#34d399",
};

const qualityDimensionDetailStyle: React.CSSProperties = {
  marginTop: 7,
  color: "#94a3b8",
  fontSize: 8,
  lineHeight: 1.75,
};

const qualityInformationalStyle: React.CSSProperties = {
  marginTop: 5,
  color: "#93c5fd",
  fontSize: 7,
};

const analysisQualityNotesGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 8,
  marginTop: 10,
};

const analysisQualityNoteBoxStyle: React.CSSProperties = {
  padding: 9,
  border: "1px solid rgba(148,163,184,.09)",
  borderRadius: 7,
  background: "rgba(2,9,7,.38)",
};

const analysisQualityNoteTitleStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "#d1fae5",
  fontSize: 9,
};

const analysisQualityPositiveLineStyle: React.CSSProperties = {
  color: "#a7f3d0",
  fontSize: 8,
  lineHeight: 1.8,
};

const analysisQualityCautionLineStyle: React.CSSProperties = {
  color: "#fde68a",
  fontSize: 8,
  lineHeight: 1.8,
};

const analysisQualityMutedLineStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 8,
  lineHeight: 1.8,
};

const analysisQualityFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
  paddingTop: 9,
  borderTop: "1px solid rgba(52,211,153,.09)",
  color: "#64748b",
  fontSize: 7,
};

const humanReviewButtonStyle: React.CSSProperties = {
  minHeight: 31,
  padding: "6px 10px",
  border: "1px solid rgba(167,139,250,.32)",
  borderRadius: 7,
  color: "#ede9fe",
  background: "rgba(91,33,182,.18)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 9,
};

const humanReviewProgressBadgeStyle: React.CSSProperties = {
  padding: "4px 8px",
  border: "1px solid rgba(251,191,36,.20)",
  borderRadius: 999,
  color: "#fde68a",
  background: "rgba(120,53,15,.12)",
  fontSize: 8,
  whiteSpace: "nowrap",
};

const humanReviewCompletedBadgeStyle: React.CSSProperties = {
  ...humanReviewProgressBadgeStyle,
  border: "1px solid rgba(52,211,153,.24)",
  color: "#a7f3d0",
  background: "rgba(20,83,45,.18)",
};

const humanReviewStaleStyle: React.CSSProperties = {
  marginBottom: 12,
  padding: "9px 10px",
  border: "1px solid rgba(248,113,113,.24)",
  borderRadius: 7,
  color: "#fecaca",
  background: "rgba(127,29,29,.14)",
  fontSize: 9,
  lineHeight: 1.9,
};

const humanReviewPanelStyle: React.CSSProperties = {
  marginBottom: 14,
  padding: 13,
  border: "1px solid rgba(167,139,250,.20)",
  borderRadius: 9,
  background:
    "linear-gradient(180deg, rgba(40,25,75,.25), rgba(10,14,20,.62))",
};

const humanReviewPanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 9,
};

const humanReviewEyebrowStyle: React.CSSProperties = {
  marginBottom: 4,
  color: "#c4b5fd",
  fontSize: 8,
  fontWeight: 800,
};

const humanReviewPanelTitleStyle: React.CSSProperties = {
  display: "block",
  color: "#f5f3ff",
  fontSize: 12,
};

const humanReviewPanelMetaStyle: React.CSSProperties = {
  marginTop: 5,
  color: "#64748b",
  fontSize: 8,
  lineHeight: 1.7,
};

const humanReviewSafetyBadgeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "4px 8px",
  border: "1px solid rgba(52,211,153,.22)",
  borderRadius: 999,
  color: "#a7f3d0",
  background: "rgba(20,83,45,.14)",
  fontSize: 8,
};

const humanReviewIntroStyle: React.CSSProperties = {
  marginBottom: 10,
  padding: "8px 9px",
  border: "1px solid rgba(167,139,250,.10)",
  borderRadius: 6,
  color: "#cbd5e1",
  background: "rgba(30,27,75,.13)",
  fontSize: 8,
  lineHeight: 1.9,
};

const humanReviewListStyle: React.CSSProperties = {
  display: "grid",
  gap: 9,
  marginBottom: 11,
};

const humanReviewCardStyle: React.CSSProperties = {
  padding: 10,
  border: "1px solid rgba(148,163,184,.11)",
  borderRadius: 8,
  background: "rgba(2,8,14,.48)",
};

const humanReviewCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 9,
  marginBottom: 8,
};

const humanReviewCardTitleStyle: React.CSSProperties = {
  color: "#e2e8f0",
  fontSize: 10,
};

const humanReviewSelectStyle: React.CSSProperties = {
  minWidth: 180,
  minHeight: 31,
  padding: "5px 8px",
  border: "1px solid rgba(167,139,250,.18)",
  borderRadius: 6,
  color: "#e2e8f0",
  background: "#10141c",
  fontFamily: "inherit",
  fontSize: 9,
  outline: "none",
};

const humanReviewCompareGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 8,
};

const humanReviewMachineColumnStyle: React.CSSProperties = {
  minWidth: 0,
  padding: 9,
  border: "1px solid rgba(96,165,250,.11)",
  borderRadius: 7,
  background: "rgba(30,64,175,.07)",
};

const humanReviewAnalystColumnStyle: React.CSSProperties = {
  minWidth: 0,
  padding: 9,
  border: "1px solid rgba(52,211,153,.11)",
  borderRadius: 7,
  background: "rgba(20,83,45,.07)",
};

const humanReviewColumnLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "#94a3b8",
  fontSize: 8,
  fontWeight: 700,
};

const humanReviewCompareTextStyle: React.CSSProperties = {
  color: "#dbe7e0",
  fontSize: 9,
  lineHeight: 1.9,
  whiteSpace: "pre-wrap",
};

const humanReviewDecisionLineStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#94a3b8",
  fontSize: 8,
};

const humanReviewNoteInputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 58,
  boxSizing: "border-box",
  marginTop: 7,
  padding: "7px 8px",
  border: "1px solid rgba(148,163,184,.12)",
  borderRadius: 6,
  color: "#e2e8f0",
  background: "rgba(2,10,7,.58)",
  fontFamily: "inherit",
  fontSize: 9,
  lineHeight: 1.8,
  resize: "vertical",
};

const humanReviewFooterStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 10,
  paddingTop: 10,
  borderTop: "1px solid rgba(167,139,250,.10)",
};

const humanReviewFooterMetaStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 8,
};

const structuredHeaderActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 7,
  flexWrap: "wrap",
};

const machineDraftButtonStyle: React.CSSProperties = {
  minHeight: 31,
  padding: "6px 10px",
  border: "1px solid rgba(96,165,250,.34)",
  borderRadius: 7,
  color: "#dbeafe",
  background: "rgba(30,64,175,.24)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 9,
};

const machineDraftSecondaryButtonStyle: React.CSSProperties = {
  minHeight: 31,
  padding: "6px 10px",
  border: "1px solid rgba(148,163,184,.18)",
  borderRadius: 7,
  color: "#cbd5e1",
  background: "rgba(30,41,59,.22)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 9,
};

const machineDraftEmptyHintStyle: React.CSSProperties = {
  marginBottom: 10,
  padding: "8px 9px",
  border: "1px dashed rgba(96,165,250,.18)",
  borderRadius: 7,
  color: "#94a3b8",
  background: "rgba(30,58,138,.08)",
  fontSize: 9,
  lineHeight: 1.8,
};

const machinePreviewStyle: React.CSSProperties = {
  marginBottom: 13,
  padding: 12,
  border: "1px solid rgba(96,165,250,.22)",
  borderRadius: 9,
  background:
    "linear-gradient(180deg, rgba(13,35,70,.34), rgba(5,16,25,.58))",
};

const machinePreviewHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 9,
};

const machinePreviewEyebrowStyle: React.CSSProperties = {
  marginBottom: 4,
  color: "#93c5fd",
  fontSize: 8,
  fontWeight: 800,
};

const machinePreviewTitleStyle: React.CSSProperties = {
  display: "block",
  color: "#eff6ff",
  fontSize: 11,
};

const machinePreviewMetaStyle: React.CSSProperties = {
  marginTop: 5,
  color: "#64748b",
  fontSize: 8,
  lineHeight: 1.7,
};

const machinePreviewBadgeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "4px 7px",
  border: "1px solid rgba(251,191,36,.26)",
  borderRadius: 999,
  color: "#fde68a",
  background: "rgba(120,53,15,.18)",
  fontSize: 8,
};

const machinePreviewNoteStyle: React.CSSProperties = {
  marginBottom: 9,
  padding: "7px 8px",
  border: "1px solid rgba(96,165,250,.11)",
  borderRadius: 6,
  color: "#bfdbfe",
  background: "rgba(30,64,175,.08)",
  fontSize: 8,
  lineHeight: 1.8,
};

const machinePreviewGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 7,
};

const machinePreviewFieldStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "8px 9px",
  border: "1px solid rgba(148,163,184,.10)",
  borderRadius: 7,
  background: "rgba(2,10,18,.36)",
};

const machinePreviewFieldLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 5,
  color: "#60a5fa",
  fontSize: 8,
  fontWeight: 700,
};

const machinePreviewFieldValueStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: 9,
  lineHeight: 1.9,
  whiteSpace: "pre-wrap",
};

const machinePreviewActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
  marginTop: 10,
  paddingTop: 9,
  borderTop: "1px solid rgba(96,165,250,.10)",
};

const structuredSectionStyle: React.CSSProperties = {
  margin: "16px 0 18px",
  padding: 14,
  border: "1px solid rgba(52,211,153,.18)",
  borderRadius: 10,
  background:
    "linear-gradient(180deg, rgba(6,31,20,.62), rgba(8,18,13,.70))",
};

const structuredSectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
};

const structuredEyebrowStyle: React.CSSProperties = {
  marginBottom: 4,
  color: "#6ee7b7",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: ".03em",
};

const structuredTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: 15,
};

const structuredHintStyle: React.CSSProperties = {
  maxWidth: 720,
  marginTop: 5,
  color: "#94a3b8",
  fontSize: 9,
  lineHeight: 1.8,
};

const completenessBadgeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "5px 9px",
  border: "1px solid rgba(52,211,153,.24)",
  borderRadius: 999,
  color: "#a7f3d0",
  background: "rgba(52,211,153,.06)",
  fontSize: 9,
  whiteSpace: "nowrap",
};

const structuredGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
};

const scenarioGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
  marginBottom: 14,
};

const scenarioCardStyle: React.CSSProperties = {
  padding: 11,
  border: "1px solid rgba(148,163,184,.14)",
  borderRadius: 8,
  background: "rgba(5,15,10,.62)",
};

const scenarioCardHeaderStyle: React.CSSProperties = {
  marginBottom: 9,
  color: "#d1fae5",
  fontSize: 11,
  fontWeight: 800,
};

const actionPlanStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
  marginBottom: 14,
  padding: 12,
  border: "1px solid rgba(52,211,153,.12)",
  borderRadius: 8,
  background: "rgba(5,19,13,.40)",
};

const evidenceRoutingPanelStyle: React.CSSProperties = {
  padding: 16,
  marginBottom: 15,
  background:
    "linear-gradient(180deg, rgba(8,38,25,.92), rgba(11,23,17,.96))",
  border: "1px solid rgba(52,211,153,.28)",
  borderRadius: 10,
  boxShadow: "0 12px 32px rgba(0,0,0,.20)",
};

const evidenceRoutingHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 10,
};

const evidenceRoutingEyebrowStyle: React.CSSProperties = {
  marginBottom: 4,
  color: "#6ee7b7",
  fontSize: 10,
  fontWeight: 700,
};

const evidenceRoutingTitleStyle: React.CSSProperties = {
  display: "block",
  color: "#fff",
  fontSize: 14,
};

const evidenceRoutingBadgeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "4px 8px",
  border: "1px solid rgba(52,211,153,.22)",
  borderRadius: 999,
  color: "#a7f3d0",
  background: "rgba(52,211,153,.06)",
  fontSize: 9,
};

const evidenceRoutingSummaryStyle: React.CSSProperties = {
  padding: "9px 10px",
  marginBottom: 12,
  border: "1px solid rgba(148,163,184,.12)",
  borderRadius: 7,
  color: "#d1d5db",
  background: "rgba(3,13,9,.46)",
  fontSize: 11,
  lineHeight: 1.8,
};

const evidenceRouteOptionsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 9,
  marginBottom: 12,
};

const evidenceRouteOptionStyle = (
  active: boolean,
  disabled = false
): React.CSSProperties => ({
  minHeight: 78,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  gap: 6,
  padding: 12,
  direction: "rtl",
  textAlign: "right",
  border: active
    ? "1px solid rgba(52,211,153,.55)"
    : "1px solid rgba(100,116,139,.25)",
  borderRadius: 8,
  color: disabled ? "#64748b" : "#f8fafc",
  background: active
    ? "rgba(20,83,45,.62)"
    : "rgba(8,15,12,.72)",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.55 : 1,
  fontFamily: "inherit",
});

const evidenceRouteOptionHintStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 10,
  lineHeight: 1.7,
};

const evidenceRoutingActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 4,
};

const containerStyle: React.CSSProperties = {
  padding: 18,
  color: "#fff",
  background: "#111",
  minHeight: "100%",
  boxSizing: "border-box",
};

const stickyToolbarStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "10px 0 12px",
  marginBottom: 12,
  background: "#111",
  borderBottom: "1px solid #242424",
};

const subTitleStyle: React.CSSProperties = {
  color: "#999",
  fontSize: 12,
  marginTop: 4,
};

const tabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
  marginBottom: 15,
};

const panelStyle: React.CSSProperties = {
  padding: 16,
  background: "#171717",
  border: "1px solid #303030",
  borderRadius: 10,
  marginBottom: 15,
};

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
};

const responsiveGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 10,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: 10,
};

const labelStyle: React.CSSProperties = {
  color: "#ccc",
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0d0d0d",
  color: "#fff",
  border: "1px solid #444",
  padding: 9,
  borderRadius: 6,
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 90,
  resize: "vertical",
};

const smallTextareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 75,
  resize: "vertical",
};

const riskBoxStyle: React.CSSProperties = {
  ...inputStyle,
  textAlign: "center",
  color: "#fbbf24",
  fontWeight: "bold",
};

const greenButton: React.CSSProperties = {
  padding: "9px 14px",
  background: "#14532d",
  border: "1px solid #22c55e",
  color: "#fff",
  borderRadius: 7,
  cursor: "pointer",
};

const grayButton: React.CSSProperties = {
  padding: "9px 14px",
  background: "#242424",
  border: "1px solid #555",
  color: "#fff",
  borderRadius: 7,
  cursor: "pointer",
};

const smallButton: React.CSSProperties = {
  padding: "6px 10px",
  background: "#1f2937",
  border: "1px solid #4b5563",
  color: "#fff",
  borderRadius: 6,
  cursor: "pointer",
};

const redButton: React.CSSProperties = {
  ...smallButton,
  background: "#451a1a",
  border: "1px solid #7f1d1d",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const noticeStyle: React.CSSProperties = {
  padding: 10,
  background: "#18202a",
  border: "1px solid #374151",
  borderRadius: 7,
  marginBottom: 15,
};

const messageBoxStyle: React.CSSProperties = {
  padding: 30,
  color: "#fff",
};

const archiveBlockStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(170px, 230px) minmax(0, 1fr)",
  gap: 12,
  marginTop: 11,
  padding: 10,
  border: "1px solid rgba(52,211,153,.16)",
  borderRadius: 8,
  background: "rgba(4,22,14,.52)",
};

const archiveImageWrapStyle: React.CSSProperties = {
  position: "relative",
  minHeight: 130,
  overflow: "hidden",
  border: "1px solid rgba(148,163,184,.14)",
  borderRadius: 7,
  background: "#000",
};

const archiveImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: 130,
  display: "block",
  objectFit: "contain",
  background: "#000",
};

const archiveImageBadgeStyle: React.CSSProperties = {
  position: "absolute",
  right: 7,
  bottom: 7,
  padding: "4px 7px",
  border: "1px solid rgba(52,211,153,.24)",
  borderRadius: 999,
  color: "#d1fae5",
  background: "rgba(4,22,14,.88)",
  fontSize: 8,
  backdropFilter: "blur(6px)",
};

const archiveMissingImageStyle: React.CSSProperties = {
  minHeight: 130,
  display: "grid",
  placeItems: "center",
  padding: 12,
  textAlign: "center",
  color: "#94a3b8",
  border: "1px dashed rgba(148,163,184,.22)",
  borderRadius: 7,
  background: "rgba(2,8,5,.52)",
  fontSize: 10,
  lineHeight: 1.8,
};

const archiveDetailsStyle: React.CSSProperties = {
  minWidth: 0,
};

const archiveDetailsHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 9,
};

const archiveStatusBadgeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "3px 7px",
  border: "1px solid rgba(52,211,153,.18)",
  borderRadius: 999,
  color: "#86efac",
  background: "rgba(52,211,153,.045)",
  fontSize: 8,
};

const archiveMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
  gap: 7,
};

const archiveMetaItemStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "7px 8px",
  border: "1px solid rgba(148,163,184,.10)",
  borderRadius: 6,
  background: "rgba(2,10,7,.48)",
};

const archiveMetaLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 3,
  color: "#64748b",
  fontSize: 8,
};

const archiveMetaValueStyle: React.CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#dbe7e0",
  fontSize: 9,
};

const archiveNoteStyle: React.CSSProperties = {
  marginTop: 8,
  padding: "7px 8px",
  color: "#a7b7ad",
  border: "1px solid rgba(148,163,184,.08)",
  borderRadius: 6,
  background: "rgba(15,23,42,.18)",
  fontSize: 9,
  lineHeight: 1.75,
};

const archiveActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
  marginTop: 9,
};

const archivePrimaryLinkStyle: React.CSSProperties = {
  padding: "6px 9px",
  color: "#ecfdf5",
  border: "1px solid rgba(52,211,153,.28)",
  borderRadius: 6,
  background: "rgba(20,83,45,.52)",
  textDecoration: "none",
  fontSize: 9,
};

const archiveSecondaryLinkStyle: React.CSSProperties = {
  padding: "6px 9px",
  color: "#cbd5e1",
  border: "1px solid rgba(148,163,184,.18)",
  borderRadius: 6,
  background: "rgba(30,41,59,.24)",
  textDecoration: "none",
  fontSize: 9,
};

const archiveCopyButtonStyle: React.CSSProperties = {
  minHeight: 29,
  padding: "0 9px",
  color: "#cbd5e1",
  border: "1px solid rgba(148,163,184,.18)",
  borderRadius: 6,
  background: "rgba(30,41,59,.24)",
  fontFamily: "inherit",
  fontSize: 9,
  cursor: "pointer",
};

const legacyEvidenceNoticeStyle: React.CSSProperties = {
  marginTop: 9,
  padding: "8px 9px",
  color: "#94a3b8",
  border: "1px dashed rgba(148,163,184,.16)",
  borderRadius: 6,
  background: "rgba(15,23,42,.16)",
  fontSize: 9,
  lineHeight: 1.8,
};

const evidenceListStyle: React.CSSProperties = {
  display: "grid",
  gap: 9,
  marginBottom: 14,
};

const evidenceCardStyle: React.CSSProperties = {
  padding: 11,
  background: "#101010",
  border: "1px solid #334155",
  borderRadius: 8,
};

const evidenceSummaryStyle: React.CSSProperties = {
  color: "#d1d5db",
  fontSize: 12,
  lineHeight: 1.7,
  marginTop: 8,
};

const emptyEvidenceStyle: React.CSSProperties = {
  padding: 16,
  textAlign: "center",
  color: "#94a3b8",
  border: "1px dashed #3b4657",
  borderRadius: 8,
  marginBottom: 14,
};

const analysisCardStyle: React.CSSProperties = {
  padding: 12,
  background: "#101010",
  border: "1px solid #333",
  borderRadius: 8,
  marginBottom: 10,
};

const cardTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const metaStyle: React.CSSProperties = {
  color: "#999",
  marginTop: 6,
  fontSize: 11,
};

const cardActionsStyle: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
};

const statusBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  background: "#222",
  padding: "4px 8px",
  borderRadius: 20,
  border: "1px solid #3b3b3b",
  whiteSpace: "nowrap",
};

const emptyListStyle: React.CSSProperties = {
  textAlign: "center",
  color: "#999",
  padding: 20,
};

const linkStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 8,
  color: "#38bdf8",
  fontSize: 12,
  textDecoration: "none",
};

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: "7px 11px",
  borderRadius: 6,
  border: active ? "1px solid #22c55e" : "1px solid #333",
  background: active ? "#17351f" : "#181818",
  color: "#fff",
  cursor: "pointer",
});
