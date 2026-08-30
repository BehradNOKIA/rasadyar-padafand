/*
 * Rasadyar Data Model — Legacy migration v1
 *
 * اصل این Migration:
 * 1) داده‌های فعلی پروژه حذف نمی‌شوند.
 * 2) ابتدا Canonical Store جدید ساخته می‌شود.
 * 3) تا زمانی که UIها به Repository جدید وصل نشده‌اند،
 *    Legacy Storeها منبع عملیاتی پروژه باقی می‌مانند.
 */

import {
  RASADYAR_SCHEMA_VERSION,
  createEmptyDataEnvelope,
  createRasadyarId,
  nowIso,
  type RasadyarAnalysisCase,
  type RasadyarArchive,
  type RasadyarCaseSnapshot,
  type RasadyarDataEnvelopeV1,
  type RasadyarEvidence,
  type RasadyarEvidenceSnapshot,
  type RasadyarReport,
  type ReportStatus,
} from "./schema";

import {
  LEGACY_STORAGE_KEYS,
  RASADYAR_DATA_STORE_KEY,
  hasCanonicalStore,
  writeCanonicalStore,
  type StorageLike,
} from "./storage";


export interface LegacyMigrationPreview {
  analyses:
    number;

  reports:
    number;

  evidence:
    number;

  archives:
    number;

  canonicalStoreExists:
    boolean;
}


export interface LegacyMigrationResult
  extends LegacyMigrationPreview {
  migrated:
    boolean;

  skippedReason?:
    string;

  storeKey:
    string;
}


function resolveStorage(
  storage?:
    StorageLike
): StorageLike {
  if (storage) {
    return storage;
  }

  if (
    typeof localStorage !==
    "undefined"
  ) {
    return localStorage;
  }

  throw new Error(
    "Rasadyar migration storage is not available."
  );
}


function safeArray(
  raw:
    string | null
): any[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(raw);

    return Array.isArray(
      parsed
    )
      ? parsed
      : [];
  } catch {
    return [];
  }
}


function stringValue(
  value:
    unknown,
  fallback = ""
): string {
  return typeof value ===
    "string"
    ? value
    : fallback;
}


function toEvidence(
  value:
    any,
  fallbackCreatedAt:
    string
): {
  evidence:
    RasadyarEvidence;

  archive?:
    RasadyarArchive;
} {
  const id =
    stringValue(
      value?.id
    ) ||
    createRasadyarId(
      "evidence"
    );

  const timestamp =
    stringValue(
      value?.timestamp
    ) ||
    fallbackCreatedAt;

  const archiveValue =
    value?.archive &&
    typeof value.archive ===
      "object"
      ? value.archive
      : undefined;

  const archiveId =
    archiveValue
      ? stringValue(
          archiveValue.archiveId
        ) ||
        createRasadyarId(
          "archive"
        )
      : undefined;

  const evidence:
    RasadyarEvidence = {
    schemaVersion:
      RASADYAR_SCHEMA_VERSION,

    id,

    kind:
      value?.kind ===
        "map"
        ? "map"
        : value?.kind ===
          "alert"
        ? "alert"
        : value?.kind ===
          "manual"
        ? "manual"
        : value?.kind ===
          "infrastructure"
        ? "infrastructure"
        : value?.kind ===
          "live-stream"
        ? "live-stream"
        : "news",

    title:
      stringValue(
        value?.title,
        "شاهد بدون عنوان"
      ),

    source:
      stringValue(
        value?.source
      ) ||
      undefined,

    url:
      stringValue(
        value?.url
      ) ||
      undefined,

    country:
      stringValue(
        value?.country
      ) ||
      undefined,

    region:
      stringValue(
        value?.region
      ) ||
      undefined,

    lat:
      typeof value?.lat ===
        "number"
        ? value.lat
        : undefined,

    lon:
      typeof value?.lon ===
        "number"
        ? value.lon
        : undefined,

    timestamp,

    summary:
      stringValue(
        value?.summary
      ) ||
      undefined,

    description:
      stringValue(
        value?.description
      ) ||
      undefined,

    archiveId,

    createdAt:
      timestamp,
  };

  if (!archiveValue) {
    return {
      evidence,
    };
  }

  const archive:
    RasadyarArchive = {
    schemaVersion:
      RASADYAR_SCHEMA_VERSION,

    archiveId:
      archiveId!,

    archivedAt:
      stringValue(
        archiveValue.archivedAt
      ) ||
      timestamp,

    archiveVersion:
      typeof archiveValue.archiveVersion ===
        "number"
        ? archiveValue.archiveVersion
        : 1,

    snapshotKind:
      archiveValue.snapshotKind ===
        "video-frame"
        ? "video-frame"
        : archiveValue.snapshotKind ===
          "youtube-thumbnail"
        ? "youtube-thumbnail"
        : "metadata-card",

    snapshotDataUrl:
      stringValue(
        archiveValue.snapshotDataUrl
      ) ||
      undefined,

    mediaType:
      archiveValue.mediaType,

    channelId:
      stringValue(
        archiveValue.channelId
      ) ||
      undefined,

    channelName:
      stringValue(
        archiveValue.channelName
      ) ||
      undefined,

    videoId:
      stringValue(
        archiveValue.videoId
      ) ||
      undefined,

    originalUrl:
      stringValue(
        archiveValue.originalUrl
      ) ||
      undefined,

    streamUrl:
      stringValue(
        archiveValue.streamUrl
      ) ||
      undefined,

    playbackState:
      stringValue(
        archiveValue.playbackState
      ) ||
      undefined,

    note:
      stringValue(
        archiveValue.note
      ) ||
      undefined,
  };

  return {
    evidence,
    archive,
  };
}


