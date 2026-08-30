/*
 * Rasadyar P3-Step6 — Analysis Revision History & Audit Trail
 *
 * Design:
 * - Revision history stores analytical snapshots WITHOUT duplicating full
 *   Evidence/archive payloads. Only Evidence IDs are retained.
 * - Audit trail stores lightweight operational events.
 * - Revision history is capped at 25 snapshots.
 * - Audit trail is capped at 100 events.
 *
 * This is still browser/localStorage prototype storage. A future backend
 * should persist immutable revisions and audit events server-side.
 */

import {
  type RasadyarAnalysisQualityAssessment,
  type RasadyarAnalysisRevision,
  type RasadyarCaseReadinessAssessment,
  type RasadyarAnalysisRevisionAction,
  type RasadyarAnalysisRevisionSnapshot,
  type RasadyarAnalysisStatus,
  type RasadyarAuditEvent,
  type RasadyarAuditEventType,
  type RasadyarEvidenceRelationshipRegister,
  type RasadyarEvidenceTraceabilityRecord,
  type RasadyarHumanReviewRecord,
  type RasadyarMachineAnalysisDraft,
  type RasadyarStructuredAssessment,
} from "../../core/rasadyar-data";


const MAX_REVISIONS =
  25;

const MAX_AUDIT_EVENTS =
  100;


export interface RevisionSource {
  id:
    string;

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

  evidence:
    Array<{
      id:
        string;
    }>;

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

  revisionNumber?:
    number;

  revisionHistory?:
    RasadyarAnalysisRevision[];

  auditTrail?:
    RasadyarAuditEvent[];
}


export interface RevisionActor {
  username:
    string;

  name?:
    string;
}


export interface RevisionResult {
  revisionNumber:
    number;

  revisionHistory:
    RasadyarAnalysisRevision[];

  auditTrail:
    RasadyarAuditEvent[];

  revision?:
    RasadyarAnalysisRevision;
}


function createId(
  prefix:
    string
): string {
  if (
    typeof crypto !==
      "undefined" &&
    "randomUUID" in
      crypto
  ) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}


function clone<T>(
  value:
    T
): T {
  return JSON.parse(
    JSON.stringify(
      value
    )
  ) as T;
}


function stableHash(
  value:
    unknown
): string {
  const text =
    JSON.stringify(
      value
    );

  let hash =
    2166136261;

  for (
    let index =
      0;
    index <
      text.length;
    index +=
      1
  ) {
    hash ^=
      text.charCodeAt(
        index
      );

    hash =
      Math.imul(
        hash,
        16777619
      );
  }

  return (
    hash >>>
    0
  )
    .toString(
      16
    )
    .padStart(
      8,
      "0"
    );
}


export function buildRevisionSnapshot(
  source:
    RevisionSource
): RasadyarAnalysisRevisionSnapshot {
  return {
    title:
      source.title,

    analysisType:
      source.analysisType,

    region:
      source.region,

    timeRange:
      source.timeRange,

    domain:
      source.domain,

    description:
      source.description,

    findings:
      source.findings,

    probability:
      source.probability,

    impact:
      source.impact,

    confidence:
      source.confidence,

    likelyScenario:
      source.likelyScenario,

    worstScenario:
      source.worstScenario,

    bestScenario:
      source.bestScenario,

    recommendations:
      source.recommendations,

    status:
      source.status,

    evidenceIds:
      (
        source.evidence ||
        []
      ).map(
        (
          item
        ) =>
          item.id
      ),

    structuredAssessment:
      source.structuredAssessment
        ? clone(
            source.structuredAssessment
          )
        : undefined,

    machineDraft:
      source.machineDraft
        ? clone(
            source.machineDraft
          )
        : undefined,

    humanReview:
      source.humanReview
        ? clone(
            source.humanReview
          )
        : undefined,

    qualityAssessment:
      source.qualityAssessment
        ? clone(
            source.qualityAssessment
          )
        : undefined,

    evidenceTraceability:
      source.evidenceTraceability
        ? clone(
            source.evidenceTraceability
          )
        : undefined,

    evidenceRelationshipRegister:
      source.evidenceRelationshipRegister
        ? clone(
            source.evidenceRelationshipRegister
          )
        : undefined,

    readinessAssessment:
      source.readinessAssessment
        ? clone(
            source.readinessAssessment
          )
        : undefined,
  };
}


function compareEvidenceIds(
  previous:
    string[],
  current:
    string[]
): string[] {
  const previousSet =
    new Set(
      previous
    );

  const currentSet =
    new Set(
      current
    );

  const added =
    current.filter(
      (
        id
      ) =>
        !previousSet.has(
          id
        )
    ).length;

  const removed =
    previous.filter(
      (
        id
      ) =>
        !currentSet.has(
          id
        )
    ).length;

  const changes:
    string[] = [];

  if (
    added >
    0
  ) {
    changes.push(
      `${added} شاهد اضافه شد`
    );
  }

  if (
    removed >
    0
  ) {
    changes.push(
      `${removed} شاهد حذف شد`
    );
  }

  return changes;
}


