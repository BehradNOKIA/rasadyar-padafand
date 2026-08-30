/*
 * Rasadyar P3-Step5 — Evidence Traceability & Citation Matrix
 *
 * A citation link means:
 * "This Evidence informed this analytical section."
 *
 * It does NOT mean:
 * "This Evidence proves the claim" or "the source is independently verified."
 */

import {
  type RasadyarEvidenceTraceabilityRecord,
  type RasadyarHumanReviewSectionKey,
  type RasadyarMachineAnalysisDraft,
} from "../../core/rasadyar-data";

import {
  HUMAN_REVIEW_SECTIONS,
} from "./humanReview";


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


function unique(
  values:
    string[]
): string[] {
  return [
    ...new Set(
      values.filter(
        Boolean
      )
    ),
  ];
}


export function createEvidenceTraceabilityRecord(
  updatedBy:
    string,
  updatedByName?:
    string
): RasadyarEvidenceTraceabilityRecord {
  const now =
    new Date().toISOString();

  return {
    traceabilityId:
      createId(
        "traceability"
      ),

    version:
      "rasadyar-evidence-traceability-v1",

    createdAt:
      now,

    updatedAt:
      now,

    updatedBy,

    updatedByName:
      updatedByName ||
      updatedBy,

    sections:
      {},
  };
}


export function normalizeEvidenceTraceability(
  value:
    RasadyarEvidenceTraceabilityRecord | undefined,
  currentEvidenceIds:
    string[],
  updatedBy:
    string,
  updatedByName?:
    string
): RasadyarEvidenceTraceabilityRecord | undefined {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return undefined;
  }

  const validIds =
    new Set(
      currentEvidenceIds
    );

  const sections:
    RasadyarEvidenceTraceabilityRecord["sections"] =
      {};

  for (
    const section of
    HUMAN_REVIEW_SECTIONS
  ) {
    const existing =
      value.sections[
        section.key
      ];

    if (
      !existing
    ) {
      continue;
    }

    sections[
      section.key
    ] = {
      evidenceIds:
        unique(
          (
            existing.evidenceIds ||
            []
          ).filter(
            (
              id
            ) =>
              validIds.has(
                id
              )
          )
        ),

      note:
        existing.note ||
        "",

      updatedAt:
        existing.updatedAt ||
        value.updatedAt,

      updatedBy:
        existing.updatedBy ||
        value.updatedBy ||
        updatedBy,
    };
  }

  return {
    ...value,

    updatedBy:
      value.updatedBy ||
      updatedBy,

    updatedByName:
      value.updatedByName ||
      updatedByName ||
      updatedBy,

    sections,
  };
}


export function calculateTraceabilityCoverage(
  value:
    RasadyarEvidenceTraceabilityRecord | undefined
): {
  linkedSections:
    number;

  totalSections:
    number;

  linkedEvidenceRefs:
    number;

  percent:
    number;
} {
  const totalSections =
    HUMAN_REVIEW_SECTIONS.length;

  if (
    !value
  ) {
    return {
      linkedSections:
        0,

      totalSections,

      linkedEvidenceRefs:
        0,

      percent:
        0,
    };
  }

  let linkedSections =
    0;

  let linkedEvidenceRefs =
    0;

  for (
    const section of
    HUMAN_REVIEW_SECTIONS
  ) {
    const count =
      value.sections[
        section.key
      ]?.evidenceIds
        ?.length ||
      0;

    if (
      count >
      0
    ) {
      linkedSections +=
        1;
    }

    linkedEvidenceRefs +=
      count;
  }

  return {
    linkedSections,

    totalSections,

    linkedEvidenceRefs,

    percent:
      Math.round(
        (
          linkedSections /
          totalSections
        ) *
          100
      ),
  };
}


