import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../auth/AuthProvider";

import {
  rasadyarDataService,
} from "../../core/rasadyar-data";


/* =========================================================
   Types
========================================================= */

type ReportStatus =
  | "draft"
  | "review"
  | "published";


type EvidenceArchive = {
  archiveId?: string;
  archivedAt?: string;
  archiveVersion?: number;

  snapshotKind?:
    | "video-frame"
    | "youtube-thumbnail"
    | "metadata-card";

  snapshotDataUrl?: string;

  mediaType?: string;
  channelId?: string;
  channelName?: string;
  videoId?: string;

  originalUrl?: string;
  streamUrl?: string;

  playbackState?: string;
  note?: string;
};


type ReportEvidence = {
  id?: string;

  kind?:
    | "news"
    | "live-stream"
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

  title?: string;
  source?: string;
  url?: string;
  country?: string;
  region?: string;

  lat?: number;
  lon?: number;

  timestamp?: string;
  summary?: string;
  description?: string;

  archive?: EvidenceArchive;

  [key: string]: unknown;
};


type SourceAnalysisSnapshot = {
  id?: string;
  title?: string;
  analysisType?: string;
  region?: string;
  timeRange?: string;
  domain?: string;
  description?: string;
  findings?: string;
  probability?: string;
  impact?: string;
  confidence?: string;
  riskLevel?: string;
  likelyScenario?: string;
  worstScenario?: string;
  bestScenario?: string;
  recommendations?: string;
  status?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  snapshotAt?: string;

  [key: string]: unknown;
};


type Report = {
  id: string;
  title: string;
  summary: string;
  content: string;
  status: ReportStatus;

  createdAt: string;
  updatedAt: string;
  publishedAt?: string;

  author?: string;

  analysisId?: string;
  sourceAnalysisId?: string;
  sourceAnalysisTitle?: string;
  sourceAnalysisSnapshot?: SourceAnalysisSnapshot;

  evidence?: ReportEvidence[];
  evidenceSnapshotAt?: string;
  createdFromAnalysisAt?: string;

  findings?: unknown;
  recommendations?: unknown;
};


/* =========================================================
   Helpers
========================================================= */

