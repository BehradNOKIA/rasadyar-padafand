/*
 * Rasadyar P3-Step4 — Analysis Quality & Confidence Assessment
 *
 * This module evaluates the QUALITY OF THE ANALYTICAL PROCESS — not the
 * truth of the underlying real-world event.
 *
 * Important:
 * - No external API is called.
 * - Machine–Analyst Agreement is displayed as an informational metric and
 *   deliberately has zero weight in the overall quality score.
 * - Evidence Consistency is only a metadata-based corroboration proxy; it is
 *   NOT content-level fact verification.
 */

import {
  type RasadyarAnalysisQualityAssessment,
  type RasadyarAnalysisQualityDimension,
  type RasadyarEvidenceTraceabilityRecord,
  type RasadyarHumanReviewRecord,
  type RasadyarMachineAnalysisDraft,
  type RasadyarStructuredAssessment,
} from "../../core/rasadyar-data";

import {
  HUMAN_REVIEW_SECTIONS,
  calculateHumanReviewProgress,
  isMachineDraftStale,
} from "./humanReview";

import {
  calculateTraceabilityCoverage,
} from "./evidenceTraceability";


export interface QualityEvidenceInput {
  id: string;
  kind?: string;
  title?: string;
  source?: string;
  url?: string;
  country?: string;
  region?: string;
  timestamp?: string;
  summary?: string;

  archive?: {
    archiveId?: string;
    archivedAt?: string;
    channelName?: string;
    originalUrl?: string;
  };
}


export interface CalculateAnalysisQualityInput {
  analystConfidence: string;
  structuredAssessment: RasadyarStructuredAssessment;
  evidence: QualityEvidenceInput[];
  machineDraft?: RasadyarMachineAnalysisDraft;
  humanReview?: RasadyarHumanReviewRecord;
  evidenceTraceability?: RasadyarEvidenceTraceabilityRecord;
}


function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}


function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}


function unique(values: Array<string | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => cleanText(value))
        .filter(Boolean)
    ),
  ];
}


function safeTimestamp(value: string | undefined): number | null {
  if (!value) return null;

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : null;
}


function median(values: number[]): number {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }

  return sorted[middle]!;
}


function dimension(
  key: RasadyarAnalysisQualityDimension["key"],
  label: string,
  score: number,
  weight: number,
  applicable: boolean,
  detail: string
): RasadyarAnalysisQualityDimension {
  return {
    key,
    label,
    score: clamp(score),
    weight,
    applicable,
    detail,
  };
}


function calculateEvidenceQuality(
  evidence: QualityEvidenceInput[]
): RasadyarAnalysisQualityDimension {
  if (!evidence.length) {
    return dimension(
      "evidenceQuality",
      "کیفیت شواهد",
      0,
      18,
      true,
      "هیچ شاهدی به پرونده متصل نیست."
    );
  }

  const scores = evidence.map((item) => {
    let score = 0;

    if (cleanText(item.source) || cleanText(item.archive?.channelName)) {
      score += 25;
    }

    if (cleanText(item.summary)) {
      score += 25;
    }

    if (safeTimestamp(item.timestamp) !== null) {
      score += 15;
    }

    if (cleanText(item.archive?.archiveId)) {
      score += 25;
    }

    if (cleanText(item.country) || cleanText(item.region)) {
      score += 10;
    }

    return score;
  });

  const average =
    scores.reduce((sum, score) => sum + score, 0) / scores.length;

  return dimension(
    "evidenceQuality",
    "کیفیت شواهد",
    average,
    18,
    true,
    `میانگین کامل‌بودن فراداده ${evidence.length} شاهد؛ منبع، خلاصه، زمان، آرشیو و جغرافیا بررسی شده‌اند.`
  );
}


function calculateSourceDiversity(
  evidence: QualityEvidenceInput[]
): RasadyarAnalysisQualityDimension {
  if (!evidence.length) {
    return dimension(
      "sourceDiversity",
      "تنوع منابع",
      0,
      12,
      true,
      "بدون شاهد، تنوع منبع قابل ارزیابی نیست."
    );
  }

  const sources = unique(
    evidence.map((item) => item.archive?.channelName || item.source)
  );

  let score = 0;

  if (sources.length === 0) score = 10;
  else if (sources.length === 1) score = 35;
  else if (sources.length === 2) score = 65;
  else if (sources.length === 3) score = 80;
  else if (sources.length === 4) score = 90;
  else score = 100;

  if (evidence.length >= 4 && sources.length === 1) {
    score = 25;
  }

  return dimension(
    "sourceDiversity",
    "تنوع منابع",
    score,
    12,
    true,
    `${sources.length} منبع متمایز در ${evidence.length} شاهد شناسایی شد.`
  );
}