export function toggleEvidenceTraceabilityLink(
  value:
    RasadyarEvidenceTraceabilityRecord | undefined,
  sectionKey:
    RasadyarHumanReviewSectionKey,
  evidenceId:
    string,
  selected:
    boolean,
  currentEvidenceIds:
    string[],
  updatedBy:
    string,
  updatedByName?:
    string
): RasadyarEvidenceTraceabilityRecord {
  const base =
    normalizeEvidenceTraceability(
      value,
      currentEvidenceIds,
      updatedBy,
      updatedByName
    ) ||
    createEvidenceTraceabilityRecord(
      updatedBy,
      updatedByName
    );

  const now =
    new Date().toISOString();

  const existing =
    base.sections[
      sectionKey
    ];

  const ids =
    new Set(
      existing?.evidenceIds ||
      []
    );

  if (
    selected
  ) {
    ids.add(
      evidenceId
    );
  } else {
    ids.delete(
      evidenceId
    );
  }

  return {
    ...base,

    updatedAt:
      now,

    updatedBy,

    updatedByName:
      updatedByName ||
      updatedBy,

    sections: {
      ...base.sections,

      [sectionKey]: {
        evidenceIds:
          [
            ...ids,
          ],

        note:
          existing?.note ||
          "",

        updatedAt:
          now,

        updatedBy,
      },
    },
  };
}


export function setEvidenceTraceabilityNote(
  value:
    RasadyarEvidenceTraceabilityRecord | undefined,
  sectionKey:
    RasadyarHumanReviewSectionKey,
  note:
    string,
  currentEvidenceIds:
    string[],
  updatedBy:
    string,
  updatedByName?:
    string
): RasadyarEvidenceTraceabilityRecord {
  const base =
    normalizeEvidenceTraceability(
      value,
      currentEvidenceIds,
      updatedBy,
      updatedByName
    ) ||
    createEvidenceTraceabilityRecord(
      updatedBy,
      updatedByName
    );

  const now =
    new Date().toISOString();

  const existing =
    base.sections[
      sectionKey
    ];

  return {
    ...base,

    updatedAt:
      now,

    updatedBy,

    updatedByName:
      updatedByName ||
      updatedBy,

    sections: {
      ...base.sections,

      [sectionKey]: {
        evidenceIds:
          existing?.evidenceIds ||
          [],

        note,

        updatedAt:
          now,

        updatedBy,
      },
    },
  };
}


export function applyMachineCitationSuggestions(
  value:
    RasadyarEvidenceTraceabilityRecord | undefined,
  draft:
    RasadyarMachineAnalysisDraft,
  currentEvidenceIds:
    string[],
  updatedBy:
    string,
  updatedByName?:
    string
): RasadyarEvidenceTraceabilityRecord {
  const base =
    normalizeEvidenceTraceability(
      value,
      currentEvidenceIds,
      updatedBy,
      updatedByName
    ) ||
    createEvidenceTraceabilityRecord(
      updatedBy,
      updatedByName
    );

  const validIds =
    new Set(
      currentEvidenceIds
    );

  const now =
    new Date().toISOString();

  const nextSections = {
    ...base.sections,
  };

  for (
    const section of
    HUMAN_REVIEW_SECTIONS
  ) {
    const existing =
      nextSections[
        section.key
      ];

    if (
      existing?.evidenceIds
        ?.length
    ) {
      continue;
    }

    const suggested =
      (
        draft.evidenceCitations?.[
          section.key
        ] ||
        []
      ).filter(
        (
          id
        ) =>
          validIds.has(
            id
          )
      );

    if (
      suggested.length ===
      0
    ) {
      continue;
    }

    nextSections[
      section.key
    ] = {
      evidenceIds:
        unique(
          suggested
        ),

      note:
        existing?.note ||
        "",

      updatedAt:
        now,

      updatedBy,
    };
  }

  return {
    ...base,

    updatedAt:
      now,

    updatedBy,

    updatedByName:
      updatedByName ||
      updatedBy,

    machineSuggestedFromDraftId:
      draft.draftId,

    sections:
      nextSections,
  };
}


export function clearEvidenceTraceability(
  updatedBy:
    string,
  updatedByName?:
    string
): RasadyarEvidenceTraceabilityRecord {
  return createEvidenceTraceabilityRecord(
    updatedBy,
    updatedByName
  );
}