function toCase(
  value:
    any,
  envelope:
    RasadyarDataEnvelopeV1
): RasadyarAnalysisCase {
  const now =
    nowIso();

  const id =
    stringValue(
      value?.id
    ) ||
    createRasadyarId(
      "case"
    );

  const createdAt =
    stringValue(
      value?.createdAt
    ) ||
    now;

  const evidenceIds:
    string[] = [];

  const legacyEvidence =
    Array.isArray(
      value?.evidence
    )
      ? value.evidence
      : [];

  for (
    const item of
    legacyEvidence
  ) {
    const converted =
      toEvidence(
        item,
        createdAt
      );

    envelope.evidence[
      converted.evidence.id
    ] =
      converted.evidence;

    evidenceIds.push(
      converted.evidence.id
    );

    if (
      converted.archive
    ) {
      envelope.archives[
        converted.archive.archiveId
      ] =
        converted.archive;
    }
  }

  return {
    schemaVersion:
      RASADYAR_SCHEMA_VERSION,

    id,

    title:
      stringValue(
        value?.title,
        "پرونده بدون عنوان"
      ),

    analysisType:
      stringValue(
        value?.analysisType,
        "تهدید"
      ),

    region:
      stringValue(
        value?.region,
        "جهانی"
      ),

    timeRange:
      stringValue(
        value?.timeRange,
        "7 روز"
      ),

    domain:
      stringValue(
        value?.domain,
        "نظامی"
      ),

    description:
      stringValue(
        value?.description
      ),

    findings:
      stringValue(
        value?.findings
      ),

    probability:
      stringValue(
        value?.probability,
        "متوسط"
      ),

    impact:
      stringValue(
        value?.impact,
        "متوسط"
      ),

    confidence:
      stringValue(
        value?.confidence,
        "متوسط"
      ),

    likelyScenario:
      stringValue(
        value?.likelyScenario
      ),

    worstScenario:
      stringValue(
        value?.worstScenario
      ),

    bestScenario:
      stringValue(
        value?.bestScenario
      ),

    recommendations:
      stringValue(
        value?.recommendations
      ),

    evidenceIds,

    status:
      value?.status ===
        "completed"
        ? "completed"
        : value?.status ===
          "review"
        ? "review"
        : "draft",

    createdBy:
      stringValue(
        value?.createdBy,
        "unknown"
      ),

    createdByName:
      stringValue(
        value?.createdByName,
        stringValue(
          value?.createdBy,
          "unknown"
        )
      ),

    createdAt,

    updatedAt:
      stringValue(
        value?.updatedAt
      ) ||
      createdAt,
  };
}


function toCaseSnapshot(
  value:
    any
): RasadyarCaseSnapshot | undefined {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return undefined;
  }

  const now =
    nowIso();

  return {
    id:
      stringValue(
        value.id
      ) ||
      createRasadyarId(
        "case-snapshot"
      ),

    title:
      stringValue(
        value.title
      ),

    analysisType:
      stringValue(
        value.analysisType
      ),

    region:
      stringValue(
        value.region
      ),

    timeRange:
      stringValue(
        value.timeRange
      ),

    domain:
      stringValue(
        value.domain
      ),

    description:
      stringValue(
        value.description
      ),

    findings:
      stringValue(
        value.findings
      ),

    probability:
      stringValue(
        value.probability
      ),

    impact:
      stringValue(
        value.impact
      ),

    confidence:
      stringValue(
        value.confidence
      ),

    riskLevel:
      stringValue(
        value.riskLevel
      ) ||
      undefined,

    likelyScenario:
      stringValue(
        value.likelyScenario
      ),

    worstScenario:
      stringValue(
        value.worstScenario
      ),

    bestScenario:
      stringValue(
        value.bestScenario
      ),

    recommendations:
      stringValue(
        value.recommendations
      ),

    status:
      value.status ===
        "completed"
        ? "completed"
        : value.status ===
          "review"
        ? "review"
        : "draft",

    createdBy:
      stringValue(
        value.createdBy,
        "unknown"
      ),

    createdByName:
      stringValue(
        value.createdByName,
        stringValue(
          value.createdBy,
          "unknown"
        )
      ),

    createdAt:
      stringValue(
        value.createdAt
      ) ||
      now,

    updatedAt:
      stringValue(
        value.updatedAt
      ) ||
      now,

    snapshotAt:
      stringValue(
        value.snapshotAt
      ) ||
      now,
  };
}


