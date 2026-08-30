/*
 * Rasadyar P3-Step7 — Evidence Consistency & Conflict Review
 *
 * This is a local heuristic review assistant, not fact verification.
 * It detects patterns that deserve analyst attention:
 * - possible contradiction
 * - cross-source corroboration
 * - near-duplicate / non-independent reporting
 * - temporal divergence
 * - location divergence
 *
 * Machine findings remain advisory until an analyst reviews them.
 */

import {
  type RasadyarEvidenceRelationshipFinding,
  type RasadyarEvidenceRelationshipRegister,
  type RasadyarEvidenceRelationshipReviewStatus,
  type RasadyarEvidenceRelationshipType,
} from "../../core/rasadyar-data";


export interface RelationshipEvidenceInput {
  id:
    string;

  title:
    string;

  summary?:
    string;

  source?:
    string;

  country?:
    string;

  region?:
    string;

  timestamp?:
    string;

  archive?: {
    channelName?:
      string;

    archiveId?:
      string;
  };
}


const NEGATION_TERMS = [
  " نیست ",
  " نبود ",
  " نشد ",
  " نخواهد ",
  " تکذیب ",
  " رد ",
  " عدم ",
  " بدون ",
  " کاهش ",
  " متوقف ",
  "not",
  " no ",
  " denied ",
  " denies ",
  " false ",
  " without ",
  " decrease ",
  " stopped ",
];


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


