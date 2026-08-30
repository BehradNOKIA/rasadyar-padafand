/*
 * Rasadyar P3-Step8 — Case Readiness Dashboard
 *
 * This module consolidates the P3 analytical controls into one final
 * pre-review readiness assessment.
 *
 * Important:
 * - Readiness measures workflow/analysis preparedness, not truth.
 * - Machine Draft is optional. If present, it must be fresh and Human Review
 *   must be completed before the Case is considered ready.
 * - Conflict/consistency findings are advisory, but unresolved HIGH findings
 *   are treated as blockers for final review readiness.
 */

import {
  type RasadyarAnalysisQualityAssessment,
  type RasadyarCaseReadinessAssessment,
  type RasadyarCaseReadinessCheck,
  type RasadyarCaseReadinessCheckKey,
  type RasadyarEvidenceRelationshipRegister,
  type RasadyarEvidenceTraceabilityRecord,
  type RasadyarHumanReviewRecord,
  type RasadyarMachineAnalysisDraft,
  type RasadyarStructuredAssessment,
} from "../../core/rasadyar-data";

import {
  calculateTraceabilityCoverage,
} from "./evidenceTraceability";

import {
  evidenceRelationshipSummary,
  isEvidenceRelationshipScanStale,
} from "./evidenceRelationship";

import {
  isMachineDraftStale,
} from "./humanReview";


export interface ReadinessEvidenceInput {
  id:
    string;

  source?:
    string;

  archive?: {
    archiveId?:
      string;

    channelName?:
      string;
  };
}


export interface CalculateCaseReadinessInput {
  evidence:
    ReadinessEvidenceInput[];

  structuredAssessment:
    RasadyarStructuredAssessment;

  qualityAssessment:
    RasadyarAnalysisQualityAssessment;

  machineDraft?:
    RasadyarMachineAnalysisDraft;

  humanReview?:
    RasadyarHumanReviewRecord;

  evidenceTraceability?:
    RasadyarEvidenceTraceabilityRecord;

  evidenceRelationshipRegister?:
    RasadyarEvidenceRelationshipRegister;

  revisionNumber?:
    number;

  auditEventCount?:
    number;
}


function clamp(
  value:
    number
): number {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        value
      )
    )
  );
}


function check(
  key:
    RasadyarCaseReadinessCheckKey,
  label:
    string,
  score:
    number,
  weight:
    number,
  status:
    RasadyarCaseReadinessCheck["status"],
  blocking:
    boolean,
  detail:
    string
): RasadyarCaseReadinessCheck {
  return {
    key,
    label,
    score:
      clamp(
        score
      ),
    weight,
    status,
    blocking,
    detail,
  };
}


function qualityDimensionScore(
  quality:
    RasadyarAnalysisQualityAssessment,
  key:
    string
): number {
  return (
    quality.dimensions.find(
      (
        item
      ) =>
        item.key ===
        key
    )?.score ??
    0
  );
}


function uniqueSources(
  evidence:
    ReadinessEvidenceInput[]
): number {
  const values =
    evidence
      .map(
        (
          item
        ) =>
          (
            item.archive?.channelName ||
            item.source ||
            ""
          )
            .trim()
            .toLowerCase()
      )
      .filter(
        Boolean
      );

  return new Set(
    values
  ).size;
}


function weightedScore(
  checks:
    RasadyarCaseReadinessCheck[]
): number {
  const applicable =
    checks.filter(
      (
        item
      ) =>
        item.status !==
          "not-applicable" &&
        item.weight >
          0
    );

  const totalWeight =
    applicable.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.weight,
      0
    );

  if (
    totalWeight ===
    0
  ) {
    return 0;
  }

  return clamp(
    applicable.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.score *
          item.weight,
      0
    ) /
      totalWeight
  );
}


export function caseReadinessStatusLabel(
  status:
    RasadyarCaseReadinessAssessment["status"]
): string {
  if (
    status ===
    "ready"
  ) {
    return "آماده بررسی نهایی";
  }

  if (
    status ===
    "needs-attention"
  ) {
    return "نیازمند تکمیل";
  }

  return "آماده نیست";
}


