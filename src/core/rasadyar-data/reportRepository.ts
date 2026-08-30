/*
 * Rasadyar Data Model — Report Repository
 *
 * P2-Step4:
 * Dual-write Reports into rasadyar_data_v1 while rasadyar_reports
 * remains the active operational source.
 *
 * Design rules:
 * - Legacy report workflow remains untouched.
 * - Canonical write failure never blocks the Report Center.
 * - Report stores an immutable source Case snapshot.
 * - Report stores immutable Evidence snapshots.
 * - Evidence/Archive canonical records are also ensured for traceability.
 */

import {
  RASADYAR_SCHEMA_VERSION,
  type EvidenceKind,
  type JsonValue,
  type RasadyarAnalysisQualityAssessment,
  type RasadyarAnalysisRevision,
  type RasadyarAuditEvent,
  type RasadyarCaseReadinessAssessment,
  type RasadyarCaseSnapshot,
  type RasadyarEvidenceRelationshipRegister,
  type RasadyarEvidenceSnapshot,
  type RasadyarEvidenceTraceabilityRecord,
  type RasadyarHumanReviewRecord,
  type RasadyarMachineAnalysisDraft,
  type RasadyarReport,
  type RasadyarStructuredAssessment,
  type ReportStatus,
} from "./schema";

import {
  updateCanonicalStore,
} from "./storage";

import {
  upsertCanonicalEvidenceBundle,
  type CanonicalEvidenceInput,
} from "./evidenceRepository";


export interface LegacyReportArchiveInput {
  archiveId?:
    string;

  archivedAt?:
    string;

  archiveVersion?:
    number;

  snapshotKind?:
    | "video-frame"
    | "youtube-thumbnail"
    | "metadata-card";

  snapshotDataUrl?:
    string;

  mediaType?:
    "live-stream"
    | "news"
    | "map"
    | "alert"
    | "infrastructure"
    | "manual";

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

  metadata?:
    Record<
      string,
      JsonValue
    >;
}


export interface LegacyReportEvidenceInput {
  id?:
    string;

  kind?:
    EvidenceKind;

  title?:
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

  timestamp?:
    string;

  summary?:
    string;

  description?:
    string;

  metadata?:
    Record<
      string,
      JsonValue
    >;

  archive?:
    LegacyReportArchiveInput;
}


export interface LegacySourceCaseSnapshotInput {
  id?:
    string;

  title?:
    string;

  analysisType?:
    string;

  region?:
    string;

  timeRange?:
    string;

  domain?:
    string;

  description?:
    string;

  findings?:
    string;

  probability?:
    string;

  impact?:
    string;

  confidence?:
    string;

  riskLevel?:
    string;

  likelyScenario?:
    string;

  worstScenario?:
    string;

  bestScenario?:
    string;

  recommendations?:
    string;

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

  status?:
    string;

  createdBy?:
    string;

  createdByName?:
    string;

  createdAt?:
    string;

  updatedAt?:
    string;

  snapshotAt?:
    string;
}


export interface LegacyReportInput {
  id:
    string;

  title:
    string;

  summary:
    string;

  content:
    string;

  status:
    "draft"
    | "review"
    | "published";

  createdAt:
    string;

  updatedAt:
    string;

  publishedAt?:
    string;

  author?:
    string;

  analysisId?:
    string;

  sourceAnalysisId?:
    string;

  sourceAnalysisTitle?:
    string;

  sourceAnalysisSnapshot?:
    LegacySourceCaseSnapshotInput;

  evidence?:
    LegacyReportEvidenceInput[];

  evidenceSnapshotAt?:
    string;

  createdFromAnalysisAt?:
    string;

  findings?:
    unknown;

  recommendations?:
    unknown;
}


export interface CanonicalReportSyncResult {
  ok:
    boolean;

  reportCount:
    number;

  evidenceSnapshots:
    number;

  evidenceWriteFailures:
    number;

  error?:
    unknown;
}


function asString(
  value:
    unknown,
  fallback = ""
): string {
  return typeof value ===
    "string"
      ? value
      : fallback;
}