function toReport(
  value:
    any
): RasadyarReport {
  const now =
    nowIso();

  const status:
    ReportStatus =
    value?.status ===
      "published"
      ? "published"
      : value?.status ===
        "review"
      ? "review"
      : "draft";

  const evidenceSnapshots:
    RasadyarEvidenceSnapshot[] =
      [];

  const legacyEvidence =
    Array.isArray(
      value?.evidence
    )
      ? value.evidence
      : [];

  for (
    const item of
    legacyEvidence
  ) {
    const converted =
      toEvidence(
        item,
        stringValue(
          value?.createdAt
        ) ||
        now
      );

    evidenceSnapshots.push({
      ...converted.evidence,

      archiveSnapshot:
        converted.archive,
    });
  }

  return {
    schemaVersion:
      RASADYAR_SCHEMA_VERSION,

    id:
      stringValue(
        value?.id
      ) ||
      createRasadyarId(
        "report"
      ),

    title:
      stringValue(
        value?.title,
        "گزارش بدون عنوان"
      ),

    summary:
      stringValue(
        value?.summary
      ),

    content:
      stringValue(
        value?.content
      ),

    status,

    createdAt:
      stringValue(
        value?.createdAt
      ) ||
      now,

    updatedAt:
      stringValue(
        value?.updatedAt
      ) ||
      stringValue(
        value?.createdAt
      ) ||
      now,

    publishedAt:
      stringValue(
        value?.publishedAt
      ) ||
      undefined,

    author:
      stringValue(
        value?.author
      ) ||
      undefined,

    sourceCaseId:
      stringValue(
        value?.sourceAnalysisId,
        stringValue(
          value?.analysisId
        )
      ) ||
      undefined,

    sourceCaseTitle:
      stringValue(
        value?.sourceAnalysisTitle
      ) ||
      undefined,

    sourceCaseSnapshot:
      toCaseSnapshot(
        value?.sourceAnalysisSnapshot
      ),

    evidenceSnapshots,

    evidenceSnapshotAt:
      stringValue(
        value?.evidenceSnapshotAt
      ) ||
      undefined,

    findings:
      value?.findings,

    recommendations:
      value?.recommendations,
  };
}


export function previewLegacyMigration(
  storage?:
    StorageLike
): LegacyMigrationPreview {
  const target =
    resolveStorage(
      storage
    );

  const analyses =
    safeArray(
      target.getItem(
        LEGACY_STORAGE_KEYS.analyses
      )
    );

  const reports =
    safeArray(
      target.getItem(
        LEGACY_STORAGE_KEYS.reports
      )
    );

  let evidenceCount =
    0;

  let archiveCount =
    0;

  for (
    const item of
    analyses
  ) {
    const evidence =
      Array.isArray(
        item?.evidence
      )
        ? item.evidence
        : [];

    evidenceCount +=
      evidence.length;

    archiveCount +=
      evidence.filter(
        (entry: any) =>
          !!entry?.archive
      ).length;
  }

  return {
    analyses:
      analyses.length,

    reports:
      reports.length,

    evidence:
      evidenceCount,

    archives:
      archiveCount,

    canonicalStoreExists:
      hasCanonicalStore(
        target
      ),
  };
}


/**
 * Migration ایمن:
 * - Legacy keyها پاک نمی‌شوند.
 * - اگر Store مرکزی از قبل وجود داشته باشد، پیش‌فرض overwrite نمی‌کند.
 */
export function migrateLegacyToV1(
  options?: {
    storage?:
      StorageLike;

    overwrite?:
      boolean;
  }
): LegacyMigrationResult {
  const storage =
    resolveStorage(
      options?.storage
    );

  const preview =
    previewLegacyMigration(
      storage
    );

  if (
    preview.canonicalStoreExists &&
    !options?.overwrite
  ) {
    return {
      ...preview,

      migrated:
        false,

      skippedReason:
        "canonical-store-exists",

      storeKey:
        RASADYAR_DATA_STORE_KEY,
    };
  }

  const envelope =
    createEmptyDataEnvelope();

  const analyses =
    safeArray(
      storage.getItem(
        LEGACY_STORAGE_KEYS.analyses
      )
    );

  for (
    const legacyCase of
    analyses
  ) {
    const converted =
      toCase(
        legacyCase,
        envelope
      );

    envelope.cases[
      converted.id
    ] =
      converted;
  }

  const reports =
    safeArray(
      storage.getItem(
        LEGACY_STORAGE_KEYS.reports
      )
    );

  for (
    const legacyReport of
    reports
  ) {
    const converted =
      toReport(
        legacyReport
      );

    envelope.reports[
      converted.id
    ] =
      converted;
  }

  writeCanonicalStore(
    envelope,
    storage
  );

  const migratedEvidence =
    Object.keys(
      envelope.evidence
    ).length;

  const migratedArchives =
    Object.keys(
      envelope.archives
    ).length;

  return {
    analyses:
      Object.keys(
        envelope.cases
      ).length,

    reports:
      Object.keys(
        envelope.reports
      ).length,

    evidence:
      migratedEvidence,

    archives:
      migratedArchives,

    canonicalStoreExists:
      true,

    migrated:
      true,

    storeKey:
      RASADYAR_DATA_STORE_KEY,
  };
}
