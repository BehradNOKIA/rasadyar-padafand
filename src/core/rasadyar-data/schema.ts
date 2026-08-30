/*
 * Rasadyar Data Model — Schema v1
 *
 * این فایل مدل مرکزی داده رصدیار را تعریف می‌کند.
 * در این مرحله هیچ UI یا Workflow موجودی به این مدل وابسته نشده است.
 * هدف: تثبیت قرارداد داده قبل از انتقال تدریجی از localStorage پراکنده
 * به Repository/Backend/Database.
 */

export const RASADYAR_SCHEMA_VERSION = 1 as const;

export type RasadyarSchemaVersion =
  typeof RASADYAR_SCHEMA_VERSION;

export type RasadyarId = string;
export type IsoDateString = string;

export type JsonPrimitive =
  | string
  | number
  | boolean
  | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]:
        JsonValue;
    };


/* =========================================================
   Evidence / Archive
========================================================= */

export type EvidenceKind =
  | "news"
  | "live-stream"
  | "alert"
  | "map"
  | "infrastructure"
  | "sanctions"
  | "radiation"
  | "economic"
  | "cyber"
  | "aviation"
  | "maritime"
  | "weather"
  | "manual";


export type ArchiveSnapshotKind =
  | "video-frame"
  | "youtube-thumbnail"
  | "metadata-card";


export type ArchiveMediaType =
  | "live-stream"
  | "news"
  | "map"
  | "alert"
  | "infrastructure"
  | "sanctions"
  | "radiation"
  | "economic"
  | "cyber"
  | "aviation"
  | "maritime"
  | "weather"
  | "manual";


export interface RasadyarArchive {
  schemaVersion:
    RasadyarSchemaVersion;

  archiveId:
    RasadyarId;

  archivedAt:
    IsoDateString;

  archiveVersion:
    number;

  snapshotKind:
    ArchiveSnapshotKind;

  snapshotDataUrl?:
    string;

  mediaType?:
    ArchiveMediaType;

  channelId?:
    string;

  channelName?:
    string;

  videoId?:
    string;

  originalUrl?:
    string;

  streamUrl?:
    string;

  playbackState?:
    string;

  note?:
    string;

  /**
   * برای Backend آینده:
   * hash/checksum فایل یا تصویر آرشیوی.
   */
  checksum?:
    string;

  metadata?:
    Record<
      string,
      JsonValue
    >;
}


export interface RasadyarEvidence {
  schemaVersion:
    RasadyarSchemaVersion;

  id:
    RasadyarId;

  kind:
    EvidenceKind;

  title:
    string;

  source?:
    string;

  url?:
    string;

  country?:
    string;

  region?:
    string;

  lat?:
    number;

  lon?:
    number;

  timestamp:
    IsoDateString;

  summary?:
    string;

  description?:
    string;

  /**
   * در Store نرمال‌شده فقط شناسه آرشیو نگهداری می‌شود.
   */
  archiveId?:
    RasadyarId;

  createdAt:
    IsoDateString;

  createdBy?:
    string;

  metadata?:
    Record<
      string,
      JsonValue
    >;
}


/**
 * Snapshot مستقل شاهد برای گزارش.
 *
 * گزارش باید بتواند حتی پس از تغییر Case/Evidence اصلی،
 * همان شاهدِ زمان ساخت گزارش را بازسازی کند.
 */
export interface RasadyarEvidenceSnapshot
  extends RasadyarEvidence {
  archiveSnapshot?:
    RasadyarArchive;
}


/* =========================================================
   Analysis Case
========================================================= */

export type AnalysisCaseStatus =
  | "draft"
  | "review"
  | "completed";

export type RasadyarAnalysisStatus =
  AnalysisCaseStatus;


/*
 * P3 Structured Analysis contract.
 *
 * Existing Case fields remain for compatibility, while this structure gives
 * the future AI engine and analyst-review workflow a stable analytical model.
 */
export interface RasadyarScenarioAssessment {
  narrative:
    string;

  indicators:
    string;
}


export interface RasadyarActionPlan {
  immediate:
    string;

  shortTerm:
    string;

  mediumTerm:
    string;

  monitoringRequirements:
    string;
}


export interface RasadyarStructuredAssessment {
  situationSummary:
    string;

  keyPoints:
    string;

  actorsFactors:
    string;

  drivers:
    string;

  warningIndicators:
    string;

  confidence:
    string;

  informationGaps:
    string;

  assumptions:
    string;

  implications:
    string;