function freshnessScoreFromAgeDays(ageDays: number): number {
  if (ageDays <= 1) return 100;
  if (ageDays <= 7) return 90;
  if (ageDays <= 30) return 75;
  if (ageDays <= 90) return 55;
  if (ageDays <= 365) return 40;
  return 25;
}


function calculateFreshness(
  evidence: QualityEvidenceInput[],
  now: number
): RasadyarAnalysisQualityDimension {
  const ages = evidence
    .map((item) => safeTimestamp(item.timestamp))
    .filter((timestamp): timestamp is number => timestamp !== null)
    .map((timestamp) =>
      Math.max(0, (now - timestamp) / 86_400_000)
    );

  if (!ages.length) {
    return dimension(
      "freshness",
      "تازگی اطلاعات",
      20,
      10,
      true,
      "برای شواهد، زمان معتبر کافی ثبت نشده است."
    );
  }

  const medianAge = median(ages);

  return dimension(
    "freshness",
    "تازگی اطلاعات",
    freshnessScoreFromAgeDays(medianAge),
    10,
    true,
    `میانه عمر شواهد دارای زمان معتبر حدود ${medianAge.toFixed(1)} روز است.`
  );
}


function calculateArchiveCoverage(
  evidence: QualityEvidenceInput[]
): RasadyarAnalysisQualityDimension {
  if (!evidence.length) {
    return dimension(
      "archiveCoverage",
      "پوشش آرشیوی",
      0,
      10,
      true,
      "هیچ شاهدی برای ارزیابی پوشش آرشیوی وجود ندارد."
    );
  }

  const archived = evidence.filter((item) =>
    Boolean(cleanText(item.archive?.archiveId))
  ).length;

  return dimension(
    "archiveCoverage",
    "پوشش آرشیوی",
    (archived / evidence.length) * 100,
    10,
    true,
    `${archived} از ${evidence.length} شاهد دارای Archive ID هستند.`
  );
}


function calculateConsistencyProxy(
  evidence: QualityEvidenceInput[]
): RasadyarAnalysisQualityDimension {
  if (!evidence.length) {
    return dimension(
      "evidenceConsistency",
      "سازگاری / هم‌پوشانی شواهد",
      0,
      10,
      true,
      "هیچ شاهدی برای سنجش هم‌پوشانی وجود ندارد."
    );
  }

  if (evidence.length === 1) {
    return dimension(
      "evidenceConsistency",
      "سازگاری / هم‌پوشانی شواهد",
      35,
      10,
      true,
      "تنها یک شاهد وجود دارد؛ تأیید متقاطع ممکن نیست."
    );
  }

  const sources = unique(
    evidence.map((item) => item.archive?.channelName || item.source)
  );

  const locations = evidence
    .map((item) => cleanText(item.country) || cleanText(item.region))
    .filter(Boolean);

  const timestamps = evidence
    .map((item) => safeTimestamp(item.timestamp))
    .filter((timestamp): timestamp is number => timestamp !== null);

  let sourceScore = Math.min(60, sources.length * 20);

  if (sources.length >= 2) {
    sourceScore = Math.max(sourceScore, 45);
  }

  let geographyScore = 10;

  if (locations.length >= 2) {
    const counts = new Map<string, number>();

    for (const location of locations) {
      counts.set(location, (counts.get(location) || 0) + 1);
    }

    const maxCount = Math.max(...counts.values());
    geographyScore = (maxCount / locations.length) * 20;
  }

  let temporalScore = 10;

  if (timestamps.length >= 2) {
    const rangeDays =
      (Math.max(...timestamps) - Math.min(...timestamps)) /
      86_400_000;

    if (rangeDays <= 1) temporalScore = 20;
    else if (rangeDays <= 7) temporalScore = 17;
    else if (rangeDays <= 30) temporalScore = 13;
    else temporalScore = 8;
  }

  return dimension(
    "evidenceConsistency",
    "سازگاری / هم‌پوشانی شواهد",
    sourceScore + geographyScore + temporalScore,
    10,
    true,
    "این امتیاز فقط یک Proxy مبتنی بر تنوع منبع و هم‌پوشانی زمانی/جغرافیایی است و جای راستی‌آزمایی محتوایی را نمی‌گیرد."
  );
}


