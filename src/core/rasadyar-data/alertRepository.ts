/*
 * Rasadyar Data Model — Alert Repository
 *
 * P2-Step5:
 * Standardize Strategic Alerts inside rasadyar_data_v1 and maintain:
 *
 *   Alert -> evidenceId -> caseIds[]
 *
 * The current StrategicRiskPanel remains operational.
 */

import {
  RASADYAR_SCHEMA_VERSION,
  type AlertPriority,
  type RasadyarAlert,
  type RasadyarAnalysisCase,
} from "./schema";

import {
  updateCanonicalStore,
} from "./storage";


export interface CanonicalAlertInput {
  id:
    string;

  title:
    string;

  summary:
    string;

  alertType:
    string;

  priority:
    AlertPriority;

  timestamp:
    string | Date;

  countries?:
    string[];

  lat?:
    number;

  lon?:
    number;

  source?:
    string;

  sourceUrl?:
    string;

  evidenceId?:
    string;
}


export interface CanonicalAlertSyncResult {
  ok:
    boolean;

  alertCount:
    number;

  linkedAlerts:
    number;

  error?:
    unknown;
}


function safeIso(
  value:
    string | Date,
  fallback:
    string
): string {
  const parsed =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return fallback;
  }

  return parsed.toISOString();
}


function normalizePriority(
  value:
    AlertPriority
): AlertPriority {
  if (
    value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
  ) {
    return value;
  }

  return "medium";
}


/**
 * Rebuild Alert -> Case relationships from normalized Case.evidenceIds[].
 *
 * This function is pure: it does not write storage by itself.
 */
export function reconcileCanonicalAlertCaseLinks(
  alerts:
    Record<
      string,
      RasadyarAlert
    >,
  cases:
    Record<
      string,
      RasadyarAnalysisCase
    >
): Record<
  string,
  RasadyarAlert
> {
  const casesByEvidenceId =
    new Map<
      string,
      string[]
    >();

  for (
    const analysisCase of
    Object.values(cases)
  ) {
    for (
      const evidenceId of
      analysisCase.evidenceIds
    ) {
      const current =
        casesByEvidenceId.get(
          evidenceId
        ) || [];

      if (
        !current.includes(
          analysisCase.id
        )
      ) {
        current.push(
          analysisCase.id
        );
      }

      casesByEvidenceId.set(
        evidenceId,
        current
      );
    }
  }

  const next:
    Record<
      string,
      RasadyarAlert
    > = {};

  for (
    const alert of
    Object.values(alerts)
  ) {
    const caseIds =
      alert.evidenceId
        ? (
            casesByEvidenceId.get(
              alert.evidenceId
            ) || []
          )
        : [];

    let status =
      alert.status;

    if (
      caseIds.length >
        0 &&
      (
        status === "new" ||
        status === "acknowledged" ||
        status === "in-review"
      )
    ) {
      status =
        "linked-to-case";
    }

    if (
      caseIds.length ===
        0 &&
      status ===
        "linked-to-case"
    ) {
      status =
        "new";
    }

    next[
      alert.id
    ] = {
      ...alert,

      caseIds,

      status,
    };
  }

  return next;
}


/**
 * Mirror the currently available StrategicRiskPanel alerts.
 *
 * Existing workflow metadata such as assignedTo / acknowledgedAt / closedAt
 * is preserved when the same alert appears again.
 */
export function syncCanonicalAlerts(
  items:
    CanonicalAlertInput[]
): CanonicalAlertSyncResult {
  try {
    let linkedAlerts =
      0;

    updateCanonicalStore(
      (
        current
      ) => {
        const canonicalAlerts:
          Record<
            string,
            RasadyarAlert
          > = {};

        const now =
          new Date().toISOString();

        for (
          const item of
          items
        ) {
          const previous =
            current.alerts[
              item.id
            ];

          const evidenceId =
            item.evidenceId ||
            previous?.evidenceId ||
            `alert-evidence-${item.id}`;

          canonicalAlerts[
            item.id
          ] = {
            schemaVersion:
              RASADYAR_SCHEMA_VERSION,

            id:
              item.id,

            title:
              item.title,

            summary:
              item.summary,

            alertType:
              item.alertType,

            priority:
              normalizePriority(
                item.priority
              ),

            status:
              previous?.status ||
              "new",

            timestamp:
              safeIso(
                item.timestamp,
                now
              ),

            countries:
              Array.isArray(
                item.countries
              )
                ? [
                    ...item.countries,
                  ]
                : [],

            lat:
              item.lat,

            lon:
              item.lon,

            source:
              item.source,

            sourceUrl:
              item.sourceUrl,

            evidenceId,

            caseIds:
              previous?.caseIds
                ? [
                    ...previous.caseIds,
                  ]
                : [],

            assignedTo:
              previous?.assignedTo,

            acknowledgedAt:
              previous?.acknowledgedAt,

            closedAt:
              previous?.closedAt,
          };
        }

        const reconciled =
          reconcileCanonicalAlertCaseLinks(
            canonicalAlerts,
            current.cases
          );

        linkedAlerts =
          Object.values(
            reconciled
          ).filter(
            (
              alert
            ) =>
              alert.caseIds.length >
              0
          ).length;

        return {
          ...current,

          alerts:
            reconciled,
        };
      }
    );

    return {
      ok:
        true,

      alertCount:
        items.length,

      linkedAlerts,
    };
  } catch (
    error
  ) {
    console.warn(
      "[RasadyarData] Canonical Alert sync failed; StrategicRiskPanel continues normally.",
      error
    );

    return {
      ok:
        false,

      alertCount:
        0,

      linkedAlerts:
        0,

      error,
    };
  }
}
