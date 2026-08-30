/*
 * Rasadyar Data Model — Analysis Case Repository
 *
 * P2-Step3:
 * Dual-write Analysis Cases into rasadyar_data_v1 while the existing
 * rasadyar_analyses workflow remains the operational source.
 *
 * Design rules:
 * - Legacy data is never deleted by this repository.
 * - Canonical write failure must never block the current UI.
 * - Case -> Evidence is stored as evidenceIds[].
 * - Evidence/Archive records are ensured before the Case relation is written.
 */

import {
  RASADYAR_SCHEMA_VERSION,
  type AnalysisCaseStatus,
  type RasadyarAnalysisCase,
  type RasadyarAnalysisQualityAssessment,
  type RasadyarCaseReadinessAssessment,
  type RasadyarAnalysisRevision,
  type RasadyarAuditEvent,
  type RasadyarEvidenceRelationshipRegister,
  type RasadyarEvidenceTraceabilityRecord,
  type RasadyarHumanReviewRecord,
  type RasadyarMachineAnalysisDraft,
  type RasadyarStructuredAssessment,
} from "./schema";

import {
  updateCanonicalStore,
} from "./storage";

import {
  upsertCanonicalEvidenceBundle,
  type CanonicalEvidenceInput,
} from "./evidenceRepository";

import {
  reconcileCanonicalAlertCaseLinks,
} from "./alertRepository";


export interface LegacyAnalysisCaseInput {
  id:
    string;

  title:
    string;

  analysisType:
    string;

  region:
    string;

  timeRange:
    string;

  domain:
    string;

  description:
    string;

  findings:
    string;

  probability:
    string;

  impact:
    string;

  confidence:
    string;

  likelyScenario:
    string;

  worstScenario:
    string;

  bestScenario:
    string;

  recommendations:
    string;

  structuredAssessment?:
    Partial<RasadyarStructuredAssessment>;

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

  evidence:
    CanonicalEvidenceInput[];

  status:
    "draft"
    | "review"
    | "completed";

  createdBy:
    string;

  createdByName:
    string;

  createdAt:
    string;

  updatedAt:
    string;
}


export interface CanonicalCaseSyncResult {
  ok:
    boolean;

  caseCount:
    number;

  evidenceLinked:
    number;

  evidenceWriteFailures:
    number;

  error?:
    unknown;
}


function normalizeStatus(
  value:
    LegacyAnalysisCaseInput["status"]
): AnalysisCaseStatus {
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


function valueText(
  value:
    unknown
): string {
  return typeof value ===
    "string"
      ? value
      : "";
}


function cloneReadinessAssessment(
  value:
    RasadyarCaseReadinessAssessment | undefined
): RasadyarCaseReadinessAssessment | undefined {
  if (
    !value ||
    typeof value !==
      "object" ||
    !value.version ||
    !Array.isArray(
      value.checks
    )
  ) {
    return undefined;
  }

  try {
    return JSON.parse(
      JSON.stringify(
        value
      )
    ) as RasadyarCaseReadinessAssessment;
  } catch {
    return undefined;
  }
}


function cloneRevisionHistory(
  value:
    RasadyarAnalysisRevision[] | undefined
): RasadyarAnalysisRevision[] | undefined {
  if (
    !Array.isArray(
      value
    )
  ) {
    return undefined;
  }

  try {
    return JSON.parse(
      JSON.stringify(
        value
      )
    ) as RasadyarAnalysisRevision[];
  } catch {
    return undefined;
  }
}


function cloneAuditTrail(
  value:
    RasadyarAuditEvent[] | undefined
): RasadyarAuditEvent[] | undefined {
  if (
    !Array.isArray(
      value
    )
  ) {
    return undefined;
  }

  try {
    return JSON.parse(
      JSON.stringify(
        value
      )
    ) as RasadyarAuditEvent[];
  } catch {
    return undefined;
  }
}


function cloneEvidenceRelationshipRegister(
  value:
    RasadyarEvidenceRelationshipRegister | undefined
): RasadyarEvidenceRelationshipRegister | undefined {
  if (
    !value ||
    typeof value !==
      "object" ||
    !value.registerId ||
    !value.version ||
    !Array.isArray(
      value.findings
    )
  ) {
    return undefined;
  }

  try {
    return JSON.parse(
      JSON.stringify(
        value
      )
    ) as RasadyarEvidenceRelationshipRegister;
  } catch {
    return undefined;
  }
}


function cloneEvidenceTraceability(
  value:
    RasadyarEvidenceTraceabilityRecord | undefined
): RasadyarEvidenceTraceabilityRecord | undefined {
  if (
    !value ||
    typeof value !==
      "object" ||
    !value.traceabilityId ||
    !value.version
  ) {
    return undefined;
  }

  try {
    return JSON.parse(
      JSON.stringify(
        value
      )
    ) as RasadyarEvidenceTraceabilityRecord;
  } catch {
    return undefined;
  }
}


function cloneQualityAssessment(
  value:
    RasadyarAnalysisQualityAssessment | undefined
): RasadyarAnalysisQualityAssessment | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    !value.version ||
    !value.calculatedAt ||
    !Array.isArray(value.dimensions)
  ) {
    return undefined;
  }

  try {
    return JSON.parse(
      JSON.stringify(value)
    ) as RasadyarAnalysisQualityAssessment;
  } catch {
    return undefined;
  }
}