function calculateInformationGapHandling(
  assessment: RasadyarStructuredAssessment
): RasadyarAnalysisQualityDimension {
  let score = 0;

  if (cleanText(assessment.informationGaps)) score += 35;
  if (cleanText(assessment.assumptions)) score += 20;
  if (cleanText(assessment.warningIndicators)) score += 20;
  if (cleanText(assessment.actions.monitoringRequirements)) score += 25;

  return dimension(
    "informationGapHandling",
    "مدیریت شکاف‌های اطلاعاتی",
    score,
    10,
    true,
    "وجود شکاف‌های اطلاعاتی، فرضیات، شاخص‌های هشدار و الزامات پایش بررسی شده است."
  );
}


function structuredValues(
  assessment: RasadyarStructuredAssessment
): string[] {
  return [
    assessment.situationSummary,
    assessment.keyPoints,
    assessment.actorsFactors,
    assessment.drivers,
    assessment.warningIndicators,
    assessment.confidence,
    assessment.informationGaps,
    assessment.assumptions,
    assessment.implications,
    assessment.analyticalJudgment,
    assessment.scenarios.likely.narrative,
    assessment.scenarios.likely.indicators,
    assessment.scenarios.worst.narrative,
    assessment.scenarios.worst.indicators,
    assessment.scenarios.best.narrative,
    assessment.scenarios.best.indicators,
    assessment.actions.immediate,
    assessment.actions.shortTerm,
    assessment.actions.mediumTerm,
    assessment.actions.monitoringRequirements,
  ];
}


function calculateAnalyticalCompleteness(
  assessment: RasadyarStructuredAssessment
): RasadyarAnalysisQualityDimension {
  const values = structuredValues(assessment);
  const completed = values.filter((value) => cleanText(value)).length;

  return dimension(
    "analyticalCompleteness",
    "کامل‌بودن تحلیل ساختاریافته",
    (completed / values.length) * 100,
    12,
    true,
    `${completed} از ${values.length} مؤلفه ساختار تحلیلی تکمیل شده‌اند.`
  );
}


function calculateHumanReviewDimension(
  draft: RasadyarMachineAnalysisDraft | undefined,
  review: RasadyarHumanReviewRecord | undefined,
  stale: boolean
): RasadyarAnalysisQualityDimension {
  if (!draft) {
    return dimension(
      "humanReviewCompletion",
      "تکمیل بازبینی انسانی",
      100,
      10,
      false,
      "پرونده پیش‌نویس ماشینی ندارد؛ Human Review در این پرونده کاربرد ندارد."
    );
  }

  if (stale) {
    return dimension(
      "humanReviewCompletion",
      "تکمیل بازبینی انسانی",
      0,
      10,
      true,
      "پیش‌نویس ماشینی نسبت به مجموعه فعلی شواهد قدیمی شده و باید بازتولید شود."
    );
  }

  const validReview =
    review?.machineDraftId === draft.draftId
      ? review
      : undefined;

  const progress = calculateHumanReviewProgress(validReview);

  return dimension(
    "humanReviewCompletion",
    "تکمیل بازبینی انسانی",
    validReview?.status === "completed"
      ? 100
      : progress.percent,
    10,
    true,
    validReview
      ? `${progress.resolved} از ${HUMAN_REVIEW_SECTIONS.length} بخش تعیین‌تکلیف شده‌اند؛ وضعیت: ${validReview.status}.`
      : "برای پیش‌نویس ماشینی فعلی هنوز Human Review معتبر ثبت نشده است."
  );
}


function calculateAgreementDimension(
  draft: RasadyarMachineAnalysisDraft | undefined,
  review: RasadyarHumanReviewRecord | undefined
): {
  dimension: RasadyarAnalysisQualityDimension;
  agreementRate?: number;
} {
  if (!draft || !review || review.machineDraftId !== draft.draftId) {
    return {
      dimension: dimension(
        "machineAnalystAgreement",
        "توافق ماشین و تحلیلگر",
        0,
        0,
        false,
        "داده کافی برای محاسبه توافق ماشین و تحلیلگر وجود ندارد."
      ),
    };
  }

  const decisions = HUMAN_REVIEW_SECTIONS
    .map((item) => review.sections[item.key]?.decision)
    .filter(Boolean);

  if (!decisions.length) {
    return {
      dimension: dimension(
        "machineAnalystAgreement",
        "توافق ماشین و تحلیلگر",
        0,
        0,
        false,
        "هنوز هیچ تصمیم مقایسه‌ای ثبت نشده است."
      ),
    };
  }

  const accepted = decisions.filter((decision) => decision === "accepted").length;
  const edited = decisions.filter((decision) => decision === "edited").length;
  const rejected = decisions.filter((decision) => decision === "rejected").length;
  const needsReview = decisions.filter(
    (decision) => decision === "needs-review"
  ).length;

  const score =
    (
      accepted * 100 +
      edited * 65 +
      rejected * 0 +
      needsReview * 20
    ) / decisions.length;

  return {
    agreementRate: clamp(score),

    dimension: dimension(
      "machineAnalystAgreement",
      "توافق ماشین و تحلیلگر",
      score,
      0,
      true,
      `تأیید: ${accepted}، اصلاح: ${edited}، رد: ${rejected}، نیازمند بررسی: ${needsReview}. این شاخص در امتیاز کلی وزن ندارد.`
    ),
  };
}