  analyticalJudgment:
    string;

  scenarios: {
    likely:
      RasadyarScenarioAssessment;

    worst:
      RasadyarScenarioAssessment;

    best:
      RasadyarScenarioAssessment;
  };

  actions:
    RasadyarActionPlan;
}


export type RasadyarMachineDraftMode =
  | "browser-ml-hybrid"
  | "local-grounded";


export interface RasadyarMachineAnalysisDraft {
  draftId:
    RasadyarId;

  engineVersion:
    string;

  engineMode:
    RasadyarMachineDraftMode;

  generatedAt:
    IsoDateString;

  /**
   * Exact Evidence set used when the machine draft was generated.
   */
  evidenceIds:
    RasadyarId[];

  /**
   * Machine output is preserved separately from the analyst assessment.
   */
  assessment:
    RasadyarStructuredAssessment;

  /**
   * Machine-suggested Evidence relevance by analytical section.
   * Advisory only; analyst approval is stored separately.
   */
  evidenceCitations?:
    Partial<
      Record<
        RasadyarHumanReviewSectionKey,
        RasadyarId[]
      >
    >;

  mlSignals?: {
    entityCount:
      number;

    entities:
      string[];

    negativeShare?:
      number;

    neutralShare?:
      number;

    positiveShare?:
      number;
  };

  note?:
    string;
}


export type RasadyarHumanReviewDecision =
  | "accepted"
  | "edited"
  | "rejected"
  | "needs-review";


export type RasadyarHumanReviewSectionKey =
  | "situationSummary"
  | "keyPoints"
  | "actorsFactors"
  | "drivers"
  | "warningIndicators"
  | "informationGaps"
  | "assumptions"
  | "implications"
  | "analyticalJudgment"
  | "scenarios"
  | "actions";


export interface RasadyarHumanReviewSection {
  decision:
    RasadyarHumanReviewDecision;

  note:
    string;

  reviewedAt:
    IsoDateString;

  reviewedBy:
    string;
}


export interface RasadyarHumanReviewRecord {
  reviewId:
    RasadyarId;

  /**
   * The review is valid only for this exact machine draft.
   */
  machineDraftId:
    RasadyarId;

  status:
    | "in-progress"
    | "completed";

  reviewedBy:
    string;

  reviewedByName:
    string;

  createdAt:
    IsoDateString;

  updatedAt:
    IsoDateString;

  completedAt?:
    IsoDateString;

  overallNote:
    string;

  sections:
    Partial<
      Record<
        RasadyarHumanReviewSectionKey,
        RasadyarHumanReviewSection
      >
    >;
}


export interface RasadyarEvidenceTraceabilitySection {
  evidenceIds:
    RasadyarId[];

  note:
    string;

  updatedAt:
    IsoDateString;

  updatedBy:
    string;
}


export interface RasadyarEvidenceTraceabilityRecord {
  traceabilityId:
    RasadyarId;

  version:
    string;

  createdAt:
    IsoDateString;

  updatedAt:
    IsoDateString;

  updatedBy:
    string;

  updatedByName:
    string;

  machineSuggestedFromDraftId?:
    RasadyarId;

  sections:
    Partial<
      Record<
        RasadyarHumanReviewSectionKey,
        RasadyarEvidenceTraceabilitySection
      >
    >;
}


export type RasadyarAnalysisQualityDimensionKey =
  | "evidenceQuality"
  | "sourceDiversity"
  | "freshness"
  | "archiveCoverage"
  | "evidenceConsistency"
  | "informationGapHandling"
  | "humanReviewCompletion"
  | "machineAnalystAgreement"
  | "analyticalCompleteness"
  | "confidenceCalibration"
  | "traceabilityCoverage";


export interface RasadyarAnalysisQualityDimension {
  key:
    RasadyarAnalysisQualityDimensionKey;

  label:
    string;

  score:
    number;

  weight:
    number;

  applicable:
    boolean;

  detail:
    string;
}


export interface RasadyarAnalysisQualityAssessment {
  version:
    string;

  calculatedAt:
    IsoDateString;

  overallScore:
    number;

  qualityLevel:
    | "weak"
    | "moderate"
    | "good"
    | "strong";

  reviewReadiness:
    | "insufficient"
    | "needs-work"
    | "ready";

  readyForReview:
    boolean;

  evidenceStrengthScore:
    number;

  suggestedEvidenceConfidence:
    string;

  analystConfidence:
    string;

  machineDraftStale:
    boolean;