function createReportId() {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `report-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}


function createEmptyReport(): Report {
  const now = new Date().toISOString();

  return {
    id: "",
    title: "",
    summary: "",
    content: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    evidence: [],
  };
}


function valueToText(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        try {
          return JSON.stringify(
            item,
            null,
            2
          );
        } catch {
          return String(item);
        }
      })
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
}


function normalizeReport(
  value: any
): Report {
  const findings = value?.findings;
  const recommendations = value?.recommendations;

  let content =
    value?.content ||
    value?.text ||
    value?.body ||
    "";

  if (!content) {
    const parts: string[] = [];

    const description = valueToText(
      value?.description
    );

    const findingsText = valueToText(
      findings
    );

    const recommendationsText = valueToText(
      recommendations
    );

    if (description) {
      parts.push(
        `شرح و زمینه تحلیل\n${description}`
      );
    }

    if (findingsText) {
      parts.push(
        `یافته‌های کلیدی\n${findingsText}`
      );
    }

    if (recommendationsText) {
      parts.push(
        `پیشنهادها و اقدامات\n${recommendationsText}`
      );
    }

    content = parts.join("\n\n");
  }

  const status: ReportStatus =
    value?.status === "published"
      ? "published"
      : value?.status === "review"
        ? "review"
        : "draft";

  const now = new Date().toISOString();

  return {
    id:
      value?.id ||
      createReportId(),

    title:
      value?.title ||
      value?.name ||
      value?.analysisTitle ||
      "گزارش بدون عنوان",

    summary:
      value?.summary ||
      value?.executiveSummary ||
      value?.description ||
      "",

    content,
    status,

    createdAt:
      value?.createdAt ||
      now,

    updatedAt:
      value?.updatedAt ||
      value?.createdAt ||
      now,

    publishedAt:
      value?.publishedAt,

    author:
      value?.author,

    analysisId:
      value?.analysisId ||
      value?.sourceAnalysisId,

    sourceAnalysisId:
      value?.sourceAnalysisId ||
      value?.analysisId,

    sourceAnalysisTitle:
      value?.sourceAnalysisTitle ||
      value?.analysisTitle,

    sourceAnalysisSnapshot:
      value?.sourceAnalysisSnapshot &&
      typeof value.sourceAnalysisSnapshot === "object"
        ? value.sourceAnalysisSnapshot
        : undefined,

    evidence:
      Array.isArray(value?.evidence)
        ? value.evidence
        : [],

    evidenceSnapshotAt:
      value?.evidenceSnapshotAt,

    createdFromAnalysisAt:
      value?.createdFromAnalysisAt,

    findings,
    recommendations,
  };
}


function loadReports(): Report[] {
  try {
    return rasadyarDataService.reports
      .load<unknown>()
      .map(
        normalizeReport
      );
  } catch (
    error
  ) {
    console.error(
      "Loading reports failed:",
      error
    );

    return [];
  }
}


function saveReports(
  reports:
    Report[]
): boolean {
  return (
    rasadyarDataService.reports.save(
      reports
    ).ok
  );
}


function statusLabel(
  status: ReportStatus
): string {
  if (status === "published") {
    return "منتشرشده";
  }

  if (status === "review") {
    return "در حال بررسی";
  }

  return "پیش‌نویس";
}


function analysisStatusLabel(
  status?: string
): string {
  if (status === "draft") {
    return "پیش‌نویس";
  }

  if (status === "review") {
    return "در حال بررسی";
  }

  if (status === "completed") {
    return "تکمیل‌شده";
  }

  return status || "—";
}


function evidenceKindLabel(
  kind?: ReportEvidence["kind"]
): string {
  if (kind === "news") {
    return "خبر";
  }

  if (kind === "live-stream") {
    return "پخش زنده";
  }

  if (kind === "map") {
    return "رویداد نقشه";
  }

  if (kind === "alert") {
    return "هشدار";
  }

  if (kind === "infrastructure") {
    return "زیرساخت";
  }

  if (kind === "sanctions") {
    return "تحریم";
  }

  if (kind === "radiation") {
    return "پرتویی";
  }

  if (kind === "economic") {
    return "اقتصادی";
  }

  if (kind === "cyber") {
    return "سایبری";
  }

  if (kind === "aviation") {
    return "هوانوردی";
  }

  if (kind === "maritime") {
    return "دریایی";
  }

  if (kind === "weather") {
    return "هواشناسی";
  }

  return "شاهد";
}


function archiveKindLabel(
  kind?: EvidenceArchive["snapshotKind"]
): string {
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


function formatFaDate(
  value?: string
): string {
  if (!value) {
    return "—";
  }

  try {
    return new Date(value).toLocaleString(
      "fa-IR"
    );
  } catch {
    return value;
  }
}


/* =========================================================
   Print / PDF
========================================================= */

function printReport(
  report: Report
): void {
  const escapeHtml = (
    value: unknown
  ): string => {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const safeDataImage = (
    value?: string
  ) => {
    return typeof value === "string" &&
      value.startsWith("data:image/")
      ? value
      : "";
  };

  const evidence =
    Array.isArray(report.evidence)
      ? report.evidence
      : [];

  const evidenceHtml =
    evidence.length > 0
      ? evidence
          .map((item, index) => {
            const archive = item.archive;
            const snapshot = safeDataImage(
              archive?.snapshotDataUrl
            );

            const sourceUrl =
              archive?.originalUrl ||
              item.url ||
              "";

            return `
              <article class="evidence">
                <div class="evidence-title">
                  ${escapeHtml(
                    item.title ||
                      `شاهد ${index + 1}`
                  )}
                </div>

                <div class="meta">
                  <strong>نوع شاهد:</strong>
                  ${escapeHtml(
                    evidenceKindLabel(item.kind)
                  )}
                </div>

                ${
                  snapshot
                    ? `
                      <div class="archive-image-wrap">
                        <img
                          class="archive-image"
                          src="${snapshot}"
                          alt="تصویر آرشیوی شاهد"
                        >

                        <div class="archive-caption">
                          ${escapeHtml(
                            archiveKindLabel(
                              archive?.snapshotKind
                            )
                          )}
                        </div>
                      </div>
                    `
                    : ""
                }

                ${
                  item.summary
                    ? `
                      <div class="evidence-text">
                        ${escapeHtml(item.summary)}
                      </div>
                    `
                    : ""
                }

                ${
                  item.source || archive?.channelName
                    ? `
                      <div class="meta">
                        <strong>منبع:</strong>
                        ${escapeHtml(
                          archive?.channelName ||
                            item.source ||
                            ""
                        )}
                      </div>
                    `
                    : ""
                }

                ${
                  item.timestamp
                    ? `
                      <div class="meta">
                        <strong>زمان ثبت شاهد:</strong>
                        ${escapeHtml(
                          formatFaDate(item.timestamp)
                        )}
                      </div>
                    `
                    : ""
                }

                ${
                  archive?.archivedAt
                    ? `
                      <div class="meta">
                        <strong>زمان آرشیو:</strong>
                        ${escapeHtml(
                          formatFaDate(
                            archive.archivedAt
                          )
                        )}
                      </div>
                    `
                    : ""
                }

                ${
                  archive?.archiveId
                    ? `
                      <div class="meta mono">
                        <strong>Archive ID:</strong>
                        ${escapeHtml(
                          archive.archiveId
                        )}
                      </div>
                    `
                    : ""
                }

                ${
                  archive?.videoId
                    ? `
                      <div class="meta mono">
                        <strong>Video ID:</strong>
                        ${escapeHtml(
                          archive.videoId
                        )}
                      </div>
                    `
                    : ""
                }

                ${
                  archive?.channelId
                    ? `
                      <div class="meta mono">
                        <strong>Channel ID:</strong>
                        ${escapeHtml(
                          archive.channelId
                        )}
                      </div>
                    `
                    : ""
                }

                ${
                  archive?.playbackState
                    ? `
                      <div class="meta">
                        <strong>وضعیت پخش:</strong>
                        ${escapeHtml(
                          archive.playbackState
                        )}
                      </div>
                    `
                    : ""
                }

                ${
                  archive?.note
                    ? `
                      <div class="archive-note">
                        ${escapeHtml(archive.note)}
                      </div>
                    `
                    : ""
                }

                ${
                  sourceUrl
                    ? `
                      <div class="meta url">
                        <strong>منبع اصلی:</strong>
                        ${escapeHtml(sourceUrl)}
                      </div>
                    `
                    : ""
                }
              </article>
            `;
          })
          .join("")
      : `
          <div class="empty">
            شاهد یا منبعی ثبت نشده است.
          </div>
        `;

  const snapshot = report.sourceAnalysisSnapshot;

  const snapshotHtml = snapshot
    ? `
      <section>
        <h2>مشخصات پرونده تحلیل مبنا</h2>

        <div class="snapshot-grid">
          <div><strong>شناسه:</strong> ${escapeHtml(snapshot.id || report.sourceAnalysisId || "—")}</div>
          <div><strong>نوع تحلیل:</strong> ${escapeHtml(snapshot.analysisType || "—")}</div>
          <div><strong>حوزه:</strong> ${escapeHtml(snapshot.domain || "—")}</div>
          <div><strong>منطقه:</strong> ${escapeHtml(snapshot.region || "—")}</div>
          <div><strong>بازه زمانی:</strong> ${escapeHtml(snapshot.timeRange || "—")}</div>
          <div><strong>وضعیت:</strong> ${escapeHtml(analysisStatusLabel(snapshot.status))}</div>
          <div><strong>ریسک:</strong> ${escapeHtml(snapshot.riskLevel || "—")}</div>
          <div><strong>اطمینان:</strong> ${escapeHtml(snapshot.confidence || "—")}</div>
          <div><strong>زمان Snapshot:</strong> ${escapeHtml(formatFaDate(snapshot.snapshotAt))}</div>
        </div>
      </section>
    `
    : "";

  const html = `
<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.title || "گزارش رصدیار پدافند")}</title>

  <style>
    @page {
      size: A4;
      margin: 16mm 15mm 18mm 15mm;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff !important;
      color: #111 !important;
    }

    body {
      direction: rtl;
      font-family: Tahoma, Arial, sans-serif;
      font-size: 11.5pt;
      line-height: 2;
    }

    .report {
      width: 100%;
      max-width: 180mm;
      margin: 0 auto;
    }

    .brand {
      text-align: center;
      border-bottom: 2px solid #202020;
      padding-bottom: 12px;
      margin-bottom: 22px;
    }

    .brand-name {
      font-size: 19pt;
      font-weight: 700;
    }

    .brand-subtitle {
      margin-top: 4px;
      color: #555;
      font-size: 10pt;
    }

    .status {
      display: inline-block;
      padding: 2px 10px;
      margin-bottom: 11px;
      border: 1px solid #444;
      border-radius: 20px;
      font-size: 9pt;
    }

    h1 {
      margin: 0 0 15px;
      font-size: 20pt;
      line-height: 1.7;
    }

    h2 {
      margin: 25px 0 9px;
      padding-bottom: 5px;
      border-bottom: 1px solid #ccc;
      font-size: 14pt;
    }

    .metadata,
    .snapshot-grid {
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 5px;
      background: #f5f5f5;
      font-size: 9.5pt;
    }

    .snapshot-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px 16px;
    }

    .summary {
      padding: 13px 15px;
      border-right: 4px solid #333;
      background: #f6f6f6;
      white-space: pre-wrap;
      text-align: justify;
    }

    .content {
      white-space: pre-wrap;
      text-align: justify;
      line-height: 2.1;
    }

    .analysis-source {
      margin-top: 22px;
      padding: 10px 12px;
      border: 1px solid #ddd;
      background: #f7f7f7;
    }

    .evidence {
      padding: 11px 13px;
      margin-bottom: 10px;
      border: 1px solid #ddd;
      page-break-inside: avoid;
    }

    .evidence-title {
      margin-bottom: 5px;
      font-weight: 700;
    }

    .evidence-text {
      white-space: pre-wrap;
      text-align: justify;
    }

    .archive-image-wrap {
      margin: 9px 0;
      padding: 8px;
      border: 1px solid #ddd;
      background: #fafafa;
      page-break-inside: avoid;
    }

    .archive-image {
      display: block;
      max-width: 100%;
      max-height: 92mm;
      margin: 0 auto;
      object-fit: contain;
    }

    .archive-caption {
      margin-top: 5px;
      text-align: center;
      color: #555;
      font-size: 8.5pt;
    }

    .archive-note {
      margin-top: 7px;
      padding: 7px 9px;
      border: 1px solid #ddd;
      background: #fafafa;
      color: #555;
      font-size: 9pt;
    }

    .meta {
      margin-top: 4px;
      color: #555;
      font-size: 9pt;
    }

    .mono,
    .url {
      direction: ltr;
      text-align: left;
      word-break: break-all;
    }

    .empty {
      padding: 10px 0;
      color: #777;
    }

    .footer {
      margin-top: 35px;
      padding-top: 10px;
      border-top: 1px solid #bbb;
      text-align: center;
      color: #666;
      font-size: 8.5pt;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      h1, h2 { page-break-after: avoid; }
      .evidence, .metadata, .summary, .analysis-source, .snapshot-grid {
        break-inside: avoid;
      }
    }
  </style>