function calculateTraceabilityDimension(
  traceability:
    RasadyarEvidenceTraceabilityRecord | undefined,
  evidenceCount:
    number
): RasadyarAnalysisQualityDimension {
  if (
    evidenceCount ===
    0
  ) {
    return dimension(
      "traceabilityCoverage",
      "پوشش استناد و ردیابی شواهد",
      0,
      10,
      true,
      "بدون شاهد، امکان ایجاد ماتریس استناد تحلیلی وجود ندارد."
    );
  }

  const coverage =
    calculateTraceabilityCoverage(
      traceability
    );

  return dimension(
    "traceabilityCoverage",
    "پوشش استناد و ردیابی شواهد",
    coverage.percent,
    10,
    true,
    `${coverage.linkedSections} از ${coverage.totalSections} بخش تحلیلی حداقل به یک شاهد متصل شده‌اند؛ مجموع ارجاعات ثبت‌شده: ${coverage.linkedEvidenceRefs}.`
  );
}


function evidenceStrength(
  dimensions: RasadyarAnalysisQualityDimension[]
): number {
  const keys = new Set([
    "evidenceQuality",
    "sourceDiversity",
    "freshness",
    "archiveCoverage",
    "evidenceConsistency",
  ]);

  const selected = dimensions.filter((item) => keys.has(item.key));

  const totalWeight = selected.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  if (!totalWeight) return 0;

  return clamp(
    selected.reduce(
      (sum, item) => sum + item.score * item.weight,
      0
    ) / totalWeight
  );
}


function suggestedConfidence(
  evidenceScore: number,
  evidenceCount: number,
  sourceCount: number
): string {
  if (
    evidenceScore >= 75 &&
    evidenceCount >= 3 &&
    sourceCount >= 2
  ) {
    return "زیاد";
  }

  if (evidenceScore >= 45 && evidenceCount >= 2) {
    return "متوسط";
  }

  return "کم";
}


function confidenceRank(value: string): number {
  if (value === "بسیار زیاد") return 4;
  if (value === "زیاد") return 3;
  if (value === "متوسط") return 2;
  return 1;
}


function calculateConfidenceCalibration(
  analystConfidence: string,
  suggested: string
): RasadyarAnalysisQualityDimension {
  const difference = Math.abs(
    confidenceRank(analystConfidence) -
    confidenceRank(suggested)
  );

  const score =
    difference === 0
      ? 100
      : difference === 1
        ? 65
        : 25;

  return dimension(
    "confidenceCalibration",
    "کالیبراسیون سطح اطمینان",
    score,
    8,
    true,
    `اطمینان ثبت‌شده تحلیلگر: «${analystConfidence || "نامشخص"}»؛ سطح پیشنهادی بر پایه قدرت شواهد: «${suggested}». این پیشنهاد جایگزین قضاوت تحلیلگر نیست.`
  );
}


function qualityLevel(
  score: number
): RasadyarAnalysisQualityAssessment["qualityLevel"] {
  if (score >= 85) return "strong";
  if (score >= 70) return "good";
  if (score >= 50) return "moderate";
  return "weak";
}


function weightedOverall(
  dimensions: RasadyarAnalysisQualityDimension[]
): number {
  const applicable = dimensions.filter(
    (item) => item.applicable && item.weight > 0
  );

  const totalWeight = applicable.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  if (!totalWeight) return 0;

  return clamp(
    applicable.reduce(
      (sum, item) => sum + item.score * item.weight,
      0
    ) / totalWeight
  );
}


export function qualityLevelLabel(
  level: RasadyarAnalysisQualityAssessment["qualityLevel"]
): string {
  if (level === "strong") return "قوی";
  if (level === "good") return "خوب";
  if (level === "moderate") return "متوسط";
  return "ضعیف";
}