function cloneHumanReview(
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

  try {
    return JSON.parse(
      JSON.stringify(
        value
      )
    ) as RasadyarHumanReviewRecord;
  } catch {
    return undefined;
  }
}


function cloneMachineDraft(
  value:
    RasadyarMachineAnalysisDraft | undefined
): RasadyarMachineAnalysisDraft | undefined {
  if (
    !value ||
    typeof value !==
      "object" ||
    !value.draftId ||
    !value.generatedAt ||
    !value.assessment
  ) {
    return undefined;
  }

  try {
    return JSON.parse(
      JSON.stringify(
        value
      )
    ) as RasadyarMachineAnalysisDraft;
  } catch {
    return undefined;
  }
}


function normalizeStructuredAssessment(
  item:
    LegacyAnalysisCaseInput
): RasadyarStructuredAssessment {
  const source =
    item.structuredAssessment &&
    typeof item.structuredAssessment ===
      "object"
      ? item.structuredAssessment
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
      valueText(
        source.situationSummary
      ),

    keyPoints:
      item.findings,

    actorsFactors:
      valueText(
        source.actorsFactors
      ),

    drivers:
      valueText(
        source.drivers
      ),

    warningIndicators:
      valueText(
        source.warningIndicators
      ),

    confidence:
      item.confidence,

    informationGaps:
      valueText(
        source.informationGaps
      ),

    assumptions:
      valueText(
        source.assumptions
      ),

    implications:
      valueText(
        source.implications
      ),

    analyticalJudgment:
      valueText(
        source.analyticalJudgment
      ),

    scenarios: {
      likely: {
        narrative:
          item.likelyScenario,

        indicators:
          valueText(
            scenarios?.likely?.indicators
          ),
      },

      worst: {
        narrative:
          item.worstScenario,

        indicators:
          valueText(
            scenarios?.worst?.indicators
          ),
      },

      best: {
        narrative:
          item.bestScenario,

        indicators:
          valueText(
            scenarios?.best?.indicators
          ),
      },
    },

    actions: {
      immediate:
        valueText(
          actions?.immediate
        ),

      shortTerm:
        valueText(
          actions?.shortTerm
        ),

      mediumTerm:
        valueText(
          actions?.mediumTerm
        ),

      monitoringRequirements:
        valueText(
          actions?.monitoringRequirements
        ),
    },
  };
}