</head>

<body>
  <main class="report">
    <header class="brand">
      <div class="brand-name">رصدیار پدافند</div>
      <div class="brand-subtitle">سامانه هوشمند رصد، تحلیل و گزارش‌دهی</div>
    </header>

    <div class="status">${escapeHtml(statusLabel(report.status))}</div>

    <h1>${escapeHtml(report.title)}</h1>

    <div class="metadata">
      <div><strong>آخرین به‌روزرسانی:</strong> ${escapeHtml(formatFaDate(report.updatedAt))}</div>
      ${report.publishedAt ? `<div><strong>تاریخ انتشار:</strong> ${escapeHtml(formatFaDate(report.publishedAt))}</div>` : ""}
      ${report.author ? `<div><strong>تهیه‌کننده:</strong> ${escapeHtml(report.author)}</div>` : ""}
      ${report.sourceAnalysisTitle ? `<div><strong>پرونده تحلیل مبنا:</strong> ${escapeHtml(report.sourceAnalysisTitle)}</div>` : ""}
    </div>

    ${
      report.summary
        ? `
          <section>
            <h2>خلاصه مدیریتی</h2>
            <div class="summary">${escapeHtml(report.summary)}</div>
          </section>
        `
        : ""
    }

    <section>
      <h2>متن گزارش</h2>
      <div class="content">${escapeHtml(report.content || "متن گزارش ثبت نشده است.")}</div>
    </section>

    ${
      report.sourceAnalysisTitle
        ? `
          <div class="analysis-source">
            <strong>پرونده تحلیل مبنا:</strong>
            ${escapeHtml(report.sourceAnalysisTitle)}
          </div>
        `
        : ""
    }

    ${snapshotHtml}

    <section>
      <h2>شواهد و مستندات آرشیوی</h2>
      ${evidenceHtml}
    </section>

    <footer class="footer">
      رصدیار پدافند
      <br>
      گزارش تولیدشده از سامانه هوشمند رصد، تحلیل و گزارش‌دهی
    </footer>
  </main>