  machineAnalystAgreementRate?:
    number;

  traceabilityCoverageScore:
    number;

  dimensions:
    RasadyarAnalysisQualityDimension[];

  strengths:
    string[];

  cautions:
    string[];
}


export type RasadyarEvidenceRelationshipType =
  | "possible-conflict"
  | "possible-corroboration"
  | "near-duplicate"
  | "source-concentration"
  | "temporal-divergence"
  | "location-divergence";


export type RasadyarEvidenceRelationshipReviewStatus =
  | "unreviewed"
  | "accepted"
  | "resolved"
  | "dismissed"
  | "needs-review";


export interface RasadyarEvidenceRelationshipFinding {
  findingId:
    RasadyarId;

  relationshipKey:
    string;

  type:
    RasadyarEvidenceRelationshipType;

  severity:
    | "low"
    | "medium"
    | "high";

  reviewStatus:
    RasadyarEvidenceRelationshipReviewStatus;

  evidenceIds:
    RasadyarId[];

  title:
    string;

  reason:
    string;

  machineSuggested:
    boolean;

  analystNote:
    string;

  reviewedBy?:
    string;

  reviewedAt?:
    IsoDateString;

  createdAt:
    IsoDateString;

  updatedAt:
    IsoDateString;
}


export interface RasadyarEvidenceRelationshipRegister {
  registerId:
    RasadyarId;

  version:
    string;

  scanVersion:
    string;

  scannedAt:
    IsoDateString;

  /**
   * Exact Evidence set present when the local relationship scan ran.
   */
  evidenceIds:
    RasadyarId[];

  findings:
    RasadyarEvidenceRelationshipFinding[];
}


export type RasadyarCaseReadinessCheckKey =
  | "evidenceSufficiency"
  | "sourceDiversity"
  | "archiveCoverage"
  | "structuredCompleteness"
  | "machineDraftFreshness"
  | "humanReview"
  | "traceability"
  | "conflictReview"
  | "qualityThreshold"
  | "informationGaps"
  | "revisionAudit";


export interface RasadyarCaseReadinessCheck {
  key:
    RasadyarCaseReadinessCheckKey;

  label:
    string;

  score:
    number;

  weight:
    number;

  status:
    | "pass"
    | "warning"
    | "block"
    | "not-applicable";

  blocking:
    boolean;

  detail:
    string;
}


export interface RasadyarCaseReadinessAssessment {
  version:
    string;

  calculatedAt:
    IsoDateString;

  score:
    number;

  status:
    | "not-ready"
    | "needs-attention"
    | "ready";

  readyForFinalReview:
    boolean;

  blockers:
    string[];

  warnings:
    string[];

  strengths:
    string[];

  checks:
    RasadyarCaseReadinessCheck[];
}


export type RasadyarAnalysisRevisionAction =
  | "created"
  | "draft-saved"
  | "sent-review"
  | "approved"
  | "evidence-added";


export type RasadyarAuditEventType =
  | "case-created"
  | "revision-created"
  | "sent-review"
  | "approved"
  | "evidence-added"
  | "report-created";


export interface RasadyarAnalysisRevisionSnapshot {
  title:
    string;

  analysisType:
    string;

  region:
    string;

  timeRange:
    string;

  domain:
    string;

  description:
    string;

  findings:
    string;

  probability:
    string;

  impact:
    string;

  confidence:
    string;

  likelyScenario:
    string;

  worstScenario:
    string;

  bestScenario:
    string;

  recommendations:
    string;

  status:
    RasadyarAnalysisStatus;

  /**
   * Keep only Evidence IDs to avoid duplicating Archive snapshots in history.
   */
  evidenceIds:
    RasadyarId[];

  structuredAssessment?:
    RasadyarStructuredAssessment;

  machineDraft?:
    RasadyarMachineAnalysisDraft;

  humanReview?:
    RasadyarHumanReviewRecord;

  qualityAssessment?:
    RasadyarAnalysisQualityAssessment;

  evidenceTraceability?:
    RasadyarEvidenceTraceabilityRecord;

  evidenceRelationshipRegister?:
    RasadyarEvidenceRelationshipRegister;

  readinessAssessment?:
    RasadyarCaseReadinessAssessment;
}


export interface RasadyarAnalysisRevision {
  revisionId:
    RasadyarId;

  sequence:
    number;

  action:
    RasadyarAnalysisRevisionAction;

  actor:
    string;

  actorName:
    string;

  createdAt:
    IsoDateString;

