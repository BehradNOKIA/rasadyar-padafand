/*
 * Rasadyar Data Model — Evidence Repository
 *
 * P2-Step2:
 * Dual-write Evidence + Archive into the canonical Rasadyar store.
 *
 * Important:
 * - Legacy workflow remains untouched.
 * - Failure to write canonical data must never block Analysis workflow.
 * - Large image snapshots are guarded to reduce localStorage quota risk.
 */

import {
  RASADYAR_SCHEMA_VERSION,
  type ArchiveMediaType,
  type ArchiveSnapshotKind,
  type EvidenceKind,
  type IsoDateString,
  type JsonValue,
  type RasadyarArchive,
  type RasadyarEvidence,
} from "./schema";

import {
  readCanonicalStore,
  updateCanonicalStore,
} from "./storage";


const MAX_CANONICAL_SNAPSHOT_CHARS =
  650_000;


export interface CanonicalArchiveInput {
  archiveId:
    string;

  archivedAt:
    string;

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

  metadata?:
    Record<
      string,
      JsonValue
    >;
}


export interface CanonicalEvidenceInput {
  id:
    string;

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
    CanonicalArchiveInput;
}


export interface CanonicalEvidenceWriteResult {
  ok:
    boolean;

  evidenceId:
    string;

  archiveId?:
    string;

  snapshotStored:
    boolean;

  fallbackUsed:
    boolean;

  error?:
    unknown;
}


function resolveEvidenceKind(
  input:
    CanonicalEvidenceInput
): EvidenceKind {
  if (
    input.kind ===
    "live-stream"
  ) {
    return "live-stream";
  }

  if (
    input.kind ===
      "news" &&
    input.archive?.mediaType ===
      "live-stream"
  ) {
    return "live-stream";
  }

  return input.kind;
}


function normalizeIso(
  value:
    string | undefined,
  fallback:
    string
): IsoDateString {
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


function prepareArchive(
  input:
    CanonicalArchiveInput,
  fallbackTime:
    string,
  allowSnapshot:
    boolean
): RasadyarArchive {
  const snapshotTooLarge =
    typeof input.snapshotDataUrl ===
      "string" &&
    input.snapshotDataUrl.length >
      MAX_CANONICAL_SNAPSHOT_CHARS;

  const keepSnapshot =
    allowSnapshot &&
    !snapshotTooLarge;

  let note =
    input.note;

  if (
    input.snapshotDataUrl &&
    !keepSnapshot
  ) {
    const suffix =
      snapshotTooLarge
        ? "تصویر آرشیوی به‌علت حجم زیاد در Store مرکزی localStorage تکرار نشد؛ نسخه عملیاتی موجود در پرونده/گزارش فعلی حفظ می‌شود."
        : "تصویر آرشیوی به‌علت محدودیت فضای localStorage در Store مرکزی ذخیره نشد؛ فراداده و شناسه آرشیو حفظ شدند.";

    note =
      note
        ? `${note}\n${suffix}`
        : suffix;
  }

  return {
    schemaVersion:
      RASADYAR_SCHEMA_VERSION,

    archiveId:
      input.archiveId,

    archivedAt:
      normalizeIso(
        input.archivedAt,
        fallbackTime
      ),

    archiveVersion:
      Number.isFinite(
        input.archiveVersion
      )
        ? input.archiveVersion
        : 1,

    snapshotKind:
      input.snapshotKind,

    snapshotDataUrl:
      keepSnapshot
        ? input.snapshotDataUrl
        : undefined,

    mediaType:
      input.mediaType,

    channelId:
      input.channelId,

    channelName:
      input.channelName,

    videoId:
      input.videoId,

    originalUrl:
      input.originalUrl,

    streamUrl:
      input.streamUrl,

    playbackState:
      input.playbackState,

    note,

    metadata:
      input.metadata,
  };
}


function performWrite(
  input:
    CanonicalEvidenceInput,
  createdBy:
    string | undefined,
  allowSnapshot:
    boolean
): CanonicalEvidenceWriteResult {
  const now =
    new Date().toISOString();

  const timestamp =
    normalizeIso(
      input.timestamp,
      now
    );

  const archive =
    input.archive
      ? prepareArchive(
          input.archive,
          timestamp,
          allowSnapshot
        )
      : undefined;

  updateCanonicalStore(
    (
      current
    ) => {
      const previousEvidence =
        current.evidence[
          input.id
        ];

      const evidence:
        RasadyarEvidence = {
        schemaVersion:
          RASADYAR_SCHEMA_VERSION,

        id:
          input.id,

        kind:
          resolveEvidenceKind(
            input
          ),

        title:
          input.title,

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

        archiveId:
          archive?.archiveId ??
          previousEvidence?.archiveId,

        createdAt:
          previousEvidence?.createdAt ??
          timestamp,

        createdBy:
          createdBy ??
          previousEvidence?.createdBy,

        metadata:
          input.metadata ??
          previousEvidence?.metadata,
      };

      return {
        ...current,

        evidence: {
          ...current.evidence,

          [evidence.id]:
            evidence,
        },

        archives:
          archive
            ? {
                ...current.archives,

                [archive.archiveId]:
                  archive,
              }
            : current.archives,
      };
    }
  );

  return {
    ok:
      true,

    evidenceId:
      input.id,

    archiveId:
      archive?.archiveId,

    snapshotStored:
      Boolean(
        archive?.snapshotDataUrl
      ),

    fallbackUsed:
      Boolean(
        input.archive?.snapshotDataUrl &&
        !archive?.snapshotDataUrl
      ),
  };
}


/**
 * Dual-write entry point used by AnalysisBridge.
 *
 * First attempt stores the full archive snapshot.
 * If localStorage quota rejects it, a second attempt stores metadata only.
 * Any failure is returned instead of being thrown to the UI workflow.
 */
export function upsertCanonicalEvidenceBundle(
  input:
    CanonicalEvidenceInput,
  options?: {
    createdBy?:
      string;
  }
): CanonicalEvidenceWriteResult {
  try {
    return performWrite(
      input,
      options?.createdBy,
      true
    );
  } catch (
    firstError
  ) {
    if (
      !input.archive?.snapshotDataUrl
    ) {
      return {
        ok:
          false,

        evidenceId:
          input.id,

        archiveId:
          input.archive?.archiveId,

        snapshotStored:
          false,

        fallbackUsed:
          false,

        error:
          firstError,
      };
    }

    try {
      const fallback =
        performWrite(
          input,
          options?.createdBy,
          false
        );

      return {
        ...fallback,

        fallbackUsed:
          true,
      };
    } catch (
      secondError
    ) {
      return {
        ok:
          false,

        evidenceId:
          input.id,

        archiveId:
          input.archive?.archiveId,

        snapshotStored:
          false,

        fallbackUsed:
          true,

        error:
          secondError,
      };
    }
  }
}


export function getCanonicalEvidenceStats(): {
  evidence:
    number;

  archives:
    number;

  archivesWithSnapshot:
    number;
} {
  const store =
    readCanonicalStore();

  const archives =
    Object.values(
      store.archives
    );

  return {
    evidence:
      Object.keys(
        store.evidence
      ).length,

    archives:
      archives.length,

    archivesWithSnapshot:
      archives.filter(
        (
          archive
        ) =>
          Boolean(
            archive.snapshotDataUrl
          )
      ).length,
  };
}