function normalizeText(
  value:
    string | undefined
): string {
  return (
    value ||
    ""
  )
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function tokenize(
  value:
    string
): Set<string> {
  const stopWords =
    new Set(
      [
        "و",
        "در",
        "به",
        "از",
        "با",
        "برای",
        "که",
        "این",
        "آن",
        "the",
        "a",
        "an",
        "of",
        "to",
        "in",
        "on",
        "for",
        "and",
        "is",
        "are",
      ]
    );

  return new Set(
    value
      .split(
        " "
      )
      .filter(
        (
          token
        ) =>
          token.length >=
            3 &&
          !stopWords.has(
            token
          )
      )
  );
}


function jaccard(
  left:
    Set<string>,
  right:
    Set<string>
): number {
  if (
    left.size ===
      0 ||
    right.size ===
      0
  ) {
    return 0;
  }

  let intersection =
    0;

  for (
    const token of
    left
  ) {
    if (
      right.has(
        token
      )
    ) {
      intersection +=
        1;
    }
  }

  const union =
    left.size +
    right.size -
    intersection;

  return union >
    0
    ? intersection /
        union
    : 0;
}


function sourceKey(
  item:
    RelationshipEvidenceInput
): string {
  return normalizeText(
    item.archive?.channelName ||
    item.source
  );
}


function locationKey(
  item:
    RelationshipEvidenceInput
): string {
  return normalizeText(
    item.country ||
    item.region
  );
}


function combinedText(
  item:
    RelationshipEvidenceInput
): string {
  return normalizeText(
    [
      item.title,
      item.summary,
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      )
  );
}


function hasNegation(
  text:
    string
): boolean {
  const padded =
    ` ${text} `;

  return NEGATION_TERMS.some(
    (
      term
    ) =>
      padded.includes(
        term
      )
  );
}


function safeTime(
  value:
    string | undefined
): number | null {
  if (
    !value
  ) {
    return null;
  }

  const time =
    new Date(
      value
    ).getTime();

  return Number.isFinite(
    time
  )
    ? time
    : null;
}


function relationshipKey(
  type:
    RasadyarEvidenceRelationshipType,
  evidenceIds:
    string[]
): string {
  return `${type}:${[
    ...evidenceIds,
  ]
    .sort()
    .join(
      "|"
    )}`;
}


function createFinding(
  type:
    RasadyarEvidenceRelationshipType,
  severity:
    RasadyarEvidenceRelationshipFinding["severity"],
  evidenceIds:
    string[],
  title:
    string,
  reason:
    string
): RasadyarEvidenceRelationshipFinding {
  const now =
    new Date().toISOString();

  return {
    findingId:
      createId(
        "relationship"
      ),

    relationshipKey:
      relationshipKey(
        type,
        evidenceIds
      ),

    type,

    severity,

    reviewStatus:
      "unreviewed",

    evidenceIds:
      [
        ...new Set(
          evidenceIds
        ),
      ],

    title,

    reason,

    machineSuggested:
      true,

    analystNote:
      "",

    createdAt:
      now,

    updatedAt:
      now,
  };
}


function preserveReview(
  next:
    RasadyarEvidenceRelationshipFinding,
  previous:
    RasadyarEvidenceRelationshipFinding | undefined
): RasadyarEvidenceRelationshipFinding {
  if (
    !previous
  ) {
    return next;
  }

  return {
    ...next,

    findingId:
      previous.findingId,

    reviewStatus:
      previous.reviewStatus,

    analystNote:
      previous.analystNote,

    reviewedBy:
      previous.reviewedBy,

    reviewedAt:
      previous.reviewedAt,

    createdAt:
      previous.createdAt,
  };
}


export function scanEvidenceRelationships(
  evidence:
    RelationshipEvidenceInput[],
  previous:
    RasadyarEvidenceRelationshipRegister | undefined
): RasadyarEvidenceRelationshipRegister {
  const items =
    evidence.filter(
      (
        item
      ) =>
        item.id &&
        item.title
    );

  const previousByKey =
    new Map(
      (
        previous?.findings ||
        []
      ).map(
        (
          finding
        ) => [
          finding.relationshipKey,
          finding,
        ]
      )
    );

  const findings:
    RasadyarEvidenceRelationshipFinding[] =
      [];

  /*
   * 1) Same-source concentration / non-independent reporting.
   */
  const bySource =
    new Map<
      string,
      RelationshipEvidenceInput[]
    >();

  for (
    const item of
    items
  ) {
    const key =
      sourceKey(
        item
      );

    if (
      !key
    ) {
      continue;
    }

    const group =
      bySource.get(
        key
      ) ||
      [];

    group.push(
      item
    );

    bySource.set(
      key,
      group
    );
  }

  for (
    const group of
    bySource.values()
  ) {
    if (
      group.length <
      2
    ) {
      continue;
    }

    const ids =
      group.map(
        (
          item
        ) =>
          item.id
      );

    const finding =
      createFinding(
        "source-concentration",
        group.length >=
          4
          ? "medium"
          : "low",
        ids,
        "تمرکز چند شاهد بر یک منبع",
        `${group.length} شاهد از یک منبع/کانال مشترک ثبت شده‌اند. این اقلام نباید به‌طور خودکار معادل ${group.length} تأیید مستقل در نظر گرفته شوند.`
      );

    findings.push(
      preserveReview(
        finding,
        previousByKey.get(
          finding.relationshipKey
        )
      )
    );
  }

  /*
   * 2) Pairwise semantic-overlap heuristics.
   */
  for (
    let leftIndex =
      0;
    leftIndex <
      items.length;
    leftIndex +=
      1
  ) {
    for (
      let rightIndex =
        leftIndex +
        1;
      rightIndex <
        items.length;
      rightIndex +=
        1
    ) {
      const left =
        items[
          leftIndex
        ];

      const right =
        items[
          rightIndex
        ];

      if (
        !left ||
        !right
      ) {
        continue;
      }

      const leftText =
        combinedText(
          left
        );

      const rightText =
        combinedText(
          right
        );

      const similarity =
        jaccard(
          tokenize(
            leftText
          ),
          tokenize(
            rightText
          )
        );

      const leftSource =
        sourceKey(
          left
        );

      const rightSource =
        sourceKey(
          right
        );

      const differentSources =
        Boolean(
          leftSource &&
          rightSource &&
          leftSource !==
            rightSource
        );

      const ids = [
        left.id,
        right.id,
      ];

      /*
       * Possible contradiction:
       * meaningful lexical overlap + negation asymmetry.
       */
      if (
        similarity >=
          0.28 &&
        hasNegation(
          leftText
        ) !==
          hasNegation(
            rightText
          )
      ) {
        const finding =
          createFinding(
            "possible-conflict",
            similarity >=
              0.45
              ? "high"
              : "medium",
            ids,
            "تعارض احتمالی میان دو شاهد",
            `شباهت واژگانی حدود ${Math.round(
              similarity *
                100
            )}% است و الگوی نفی/رد در دو متن یکسان نیست. این فقط یک هشدار زبانی است و باید توسط تحلیلگر بررسی شود.`
          );

        findings.push(
          preserveReview(
            finding,
            previousByKey.get(
              finding.relationshipKey
            )
          )
        );
      }

      /*
       * Cross-source corroboration candidate.
       */
      if (
        similarity >=
          0.55 &&
        differentSources &&
        hasNegation(
          leftText
        ) ===
          hasNegation(
            rightText
          )
      ) {
        const finding =
          createFinding(
            "possible-corroboration",
            "low",
            ids,
            "هم‌پوشانی احتمالی میان منابع مستقل",
            `دو شاهد از منابع متفاوت دارای حدود ${Math.round(
              similarity *
                100
            )}% هم‌پوشانی واژگانی هستند. این نشانه می‌تواند برای تأیید متقاطع مفید باشد، اما استقلال واقعی منابع باید بررسی شود.`
          );

        findings.push(
          preserveReview(
            finding,
            previousByKey.get(
              finding.relationshipKey
            )
          )
        );
      }

      /*
       * Near duplicate.
       */
      if (
        similarity >=
        0.78
      ) {
        const finding =
          createFinding(
            "near-duplicate",
            "low",
            ids,
            "شباهت بسیار زیاد میان دو شاهد",
            `هم‌پوشانی واژگانی حدود ${Math.round(
              similarity *
                100
            )}% است. احتمال بازنشر، نسخه مشابه یک خبر یا وابستگی محتوایی را بررسی کنید.`
          );

        findings.push(
          preserveReview(
            finding,
            previousByKey.get(
              finding.relationshipKey
            )
          )
        );
      }

      /*
       * Location divergence on semantically similar evidence.
       */
      const leftLocation =
        locationKey(
          left
        );

      const rightLocation =
        locationKey(
          right
        );

      if (
        similarity >=
          0.35 &&
        leftLocation &&
        rightLocation &&
        leftLocation !==
          rightLocation
      ) {
        const finding =
          createFinding(
            "location-divergence",
            "medium",
            ids,
            "اختلاف مکانی در شواهد مشابه",
            "دو شاهد از نظر واژگانی مرتبط‌اند اما محدوده جغرافیایی ثبت‌شده متفاوت است. احتمال اشاره به دو رویداد جداگانه یا خطای برچسب جغرافیایی را بررسی کنید."
          );

        findings.push(
          preserveReview(
            finding,
            previousByKey.get(
              finding.relationshipKey
            )
          )
        );
      }

      /*
       * Temporal divergence for similar evidence.
       */
      const leftTime =
        safeTime(
          left.timestamp
        );

      const rightTime =
        safeTime(
          right.timestamp
        );

      if (
        similarity >=
          0.35 &&
        leftTime !==
          null &&
        rightTime !==
          null
      ) {
        const gapDays =
          Math.abs(
            leftTime -
            rightTime
          ) /
          86_400_000;

        if (
          gapDays >=
          30
        ) {
          const finding =
            createFinding(
              "temporal-divergence",
              gapDays >=
                180
                ? "medium"
                : "low",
              ids,
              "فاصله زمانی زیاد در شواهد مشابه",
              `دو شاهد مرتبط حدود ${Math.round(
                gapDays
              )} روز فاصله زمانی دارند. احتمال بازنشر رویداد قدیمی، تغییر زمینه یا مقایسه دو دوره زمانی را بررسی کنید.`
            );

          findings.push(
            preserveReview(
              finding,
              previousByKey.get(
                finding.relationshipKey
              )
            )
          );
        }
      }
    }
  }

  /*
   * Deduplicate same deterministic relationshipKey.
   */
  const uniqueFindings =
    [
      ...new Map(
        findings.map(
          (
            finding
          ) => [
            finding.relationshipKey,
            finding,
          ]
        )
      ).values(),
    ];

  return {
    registerId:
      previous?.registerId ||
      createId(
        "relationship-register"
      ),

    version:
      "rasadyar-evidence-relationship-v1",

    scanVersion:
      "local-heuristic-v1",

    scannedAt:
      new Date().toISOString(),

    evidenceIds:
      items.map(
        (
          item
        ) =>
          item.id
      ),

    findings:
      uniqueFindings,
  };
}


export function isEvidenceRelationshipScanStale(
  register:
    RasadyarEvidenceRelationshipRegister | undefined,
  currentEvidenceIds:
    string[]
): boolean {
  if (
    !register
  ) {
    return false;
  }

  const previous =
    [
      ...register.evidenceIds,
    ].sort();

  const current =
    [
      ...new Set(
        currentEvidenceIds
      ),
    ].sort();

  if (
    previous.length !==
    current.length
  ) {
    return true;
  }

  return previous.some(
    (
      id,
      index
    ) =>
      id !==
      current[
        index
      ]
  );
}


export function updateEvidenceRelationshipReview(
  register:
    RasadyarEvidenceRelationshipRegister,
  findingId:
    string,
  reviewStatus:
    RasadyarEvidenceRelationshipReviewStatus,
  reviewedBy:
    string
): RasadyarEvidenceRelationshipRegister {
  const now =
    new Date().toISOString();

  return {
    ...register,

    findings:
      register.findings.map(
        (
          finding
        ) =>
          finding.findingId ===
            findingId
            ? {
                ...finding,

                reviewStatus,

                reviewedBy,

                reviewedAt:
                  now,

                updatedAt:
                  now,
              }
            : finding
      ),
  };
}


export function updateEvidenceRelationshipNote(
  register:
    RasadyarEvidenceRelationshipRegister,
  findingId:
    string,
  analystNote:
    string,
  reviewedBy:
    string
): RasadyarEvidenceRelationshipRegister {
  const now =
    new Date().toISOString();

  return {
    ...register,

    findings:
      register.findings.map(
        (
          finding
        ) =>
          finding.findingId ===
            findingId
            ? {
                ...finding,

                analystNote,

                reviewedBy,

                updatedAt:
                  now,
              }
            : finding
      ),
  };
}


export function evidenceRelationshipSummary(
  register:
    RasadyarEvidenceRelationshipRegister | undefined
): {
  total:
    number;

  unreviewed:
    number;

  accepted:
    number;

  resolved:
    number;

  dismissed:
    number;

  needsReview:
    number;

  highOpen:
    number;
} {
  const findings =
    register?.findings ||
    [];

  return {
    total:
      findings.length,

    unreviewed:
      findings.filter(
        (
          finding
        ) =>
          finding.reviewStatus ===
          "unreviewed"
      ).length,

    accepted:
      findings.filter(
        (
          finding
        ) =>
          finding.reviewStatus ===
          "accepted"
      ).length,

    resolved:
      findings.filter(
        (
          finding
        ) =>
          finding.reviewStatus ===
          "resolved"
      ).length,

    dismissed:
      findings.filter(
        (
          finding
        ) =>
          finding.reviewStatus ===
          "dismissed"
      ).length,

    needsReview:
      findings.filter(
        (
          finding
        ) =>
          finding.reviewStatus ===
          "needs-review"
      ).length,

    highOpen:
      findings.filter(
        (
          finding
        ) =>
          finding.severity ===
            "high" &&
          (
            finding.reviewStatus ===
              "unreviewed" ||
            finding.reviewStatus ===
              "needs-review"
          )
      ).length,
  };
}


export function evidenceRelationshipTypeLabel(
  type:
    RasadyarEvidenceRelationshipType
): string {
  if (
    type ===
    "possible-conflict"
  ) {
    return "تعارض احتمالی";
  }

  if (
    type ===
    "possible-corroboration"
  ) {
    return "هم‌پوشانی / تأیید متقاطع احتمالی";
  }

  if (
    type ===
    "near-duplicate"
  ) {
    return "شاهد بسیار مشابه";
  }

  if (
    type ===
    "source-concentration"
  ) {
    return "تمرکز منبع";
  }

  if (
    type ===
    "temporal-divergence"
  ) {
    return "اختلاف زمانی";
  }

  return "اختلاف مکانی";
}