  snapshotHash:
    string;

  changeSummary:
    string[];

  snapshot:
    RasadyarAnalysisRevisionSnapshot;
}


export interface RasadyarAuditEvent {
  eventId:
    RasadyarId;

  eventType:
    RasadyarAuditEventType;

  actor:
    string;

  actorName:
    string;

  createdAt:
    IsoDateString;

  detail:
    string;

  revisionId?:
    RasadyarId;

  metadata?:
    Record<
      string,
      string | number | boolean | null | undefined
    >;
}


export interface RasadyarAnalysisCase {
  schemaVersion:
    RasadyarSchemaVersion;

  id:
    RasadyarId;

  title:
    string;

  analysisType:
    string;

  region:
    string;

  timeRange:
    string;

  domain:
    string;

  description:
    string;

  findings:
    string;

  probability:
    string;

  impact:
    string;

  confidence:
    string;

  likelyScenario:
    string;

  worstScenario:
    string;

  bestScenario:
    string;

  recommendations:
    string;

  /**
   * P3 analytical structure.
   * Optional for backward compatibility with already-persisted v1 records.
   */
  structuredAssessment?:
    RasadyarStructuredAssessment;

  /**
   * P3-Step2 machine draft remains independent from analyst judgment.
   */
  machineDraft?:
    RasadyarMachineAnalysisDraft;

  /**
   * Auditable Human-in-the-loop review tied to machineDraft.draftId.
   */
  humanReview?:
    RasadyarHumanReviewRecord;

  /**
   * P3-Step4 quality snapshot. It measures process/data quality, not truth.
   */
  qualityAssessment?:
    RasadyarAnalysisQualityAssessment;

  /**
   * Analyst-curated Evidence-to-analysis citation matrix.
   */
  evidenceTraceability?:
    RasadyarEvidenceTraceabilityRecord;

  /**
   * P3-Step7 local Evidence relationship/conflict review.
   */
  evidenceRelationshipRegister?:
    RasadyarEvidenceRelationshipRegister;

  /**
   * P3-Step8 consolidated pre-review readiness.
   */
  readinessAssessment?:
    RasadyarCaseReadinessAssessment;

  /**
   * P3-Step6 bounded local revision history.
   */
  revisionNumber?:
    number;

  revisionHistory?:
    RasadyarAnalysisRevision[];

  auditTrail?:
    RasadyarAuditEvent[];

  /**
   * رابطه نرمال‌شده Case -> Evidence.
   */
  evidenceIds:
    RasadyarId[];

  status:
    AnalysisCaseStatus;

  createdBy:
    string;

  createdByName:
    string;

  createdAt:
    IsoDateString;

  updatedAt:
    IsoDateString;

  completedAt?:
    IsoDateString;

  metadata?:
    Record<
      string,
      JsonValue
    >;
}


/* =========================================================
   Report
========================================================= */

export type ReportStatus =
  | "draft"
  | "review"
  | "published";


export interface RasadyarCaseSnapshot {
  id:
    RasadyarId;

  title:
    string;

  analysisType:
    string;

  region:
    string;

  timeRange:
    string;

  domain:
    string;

  description:
    string;

  findings:
    string;

  probability:
    string;

  impact:
    string;

  confidence:
    string;

  riskLevel?:
    string;

  likelyScenario:
    string;

  worstScenario:
    string;

  bestScenario:
    string;

  recommendations:
    string;

  /**
   * Immutable P3 structured assessment at report creation time.
   */
  structuredAssessment?:
    RasadyarStructuredAssessment;

  /**
   * Machine draft snapshot, retained for future human-vs-machine review.
   */
  machineDraft?:
    RasadyarMachineAnalysisDraft;

  /**
   * Human review snapshot retained with the report source Case.
   */
  humanReview?:
    RasadyarHumanReviewRecord;

  /**
   * Analysis quality snapshot retained with the immutable source Case.
   */
  qualityAssessment?:
    RasadyarAnalysisQualityAssessment;

  evidenceTraceability?:
    RasadyarEvidenceTraceabilityRecord;

  evidenceRelationshipRegister?:
    RasadyarEvidenceRelationshipRegister;

  readinessAssessment?:
    RasadyarCaseReadinessAssessment;

  revisionNumber?:
    number;

  revisionHistory?:
    RasadyarAnalysisRevision[];

  auditTrail?:
    RasadyarAuditEvent[];

  status:
    AnalysisCaseStatus;

  createdBy:
    string;

  createdByName:
    string;

