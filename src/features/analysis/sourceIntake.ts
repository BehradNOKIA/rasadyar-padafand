/*
 * Rasadyar P4-Step1 — Unified Source Intake Foundation
 *
 * Converts heterogeneous monitoring observations into Rasadyar Evidence.
 * This module does not fetch external data itself; future P4 connectors use
 * this adapter to enter the stable:
 *
 * Source -> Evidence -> Archive -> Case -> Analysis -> Report
 *
 * workflow.
 */

import {
  type ArchiveMediaType,
  type EvidenceKind,
  type JsonValue,
} from "../../core/rasadyar-data";

import {
  openAnalysisWithEvidence,
  type AnalysisEvidence,
  type AnalysisEvidenceArchive,
} from "./analysisBridge";


export const RASADYAR_SOURCE_INTAKE_VERSION =
  "rasadyar-source-intake-v1";


export const SUPPORTED_SOURCE_OBSERVATION_KINDS:
  readonly EvidenceKind[] = [
  "news",
  "live-stream",
  "alert",
  "map",
  "infrastructure",
  "sanctions",
  "radiation",
  "economic",
  "cyber",
  "aviation",
  "maritime",
  "weather",
  "manual",
] as const;


export type SourceObservationSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";


export interface RasadyarSourceObservation {
  id?: string;
  externalId?: string;

  kind:
    EvidenceKind;

  title:
    string;

  provider:
    string;

  source?: string;
  sourceDomain?: string;
  observationType?: string;
  url?: string;

  country?: string;
  region?: string;

  lat?: number;
  lon?: number;

  observedAt?: string;

  summary?: string;
  description?: string;

  severity?:
    SourceObservationSeverity;

  confidence?:
    string | number;

  tags?:
    string[];

  metadata?:
    Record<
      string,
      JsonValue
    >;