</body>
</html>
  `;

  const printWindow = window.open(
    "",
    "_blank",
    "width=1000,height=800"
  );

  if (!printWindow) {
    window.alert(
      "مرورگر اجازه باز کردن پنجره چاپ را نداد. Pop-up را برای این سایت فعال کنید."
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
}


/* =========================================================
   Shared views
========================================================= */

function AnalysisSnapshotView({
  snapshot,
}: {
  snapshot: SourceAnalysisSnapshot;
}) {
  const items: Array<[string, string]> = [
    ["نوع تحلیل", snapshot.analysisType || "—"],
    ["حوزه", snapshot.domain || "—"],
    ["منطقه", snapshot.region || "—"],
    ["بازه زمانی", snapshot.timeRange || "—"],
    ["وضعیت پرونده", analysisStatusLabel(snapshot.status)],
    ["سطح ریسک", snapshot.riskLevel || "—"],
    ["احتمال", snapshot.probability || "—"],
    ["اثر", snapshot.impact || "—"],
    ["اطمینان تحلیل", snapshot.confidence || "—"],
    ["تهیه‌کننده", snapshot.createdByName || snapshot.createdBy || "—"],
    ["زمان ایجاد پرونده", formatFaDate(snapshot.createdAt)],
    ["زمان Snapshot", formatFaDate(snapshot.snapshotAt)],
  ];

  return (
    <div style={analysisSnapshotGridStyle}>
      {items.map(([label, value]) => (
        <div key={label} style={analysisSnapshotItemStyle}>
          <span style={analysisSnapshotLabelStyle}>{label}</span>
          <strong style={analysisSnapshotValueStyle}>{value}</strong>
        </div>
      ))}
    </div>
  );
}


function EvidenceMeta({
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

      <strong
        dir={dir}
        title={value}
        style={{
          ...archiveMetaValueStyle,
          textAlign: dir === "ltr" ? "left" : "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}


function ReportEvidenceCard({
  evidence,
  index,
}: {
  evidence: ReportEvidence;
  index: number;
}) {
  const archive = evidence.archive;

  const sourceUrl =
    archive?.originalUrl ||
    evidence.url;

  return (
    <article style={archiveCardStyle}>
      <div style={archiveCardHeaderStyle}>
        <div style={{ minWidth: 0 }}>
          <div dir="auto" style={archiveTitleStyle}>
            {evidence.title || `شاهد ${index + 1}`}
          </div>

          <div style={archiveMetaLineStyle}>
            {evidenceKindLabel(evidence.kind)}
            {archive?.channelName || evidence.source
              ? ` | ${archive?.channelName || evidence.source}`
              : ""}
            {evidence.country ? ` | ${evidence.country}` : ""}
          </div>
        </div>

        {archive?.archiveId && (
          <span style={archiveRegisteredBadgeStyle}>
            آرشیوشده
          </span>
        )}
      </div>

      {archive?.snapshotDataUrl ? (
        <div style={archiveImageWrapStyle}>
          <img
            src={archive.snapshotDataUrl}
            alt={`تصویر آرشیوی ${evidence.title || `شاهد ${index + 1}`}`}
            style={archiveImageStyle}
          />

          <span style={archiveImageBadgeStyle}>
            {archiveKindLabel(archive.snapshotKind)}
          </span>
        </div>
      ) : archive ? (
        <div style={archiveNoImageStyle}>
          تصویر آرشیوی در دسترس نیست؛ شناسه، زمان و فراداده شاهد حفظ شده است.
        </div>
      ) : (
        <div style={legacyNoticeStyle}>
          این شاهد قبل از فعال‌شدن لایه آرشیو ثبت شده است.
        </div>
      )}

      {evidence.summary && (
        <div dir="auto" style={archiveSummaryStyle}>
          {evidence.summary}
        </div>
      )}

      <div style={archiveMetaGridStyle}>
        <EvidenceMeta
          label="زمان ثبت شاهد"
          value={formatFaDate(evidence.timestamp)}
        />

        <EvidenceMeta
          label="زمان آرشیو"
          value={
            archive?.archivedAt
              ? formatFaDate(archive.archivedAt)
              : "—"
          }
        />

        <EvidenceMeta
          label="وضعیت پخش"
          value={archive?.playbackState || "—"}
        />

        <EvidenceMeta
          label="Archive ID"
          value={archive?.archiveId || "—"}
          dir="ltr"
        />

        {archive?.videoId && (
          <EvidenceMeta
            label="Video ID"
            value={archive.videoId}
            dir="ltr"
          />
        )}

        {archive?.channelId && (
          <EvidenceMeta
            label="Channel ID"
            value={archive.channelId}
            dir="ltr"
          />
        )}
      </div>

      {archive?.note && (
        <div style={archiveNoteStyle}>
          {archive.note}
        </div>
      )}

      {sourceUrl && (
        <div style={archiveActionsStyle}>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={sourceLinkStyle}
          >
            باز کردن منبع اصلی
          </a>

          {archive?.streamUrl &&
            archive.streamUrl !== sourceUrl && (
              <a
                href={archive.streamUrl}
                target="_blank"
                rel="noreferrer"
                style={streamLinkStyle}
              >
                نشانی جریان
              </a>
            )}
        </div>
      )}
    </article>
  );
}


/* =========================================================
   Main Component
========================================================= */

export default function ReportCenter() {
  const auth = useAuth();
  const user = auth?.user;

  const role = user?.role || "viewer";

  const isAdmin =
    role === "superadmin" ||
    role === "admin";

  const isAnalyst = role === "analyst";
  const isViewer = role === "viewer";

  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Report>(createEmptyReport());
  const [filter, setFilter] = useState<"all" | ReportStatus>(
    isViewer ? "published" : "all"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    setReports(
      loadReports()
    );
  }, []);

  const visibleReports = useMemo(() => {
    let list = [...reports].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime()
    );

    if (isViewer) {
      return list.filter(
        (report) => report.status === "published"
      );
    }

    if (filter !== "all") {
      list = list.filter(
        (report) => report.status === filter
      );
    }

    return list;
  }, [reports, filter, isViewer]);

  const viewerReport = isViewer
    ? visibleReports.find(
        (report) => report.id === selectedId
      ) ||
      visibleReports[0] ||
      null
    : null;

  const canCreate = isAdmin || isAnalyst;

  const canEditCurrent =
    isAdmin ||
    (isAnalyst && form.status !== "published");

  const canPublish = isAdmin;
  const canDelete = isAdmin;

  const persist = (
    next: Report[]
  ) => {
    const saved =
      saveReports(
        next
      );

    if (!saved) {
      setMessage(
        "ذخیره گزارش انجام نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید."
      );

      return false;
    }

    setReports(
      next
    );

    return true;
  };

  const newReport = () => {
    if (!canCreate) return;

    setSelectedId(null);
    setForm(createEmptyReport());
    setMessage("");
  };

  const openReport = (
    report: Report
  ) => {
    setSelectedId(report.id);
    setForm({ ...report });
    setMessage("");
  };

  const changeField = (
    field: "title" | "summary" | "content",
    value: string
  ) => {
    if (!canEditCurrent) return;

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const upsertReport = (
    status: ReportStatus,
    successMessage: string,
    publish = false
  ) => {
    if (!form.title.trim()) {
      setMessage("عنوان گزارش را وارد کنید.");
      return;
    }

    const now = new Date().toISOString();
    const id = selectedId || form.id || createReportId();

    const nextReport: Report = {
      ...form,
      id,
      title: form.title.trim(),
      status,
      author:
        form.author ||
        user?.name ||
        user?.username,
      createdAt: form.createdAt || now,
      updatedAt: now,
      publishedAt:
        publish
          ? now
          : status === "published"
            ? form.publishedAt
            : undefined,
    };

    const exists = reports.some(
      (report) => report.id === id
    );

    const next = exists
      ? reports.map((report) =>
          report.id === id
            ? nextReport
            : report
        )
      : [nextReport, ...reports];

    if (!persist(next)) return;

    setSelectedId(id);
    setForm(nextReport);
    setMessage(successMessage);
  };

  const saveCurrentReport = () => {
    if (!canEditCurrent) return;

    upsertReport(
      form.status,
      "گزارش ذخیره شد."
    );
  };

  const sendForReview = () => {
    if (!isAdmin && !isAnalyst) return;

    if (
      form.status === "published" &&
      !isAdmin
    ) {
      return;
    }

    upsertReport(
      "review",
      "گزارش برای بررسی مدیر ارسال شد."
    );
  };

  const publishReport = () => {
    if (!canPublish) return;

    upsertReport(
      "published",
      "گزارش منتشر شد.",
      true
    );
  };

  const returnToDraft = () => {
    if (!isAdmin || !selectedId) return;

    const nextReport: Report = {
      ...form,
      status: "draft",
      updatedAt: new Date().toISOString(),
      publishedAt: undefined,
    };

    const next = reports.map((report) =>
      report.id === selectedId
        ? nextReport
        : report
    );

    if (!persist(next)) return;

    setForm(nextReport);
    setMessage("گزارش به پیش‌نویس بازگردانده شد.");
  };

  const removeReport = () => {
    if (!canDelete || !selectedId) return;

    const confirmed = window.confirm(
      "این گزارش حذف شود؟"
    );

    if (!confirmed) return;

    const next = reports.filter(
      (report) => report.id !== selectedId
    );

    if (!persist(next)) return;

    setSelectedId(null);
    setForm(createEmptyReport());
    setMessage("گزارش حذف شد.");
  };

  if (!auth || !user) {
    return (
      <div style={pageStyle} dir="rtl">
        خطای احراز هویت
      </div>
    );
  }

  /* =========================================================
     Viewer mode
  ========================================================= */

  if (isViewer) {
    return (
      <div dir="rtl" style={viewerPageStyle}>
        <div style={viewerHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, fontSize: 23 }}>
              گزارش‌های منتشرشده
            </h2>

            <div style={headerSubtitleStyle}>
              کتابخانه گزارش‌های نهایی و تأییدشده رصدیار پدافند
            </div>
          </div>

          <div style={readOnlyBadgeStyle}>
            فقط خواندنی
          </div>
        </div>

        {visibleReports.length === 0 ? (
          <div style={emptyBoxStyle}>
            هنوز گزارش منتشرشده‌ای وجود ندارد.
          </div>
        ) : (
          <div style={viewerLayoutStyle}>
            <aside style={viewerListStyle}>
              <div style={listTitleStyle}>گزارش‌ها</div>

              {visibleReports.map((report) => {
                const active = viewerReport?.id === report.id;

                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => openReport(report)}
                    style={viewerListButtonStyle(active)}
                  >
                    <div dir="auto" style={listReportTitleStyle}>
                      {report.title}
                    </div>

                    <div style={publishedTextStyle}>
                      منتشرشده
                    </div>

                    <div style={listDateStyle}>
                      {formatFaDate(
                        report.publishedAt || report.updatedAt
                      )}
                    </div>
                  </button>
                );
              })}
            </aside>

            {viewerReport && (
              <article style={articleStyle}>
                <div style={articleHeaderStyle}>
                  <div style={articleTitleRowStyle}>
                    <div>
                      <div style={publishedBadgeStyle}>
                        منتشرشده
                      </div>

                      <h1 dir="auto" style={articleTitleStyle}>
                        {viewerReport.title}
                      </h1>
                    </div>

                    <button
                      type="button"
                      onClick={() => printReport(viewerReport)}
                      style={secondaryButton}
                    >
                      چاپ / PDF
                    </button>
                  </div>

                  <div style={metadataStyle}>
                    <span>
                      تاریخ انتشار: {formatFaDate(
                        viewerReport.publishedAt || viewerReport.updatedAt
                      )}
                    </span>

                    {viewerReport.author && (
                      <span>
                        تهیه‌کننده: {viewerReport.author}
                      </span>
                    )}
                  </div>
                </div>

                <div style={articleBodyStyle}>
                  {viewerReport.summary && (
                    <section style={sectionSpacingStyle}>
                      <h3 style={greenSectionTitleStyle}>
                        خلاصه مدیریتی
                      </h3>

                      <div dir="auto" style={summaryReadStyle}>
                        {viewerReport.summary}
                      </div>
                    </section>
                  )}

                  <section style={sectionSpacingStyle}>
                    <h3 style={sectionTitleStyle}>
                      متن گزارش
                    </h3>

                    <div dir="auto" style={reportTextStyle}>
                      {viewerReport.content || "متن گزارش ثبت نشده است."}
                    </div>
                  </section>

                  {viewerReport.sourceAnalysisTitle && (
                    <section style={sourceAnalysisStyle}>
                      <div style={sourceHeaderStyle}>
                        <div>
                          <span style={sourceEyebrowStyle}>
                            پرونده تحلیل مبنا
                          </span>

                          <div style={sourceTitleStyle}>
                            {viewerReport.sourceAnalysisTitle}
                          </div>
                        </div>

                        {viewerReport.sourceAnalysisId && (
                          <span style={sourceIdStyle}>
                            {viewerReport.sourceAnalysisId}
                          </span>
                        )}
                      </div>

                      {viewerReport.sourceAnalysisSnapshot && (
                        <AnalysisSnapshotView
                          snapshot={viewerReport.sourceAnalysisSnapshot}
                        />
                      )}
                    </section>
                  )}

                  <section>
                    <h3 style={sectionTitleStyle}>
                      شواهد و مستندات آرشیوی
                    </h3>

                    {viewerReport.evidenceSnapshotAt && (
                      <div style={snapshotTimeStyle}>
                        Snapshot شواهد گزارش: {formatFaDate(
                          viewerReport.evidenceSnapshotAt
                        )}
                      </div>
                    )}

                    {!viewerReport.evidence ||
                    viewerReport.evidence.length === 0 ? (
                      <div style={mutedStyle}>
                        شاهد یا منبعی ثبت نشده است.
                      </div>
                    ) : (
                      <div style={evidenceListStyle}>
                        {viewerReport.evidence.map((evidence, index) => (
                          <ReportEvidenceCard
                            key={evidence.id || index}
                            evidence={evidence}
                            index={index}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </article>
            )}
          </div>
        )}
      </div>
    );
  }

  /* =========================================================
     Admin / Analyst mode
  ========================================================= */

  return (
    <div style={pageStyle} dir="rtl">
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0 }}>
            مرکز گزارش‌ها
          </h2>

          <div style={headerSubtitleStyle}>
            تدوین، بررسی، تأیید و انتشار گزارش‌های تحلیلی مستند
          </div>
        </div>

        {canCreate && (
          <button
            type="button"
            style={primaryButton}
            onClick={newReport}
          >
            + گزارش جدید
          </button>
        )}
      </div>

      {message && (
        <div style={noticeStyle}>
          {message}
        </div>
      )}

      <div style={tabsStyle}>
        {([
          ["all", "همه"],
          ["draft", "پیش‌نویس"],
          ["review", "در حال بررسی"],
          ["published", "منتشرشده"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            style={tabStyle(filter === value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={layoutStyle}>
        <div style={listPanelStyle}>
          <h3 style={{ marginTop: 0 }}>
            گزارش‌ها
          </h3>

          {visibleReports.length === 0 ? (
            <div style={emptyListStyle}>
              گزارشی وجود ندارد.
            </div>
          ) : (
            visibleReports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => openReport(report)}
                style={reportItemStyle(selectedId === report.id)}
              >
                <strong dir="auto">{report.title}</strong>

                <div style={reportStatusTextStyle}>
                  {statusLabel(report.status)}
                </div>

                <div style={listDateStyle}>
                  {formatFaDate(report.updatedAt)}
                </div>
              </button>
            ))
          )}
        </div>

        <div style={editorStyle}>
          <div style={statusBarStyle}>
            وضعیت:
            <strong>{statusLabel(form.status)}</strong>
          </div>

          <label style={labelStyle}>
            عنوان گزارش
          </label>

          <input
            dir="auto"
            style={inputStyle}
            value={form.title}
            disabled={!canEditCurrent}
            onChange={(event) =>
              changeField("title", event.target.value)
            }
            placeholder="عنوان گزارش..."
          />

          <label style={labelStyle}>
            خلاصه مدیریتی
          </label>

          <textarea
            dir="auto"
            style={summaryInputStyle}
            value={form.summary}
            disabled={!canEditCurrent}
            onChange={(event) =>
              changeField("summary", event.target.value)
            }
            placeholder="خلاصه مدیریتی گزارش..."
          />

          <label style={labelStyle}>
            متن گزارش
          </label>

          <textarea
            dir="auto"
            style={contentInputStyle}
            value={form.content}
            disabled={!canEditCurrent}
            onChange={(event) =>
              changeField("content", event.target.value)
            }
            placeholder="متن کامل گزارش..."
          />

          {form.sourceAnalysisTitle && (
            <section style={sourceSnapshotPanelStyle}>
              <div style={sourceHeaderStyle}>
                <div>
                  <div style={sourceEyebrowStyle}>
                    Snapshot پرونده تحلیل مبنا
                  </div>

                  <strong>
                    {form.sourceAnalysisTitle}
                  </strong>
                </div>

                {form.sourceAnalysisId && (
                  <span style={sourceIdStyle}>
                    {form.sourceAnalysisId}
                  </span>
                )}
              </div>

              {form.sourceAnalysisSnapshot ? (
                <AnalysisSnapshotView
                  snapshot={form.sourceAnalysisSnapshot}
                />
              ) : (
                <div style={legacyNoticeStyle}>
                  این گزارش با نسخه قدیمی مرکز تحلیل ساخته شده و Snapshot ساختاریافته پرونده مبنا ندارد.
                </div>
              )}
            </section>
          )}

          {!!form.evidence?.length && (
            <section style={evidencePanelStyle}>
              <div style={evidencePanelHeaderStyle}>
                <div>
                  <div style={sourceEyebrowStyle}>
                    مستندات همراه گزارش
                  </div>

                  <strong>
                    شواهد و آرشیوها
                  </strong>
                </div>

                <span style={evidenceCountBadgeStyle}>
                  {form.evidence.length} شاهد
                </span>
              </div>

              {form.evidenceSnapshotAt && (
                <div style={snapshotTimeStyle}>
                  زمان Snapshot شواهد: {formatFaDate(form.evidenceSnapshotAt)}
                </div>
              )}

              <div style={evidenceListStyle}>
                {form.evidence.map((evidence, index) => (
                  <ReportEvidenceCard
                    key={evidence.id || index}
                    evidence={evidence}
                    index={index}
                  />
                ))}
              </div>
            </section>
          )}

          <div style={actionBarStyle}>
            {canEditCurrent && (
              <button
                type="button"
                style={secondaryButton}
                onClick={saveCurrentReport}
              >
                ذخیره
              </button>
            )}

            {(isAdmin || isAnalyst) &&
              form.status !== "published" && (
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={sendForReview}
                >
                  ارسال برای بررسی
                </button>
              )}

            {canPublish &&
              form.status !== "published" && (
                <button
                  type="button"
                  style={primaryButton}
                  onClick={publishReport}
                >
                  انتشار گزارش
                </button>
              )}

            {isAdmin &&
              form.status === "published" && (
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={returnToDraft}
                >
                  بازگردانی به پیش‌نویس
                </button>
              )}

            {canDelete && selectedId && (
              <button
                type="button"
                style={dangerButton}
                onClick={removeReport}
              >
                حذف
              </button>
            )}

            {form.id && (
              <button
                type="button"
                style={secondaryButton}
                onClick={() => printReport(form)}
              >
                چاپ / PDF
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   Styles
========================================================= */

const fontFamily =
  '"Vazirmatn Variable", "Vazirmatn", Tahoma, Arial, sans-serif';

const pageStyle: React.CSSProperties = {
  minHeight: "100%",
  padding: 20,
  boxSizing: "border-box",
  color: "#fff",
  background: "#0d120f",
  fontFamily,
};

const viewerPageStyle: React.CSSProperties = {
  ...pageStyle,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 18,
};

const viewerHeaderStyle: React.CSSProperties = {
  ...headerStyle,
  paddingBottom: 16,
  marginBottom: 20,
  borderBottom: "1px solid rgba(52,211,153,.10)",
};

const headerSubtitleStyle: React.CSSProperties = {
  marginTop: 6,
  color: "rgba(220,238,229,.52)",
  fontSize: 12,
};

const tabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 16,
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, .82fr) minmax(0, 2.2fr)",
  gap: 16,
};

const viewerLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "230px minmax(0, 1fr)",
  gap: 16,
  alignItems: "start",
};

const listPanelStyle: React.CSSProperties = {
  maxHeight: "76vh",
  padding: 12,
  overflowY: "auto",
  border: "1px solid rgba(52,211,153,.11)",
  borderRadius: 9,
  background: "rgba(5,20,13,.66)",
};

const viewerListStyle: React.CSSProperties = {
  ...listPanelStyle,
};

const editorStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid rgba(52,211,153,.11)",
  borderRadius: 9,
  background: "rgba(5,20,13,.58)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginTop: 16,
  marginBottom: 6,
  color: "rgba(220,238,229,.70)",
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 40,
  boxSizing: "border-box",
  padding: "9px 10px",
  color: "#fff",
  background: "rgba(2,10,7,.76)",
  border: "1px solid rgba(52,211,153,.13)",
  borderRadius: 7,
  outline: "none",
  fontFamily,
};

const summaryInputStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 110,
  resize: "vertical",
};

const contentInputStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 280,
  resize: "vertical",
};

const noticeStyle: React.CSSProperties = {
  padding: 10,
  marginBottom: 14,
  border: "1px solid rgba(96,165,250,.22)",
  borderRadius: 7,
  color: "#dbeafe",
  background: "rgba(30,58,138,.15)",
  fontSize: 11,
};

const actionBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 20,
  paddingTop: 16,
  borderTop: "1px solid rgba(52,211,153,.10)",
};

const statusBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginBottom: 12,
  color: "rgba(220,238,229,.62)",
  fontSize: 11,
};

const primaryButton: React.CSSProperties = {
  minHeight: 34,
  padding: "7px 12px",
  border: "1px solid rgba(52,211,153,.42)",
  borderRadius: 7,
  color: "#fff",
  background: "#0b6a3a",
  cursor: "pointer",
  fontFamily,
  fontSize: 11,
  fontWeight: 700,
};

const secondaryButton: React.CSSProperties = {
  minHeight: 34,
  padding: "7px 12px",
  border: "1px solid rgba(148,163,184,.20)",
  borderRadius: 7,
  color: "#e2e8f0",
  background: "rgba(30,41,59,.28)",
  cursor: "pointer",
  fontFamily,
  fontSize: 11,
};

const dangerButton: React.CSSProperties = {
  ...secondaryButton,
  border: "1px solid rgba(248,113,113,.28)",
  color: "#fecaca",
  background: "rgba(127,29,29,.20)",
};

const tabStyle = (
  active: boolean
): React.CSSProperties => ({
  ...secondaryButton,
  border: active
    ? "1px solid rgba(52,211,153,.42)"
    : "1px solid rgba(148,163,184,.18)",
  color: active ? "#d1fae5" : "#cbd5e1",
  background: active
    ? "rgba(20,83,45,.42)"
    : "rgba(30,41,59,.22)",
});

const reportItemStyle = (
  active: boolean
): React.CSSProperties => ({
  width: "100%",
  display: "block",
  padding: 11,
  marginBottom: 8,
  textAlign: "right",
  color: "#fff",
  border: active
    ? "1px solid rgba(52,211,153,.42)"
    : "1px solid rgba(148,163,184,.11)",
  borderRadius: 7,
  background: active
    ? "rgba(20,83,45,.36)"
    : "rgba(2,10,7,.48)",
  cursor: "pointer",
  fontFamily,
});

const viewerListButtonStyle = (
  active: boolean
): React.CSSProperties => ({
  ...reportItemStyle(active),
});

const emptyListStyle: React.CSSProperties = {
  padding: 20,
  color: "rgba(220,238,229,.42)",
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 30,
  textAlign: "center",
  color: "rgba(220,238,229,.52)",
  border: "1px solid rgba(52,211,153,.10)",
  borderRadius: 9,
  background: "rgba(5,20,13,.58)",
};

const listTitleStyle: React.CSSProperties = {
  marginBottom: 12,
  fontWeight: 700,
};

const listReportTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  lineHeight: 1.8,
};

const publishedTextStyle: React.CSSProperties = {
  marginTop: 5,
  color: "#86efac",
  fontSize: 10,
};

const reportStatusTextStyle: React.CSSProperties = {
  marginTop: 6,
  color: "rgba(220,238,229,.62)",
  fontSize: 10,
};

const listDateStyle: React.CSSProperties = {
  marginTop: 4,
  color: "rgba(220,238,229,.34)",
  fontSize: 9,
};

const readOnlyBadgeStyle: React.CSSProperties = {
  padding: "5px 10px",
  border: "1px solid rgba(52,211,153,.30)",
  borderRadius: 999,
  color: "#86efac",
  fontSize: 10,
};

const articleStyle: React.CSSProperties = {
  overflow: "hidden",
  border: "1px solid rgba(52,211,153,.11)",
  borderRadius: 9,
  background: "rgba(5,20,13,.58)",
};

const articleHeaderStyle: React.CSSProperties = {
  padding: "20px 22px",
  borderBottom: "1px solid rgba(52,211,153,.10)",
  background: "rgba(2,10,7,.44)",
};

const articleTitleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 18,
};

const articleTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  lineHeight: 1.8,
};

const publishedBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 9px",
  marginBottom: 12,
  border: "1px solid rgba(52,211,153,.30)",
  borderRadius: 999,
  color: "#86efac",
  fontSize: 10,
};

const metadataStyle: React.CSSProperties = {
  display: "flex",
  gap: 18,
  flexWrap: "wrap",
  marginTop: 14,
  color: "rgba(220,238,229,.50)",
  fontSize: 11,
};

const articleBodyStyle: React.CSSProperties = {
  padding: 22,
};

const sectionSpacingStyle: React.CSSProperties = {
  marginBottom: 26,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 10px",
};

const greenSectionTitleStyle: React.CSSProperties = {
  margin: "0 0 10px",
  color: "#86efac",
};

const summaryReadStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid rgba(148,163,184,.13)",
  borderRadius: 7,
  background: "rgba(2,10,7,.42)",
  whiteSpace: "pre-wrap",
  lineHeight: 2,
};

const reportTextStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  lineHeight: 2.1,
  fontSize: 13,
};

const sourceAnalysisStyle: React.CSSProperties = {
  marginBottom: 20,
  padding: 13,
  border: "1px solid rgba(52,211,153,.13)",
  borderRadius: 8,
  background: "rgba(8,31,20,.38)",
};

const sourceSnapshotPanelStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 13,
  border: "1px solid rgba(52,211,153,.15)",
  borderRadius: 8,
  background: "rgba(8,31,20,.40)",
};

const sourceHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 11,
};

const sourceEyebrowStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 4,
  color: "#6ee7b7",
  fontSize: 9,
  fontWeight: 700,
};

const sourceTitleStyle: React.CSSProperties = {
  marginTop: 4,
  fontWeight: 800,
};

const sourceIdStyle: React.CSSProperties = {
  maxWidth: 220,
  padding: "4px 7px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  direction: "ltr",
  textAlign: "left",
  border: "1px solid rgba(148,163,184,.14)",
  borderRadius: 999,
  color: "#94a3b8",
  background: "rgba(15,23,42,.20)",
  fontSize: 8,
};

const analysisSnapshotGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
  gap: 7,
};

const analysisSnapshotItemStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "8px 9px",
  border: "1px solid rgba(148,163,184,.09)",
  borderRadius: 6,
  background: "rgba(3,13,9,.42)",
};

const analysisSnapshotLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 3,
  color: "#64748b",
  fontSize: 8,
};

const analysisSnapshotValueStyle: React.CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  color: "#dbe7e0",
  fontSize: 9,
  lineHeight: 1.6,
};

const evidencePanelStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 13,
  border: "1px solid rgba(52,211,153,.12)",
  borderRadius: 8,
  background: "rgba(5,19,13,.48)",
};

const evidencePanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 10,
};

const evidenceCountBadgeStyle: React.CSSProperties = {
  padding: "4px 8px",
  border: "1px solid rgba(52,211,153,.18)",
  borderRadius: 999,
  color: "#a7f3d0",
  background: "rgba(52,211,153,.05)",
  fontSize: 9,
};

const snapshotTimeStyle: React.CSSProperties = {
  marginBottom: 9,
  color: "#94a3b8",
  fontSize: 9,
};

const evidenceListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const archiveCardStyle: React.CSSProperties = {
  padding: 11,
  border: "1px solid rgba(148,163,184,.13)",
  borderRadius: 8,
  background: "rgba(2,10,7,.54)",
};

const archiveCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 8,
};

const archiveTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  color: "#f8fafc",
  lineHeight: 1.7,
};

const archiveMetaLineStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 9,
};

const archiveRegisteredBadgeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "4px 7px",
  border: "1px solid rgba(52,211,153,.19)",
  borderRadius: 999,
  color: "#86efac",
  background: "rgba(52,211,153,.045)",
  fontSize: 8,
};

const archiveImageWrapStyle: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  marginBottom: 9,
  border: "1px solid rgba(148,163,184,.11)",
  borderRadius: 7,
  background: "#000",
};

const archiveImageStyle: React.CSSProperties = {
  width: "100%",
  maxHeight: 310,
  display: "block",
  objectFit: "contain",
  background: "#000",
};

const archiveImageBadgeStyle: React.CSSProperties = {
  position: "absolute",
  right: 7,
  bottom: 7,
  padding: "4px 7px",
  border: "1px solid rgba(52,211,153,.22)",
  borderRadius: 999,
  color: "#d1fae5",
  background: "rgba(4,22,14,.88)",
  fontSize: 8,
};

const archiveNoImageStyle: React.CSSProperties = {
  marginBottom: 9,
  padding: "9px 10px",
  border: "1px dashed rgba(148,163,184,.18)",
  borderRadius: 6,
  color: "#94a3b8",
  background: "rgba(15,23,42,.14)",
  fontSize: 9,
  lineHeight: 1.8,
};

const legacyNoticeStyle: React.CSSProperties = {
  marginTop: 9,
  padding: "8px 9px",
  border: "1px dashed rgba(148,163,184,.16)",
  borderRadius: 6,
  color: "#94a3b8",
  background: "rgba(15,23,42,.16)",
  fontSize: 9,
  lineHeight: 1.8,
};

const archiveSummaryStyle: React.CSSProperties = {
  marginBottom: 9,
  color: "#cbd5e1",
  fontSize: 10,
  lineHeight: 1.85,
};

const archiveMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
  gap: 6,
};

const archiveMetaItemStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "7px 8px",
  border: "1px solid rgba(148,163,184,.08)",
  borderRadius: 6,
  background: "rgba(15,23,42,.14)",
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
  border: "1px solid rgba(148,163,184,.08)",
  borderRadius: 6,
  color: "#94a3b8",
  background: "rgba(15,23,42,.14)",
  fontSize: 9,
  lineHeight: 1.75,
};

const archiveActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 8,
};

const sourceLinkStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 7,
  color: "#86efac",
  fontSize: 10,
  textDecoration: "none",
};

const streamLinkStyle: React.CSSProperties = {
  ...sourceLinkStyle,
  color: "#cbd5e1",
};

const mutedStyle: React.CSSProperties = {
  color: "rgba(220,238,229,.48)",
};
