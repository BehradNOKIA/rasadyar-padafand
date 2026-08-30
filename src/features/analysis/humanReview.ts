/*
 * Rasadyar P3-Step3 — Human-in-the-loop review helpers
 *
 * A machine draft is never treated as the analyst's final judgment.
 * This module keeps one auditable review record tied to one exact draftId.
 */

import {
  type RasadyarHumanReviewDecision,
  type RasadyarHumanReviewRecord,
  type RasadyarHumanReviewSectionKey,
  type RasadyarMachineAnalysisDraft,
  type RasadyarStructuredAssessment,
} from "../../core/rasadyar-data";


export const HUMAN_REVIEW_SECTIONS: ReadonlyArray<{
  key:
    RasadyarHumanReviewSectionKey;

  label:
    string;
}> = [
  {
    key:
      "situationSummary",

    label:
      "خلاصه وضعیت",
  },

  {
    key:
      "keyPoints",

    label:
      "نکات / یافته‌های کلیدی",
  },

  {
    key:
      "actorsFactors",

    label:
      "بازیگران / عوامل مؤثر",
  },

  {
    key:
      "drivers",

    label:
      "محرک‌ها",
  },

  {
    key:
      "warningIndicators",

    label:
      "نشانه‌ها و شاخص‌های هشدار",
  },

  {
    key:
      "informationGaps",

    label:
      "شکاف‌های اطلاعاتی",
  },

  {
    key:
      "assumptions",

    label:
      "فرضیات تحلیل",
  },

  {
    key:
      "implications",

    label:
      "پیامدهای محتمل",
  },

  {
    key:
      "analyticalJudgment",

    label:
      "جمع‌بندی تحلیلی",
  },

  {
    key:
      "scenarios",

    label:
      "سناریوها",
  },

  {
    key:
      "actions",

    label:
      "پیشنهاد اقدام",
  },
] as const;


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


function safeText(
  value:
    unknown
): string {
  return typeof value ===
    "string"
      ? value
      : "";
}


function sectionBlock(
  title:
    string,
  value:
    string
): string {
  return `${title}\n${value || "—"}`;
}


export function createHumanReviewRecord(
  machineDraftId:
    string,
  reviewedBy:
    string,
  reviewedByName?:
    string
): RasadyarHumanReviewRecord {
  const now =
    new Date().toISOString();

  return {
    reviewId:
      createId(
        "human-review"
      ),

    machineDraftId,

    status:
      "in-progress",

    reviewedBy,

    reviewedByName:
      reviewedByName ||
      reviewedBy,

    createdAt:
      now,

    updatedAt:
      now,

    overallNote:
      "",

    sections:
      {},
  };
}


export function normalizeHumanReviewRecord(
  value:
    RasadyarHumanReviewRecord | undefined,
  machineDraftId:
    string | undefined
): RasadyarHumanReviewRecord | undefined {
  if (
    !value ||
    !machineDraftId ||
    value.machineDraftId !==
      machineDraftId
  ) {
    return undefined;
  }

  return value;
}


export function reviewDecisionLabel(
  decision:
    RasadyarHumanReviewDecision | undefined
): string {
  if (
    decision ===
    "accepted"
  ) {
    return "تأیید تحلیلگر";
  }

  if (
    decision ===
    "edited"
  ) {
    return "اصلاح‌شده توسط تحلیلگر";
  }

  if (
    decision ===
    "rejected"
  ) {
    return "رد تحلیل ماشینی";
  }

  if (
    decision ===
    "needs-review"
  ) {
    return "نیازمند بررسی بیشتر";
  }

  return "بدون تصمیم";
}


export function calculateHumanReviewProgress(
  review:
    RasadyarHumanReviewRecord | undefined
): {
  total:
    number;

  decided:
    number;

  resolved:
    number;

  unresolved:
    number;

  percent:
    number;
} {
  const total =
    HUMAN_REVIEW_SECTIONS.length;

  const decisions =
    HUMAN_REVIEW_SECTIONS.map(
      (
        item
      ) =>
        review?.sections[
          item.key
        ]?.decision
    );

  const decided =
    decisions.filter(
      Boolean
    ).length;

  const resolved =
    decisions.filter(
      (
        decision
      ) =>
        decision ===
          "accepted" ||
        decision ===
          "edited" ||
        decision ===
          "rejected"
    ).length;

  return {
    total,

    decided,

    resolved,

    unresolved:
      total -
      resolved,

    percent:
      Math.round(
        (
          resolved /
          total
        ) *
          100
      ),
  };
}


