/*
 * Rasadyar P3 — Structured Analysis helpers
 *
 * This module keeps the operational Analysis form compatible with older
 * Cases while providing one complete, AI-ready analytical structure.
 */

import {
  type RasadyarStructuredAssessment,
} from "../../core/rasadyar-data";


export interface StructuredAssessmentContext {
  findings:
    string;

  confidence:
    string;

  likelyScenario:
    string;

  worstScenario:
    string;

  bestScenario:
    string;
}


export function createEmptyStructuredAssessment():
  RasadyarStructuredAssessment {
  return {
    situationSummary:
      "",

    keyPoints:
      "",

    actorsFactors:
      "",

    drivers:
      "",

    warningIndicators:
      "",

    confidence:
      "متوسط",

    informationGaps:
      "",

    assumptions:
      "",

    implications:
      "",

    analyticalJudgment:
      "",

    scenarios: {
      likely: {
        narrative:
          "",

        indicators:
          "",
      },

      worst: {
        narrative:
          "",

        indicators:
          "",
      },

      best: {
        narrative:
          "",

        indicators:
          "",
      },
    },

    actions: {
      immediate:
        "",

      shortTerm:
        "",

      mediumTerm:
        "",

      monitoringRequirements:
        "",
    },
  };
}


function text(
  value:
    unknown
): string {
  return typeof value ===
    "string"
      ? value
      : "";
}


export function normalizeStructuredAssessment(
  value:
    unknown,
  context:
    StructuredAssessmentContext
): RasadyarStructuredAssessment {
  const source =
    value &&
    typeof value ===
      "object"
      ? value as Partial<RasadyarStructuredAssessment>
      : {};

  const scenarios =
    source.scenarios &&
    typeof source.scenarios ===
      "object"
      ? source.scenarios
      : undefined;

  const actions =
    source.actions &&
    typeof source.actions ===
      "object"
      ? source.actions
      : undefined;

  return {
    situationSummary:
      text(
        source.situationSummary
      ),

    /*
     * Key Points and Confidence are synchronized with the established
     * legacy Case fields to avoid two conflicting analyst inputs.
     */
    keyPoints:
      context.findings,

    actorsFactors:
      text(
        source.actorsFactors
      ),

    drivers:
      text(
        source.drivers
      ),

    warningIndicators:
      text(
        source.warningIndicators
      ),

    confidence:
      context.confidence ||
      "متوسط",

    informationGaps:
      text(
        source.informationGaps
      ),

    assumptions:
      text(
        source.assumptions
      ),

    implications:
      text(
        source.implications
      ),

    analyticalJudgment:
      text(
        source.analyticalJudgment
      ),

    scenarios: {
      likely: {
        narrative:
          context.likelyScenario,

        indicators:
          text(
            scenarios?.likely?.indicators
          ),
      },

      worst: {
        narrative:
          context.worstScenario,

        indicators:
          text(
            scenarios?.worst?.indicators
          ),
      },

      best: {
        narrative:
          context.bestScenario,

        indicators:
          text(
            scenarios?.best?.indicators
          ),
      },
    },

    actions: {
      immediate:
        text(
          actions?.immediate
        ),

      shortTerm:
        text(
          actions?.shortTerm
        ),

      mediumTerm:
        text(
          actions?.mediumTerm
        ),

      monitoringRequirements:
        text(
          actions?.monitoringRequirements
        ),
    },
  };
}


export function synchronizeStructuredAssessment(
  value:
    RasadyarStructuredAssessment,
  context:
    StructuredAssessmentContext
): RasadyarStructuredAssessment {
  return normalizeStructuredAssessment(
    value,
    context
  );
}


export function calculateStructuredCompleteness(
  assessment:
    RasadyarStructuredAssessment
): number {
  const values = [
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

  const meaningful =
    values.filter(
      (
        value
      ) =>
        typeof value ===
          "string" &&
        value.trim().length >
          0
    ).length;

  return Math.round(
    (
      meaningful /
      values.length
    ) *
      100
  );
}