function safeIso(
  value:
    string | undefined,
  fallback:
    string
): string {
  if (!value) {
    return fallback;
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return fallback;
  }

  return parsed.toISOString();
}


function normalizeStatus(
  value:
    LegacyReportInput["status"]
): ReportStatus {
  if (
    value ===
    "published"
  ) {
    return "published";
  }

  if (
    value ===
    "review"
  ) {
    return "review";
  }

  return "draft";
}


function normalizeAnalysisStatus(
  value:
    string | undefined
):
  "draft"
  | "review"
  | "completed" {
  if (
    value ===
    "completed"
  ) {
    return "completed";
  }

  if (
    value ===
    "review"
  ) {
    return "review";
  }

  return "draft";
}


function toSourceCaseSnapshot(
  input:
    LegacySourceCaseSnapshotInput | undefined,
  fallbackCaseId:
    string | undefined,
  fallbackTitle:
    string | undefined,
  fallbackTime:
    string
): RasadyarCaseSnapshot | undefined {
  if (
    !input &&
    !fallbackCaseId &&
    !fallbackTitle
  ) {
    return undefined;
  }

  const now =
    fallbackTime;

  return {
    id:
      asString(
        input?.id,
        fallbackCaseId ||
          "unknown-case"
      ),

    title:
      asString(
        input?.title,
        fallbackTitle ||
          "پرونده تحلیل"
      ),

    analysisType:
      asString(
        input?.analysisType
      ),

    region:
      asString(
        input?.region
      ),

    timeRange:
      asString(
        input?.timeRange
      ),

    domain:
      asString(
        input?.domain
      ),

    description:
      asString(
        input?.description
      ),

    findings:
      asString(
        input?.findings
      ),

    probability:
      asString(
        input?.probability
      ),

    impact:
      asString(
        input?.impact
      ),

    confidence:
      asString(
        input?.confidence
      ),

    riskLevel:
      asString(
        input?.riskLevel
      ) ||
      undefined,

    likelyScenario:
      asString(
        input?.likelyScenario
      ),

    worstScenario:
      asString(
        input?.worstScenario
      ),

    bestScenario:
      asString(
        input?.bestScenario
      ),

    recommendations:
      asString(
        input?.recommendations
      ),

    structuredAssessment:
      input?.structuredAssessment
        ? JSON.parse(
            JSON.stringify(
              input.structuredAssessment
            )
          )
        : undefined,

    machineDraft:
      input?.machineDraft
        ? JSON.parse(
            JSON.stringify(
              input.machineDraft
            )
          )
        : undefined,

    humanReview:
      input?.humanReview
        ? JSON.parse(
            JSON.stringify(
              input.humanReview
            )
          )
        : undefined,

    qualityAssessment:
      input?.qualityAssessment
        ? JSON.parse(
            JSON.stringify(
              input.qualityAssessment
            )
          )
        : undefined,

    evidenceTraceability:
      input?.evidenceTraceability
        ? JSON.parse(
            JSON.stringify(
              input.evidenceTraceability
            )
          )
        : undefined,

    evidenceRelationshipRegister:
      input?.evidenceRelationshipRegister
        ? JSON.parse(
            JSON.stringify(
              input.evidenceRelationshipRegister
            )
          )
        : undefined,

    readinessAssessment:
      input?.readinessAssessment
        ? JSON.parse(
            JSON.stringify(
              input.readinessAssessment
            )
          )
        : undefined,

    revisionNumber:
      input?.revisionNumber,

    revisionHistory:
      input?.revisionHistory
        ? JSON.parse(
            JSON.stringify(
              input.revisionHistory
            )
          )
        : undefined,

    auditTrail:
      input?.auditTrail
        ? JSON.parse(
            JSON.stringify(
              input.auditTrail
            )
          )
        : undefined,

    status:
      normalizeAnalysisStatus(
        input?.status
      ),

    createdBy:
      asString(
        input?.createdBy,
        "unknown"
      ),

    createdByName:
      asString(
        input?.createdByName,
        asString(
          input?.createdBy,
          "unknown"
        )
      ),

    createdAt:
      safeIso(
        input?.createdAt,
        now
      ),

    updatedAt:
      safeIso(
        input?.updatedAt,
        now
      ),

    snapshotAt:
      safeIso(
        input?.snapshotAt,
        now
      ),
  };
}