export function canCompleteHumanReview(
  review:
    RasadyarHumanReviewRecord | undefined
): boolean {
  const progress =
    calculateHumanReviewProgress(
      review
    );

  return (
    progress.resolved ===
    progress.total
  );
}


export function isMachineDraftStale(
  draft:
    RasadyarMachineAnalysisDraft | undefined,
  evidenceIds:
    string[]
): boolean {
  if (
    !draft
  ) {
    return false;
  }

  const draftIds =
    [
      ...draft.evidenceIds,
    ].sort();

  const currentIds =
    [
      ...new Set(
        evidenceIds
      ),
    ].sort();

  if (
    draftIds.length !==
    currentIds.length
  ) {
    return true;
  }

  return draftIds.some(
    (
      id,
      index
    ) =>
      id !==
      currentIds[
        index
      ]
  );
}


export function getMachineSectionValue(
  draft:
    RasadyarMachineAnalysisDraft,
  key:
    RasadyarHumanReviewSectionKey
): string {
  const assessment =
    draft.assessment;

  if (
    key ===
    "scenarios"
  ) {
    return [
      sectionBlock(
        "سناریوی محتمل",
        assessment.scenarios.likely.narrative
      ),

      sectionBlock(
        "شاخص‌های تحقق سناریوی محتمل",
        assessment.scenarios.likely.indicators
      ),

      sectionBlock(
        "سناریوی بدبینانه",
        assessment.scenarios.worst.narrative
      ),

      sectionBlock(
        "شاخص‌های تحقق سناریوی بدبینانه",
        assessment.scenarios.worst.indicators
      ),

      sectionBlock(
        "سناریوی خوش‌بینانه",
        assessment.scenarios.best.narrative
      ),

      sectionBlock(
        "شاخص‌های تحقق سناریوی خوش‌بینانه",
        assessment.scenarios.best.indicators
      ),
    ].join(
      "\n\n"
    );
  }

  if (
    key ===
    "actions"
  ) {
    return [
      sectionBlock(
        "اقدام فوری",
        assessment.actions.immediate
      ),

      sectionBlock(
        "اقدام کوتاه‌مدت",
        assessment.actions.shortTerm
      ),

      sectionBlock(
        "اقدام میان‌مدت",
        assessment.actions.mediumTerm
      ),

      sectionBlock(
        "الزامات پایش",
        assessment.actions.monitoringRequirements
      ),
    ].join(
      "\n\n"
    );
  }

  return safeText(
    assessment[
      key
    ]
  );
}


export function getAnalystSectionValue(
  assessment:
    RasadyarStructuredAssessment,
  key:
    RasadyarHumanReviewSectionKey
): string {
  if (
    key ===
    "scenarios"
  ) {
    return [
      sectionBlock(
        "سناریوی محتمل",
        assessment.scenarios.likely.narrative
      ),

      sectionBlock(
        "شاخص‌های تحقق سناریوی محتمل",
        assessment.scenarios.likely.indicators
      ),

      sectionBlock(
        "سناریوی بدبینانه",
        assessment.scenarios.worst.narrative
      ),

      sectionBlock(
        "شاخص‌های تحقق سناریوی بدبینانه",
        assessment.scenarios.worst.indicators
      ),

      sectionBlock(
        "سناریوی خوش‌بینانه",
        assessment.scenarios.best.narrative
      ),

      sectionBlock(
        "شاخص‌های تحقق سناریوی خوش‌بینانه",
        assessment.scenarios.best.indicators
      ),
    ].join(
      "\n\n"
    );
  }

  if (
    key ===
    "actions"
  ) {
    return [
      sectionBlock(
        "اقدام فوری",
        assessment.actions.immediate
      ),

      sectionBlock(
        "اقدام کوتاه‌مدت",
        assessment.actions.shortTerm
      ),

      sectionBlock(
        "اقدام میان‌مدت",
        assessment.actions.mediumTerm
      ),

      sectionBlock(
        "الزامات پایش",
        assessment.actions.monitoringRequirements
      ),
    ].join(
      "\n\n"
    );
  }

  return safeText(
    assessment[
      key
    ]
  );
}