  archive?:
    Partial<AnalysisEvidenceArchive>;
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


function safeIso(
  value:
    string | undefined
): string {
  if (
    !value
  ) {
    return new Date().toISOString();
  }

  const parsed =
    new Date(
      value
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}


function escapeXml(
  value:
    string
): string {
  return value
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&apos;"
    );
}


function compact(
  value:
    string | undefined,
  maxLength:
    number
): string {
  const text =
    (
      value ||
      ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (
    text.length <=
    maxLength
  ) {
    return text;
  }

  return `${text.slice(
    0,
    Math.max(
      0,
      maxLength -
        1
    )
  )}…`;
}


function defaultSourceDomain(
  kind:
    EvidenceKind
): string {
  if (
    kind ===
    "cyber"
  ) {
    return "سایبری";
  }

  if (
    kind ===
      "sanctions" ||
    kind ===
      "economic"
  ) {
    return "اقتصادی";
  }

  if (
    kind ===
    "radiation"
  ) {
    return "پرتویی";
  }

  if (
    kind ===
    "infrastructure"
  ) {
    return "زیرساخت";
  }

  if (
    kind ===
      "aviation" ||
    kind ===
      "maritime"
  ) {
    return "حمل‌ونقل";
  }

  if (
    kind ===
    "weather"
  ) {
    return "طبیعی";
  }

  return "عمومی";
}


function kindLabel(
  kind:
    EvidenceKind
): string {
  if (kind === "news") return "خبر";
  if (kind === "live-stream") return "پخش زنده";
  if (kind === "alert") return "هشدار";
  if (kind === "map") return "رویداد نقشه";
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


function createMetadataCardDataUrl(
  input:
    RasadyarSourceObservation,
  timestamp:
    string
): string {
  const title =
    escapeXml(
      compact(
        input.title,
        72
      )
    );

  const summary =
    escapeXml(
      compact(
        input.summary ||
          input.description,
        120
      )
    );

  const provider =
    escapeXml(
      compact(
        input.provider ||
          input.source,
        44
      )
    );

  const region =
    escapeXml(
      compact(
        input.country ||
          input.region ||
          "—",
        38
      )
    );

  const type =
    escapeXml(
      kindLabel(
        input.kind
      )
    );

  const time =
    escapeXml(
      new Date(
        timestamp
      ).toLocaleString(
        "fa-IR"
      )
    );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
      <rect width="960" height="540" fill="#07130f"/>
      <rect x="28" y="28" width="904" height="484" rx="20" fill="#0c1f18" stroke="#1f6f52" stroke-width="2"/>
      <text x="880" y="84" text-anchor="end" fill="#75d7ad" font-family="Tahoma,Arial" font-size="24" font-weight="700">رصدیار پدافند — آرشیو منبع</text>
      <text x="880" y="132" text-anchor="end" fill="#f1f5f9" font-family="Tahoma,Arial" font-size="32" font-weight="700">${title}</text>
      <text x="880" y="184" text-anchor="end" fill="#9fb5aa" font-family="Tahoma,Arial" font-size="19">${summary || "بدون خلاصه ثبت‌شده"}</text>
      <line x1="72" y1="225" x2="888" y2="225" stroke="#1f3a31"/>
      <text x="880" y="274" text-anchor="end" fill="#cbd5e1" font-family="Tahoma,Arial" font-size="20">نوع: ${type}</text>
      <text x="880" y="314" text-anchor="end" fill="#cbd5e1" font-family="Tahoma,Arial" font-size="20">منبع: ${provider || "—"}</text>
      <text x="880" y="354" text-anchor="end" fill="#cbd5e1" font-family="Tahoma,Arial" font-size="20">محدوده: ${region}</text>
      <text x="880" y="394" text-anchor="end" fill="#cbd5e1" font-family="Tahoma,Arial" font-size="20">زمان ثبت: ${time}</text>
      <text x="72" y="474" fill="#5f8072" font-family="Arial" font-size="16">Source Intake: ${RASADYAR_SOURCE_INTAKE_VERSION}</text>
    </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    svg
  )}`;
}


function makeObservationEvidenceId(
  input:
    RasadyarSourceObservation
): string {
  if (
    input.id
  ) {
    return input.id;
  }

  if (
    input.externalId
  ) {
    const safeExternal =
      input.externalId
        .replace(
          /[^a-zA-Z0-9._-]+/g,
          "-"
        )
        .slice(
          0,
          96
        );

    return `source-${input.kind}-${safeExternal}`;
  }

  return createId(
    `source-${input.kind}`
  );
}


function buildArchive(
  input:
    RasadyarSourceObservation,
  evidenceId:
    string,
  timestamp:
    string
): AnalysisEvidenceArchive {
  const archiveId =
    input.archive?.archiveId ||
    `archive-${evidenceId}`;

  const mediaType:
    ArchiveMediaType =
      input.archive?.mediaType ||
      input.kind;

  return {
    archiveId,

    archivedAt:
      input.archive?.archivedAt ||
      timestamp,

    archiveVersion:
      1,

    snapshotKind:
      input.archive?.snapshotKind ||
      "metadata-card",

    snapshotDataUrl:
      input.archive?.snapshotDataUrl ||
      createMetadataCardDataUrl(
        input,
        timestamp
      ),

    mediaType,

    channelId:
      input.archive?.channelId,

    channelName:
      input.archive?.channelName ||
      input.provider,

    videoId:
      input.archive?.videoId,

    originalUrl:
      input.archive?.originalUrl ||
      input.url,

    streamUrl:
      input.archive?.streamUrl,

    playbackState:
      input.archive?.playbackState,

    note:
      input.archive?.note ||
      "کارت آرشیوی خودکار P4 بر پایه فراداده منبع؛ این کارت جایگزین تصویر واقعی منبع نیست.",

    metadata: {
      ...(input.archive?.metadata || {}),

      p4SourceIntakeVersion:
        RASADYAR_SOURCE_INTAKE_VERSION,

      provider:
        input.provider,

      externalId:
        input.externalId ||
        "",

      sourceDomain:
        input.sourceDomain ||
        defaultSourceDomain(
          input.kind
        ),
    },
  };
}


export function sourceObservationToEvidence(
  input:
    RasadyarSourceObservation
): AnalysisEvidence & {
  id:
    string;
} {
  const evidenceId =
    makeObservationEvidenceId(
      input
    );

  const timestamp =
    safeIso(
      input.observedAt
    );

  const sourceDomain =
    input.sourceDomain ||
    defaultSourceDomain(
      input.kind
    );

  return {
    id:
      evidenceId,

    kind:
      input.kind,

    title:
      input.title.trim() ||
      "شاهد بدون عنوان",

    source:
      input.source ||
      input.provider,

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

    metadata: {
      ...(input.metadata || {}),

      p4SourceIntakeVersion:
        RASADYAR_SOURCE_INTAKE_VERSION,

      provider:
        input.provider,

      externalId:
        input.externalId ||
        "",

      sourceDomain,

      observationType:
        input.observationType ||
        "",

      severity:
        input.severity ||
        "info",

      confidence:
        input.confidence ===
          undefined
          ? ""
          : input.confidence,

      tags:
        input.tags ||
        [],
    },

    archive:
      buildArchive(
        input,
        evidenceId,
        timestamp
      ),
  };
}


export function openAnalysisWithSourceObservation(
  input:
    RasadyarSourceObservation
): AnalysisEvidence & {
  id:
    string;
} {
  const evidence =
    sourceObservationToEvidence(
      input
    );

  openAnalysisWithEvidence(
    evidence
  );

  return evidence;
}


export function sourceKindDefaultDomain(
  kind:
    EvidenceKind
): string {
  return defaultSourceDomain(
    kind
  );
}
