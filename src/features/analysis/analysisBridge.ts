import {
  getCurrentUser,
} from "@/auth/userStore";

import {
  upsertCanonicalEvidenceBundle,
  type ArchiveMediaType,
  type EvidenceKind,
  type JsonValue,
} from "@/core/rasadyar-data";

export type AnalysisEvidenceArchive = {
  archiveId: string;
  archivedAt: string;
  archiveVersion: 1;

  /**
   * How the visual archive was produced.
   *
   * video-frame:
   *   Exact frame captured from a native HTMLVideoElement when browser/CORS allows it.
   *
   * youtube-thumbnail:
   *   YouTube thumbnail associated with the current video ID.
   *   It identifies the stream/video but is not guaranteed to be the exact viewed frame.
   *
   * metadata-card:
   *   Local immutable fallback card containing source/time/stream metadata.
   */
  snapshotKind:
    | "video-frame"
    | "youtube-thumbnail"
    | "metadata-card";

  snapshotDataUrl?: string;

  mediaType?: ArchiveMediaType;
  channelId?: string;
  channelName?: string;
  videoId?: string;

  /** Stable/original source URL shown to the analyst. */
  originalUrl?: string;

  /** Actual stream endpoint when known. */
  streamUrl?: string;

  playbackState?: string;

  /**
   * Human-readable explanation of what the archived visual represents.
   * This is intentionally copied with the evidence into analyses/reports.
   */
  note?: string;

  metadata?: Record<
    string,
    JsonValue
  >;
};

export type AnalysisEvidence = {
  id?: string;
  kind: EvidenceKind;
  title: string;
  source?: string;
  url?: string;
  country?: string;
  region?: string;
  lat?: number;
  lon?: number;
  timestamp?: string;
  summary?: string;
  description?: string;

  metadata?: Record<
    string,
    JsonValue
  >;

  /**
   * Embedded immutable evidence archive.
   *
   * Keeping the archive inside the evidence object is deliberate:
   * AnalysisCenter already stores evidence in the analysis record and copies
   * the evidence array into reports. Therefore archive metadata travels with
   * the evidence without depending on the live stream still being available.
   */
  archive?: AnalysisEvidenceArchive;
};

export const ANALYSIS_EVIDENCE_EVENT =
  "rasadyar:add-analysis-evidence";

export const OPEN_ANALYSIS_EVENT =
  "rasadyar:open-analysis-center";

export const PENDING_ANALYSIS_EVIDENCE =
  "rasadyar_pending_analysis_evidence";

function makeEvidenceId() {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `evidence-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

export function normalizeEvidence(
  input: AnalysisEvidence
): AnalysisEvidence & { id: string } {
  return {
    ...input,
    id: input.id || makeEvidenceId(),
    timestamp:
      input.timestamp || new Date().toISOString(),
  };
}

/**
 * Persist the pending evidence safely.
 *
 * Snapshot images are deliberately small, but browser localStorage may still
 * be close to quota on long-running installations. If storing the full
 * evidence fails, we retry without the visual payload while preserving the
 * archive ID, exact time and source metadata so evidence is never blocked.
 */
function savePendingEvidence(
  evidence: AnalysisEvidence & { id: string }
): void {
  try {
    localStorage.setItem(
      PENDING_ANALYSIS_EVIDENCE,
      JSON.stringify(evidence)
    );
    return;
  } catch (error) {
    console.warn(
      "[AnalysisBridge] Full archived evidence could not be stored. Retrying without snapshot image.",
      error
    );
  }

  const archive = evidence.archive
    ? {
        ...evidence.archive,
        snapshotDataUrl: undefined,
        note:
          evidence.archive.note ||
          "تصویر آرشیوی به علت محدودیت فضای ذخیره‌سازی محلی ذخیره نشد؛ فراداده شاهد حفظ شده است.",
      }
    : undefined;

  const reducedEvidence = {
    ...evidence,
    archive,
  };

  try {
    localStorage.setItem(
      PENDING_ANALYSIS_EVIDENCE,
      JSON.stringify(reducedEvidence)
    );
  } catch (error) {
    console.error(
      "[AnalysisBridge] Pending evidence could not be persisted.",
      error
    );
  }
}

function dualWriteCanonicalEvidence(
  evidence:
    AnalysisEvidence & {
      id: string;
    }
): void {
  try {
    const user =
      getCurrentUser();

    const result =
      upsertCanonicalEvidenceBundle(
        {
          id:
            evidence.id,

          kind:
            evidence.kind,

          title:
            evidence.title,

          source:
            evidence.source,

          url:
            evidence.url,

          country:
            evidence.country,

          region:
            evidence.region,

          lat:
            evidence.lat,

          lon:
            evidence.lon,

          timestamp:
            evidence.timestamp ||
            new Date().toISOString(),

          summary:
            evidence.summary,

          description:
            evidence.description,

          metadata:
            evidence.metadata,

          archive:
            evidence.archive,
        },
        {
          createdBy:
            user?.username,
        }
      );

    if (!result.ok) {
      console.warn(
        "[AnalysisBridge] Canonical Evidence dual-write failed; legacy Analysis workflow will continue.",
        result.error
      );

      return;
    }

    if (
      result.fallbackUsed
    ) {
      console.info(
        "[AnalysisBridge] Canonical Evidence was stored with metadata-only archive fallback.",
        {
          evidenceId:
            result.evidenceId,

          archiveId:
            result.archiveId,
        }
      );
    }
  } catch (
    error
  ) {
    /*
     * Canonical migration must never block the working legacy flow.
     */
    console.warn(
      "[AnalysisBridge] Canonical Evidence dual-write was skipped because of an unexpected error.",
      error
    );
  }
}


export function openAnalysisWithEvidence(
  input: AnalysisEvidence
) {
  const evidence = normalizeEvidence(input);

  /*
   * P2-Step2 Dual Write:
   * Persist normalized Evidence + Archive in the canonical store,
   * while keeping the current pending/event workflow unchanged.
   */
  dualWriteCanonicalEvidence(
    evidence
  );

  // Keep a pending copy so evidence is not lost while the panel is mounting.
  savePendingEvidence(evidence);

  // Open the Analysis Center using the existing event-based panel manager.
  window.dispatchEvent(
    new CustomEvent(OPEN_ANALYSIS_EVENT)
  );

  // Also emit the evidence event for cases where the Analysis Center is already open.
  window.setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent(ANALYSIS_EVIDENCE_EVENT, {
        detail: evidence,
      })
    );
  }, 100);
}

export function consumePendingAnalysisEvidence() {
  try {
    const raw = localStorage.getItem(
      PENDING_ANALYSIS_EVIDENCE
    );

    if (!raw) return null;

    localStorage.removeItem(
      PENDING_ANALYSIS_EVIDENCE
    );

    return JSON.parse(raw) as AnalysisEvidence & {
      id: string;
    };
  } catch {
    localStorage.removeItem(
      PENDING_ANALYSIS_EVIDENCE
    );

    return null;
  }
}