export function caseReadinessCheckStatusLabel(
  status:
    RasadyarCaseReadinessCheck["status"]
): string {
  if (
    status ===
    "pass"
  ) {
    return "مناسب";
  }

  if (
    status ===
    "warning"
  ) {
    return "نیازمند توجه";
  }

  if (
    status ===
    "block"
  ) {
    return "مانع";
  }

  return "غیرقابل اعمال";
}


export function calculateCaseReadiness(
  input:
    CalculateCaseReadinessInput
): RasadyarCaseReadinessAssessment {
  const evidence =
    Array.isArray(
      input.evidence
    )
      ? input.evidence
      : [];

  const evidenceCount =
    evidence.length;

  const sourceCount =
    uniqueSources(
      evidence
    );

  const archiveCoverage =
    qualityDimensionScore(
      input.qualityAssessment,
      "archiveCoverage"
    );

  const structuredCompleteness =
    qualityDimensionScore(
      input.qualityAssessment,
      "analyticalCompleteness"
    );

  const qualityScore =
    input.qualityAssessment
      .overallScore;

  const traceability =
    calculateTraceabilityCoverage(
      input.evidenceTraceability
    );

  const machineDraftStale =
    isMachineDraftStale(
      input.machineDraft,
      evidence.map(
        (
          item
        ) =>
          item.id
      )
    );

  const relationshipScanStale =
    isEvidenceRelationshipScanStale(
      input.evidenceRelationshipRegister,
      evidence.map(
        (
          item
        ) =>
          item.id
      )
    );

  const relationshipSummary =
    evidenceRelationshipSummary(
      input.evidenceRelationshipRegister
    );

  const highUnresolved =
    (
      input.evidenceRelationshipRegister
        ?.findings ||
      []
    ).filter(
      (
        finding
      ) =>
        finding.severity ===
          "high" &&
        finding.reviewStatus !==
          "resolved" &&
        finding.reviewStatus !==
          "dismissed"
    ).length;

  const mediumOpen =
    (
      input.evidenceRelationshipRegister
        ?.findings ||
      []
    ).filter(
      (
        finding
      ) =>
        finding.severity ===
          "medium" &&
        (
          finding.reviewStatus ===
            "unreviewed" ||
          finding.reviewStatus ===
            "needs-review"
        )
    ).length;

  const informationGapsPresent =
    Boolean(
      input.structuredAssessment
        .informationGaps
        .trim()
    );

  const checks:
    RasadyarCaseReadinessCheck[] =
      [];

  checks.push(
    check(
      "evidenceSufficiency",
      "کفایت شواهد",
      evidenceCount >=
        3
        ? 100
        : evidenceCount ===
            2
          ? 85
          : evidenceCount ===
              1
            ? 65
            : 0,
      12,
      evidenceCount >=
        2
        ? "pass"
        : evidenceCount ===
            1
          ? "warning"
          : "block",
      evidenceCount ===
        0,
      evidenceCount >=
        2
        ? `${evidenceCount} شاهد در پرونده وجود دارد.`
        : evidenceCount ===
            1
          ? "پرونده با یک شاهد نیز می‌تواند برای بررسی نهایی ادامه یابد؛ افزودن شاهد دوم برای تأیید متقاطع توصیه می‌شود اما الزامی نیست."
          : "برای شروع ارزیابی نهایی، حداقل یک شاهد لازم است."
    )
  );

  checks.push(
    check(
      "sourceDiversity",
      "تنوع منابع",
      sourceCount >=
        3
        ? 100
        : sourceCount ===
            2
          ? 80
          : sourceCount ===
              1
            ? 40
            : 0,
      8,
      sourceCount >=
        2
        ? "pass"
        : "warning",
      false,
      sourceCount >=
        2
        ? `${sourceCount} منبع متمایز شناسایی شده است.`
        : "تنوع منبع محدود است و تأیید متقاطع ضعیف‌تر خواهد بود."
    )
  );

  checks.push(
    check(
      "archiveCoverage",
      "پوشش آرشیوی",
      archiveCoverage,
      8,
      archiveCoverage >=
        70
        ? "pass"
        : archiveCoverage >=
            50
          ? "warning"
          : "warning",
      false,
      `پوشش آرشیوی فعلی ${archiveCoverage}% است.`
    )
  );

  checks.push(
    check(
      "structuredCompleteness",
      "کامل‌بودن تحلیل ساختاریافته",
      structuredCompleteness,
      12,
      structuredCompleteness >=
        70
        ? "pass"
        : "block",
      structuredCompleteness <
        70,
      structuredCompleteness >=
        70
        ? `تکمیل ساختار تحلیلی ${structuredCompleteness}% است.`
        : `ساختار تحلیلی فقط ${structuredCompleteness}% تکمیل شده و برای بررسی نهایی کافی نیست.`
    )
  );

  if (
    input.machineDraft
  ) {
    checks.push(
      check(
        "machineDraftFreshness",
        "همگامی پیش‌نویس ماشینی",
        machineDraftStale
          ? 0
          : 100,
        8,
        machineDraftStale
          ? "block"
          : "pass",
        machineDraftStale,
        machineDraftStale
          ? "مجموعه شواهد بعد از تولید Machine Draft تغییر کرده است."
          : "Machine Draft با مجموعه فعلی شواهد همگام است."
      )
    );

    const reviewCompleted =
      input.humanReview
        ?.machineDraftId ===
        input.machineDraft
          .draftId &&
      input.humanReview
        ?.status ===
        "completed";

    checks.push(
      check(
        "humanReview",
        "بازبینی انسانی خروجی ماشین",
        reviewCompleted
          ? 100
          : 0,
        10,
        reviewCompleted
          ? "pass"
          : "block",
        !reviewCompleted,
        reviewCompleted
          ? "Human Review برای Machine Draft فعلی تکمیل شده است."
          : "Machine Draft وجود دارد اما Human Review معتبر و تکمیل‌شده ثبت نشده است."
      )
    );
  } else {
    checks.push(
      check(
        "machineDraftFreshness",
        "همگامی پیش‌نویس ماشینی",
        100,
        0,
        "not-applicable",
        false,
        "پرونده بدون Machine Draft نیز می‌تواند با تحلیل انسانی ادامه یابد."
      )
    );

    checks.push(
      check(
        "humanReview",
        "بازبینی انسانی خروجی ماشین",
        100,
        0,
        "not-applicable",
        false,
        "Machine Draft وجود ندارد؛ Human Review الزامی نیست."
      )
    );
  }

  checks.push(
    check(
      "traceability",
      "ردیابی استناد شواهد",
      traceability.percent,
      10,
      traceability.percent >=
        50
        ? "pass"
        : "block",
      traceability.percent <
        50,
      `${traceability.linkedSections} از ${traceability.totalSections} بخش تحلیلی به حداقل یک شاهد متصل شده‌اند.`
    )
  );

  if (
    evidenceCount >=
      2
  ) {
    if (
      !input.evidenceRelationshipRegister
    ) {
      checks.push(
        check(
          "conflictReview",
          "بازبینی تعارض و استقلال شواهد",
          55,
          10,
          "warning",
          false,
          "اسکن رابطه میان شواهد هنوز اجرا نشده است."
        )
      );
    } else if (
      relationshipScanStale
    ) {
      checks.push(
        check(
          "conflictReview",
          "بازبینی تعارض و استقلال شواهد",
          20,
          10,
          "block",
          true,
          "مجموعه شواهد بعد از آخرین اسکن تغییر کرده و اسکن فعلی قدیمی است."
        )
      );
    } else if (
      highUnresolved >
      0
    ) {
      checks.push(
        check(
          "conflictReview",
          "بازبینی تعارض و استقلال شواهد",
          30,
          10,
          "block",
          true,
          `${highUnresolved} یافته با شدت زیاد هنوز حل یا رد نشده است.`
        )
      );
    } else if (
      mediumOpen >
        0 ||
      relationshipSummary.unreviewed >
        0 ||
      relationshipSummary.needsReview >
        0
    ) {
      checks.push(
        check(
          "conflictReview",
          "بازبینی تعارض و استقلال شواهد",
          70,
          10,
          "warning",
          false,
          "بخشی از یافته‌های تعارض/هم‌پوشانی هنوز نیازمند بازبینی تحلیلگر است."
        )
      );
    } else {
      checks.push(
        check(
          "conflictReview",
          "بازبینی تعارض و استقلال شواهد",
          100,
          10,
          "pass",
          false,
          "یافته بحرانی باز وجود ندارد و اسکن با مجموعه فعلی شواهد همگام است."
        )
      );
    }
  } else {
    checks.push(
      check(
        "conflictReview",
        "بازبینی تعارض و استقلال شواهد",
        100,
        0,
        "not-applicable",
        false,
        evidenceCount ===
          1
          ? "پرونده فقط یک شاهد دارد؛ مقایسه تعارض و استقلال میان شواهد قابل اعمال نیست و این موضوع مانع بررسی نهایی نمی‌شود."
          : "بدون شاهد، مقایسه رابطه میان شواهد قابل اعمال نیست."
      )
    );
  }

  checks.push(
    check(
      "qualityThreshold",
      "امتیاز کیفیت تحلیل",
      qualityScore,
      12,
      qualityScore >=
        70
        ? "pass"
        : qualityScore >=
            50
          ? "warning"
          : "block",
      qualityScore <
        50,
      `Analysis Quality Score برابر ${qualityScore}/100 است.`
    )
  );

  checks.push(
    check(
      "informationGaps",
      "ثبت شکاف‌های اطلاعاتی",
      informationGapsPresent
        ? 100
        : 45,
      5,
      informationGapsPresent
        ? "pass"
        : "warning",
      false,
      informationGapsPresent
        ? "شکاف‌های اطلاعاتی به‌صورت صریح در تحلیل ثبت شده‌اند."
        : "بخش شکاف‌های اطلاعاتی خالی است؛ عدم وجود شکاف نیز بهتر است صریح ثبت شود."
    )
  );

  const revisionReady =
    (
      input.revisionNumber ||
      0
    ) >=
      1 &&
    (
      input.auditEventCount ||
      0
    ) >=
      1;

  checks.push(
    check(
      "revisionAudit",
      "نسخه‌بندی و Audit Trail",
      revisionReady
        ? 100
        : 55,
      5,
      revisionReady
        ? "pass"
        : "warning",
      false,
      revisionReady
        ? `نسخه ${input.revisionNumber} و ${input.auditEventCount} رخداد ممیزی ثبت شده است.`
        : "پس از ذخیره پرونده، Revision و Audit Trail کامل‌تر خواهد شد."
    )
  );

  const score =
    weightedScore(
      checks
    );

  const blockers =
    checks
      .filter(
        (
          item
        ) =>
          item.blocking ||
          item.status ===
            "block"
      )
      .map(
        (
          item
        ) =>
          `${item.label}: ${item.detail}`
      );

  const warnings =
    checks
      .filter(
        (
          item
        ) =>
          item.status ===
          "warning"
      )
      .map(
        (
          item
        ) =>
          `${item.label}: ${item.detail}`
      );

  const strengths =
    checks
      .filter(
        (
          item
        ) =>
          item.status ===
            "pass" &&
          item.score >=
            80
      )
      .map(
        (
          item
        ) =>
          `${item.label}: ${item.score}/100`
      );

  const readyForFinalReview =
    blockers.length ===
      0 &&
    score >=
      80;

  const status:
    RasadyarCaseReadinessAssessment["status"] =
      readyForFinalReview
        ? "ready"
        : blockers.length >
            0
          ? "not-ready"
          : "needs-attention";

  return {
    version:
      "rasadyar-case-readiness-v1",

    calculatedAt:
      new Date().toISOString(),

    score,

    status,

    readyForFinalReview,

    blockers,

    warnings,

    strengths:
      strengths.slice(
        0,
        8
      ),

    checks,
  };
}