export function reviewReadinessLabel(
  readiness: RasadyarAnalysisQualityAssessment["reviewReadiness"]
): string {
  if (readiness === "ready") return "مناسب برای بررسی نهایی";
  if (readiness === "needs-work") return "نیازمند تکمیل";
  return "ناکافی برای بررسی نهایی";
}


export function calculateAnalysisQuality(
  input: CalculateAnalysisQualityInput
): RasadyarAnalysisQualityAssessment {
  const now = Date.now();
  const evidence = Array.isArray(input.evidence)
    ? input.evidence
    : [];

  const stale = isMachineDraftStale(
    input.machineDraft,
    evidence.map((item) => item.id)
  );

  const evidenceQuality = calculateEvidenceQuality(evidence);
  const sourceDiversity = calculateSourceDiversity(evidence);
  const freshness = calculateFreshness(evidence, now);
  const archiveCoverage = calculateArchiveCoverage(evidence);
  const consistency = calculateConsistencyProxy(evidence);

  const informationGaps = calculateInformationGapHandling(
    input.structuredAssessment
  );

  const analyticalCompleteness = calculateAnalyticalCompleteness(
    input.structuredAssessment
  );

  const humanReview = calculateHumanReviewDimension(
    input.machineDraft,
    input.humanReview,
    stale
  );

  const agreement = calculateAgreementDimension(
    input.machineDraft,
    input.humanReview
  );

  const traceability = calculateTraceabilityDimension(
    input.evidenceTraceability,
    evidence.length
  );

  const preliminaryDimensions = [
    evidenceQuality,
    sourceDiversity,
    freshness,
    archiveCoverage,
    consistency,
    informationGaps,
    humanReview,
    agreement.dimension,
    analyticalCompleteness,
    traceability,
  ];

  const strength = evidenceStrength(preliminaryDimensions);

  const sources = unique(
    evidence.map((item) => item.archive?.channelName || item.source)
  );

  const suggested = suggestedConfidence(
    strength,
    evidence.length,
    sources.length
  );

  const confidenceCalibration = calculateConfidenceCalibration(
    input.analystConfidence,
    suggested
  );

  const dimensions = [
    ...preliminaryDimensions,
    confidenceCalibration,
  ];

  const overallScore = weightedOverall(dimensions);

  const strengths: string[] = [];
  const cautions: string[] = [];

  for (const item of dimensions) {
    if (!item.applicable) continue;

    if (item.score >= 80) {
      strengths.push(`${item.label}: ${item.score}/100`);
    }

    if (item.score < 50) {
      cautions.push(`${item.label}: ${item.score}/100`);
    }
  }

  if (stale) {
    cautions.push(
      "پیش‌نویس ماشینی با مجموعه فعلی شواهد همگام نیست."
    );
  }

  if (evidence.length < 2) {
    cautions.push(
      "برای تأیید متقاطع، تعداد شواهد کافی نیست."
    );
  }

  cautions.push(
    "امتیاز سازگاری شواهد یک شاخص فراداده‌ای است و راستی‌آزمایی محتوایی محسوب نمی‌شود."
  );

  const humanReviewRequired = Boolean(input.machineDraft);

  const humanReviewCompleted =
    !humanReviewRequired ||
    (
      input.humanReview?.machineDraftId ===
        input.machineDraft?.draftId &&
      input.humanReview?.status === "completed" &&
      !stale
    );

  const ready =
    overallScore >= 75 &&
    analyticalCompleteness.score >= 70 &&
    traceability.score >= 50 &&
    evidence.length >= 2 &&
    humanReviewCompleted;

  const insufficient =
    overallScore < 50 ||
    evidence.length === 0;

  const reviewReadiness:
    RasadyarAnalysisQualityAssessment["reviewReadiness"] =
      ready
        ? "ready"
        : insufficient
          ? "insufficient"
          : "needs-work";

  return {
    version: "rasadyar-analysis-quality-v1",
    calculatedAt: new Date(now).toISOString(),
    overallScore,
    qualityLevel: qualityLevel(overallScore),
    reviewReadiness,
    readyForReview: ready,
    evidenceStrengthScore: strength,
    suggestedEvidenceConfidence: suggested,
    analystConfidence: input.analystConfidence,
    machineDraftStale: stale,
    machineAnalystAgreementRate: agreement.agreementRate,
    traceabilityCoverageScore: traceability.score,
    dimensions,
    strengths: strengths.slice(0, 6),
    cautions: [...new Set(cautions)].slice(0, 8),
  };
}