/**
 * Mirrors the current Analysis Case array into the canonical Case collection.
 *
 * Important:
 * - Only `cases` is replaced to match the active legacy Analysis list.
 * - Evidence and Archive collections are retained for traceability.
 * - Deleting a Case removes the canonical Case relation but intentionally
 *   does not destroy its historical Evidence/Archive records.
 */
export function syncCanonicalAnalysisCases(
  items:
    LegacyAnalysisCaseInput[]
): CanonicalCaseSyncResult {
  try {
    const canonicalCases:
      Record<
        string,
        RasadyarAnalysisCase
      > = {};

    let evidenceLinked =
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

      const evidenceIds:
        string[] = [];

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
        if (
          !evidence?.id
        ) {
          evidenceWriteFailures +=
            1;

          continue;
        }

        const writeResult =
          upsertCanonicalEvidenceBundle(
            evidence,
            {
              createdBy:
                item.createdBy,
            }
          );

        if (
          writeResult.ok
        ) {
          evidenceIds.push(
            evidence.id
          );

          evidenceLinked +=
            1;
        } else {
          evidenceWriteFailures +=
            1;

          console.warn(
            "[RasadyarData] Evidence could not be linked to canonical Case.",
            {
              caseId:
                item.id,

              evidenceId:
                evidence.id,

              error:
                writeResult.error,
            }
          );
        }
      }

      canonicalCases[
        item.id
      ] = {
        schemaVersion:
          RASADYAR_SCHEMA_VERSION,

        id:
          item.id,

        title:
          item.title,

        analysisType:
          item.analysisType,

        region:
          item.region,

        timeRange:
          item.timeRange,

        domain:
          item.domain,

        description:
          item.description,

        findings:
          item.findings,

        probability:
          item.probability,

        impact:
          item.impact,

        confidence:
          item.confidence,

        likelyScenario:
          item.likelyScenario,

        worstScenario:
          item.worstScenario,

        bestScenario:
          item.bestScenario,

        recommendations:
          item.recommendations,

        structuredAssessment:
          normalizeStructuredAssessment(
            item
          ),

        machineDraft:
          cloneMachineDraft(
            item.machineDraft
          ),

        humanReview:
          cloneHumanReview(
            item.humanReview,
            item.machineDraft?.draftId
          ),

        qualityAssessment:
          cloneQualityAssessment(
            item.qualityAssessment
          ),

        evidenceTraceability:
          cloneEvidenceTraceability(
            item.evidenceTraceability
          ),

        evidenceRelationshipRegister:
          cloneEvidenceRelationshipRegister(
            item.evidenceRelationshipRegister
          ),

        readinessAssessment:
          cloneReadinessAssessment(
            item.readinessAssessment
          ),

        revisionNumber:
          item.revisionNumber,

        revisionHistory:
          cloneRevisionHistory(
            item.revisionHistory
          ),

        auditTrail:
          cloneAuditTrail(
            item.auditTrail
          ),

        evidenceIds,

        status:
          normalizeStatus(
            item.status
          ),

        createdBy:
          item.createdBy,

        createdByName:
          item.createdByName,

        createdAt,

        updatedAt,

        completedAt:
          item.status ===
            "completed"
            ? updatedAt
            : undefined,
      };
    }

    updateCanonicalStore(
      (
        current
      ) => ({
        ...current,

        cases:
          canonicalCases,

        /*
         * P2-Step5:
         * whenever Case -> evidenceIds[] changes, rebuild Alert -> caseIds[].
         */
        alerts:
          reconcileCanonicalAlertCaseLinks(
            current.alerts,
            canonicalCases
          ),
      })
    );

    return {
      ok:
        true,

      caseCount:
        Object.keys(
          canonicalCases
        ).length,

      evidenceLinked,

      evidenceWriteFailures,
    };
  } catch (
    error
  ) {
    console.warn(
      "[RasadyarData] Canonical Case dual-write failed; legacy Analysis workflow continues.",
      error
    );

    return {
      ok:
        false,

      caseCount:
        0,

      evidenceLinked:
        0,

      evidenceWriteFailures:
        0,

      error,
    };
  }
}