  createdAt:
    IsoDateString;

  updatedAt:
    IsoDateString;

  snapshotAt:
    IsoDateString;
}


export interface RasadyarReport {
  schemaVersion:
    RasadyarSchemaVersion;

  id:
    RasadyarId;

  title:
    string;

  summary:
    string;

  content:
    string;

  status:
    ReportStatus;

  createdAt:
    IsoDateString;

  updatedAt:
    IsoDateString;

  publishedAt?:
    IsoDateString;

  author?:
    string;

  sourceCaseId?:
    RasadyarId;

  sourceCaseTitle?:
    string;

  /**
   * Snapshot مستقل Case در لحظه ساخت گزارش.
   */
  sourceCaseSnapshot?:
    RasadyarCaseSnapshot;

  /**
   * Snapshot مستقل شواهد در لحظه ساخت گزارش.
   */
  evidenceSnapshots:
    RasadyarEvidenceSnapshot[];

  evidenceSnapshotAt?:
    IsoDateString;

  findings?:
    JsonValue;

  recommendations?:
    JsonValue;

  metadata?:
    Record<
      string,
      JsonValue
    >;
}


/* =========================================================
   Alert
========================================================= */

export type AlertPriority =
  | "critical"
  | "high"
  | "medium"
  | "low";


export type AlertWorkflowStatus =
  | "new"
  | "acknowledged"
  | "in-review"
  | "linked-to-case"
  | "actioned"
  | "closed";


export interface RasadyarAlert {
  schemaVersion:
    RasadyarSchemaVersion;

  id:
    RasadyarId;

  title:
    string;

  summary:
    string;

  alertType:
    string;

  priority:
    AlertPriority;

  status:
    AlertWorkflowStatus;

  timestamp:
    IsoDateString;

  countries:
    string[];

  lat?:
    number;

  lon?:
    number;

  source?:
    string;

  sourceUrl?:
    string;

  /**
   * در صورت تبدیل هشدار به Evidence.
   */
  evidenceId?:
    RasadyarId;

  /**
   * Caseهایی که هشدار به آنها ارجاع شده است.
   */
  caseIds:
    RasadyarId[];

  assignedTo?:
    string;

  acknowledgedAt?:
    IsoDateString;

  closedAt?:
    IsoDateString;

  metadata?:
    Record<
      string,
      JsonValue
    >;
}


/* =========================================================
   Root Store
========================================================= */

export interface RasadyarDataEnvelopeV1 {
  schemaVersion:
    RasadyarSchemaVersion;

  createdAt:
    IsoDateString;

  updatedAt:
    IsoDateString;

  cases:
    Record<
      RasadyarId,
      RasadyarAnalysisCase
    >;

  evidence:
    Record<
      RasadyarId,
      RasadyarEvidence
    >;

  archives:
    Record<
      RasadyarId,
      RasadyarArchive
    >;

  reports:
    Record<
      RasadyarId,
      RasadyarReport
    >;

  alerts:
    Record<
      RasadyarId,
      RasadyarAlert
    >;
}


/* =========================================================
   Runtime helpers
========================================================= */

export function createRasadyarId(
  prefix = "entity"
): RasadyarId {
  if (
    typeof crypto !==
      "undefined" &&
    "randomUUID" in crypto
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}


export function nowIso():
  IsoDateString {
  return new Date().toISOString();
}


export function createEmptyDataEnvelope():
  RasadyarDataEnvelopeV1 {
  const now =
    nowIso();

  return {
    schemaVersion:
      RASADYAR_SCHEMA_VERSION,

    createdAt:
      now,

    updatedAt:
      now,

    cases:
      {},

    evidence:
      {},

    archives:
      {},

    reports:
      {},

    alerts:
      {},
  };
}


export function isRasadyarDataEnvelopeV1(
  value: unknown
): value is RasadyarDataEnvelopeV1 {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return false;
  }

  const candidate =
    value as Partial<
      RasadyarDataEnvelopeV1
    >;

  return (
    candidate.schemaVersion ===
      RASADYAR_SCHEMA_VERSION &&
    !!candidate.cases &&
    typeof candidate.cases ===
      "object" &&
    !!candidate.evidence &&
    typeof candidate.evidence ===
      "object" &&
    !!candidate.archives &&
    typeof candidate.archives ===
      "object" &&
    !!candidate.reports &&
    typeof candidate.reports ===
      "object" &&
    !!candidate.alerts &&
    typeof candidate.alerts ===
      "object"
  );
}