function jsonChanged(
  previous:
    unknown,
  current:
    unknown
): boolean {
  return JSON.stringify(
    previous ||
    null
  ) !==
    JSON.stringify(
      current ||
      null
    );
}


export function describeRevisionChanges(
  previous:
    RasadyarAnalysisRevisionSnapshot | undefined,
  current:
    RasadyarAnalysisRevisionSnapshot
): string[] {
  if (
    !previous
  ) {
    return [
      "نسخه اولیه پرونده ایجاد شد",
    ];
  }

  const changes:
    string[] = [];

  if (
    previous.status !==
    current.status
  ) {
    changes.push(
      `وضعیت از «${previous.status}» به «${current.status}» تغییر کرد`
    );
  }

  if (
    previous.title !==
    current.title
  ) {
    changes.push(
      "عنوان پرونده تغییر کرد"
    );
  }

  if (
    previous.description !==
    current.description
  ) {
    changes.push(
      "شرح مسئله تغییر کرد"
    );
  }

  if (
    previous.findings !==
    current.findings
  ) {
    changes.push(
      "یافته‌های کلیدی تغییر کرد"
    );
  }

  if (
    previous.confidence !==
    current.confidence
  ) {
    changes.push(
      `سطح اطمینان از «${previous.confidence}» به «${current.confidence}» تغییر کرد`
    );
  }

  if (
    previous.probability !==
      current.probability ||
    previous.impact !==
      current.impact
  ) {
    changes.push(
      "احتمال یا شدت اثر تغییر کرد"
    );
  }

  changes.push(
    ...compareEvidenceIds(
      previous.evidenceIds,
      current.evidenceIds
    )
  );

  if (
    jsonChanged(
      previous.structuredAssessment,
      current.structuredAssessment
    )
  ) {
    changes.push(
      "تحلیل ساختاریافته تغییر کرد"
    );
  }

  if (
    previous.machineDraft?.draftId !==
    current.machineDraft?.draftId
  ) {
    changes.push(
      current.machineDraft
        ? "پیش‌نویس ماشینی جدید ثبت شد"
        : "پیش‌نویس ماشینی حذف شد"
    );
  }

  if (
    previous.humanReview?.status !==
      current.humanReview?.status ||
    previous.humanReview?.reviewId !==
      current.humanReview?.reviewId
  ) {
    changes.push(
      current.humanReview?.status ===
        "completed"
        ? "بازبینی انسانی تکمیل شد"
        : current.humanReview
          ? "وضعیت بازبینی انسانی تغییر کرد"
          : "بازبینی انسانی نامعتبر/پاک شد"
    );
  }

  if (
    previous.qualityAssessment?.overallScore !==
    current.qualityAssessment?.overallScore
  ) {
    const oldScore =
      previous.qualityAssessment?.overallScore;

    const newScore =
      current.qualityAssessment?.overallScore;

    changes.push(
      `امتیاز کیفیت از ${
        typeof oldScore ===
          "number"
          ? oldScore
          : "—"
      } به ${
        typeof newScore ===
          "number"
          ? newScore
          : "—"
      } تغییر کرد`
    );
  }

  if (
    jsonChanged(
      previous.evidenceTraceability,
      current.evidenceTraceability
    )
  ) {
    changes.push(
      "ماتریس استناد و ردیابی شواهد تغییر کرد"
    );
  }

  if (
    jsonChanged(
      previous.evidenceRelationshipRegister,
      current.evidenceRelationshipRegister
    )
  ) {
    changes.push(
      "بازبینی تعارض و هم‌پوشانی شواهد تغییر کرد"
    );
  }

  if (
    previous.readinessAssessment?.score !==
      current.readinessAssessment?.score ||
    previous.readinessAssessment?.status !==
      current.readinessAssessment?.status
  ) {
    changes.push(
      `آمادگی پرونده از ${
        previous.readinessAssessment?.score ??
        "—"
      } به ${
        current.readinessAssessment?.score ??
        "—"
      } تغییر کرد`
    );
  }

  if (
    changes.length ===
    0
  ) {
    changes.push(
      "تغییر محتوایی قابل توجهی نسبت به نسخه قبل ثبت نشد"
    );
  }

  return changes;
}


export function revisionActionLabel(
  action:
    RasadyarAnalysisRevisionAction
): string {
  if (
    action ===
    "created"
  ) {
    return "ایجاد پرونده";
  }

  if (
    action ===
    "draft-saved"
  ) {
    return "ذخیره پیش‌نویس";
  }

  if (
    action ===
    "sent-review"
  ) {
    return "ارسال برای بررسی";
  }

  if (
    action ===
    "approved"
  ) {
    return "تأیید نهایی";
  }

  if (
    action ===
    "evidence-added"
  ) {
    return "افزودن شاهد";
  }

  return action;
}


export function auditEventLabel(
  eventType:
    RasadyarAuditEventType
): string {
  if (
    eventType ===
    "case-created"
  ) {
    return "ایجاد پرونده";
  }

  if (
    eventType ===
    "revision-created"
  ) {
    return "ثبت نسخه جدید";
  }

  if (
    eventType ===
    "sent-review"
  ) {
    return "ارسال برای بررسی";
  }

  if (
    eventType ===
    "approved"
  ) {
    return "تأیید پرونده";
  }

  if (
    eventType ===
    "evidence-added"
  ) {
    return "افزودن شاهد";
  }

  if (
    eventType ===
    "report-created"
  ) {
    return "ایجاد گزارش";
  }

  return eventType;
}


