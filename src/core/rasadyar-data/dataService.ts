/*
 * Rasadyar Data Service
 *
 * Final P2 application-facing boundary.
 *
 * UI
 *  ↓
 * RasadyarDataService / Repositories
 *  ↓
 * Legacy Storage Adapter + Canonical Store
 *  ↓
 * localStorage now / API + Database later
 */

import {
  readCanonicalStore,
  type StorageLike,
} from "./storage";

import {
  syncCanonicalAnalysisCases,
  type LegacyAnalysisCaseInput,
} from "./caseRepository";

import {
  syncCanonicalReports,
  type LegacyReportInput,
} from "./reportRepository";

import {
  canonicalAlertRepository,
  canonicalArchiveRepository,
  canonicalCaseRepository,
  canonicalEvidenceRepository,
  canonicalReportRepository,
} from "./canonicalRepository";


const LEGACY_ANALYSES_KEY =
  "rasadyar_analyses";

const LEGACY_REPORTS_KEY =
  "rasadyar_reports";


export interface LegacyWriteResult {
  ok:
    boolean;

  error?:
    unknown;
}


function resolveStorage(
  storage?:
    StorageLike
): StorageLike {
  if (storage) {
    return storage;
  }

  if (
    typeof localStorage !==
    "undefined"
  ) {
    return localStorage;
  }

  throw new Error(
    "Rasadyar application storage is not available."
  );
}


function readLegacyArray<T>(
  key:
    string,
  storage?:
    StorageLike
): T[] {
  try {
    const raw =
      resolveStorage(
        storage
      ).getItem(
        key
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(
        raw
      );

    return Array.isArray(
      parsed
    )
      ? parsed
      : [];
  } catch (
    error
  ) {
    console.error(
      `[RasadyarDataService] Could not read ${key}.`,
      error
    );

    return [];
  }
}


function writeLegacyArray<T>(
  key:
    string,
  items:
    T[],
  storage?:
    StorageLike
): LegacyWriteResult {
  try {
    resolveStorage(
      storage
    ).setItem(
      key,
      JSON.stringify(
        items
      )
    );

    return {
      ok:
        true,
    };
  } catch (
    error
  ) {
    console.error(
      `[RasadyarDataService] Could not write ${key}.`,
      error
    );

    return {
      ok:
        false,

      error,
    };
  }
}


function loadAnalysisCases<T>(
  storage?:
    StorageLike
): T[] {
  const items =
    readLegacyArray<T>(
      LEGACY_ANALYSES_KEY,
      storage
    );

  const canonical =
    syncCanonicalAnalysisCases(
      items as unknown as
        LegacyAnalysisCaseInput[]
    );

  if (
    !canonical.ok
  ) {
    console.warn(
      "[RasadyarDataService] Initial Case mirror failed.",
      canonical.error
    );
  }

  return items;
}


function saveAnalysisCases<T>(
  items:
    T[],
  storage?:
    StorageLike
): LegacyWriteResult {
  const legacy =
    writeLegacyArray(
      LEGACY_ANALYSES_KEY,
      items,
      storage
    );

  if (
    !legacy.ok
  ) {
    return legacy;
  }

  const canonical =
    syncCanonicalAnalysisCases(
      items as unknown as
        LegacyAnalysisCaseInput[]
    );

  if (
    !canonical.ok
  ) {
    console.warn(
      "[RasadyarDataService] Canonical Case mirror failed; legacy Cases remain saved.",
      canonical.error
    );
  }

  return {
    ok:
      true,
  };
}


function loadReports<T>(
  storage?:
    StorageLike
): T[] {
  const items =
    readLegacyArray<T>(
      LEGACY_REPORTS_KEY,
      storage
    );

  const canonical =
    syncCanonicalReports(
      items as unknown as
        LegacyReportInput[]
    );

  if (
    !canonical.ok
  ) {
    console.warn(
      "[RasadyarDataService] Initial Report mirror failed.",
      canonical.error
    );
  }

  return items;
}


function saveReports<T>(
  items:
    T[],
  storage?:
    StorageLike
): LegacyWriteResult {
  const legacy =
    writeLegacyArray(
      LEGACY_REPORTS_KEY,
      items,
      storage
    );

  if (
    !legacy.ok
  ) {
    return legacy;
  }

  const canonical =
    syncCanonicalReports(
      items as unknown as
        LegacyReportInput[]
    );

  if (
    !canonical.ok
  ) {
    console.warn(
      "[RasadyarDataService] Canonical Report mirror failed; legacy Reports remain saved.",
      canonical.error
    );
  }

  return {
    ok:
      true,
  };
}


export const rasadyarDataService = {
  analysisCases: {
    load:
      loadAnalysisCases,

    save:
      saveAnalysisCases,
  },

  reports: {
    load:
      loadReports,

    save:
      saveReports,
  },

  canonical: {
    snapshot() {
      return readCanonicalStore();
    },

    stats() {
      const store =
        readCanonicalStore();

      return {
        cases:
          Object.keys(
            store.cases
          ).length,

        evidence:
          Object.keys(
            store.evidence
          ).length,

        archives:
          Object.keys(
            store.archives
          ).length,

        reports:
          Object.keys(
            store.reports
          ).length,

        alerts:
          Object.keys(
            store.alerts
          ).length,
      };
    },

    cases:
      canonicalCaseRepository,

    evidence:
      canonicalEvidenceRepository,

    archives:
      canonicalArchiveRepository,

    reports:
      canonicalReportRepository,

    alerts:
      canonicalAlertRepository,
  },
} as const;


export type RasadyarDataService =
  typeof rasadyarDataService;
