/*
 * Rasadyar Data Model — Storage boundary
 *
 * این فایل یک مرز واحد برای ذخیره داده‌های canonical ایجاد می‌کند.
 * فعلاً localStorage را به‌عنوان Adapter نگه می‌داریم.
 * بعداً Backend/Database می‌تواند پشت همین قرارداد جایگزین شود.
 */

import {
  createEmptyDataEnvelope,
  isRasadyarDataEnvelopeV1,
  nowIso,
  type RasadyarDataEnvelopeV1,
} from "./schema";


export const RASADYAR_DATA_STORE_KEY =
  "rasadyar_data_v1";


/**
 * کلیدهای فعلی پروژه که در مراحل بعدی از آنها مهاجرت می‌کنیم.
 * هیچ‌کدام در P2-Step1 حذف یا بازنویسی نمی‌شوند.
 */
export const LEGACY_STORAGE_KEYS = {
  analyses:
    "rasadyar_analyses",

  reports:
    "rasadyar_reports",

  users:
    "rasadyar_users",

  currentUser:
    "rasadyar_user",

  pendingEvidence:
    "rasadyar_pending_analysis_evidence",
} as const;


export interface StorageLike {
  getItem(
    key: string
  ): string | null;

  setItem(
    key: string,
    value: string
  ): void;

  removeItem(
    key: string
  ): void;
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
    "Rasadyar storage is not available in this runtime."
  );
}


export function hasCanonicalStore(
  storage?:
    StorageLike
): boolean {
  const target =
    resolveStorage(
      storage
    );

  return (
    target.getItem(
      RASADYAR_DATA_STORE_KEY
    ) !== null
  );
}


export function readCanonicalStore(
  storage?:
    StorageLike
): RasadyarDataEnvelopeV1 {
  const target =
    resolveStorage(
      storage
    );

  const raw =
    target.getItem(
      RASADYAR_DATA_STORE_KEY
    );

  if (!raw) {
    return createEmptyDataEnvelope();
  }

  try {
    const parsed =
      JSON.parse(raw);

    if (
      isRasadyarDataEnvelopeV1(
        parsed
      )
    ) {
      return parsed;
    }
  } catch (
    error
  ) {
    console.warn(
      "[RasadyarData] Canonical store could not be parsed.",
      error
    );
  }

  /*
   * خرابی Store مرکزی نباید داده Legacy فعلی را دستکاری کند.
   */
  return createEmptyDataEnvelope();
}


export function writeCanonicalStore(
  data:
    RasadyarDataEnvelopeV1,
  storage?:
    StorageLike
): RasadyarDataEnvelopeV1 {
  const target =
    resolveStorage(
      storage
    );

  const next:
    RasadyarDataEnvelopeV1 = {
    ...data,

    updatedAt:
      nowIso(),
  };

  target.setItem(
    RASADYAR_DATA_STORE_KEY,
    JSON.stringify(next)
  );

  return next;
}


export function clearCanonicalStore(
  storage?:
    StorageLike
): void {
  resolveStorage(
    storage
  ).removeItem(
    RASADYAR_DATA_STORE_KEY
  );
}


/**
 * Update اتمیک در سطح Adapter.
 *
 * در localStorage قفل تراکنشی واقعی نداریم،
 * اما همه تغییرات از یک Read -> Mutate -> Write عبور می‌کنند.
 * Backend آینده همین API را می‌تواند با Transaction واقعی پیاده کند.
 */
export function updateCanonicalStore(
  updater:
    (
      current:
        RasadyarDataEnvelopeV1
    ) => RasadyarDataEnvelopeV1,
  storage?:
    StorageLike
): RasadyarDataEnvelopeV1 {
  const current =
    readCanonicalStore(
      storage
    );

  const updated =
    updater(current);

  return writeCanonicalStore(
    updated,
    storage
  );
}