function auditTypeForRevision(
  action:
    RasadyarAnalysisRevisionAction
): RasadyarAuditEventType {
  if (
    action ===
    "created"
  ) {
    return "case-created";
  }

  if (
    action ===
    "sent-review"
  ) {
    return "sent-review";
  }

  if (
    action ===
    "approved"
  ) {
    return "approved";
  }

  if (
    action ===
    "evidence-added"
  ) {
    return "evidence-added";
  }

  return "revision-created";
}


export function recordAnalysisRevision(
  source:
    RevisionSource,
  previousSource:
    RevisionSource | undefined,
  action:
    RasadyarAnalysisRevisionAction,
  actor:
    RevisionActor
): RevisionResult {
  const currentSnapshot =
    buildRevisionSnapshot(
      source
    );

  const previousSnapshot =
    previousSource
      ? buildRevisionSnapshot(
          previousSource
        )
      : source.revisionHistory?.[
          source.revisionHistory.length -
          1
        ]?.snapshot;

  const snapshotHash =
    stableHash(
      currentSnapshot
    );

  const lastRevision =
    source.revisionHistory?.[
      source.revisionHistory.length -
      1
    ];

  /*
   * Avoid duplicate "save draft" revisions when nothing changed.
   * Workflow transitions are still always recorded.
   */
  if (
    action ===
      "draft-saved" &&
    lastRevision?.snapshotHash ===
      snapshotHash
  ) {
    return {
      revisionNumber:
        source.revisionNumber ||
        lastRevision.sequence ||
        0,

      revisionHistory:
        source.revisionHistory ||
        [],

      auditTrail:
        source.auditTrail ||
        [],
    };
  }

  const sequence =
    Math.max(
      source.revisionNumber ||
        0,
      lastRevision?.sequence ||
        0
    ) +
    1;

  const createdAt =
    new Date().toISOString();

  const revision:
    RasadyarAnalysisRevision = {
    revisionId:
      createId(
        "revision"
      ),

    sequence,

    action,

    actor:
      actor.username,

    actorName:
      actor.name ||
      actor.username,

    createdAt,

    snapshotHash,

    changeSummary:
      describeRevisionChanges(
        previousSnapshot,
        currentSnapshot
      ),

    snapshot:
      currentSnapshot,
  };

  const auditEvent:
    RasadyarAuditEvent = {
    eventId:
      createId(
        "audit"
      ),

    eventType:
      auditTypeForRevision(
        action
      ),

    actor:
      actor.username,

    actorName:
      actor.name ||
      actor.username,

    createdAt,

    detail:
      `${revisionActionLabel(action)} — نسخه ${sequence}`,

    revisionId:
      revision.revisionId,

    metadata: {
      revisionSequence:
        sequence,

      qualityScore:
        currentSnapshot.qualityAssessment?.overallScore,

      evidenceCount:
        currentSnapshot.evidenceIds.length,

      status:
        currentSnapshot.status,
    },
  };

  return {
    revisionNumber:
      sequence,

    revisionHistory:
      [
        ...(
          source.revisionHistory ||
          []
        ),
        revision,
      ].slice(
        -MAX_REVISIONS
      ),

    auditTrail:
      [
        ...(
          source.auditTrail ||
          []
        ),
        auditEvent,
      ].slice(
        -MAX_AUDIT_EVENTS
      ),

    revision,
  };
}


export function appendCaseAuditEvent(
  source:
    RevisionSource,
  eventType:
    RasadyarAuditEventType,
  actor:
    RevisionActor,
  detail:
    string,
  metadata?:
    Record<
      string,
      string | number | boolean | null | undefined
    >
): {
  auditTrail:
    RasadyarAuditEvent[];
} {
  const event:
    RasadyarAuditEvent = {
    eventId:
      createId(
        "audit"
      ),

    eventType,

    actor:
      actor.username,

    actorName:
      actor.name ||
      actor.username,

    createdAt:
      new Date().toISOString(),

    detail,

    metadata,
  };

  return {
    auditTrail:
      [
        ...(
          source.auditTrail ||
          []
        ),
        event,
      ].slice(
        -MAX_AUDIT_EVENTS
      ),
  };
}


export function qualityTrend(
  revisions:
    RasadyarAnalysisRevision[] | undefined
): Array<{
  sequence:
    number;

  score:
    number;

  createdAt:
    string;
}> {
  return (
    revisions ||
    []
  )
    .filter(
      (
        revision
      ) =>
        typeof revision.snapshot
          .qualityAssessment
          ?.overallScore ===
          "number"
    )
    .map(
      (
        revision
      ) => ({
        sequence:
          revision.sequence,

        score:
          revision.snapshot
            .qualityAssessment!
            .overallScore,

        createdAt:
          revision.createdAt,
      })
    );
}
