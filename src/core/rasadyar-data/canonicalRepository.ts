/*
 * Rasadyar Data Model — Canonical Repository Facades
 *
 * Read-only entity repositories over rasadyar_data_v1.
 */

import {
  type RasadyarAlert,
  type RasadyarAnalysisCase,
  type RasadyarArchive,
  type RasadyarEvidence,
  type RasadyarId,
  type RasadyarReport,
} from "./schema";

import {
  readCanonicalStore,
} from "./storage";


export interface ReadOnlyEntityRepository<T> {
  getById(
    id:
      RasadyarId
  ):
    T | null;

  list():
    T[];

  count():
    number;
}


function createRepository<T>(
  select:
    () => Record<
      RasadyarId,
      T
    >
): ReadOnlyEntityRepository<T> {
  return {
    getById(
      id:
        RasadyarId
    ) {
      return (
        select()[
          id
        ] ||
        null
      );
    },

    list() {
      return Object.values(
        select()
      );
    },

    count() {
      return Object.keys(
        select()
      ).length;
    },
  };
}


export const canonicalCaseRepository:
  ReadOnlyEntityRepository<RasadyarAnalysisCase> =
    createRepository(
      () =>
        readCanonicalStore().cases
    );


export const canonicalEvidenceRepository:
  ReadOnlyEntityRepository<RasadyarEvidence> =
    createRepository(
      () =>
        readCanonicalStore().evidence
    );


export const canonicalArchiveRepository:
  ReadOnlyEntityRepository<RasadyarArchive> =
    createRepository(
      () =>
        readCanonicalStore().archives
    );


export const canonicalReportRepository:
  ReadOnlyEntityRepository<RasadyarReport> =
    createRepository(
      () =>
        readCanonicalStore().reports
    );


export const canonicalAlertRepository:
  ReadOnlyEntityRepository<RasadyarAlert> =
    createRepository(
      () =>
        readCanonicalStore().alerts
    );