function toEvidenceSnapshot(
  input:
    LegacyReportEvidenceInput,
  reportCreatedAt:
    string,
  reportAuthor:
    string | undefined
): {
  snapshot:
    RasadyarEvidenceSnapshot;

  canonicalInput:
    CanonicalEvidenceInput;
} {
  const timestamp =
    safeIso(
      input.timestamp,
      reportCreatedAt
    );

  const evidenceId =
    input.id ||
    `report-evidence-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;

  const archiveId =
    input.archive
      ? (
          input.archive.archiveId ||
          `report-archive-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2)}`
        )
      : undefined;

  const canonicalInput:
    CanonicalEvidenceInput = {
    id:
      evidenceId,

    kind:
      input.kind ||
      "manual",

    title:
      input.title ||
      "شاهد گزارش",

    source:
      input.source,

    url:
      input.url,

    country:
      input.country,

    region:
      input.region,

    lat:
      input.lat,

    lon:
      input.lon,

    timestamp,

    summary:
      input.summary,

    description:
      input.description,

    metadata:
      input.metadata,

    archive:
      input.archive
        ? {
            archiveId:
              archiveId!,

            archivedAt:
              safeIso(
                input.archive.archivedAt,
                timestamp
              ),

            archiveVersion:
              typeof input.archive.archiveVersion ===
                "number"
                ? input.archive.archiveVersion
                : 1,

            snapshotKind:
              input.archive.snapshotKind ||
              "metadata-card",

            snapshotDataUrl:
              input.archive.snapshotDataUrl,

            mediaType:
              input.archive.mediaType,

            channelId:
              input.archive.channelId,

            channelName:
              input.archive.channelName,

            videoId:
              input.archive.videoId,

            originalUrl:
              input.archive.originalUrl,

            streamUrl:
              input.archive.streamUrl,

            playbackState:
              input.archive.playbackState,

            note:
              input.archive.note,

            metadata:
              input.archive.metadata,
          }
        : undefined,
  };

  const snapshot:
    RasadyarEvidenceSnapshot = {
    schemaVersion:
      RASADYAR_SCHEMA_VERSION,

    id:
      canonicalInput.id,

    kind:
      canonicalInput.kind ===
        "news" &&
      canonicalInput.archive?.mediaType ===
        "live-stream"
        ? "live-stream"
        : canonicalInput.kind,

    title:
      canonicalInput.title,

    source:
      canonicalInput.source,

    url:
      canonicalInput.url,

    country:
      canonicalInput.country,

    region:
      canonicalInput.region,

    lat:
      canonicalInput.lat,

    lon:
      canonicalInput.lon,

    timestamp:
      canonicalInput.timestamp,

    summary:
      canonicalInput.summary,

    description:
      canonicalInput.description,

    archiveId:
      canonicalInput.archive?.archiveId,

    createdAt:
      canonicalInput.timestamp,

    createdBy:
      reportAuthor,

    metadata:
      canonicalInput.metadata,

    archiveSnapshot:
      canonicalInput.archive
        ? {
            schemaVersion:
              RASADYAR_SCHEMA_VERSION,

            archiveId:
              canonicalInput.archive.archiveId,

            archivedAt:
              canonicalInput.archive.archivedAt,

            archiveVersion:
              canonicalInput.archive.archiveVersion,

            snapshotKind:
              canonicalInput.archive.snapshotKind,

            snapshotDataUrl:
              canonicalInput.archive.snapshotDataUrl,

            mediaType:
              canonicalInput.archive.mediaType,

            channelId:
              canonicalInput.archive.channelId,

            channelName:
              canonicalInput.archive.channelName,

            videoId:
              canonicalInput.archive.videoId,

            originalUrl:
              canonicalInput.archive.originalUrl,

            streamUrl:
              canonicalInput.archive.streamUrl,

            playbackState:
              canonicalInput.archive.playbackState,

            note:
              canonicalInput.archive.note,

            metadata:
              canonicalInput.archive.metadata,
          }
        : undefined,
  };

  return {
    snapshot,
    canonicalInput,
  };
}


/**
 * Mirrors the current rasadyar_reports array into canonical reports.
 *
 * Reports are immutable snapshots from the canonical perspective:
 * each sync rebuilds the canonical Report from the exact current
 * legacy Report object, including source Case snapshot and Evidence snapshots.
 *
 * Deleting a legacy Report removes its canonical Report record.
 * Evidence/Archive records remain for traceability.
 */
export function syncCanonicalReports(
  items:
    LegacyReportInput[]
): CanonicalReportSyncResult {
  try {
    const canonicalReports:
      Record<
        string,
        RasadyarReport
      > = {};

    let evidenceSnapshots =
      0;

    let evidenceWriteFailures =
      0;

    for (
      const item of
      items
    ) {
      const now =
        new Date().toISOString();

      const createdAt =
        safeIso(
          item.createdAt,
          now
        );

      const updatedAt =
        safeIso(
          item.updatedAt,
          createdAt
        );

      const sourceCaseId =
        item.sourceAnalysisId ||
        item.analysisId;

      const sourceCaseTitle =
        item.sourceAnalysisTitle;

      const snapshots:
        RasadyarEvidenceSnapshot[] =
          [];

      const evidenceList =
        Array.isArray(
          item.evidence
        )
          ? item.evidence
          : [];

      for (
        const evidence of
        evidenceList
      ) {
        const converted =
          toEvidenceSnapshot(
            evidence,
            createdAt,
            item.author
          );

        snapshots.push(
          converted.snapshot
        );

        evidenceSnapshots +=
          1;

        const writeResult =
          upsertCanonicalEvidenceBundle(
            converted.canonicalInput,
            {
              createdBy:
                item.author,
            }
          );

        if (
          !writeResult.ok
        ) {
          evidenceWriteFailures +=
            1;

          console.warn(
            "[RasadyarData] Report Evidence could not be ensured in canonical Evidence store.",
            {
              reportId:
                item.id,

              evidenceId:
                converted.canonicalInput.id,

              error:
                writeResult.error,
            }
          );
        }
      }

      canonicalReports[
        item.id
      ] = {
        schemaVersion:
          RASADYAR_SCHEMA_VERSION,

        id:
          item.id,

        title:
          item.title,

        summary:
          item.summary,

        content:
          item.content,

        status:
          normalizeStatus(
            item.status
          ),

        createdAt,

        updatedAt,

        publishedAt:
          item.publishedAt
            ? safeIso(
                item.publishedAt,
                updatedAt
              )
            : undefined,

        author:
          item.author,

        sourceCaseId,

        sourceCaseTitle,

        sourceCaseSnapshot:
          toSourceCaseSnapshot(
            item.sourceAnalysisSnapshot,
            sourceCaseId,
            sourceCaseTitle,
            item.createdFromAnalysisAt ||
              item.evidenceSnapshotAt ||
              createdAt
          ),

        evidenceSnapshots:
          snapshots,

        evidenceSnapshotAt:
          item.evidenceSnapshotAt
            ? safeIso(
                item.evidenceSnapshotAt,
                createdAt
              )
            : undefined,

        findings:
          item.findings as any,

        recommendations:
          item.recommendations as any,

        metadata: {
          legacyAnalysisId:
            item.analysisId ||
            null,

          legacySourceAnalysisId:
            item.sourceAnalysisId ||
            null,

          createdFromAnalysisAt:
            item.createdFromAnalysisAt ||
            null,
        },
      };
    }

    updateCanonicalStore(
      (
        current
      ) => ({
        ...current,

        reports:
          canonicalReports,
      })
    );

    return {
      ok:
        true,

      reportCount:
        Object.keys(
          canonicalReports
        ).length,

      evidenceSnapshots,

      evidenceWriteFailures,
    };
  } catch (
    error
  ) {
    console.warn(
      "[RasadyarData] Canonical Report dual-write failed; legacy Report workflow continues.",
      error
    );

    return {
      ok:
        false,

      reportCount:
        0,

      evidenceSnapshots:
        0,

      evidenceWriteFailures:
        0,

      error,
    };
  }
}
