/*
 * Rasadyar P3-Step2 — Evidence-to-Draft Analysis Engine
 *
 * Goals:
 * - Generate a machine draft from the Evidence already attached to a Case.
 * - Keep every statement grounded in observable Evidence metadata/text.
 * - Use WorldMonitor browser ML (NER + sentiment) when available.
 * - Never require a cloud provider and never block on external APIs.
 * - Fall back to deterministic local synthesis if browser ML is unavailable.
 *
 * The machine draft is deliberately kept separate from the analyst's final
 * assessment. P3-Step3 will use this separation for Human-vs-Machine review.
 */

import {
  mlWorker,
} from "@/services/ml-worker";

import {
  type RasadyarMachineAnalysisDraft,
  type RasadyarStructuredAssessment,
} from "../../core/rasadyar-data";


export interface DraftEngineEvidence {
  id:
    string;

  kind:
    "news"
    | "map"
    | "alert"
    | "manual";

  title:
    string;

  source?:
    string;

  url?:
    string;

  country?:
    string;

  region?:
    string;

  lat?:
    number;

  lon?:
    number;

  timestamp?:
    string;

  summary?:
    string;

  archive?: {
    archiveId?:
      string;

    mediaType?:
      string;

    channelName?:
      string;

    archivedAt?:
      string;
  };
}


export interface GenerateAnalysisDraftInput {
  caseTitle:
    string;

  description:
    string;

  region:
    string;

  domain:
    string;

  confidence:
    string;

  evidence:
    DraftEngineEvidence[];
}


type MlEntity = {
  text?:
    string;

  type?:
    string;

  confidence?:
    number;
};


type MlSentiment = {
  label?:
    string;

  score?:
    number;
};


type MlSignals = {
  entities:
    string[];

  negativeShare?:
    number;

  neutralShare?:
    number;

  positiveShare?:
    number;
};


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


function cleanText(
  value:
    unknown
): string {
  return typeof value ===
    "string"
      ? value.trim()
      : "";
}


function bullet(
  value:
    string
): string {
  return `• ${value}`;
}


function unique(
  values:
    Array<
      string | undefined
    >
): string[] {
  return [
    ...new Set(
      values
        .map(
          cleanText
        )
        .filter(
          Boolean
        )
    ),
  ];
}


function clip(
  value:
    string,
  max =
    220
): string {
  if (
    value.length <=
    max
  ) {
    return value;
  }

  return `${value.slice(0, max - 1).trim()}…`;
}


function formatEvidenceLine(
  evidence:
    DraftEngineEvidence
): string {
  const source =
    cleanText(
      evidence.archive?.channelName
    ) ||
    cleanText(
      evidence.source
    );

  const summary =
    cleanText(
      evidence.summary
    );

  const suffix =
    source
      ? ` — ${source}`
      : "";

  if (
    summary
  ) {
    return `${clip(evidence.title, 150)}${suffix}: ${clip(summary, 260)}`;
  }

  return `${clip(evidence.title, 190)}${suffix}`;
}


function countKinds(
  evidence:
    DraftEngineEvidence[]
): Record<
  string,
  number
> {
  return evidence.reduce<
    Record<
      string,
      number
    >
  >(
    (
      acc,
      item
    ) => {
      acc[
        item.kind
      ] =
        (
          acc[
            item.kind
          ] ||
          0
        ) +
        1;

      return acc;
    },
    {}
  );
}


function newestFirst(
  evidence:
    DraftEngineEvidence[]
): DraftEngineEvidence[] {
  return [
    ...evidence,
  ].sort(
    (
      a,
      b
    ) => {
      const aTime =
        a.timestamp
          ? new Date(
              a.timestamp
            ).getTime()
          : 0;

      const bTime =
        b.timestamp
          ? new Date(
              b.timestamp
            ).getTime()
          : 0;

      return (
        bTime -
        aTime
      );
    }
  );
}


async function collectBrowserMlSignals(
  evidence:
    DraftEngineEvidence[]
): Promise<
  MlSignals | null
> {
  const texts =
    evidence
      .map(
        (
          item
        ) =>
          [
            cleanText(
              item.title
            ),

            cleanText(
              item.summary
            ),
          ]
            .filter(
              Boolean
            )
            .join(
              ". "
            )
      )
      .filter(
        Boolean
      )
      .slice(
        0,
        8
      );

  if (
    texts.length ===
    0
  ) {
    return null;
  }

  try {
    const ready =
      mlWorker.isAvailable ||
      await mlWorker.init();

    if (
      !ready
    ) {
      return null;
    }

    const [
      entityGroups,
      sentiments,
    ] =
      await Promise.all(
        [
          mlWorker
            .extractEntities(
              texts
            )
            .catch(
              () => []
            ),

          mlWorker
            .classifySentiment(
              texts
            )
            .catch(
              () => []
            ),
        ]
      );

    const entities =
      unique(
        (
          entityGroups as
            MlEntity[][]
        )
          .flat()
          .filter(
            (
              entity
            ) =>
              cleanText(
                entity?.text
              ) &&
              (
                typeof entity?.confidence !==
                  "number" ||
                entity.confidence >=
                  0.55
              )
          )
          .map(
            (
              entity
            ) =>
              cleanText(
                entity.text
              )
          )
      ).slice(
        0,
        12
      );

    const safeSentiments =
      (
        sentiments as
          MlSentiment[]
      ).filter(
        (
          item
        ) =>
          typeof item?.label ===
          "string"
      );

    const total =
      safeSentiments.length;

    const share = (
      label:
        string
    ) => {
      if (
        total ===
        0
      ) {
        return undefined;
      }

      return (
        safeSentiments.filter(
          (
            item
          ) =>
            item.label ===
            label
        ).length /
        total
      );
    };

    if (
      entities.length ===
        0 &&
      total ===
        0
    ) {
      return null;
    }

    return {
      entities,

      negativeShare:
        share(
          "negative"
        ),

      neutralShare:
        share(
          "neutral"
        ),

      positiveShare:
        share(
          "positive"
        ),
    };
  } catch (
    error
  ) {
    console.warn(
      "[RasadyarDraftEngine] Browser ML was unavailable; local grounded synthesis will be used.",
      error
    );

    return null;
  }
}


function buildSituationSummary(
  input:
    GenerateAnalysisDraftInput,
  ordered:
    DraftEngineEvidence[]
): string {
  const sourceCount =
    unique(
      ordered.map(
        (
          item
        ) =>
          item.archive?.channelName ||
          item.source
      )
    ).length;

  const areaCount =
    unique(
      ordered.flatMap(
        (
          item
        ) => [
          item.country,
          item.region,
        ]
      )
    ).length;

  const lead =
    `این پیش‌نویس بر پایه ${ordered.length} شاهد ثبت‌شده`;

  const sourceText =
    sourceCount >
      0
      ? ` از ${sourceCount} منبع متمایز`
      : "";

  const areaText =
    areaCount >
      0
      ? ` و ${areaCount} محدوده جغرافیایی`
      : "";

  const caseContext =
    cleanText(
      input.description
    )
      ? ` مسئله ثبت‌شده در پرونده «${clip(input.description, 220)}» است.`
      : "";

  const topEvidence =
    ordered
      .slice(
        0,
        3
      )
      .map(
        formatEvidenceLine
      )
      .join(
        " | "
      );

  return [
    `${lead}${sourceText}${areaText} در حوزه ${input.domain || "نامشخص"} و محدوده ${input.region || "نامشخص"} تولید شده است.${caseContext}`,

    topEvidence
      ? `مهم‌ترین اقلام مشاهده‌شده: ${topEvidence}`
      : "",
  ]
    .filter(
      Boolean
    )
    .join(
      "\n\n"
    );
}


function buildKeyPoints(
  ordered:
    DraftEngineEvidence[]
): string {
  return ordered
    .slice(
      0,
      8
    )
    .map(
      (
        item
      ) =>
        bullet(
          formatEvidenceLine(
            item
          )
        )
    )
    .join(
      "\n"
    );
}


function buildActorsFactors(
  evidence:
    DraftEngineEvidence[],
  ml:
    MlSignals | null
): string {
  const sources =
    unique(
      evidence.map(
        (
          item
        ) =>
          item.archive?.channelName ||
          item.source
      )
    );

  const locations =
    unique(
      evidence.flatMap(
        (
          item
        ) => [
          item.country,
          item.region,
        ]
      )
    );

  const parts:
    string[] = [];

  if (
    ml?.entities.length
  ) {
    parts.push(
      bullet(
        `موجودیت‌های استخراج‌شده توسط مدل محلی مرورگر: ${ml.entities.join("، ")}`
      )
    );
  }

  if (
    sources.length
  ) {
    parts.push(
      bullet(
        `منابع/شبکه‌های حاضر در پرونده: ${sources.slice(0, 12).join("، ")}`
      )
    );
  }

  if (
    locations.length
  ) {
    parts.push(
      bullet(
        `محدوده‌های جغرافیایی ذکرشده: ${locations.slice(0, 12).join("، ")}`
      )
    );
  }

  return (
    parts.join(
      "\n"
    ) ||
    bullet(
      "در شواهد فعلی بازیگر یا عامل مشخصی با فراداده قابل اتکا استخراج نشده است."
    )
  );
}


function buildDrivers(
  evidence:
    DraftEngineEvidence[]
): string {
  const kinds =
    countKinds(
      evidence
    );

  const sourceCount =
    unique(
      evidence.map(
        (
          item
        ) =>
          item.archive?.channelName ||
          item.source
      )
    ).length;

  const drivers:
    string[] = [];

  if (
    kinds.alert
  ) {
    drivers.push(
      bullet(
        `${kinds.alert} هشدار راهبردی به‌عنوان محرک مستقیم پایش در پرونده وجود دارد.`
      )
    );
  }

  if (
    kinds.news
  ) {
    drivers.push(
      bullet(
        `${kinds.news} شاهد خبری روند رسانه‌ای/اطلاعاتی پرونده را شکل می‌دهد.`
      )
    );
  }

  if (
    kinds.map
  ) {
    drivers.push(
      bullet(
        `${kinds.map} رویداد مکانی برای بررسی همگرایی جغرافیایی در دسترس است.`
      )
    );
  }

  if (
    kinds.manual
  ) {
    drivers.push(
      bullet(
        `${kinds.manual} شاهد دستی نیازمند کنترل منشأ و روش ثبت است.`
      )
    );
  }

  if (
    sourceCount >=
    3
  ) {
    drivers.push(
      bullet(
        `تنوع منبع (${sourceCount} منبع) امکان مقایسه متقاطع را افزایش می‌دهد.`
      )
    );
  } else {
    drivers.push(
      bullet(
        "تنوع منبع محدود است و هر نتیجه باید با شاهد مستقل دیگری کنترل شود."
      )
    );
  }

  return drivers.join(
    "\n"
  );
}


function buildWarningIndicators(
  ordered:
    DraftEngineEvidence[]
): string {
  const alerts =
    ordered.filter(
      (
        item
      ) =>
        item.kind ===
        "alert"
    );

  const mapEvents =
    ordered.filter(
      (
        item
      ) =>
        item.kind ===
        "map"
    );

  const items:
    string[] = [];

  for (
    const alert of
    alerts.slice(
      0,
      5
    )
  ) {
    items.push(
      bullet(
        `هشدار ثبت‌شده: ${clip(alert.title, 180)}`
      )
    );
  }

  for (
    const mapEvent of
    mapEvents.slice(
      0,
      3
    )
  ) {
    items.push(
      bullet(
        `رویداد مکانی قابل پایش: ${clip(mapEvent.title, 180)}`
      )
    );
  }

  if (
    items.length ===
    0
  ) {
    items.push(
      bullet(
        "افزایش ناگهانی تعداد شواهد مستقل درباره همین موضوع."
      ),

      bullet(
        "تأیید یک ادعا توسط دو یا چند منبع مستقل با زمان ثبت نزدیک."
      ),

      bullet(
        "ظهور شاهد مکانی یا هشدار رسمی که با روند فعلی همگرا باشد."
      )
    );
  }

  return items.join(
    "\n"
  );
}


function buildInformationGaps(
  evidence:
    DraftEngineEvidence[]
): string {
  const missingSummary =
    evidence.filter(
      (
        item
      ) =>
        !cleanText(
          item.summary
        )
    ).length;

  const missingSource =
    evidence.filter(
      (
        item
      ) =>
        !cleanText(
          item.source
        ) &&
        !cleanText(
          item.archive?.channelName
        )
    ).length;

  const missingArchive =
    evidence.filter(
      (
        item
      ) =>
        !item.archive?.archiveId
    ).length;

  const sourceCount =
    unique(
      evidence.map(
        (
          item
        ) =>
          item.archive?.channelName ||
          item.source
      )
    ).length;

  const gaps:
    string[] = [];

  if (
    sourceCount <=
    1
  ) {
    gaps.push(
      bullet(
        "تأیید مستقل چندمنبعی کافی در پرونده وجود ندارد."
      )
    );
  }

  if (
    missingSummary >
    0
  ) {
    gaps.push(
      bullet(
        `${missingSummary} شاهد فاقد خلاصه/شرح محتوایی کافی است.`
      )
    );
  }

  if (
    missingSource >
    0
  ) {
    gaps.push(
      bullet(
        `${missingSource} شاهد فاقد منبع مشخص در فراداده است.`
      )
    );
  }

  if (
    missingArchive >
    0
  ) {
    gaps.push(
      bullet(
        `${missingArchive} شاهد فاقد Archive ID است و برای استناد قوی‌تر باید تکمیل شود.`
      )
    );
  }

  if (
    gaps.length ===
    0
  ) {
    gaps.push(
      bullet(
        "شکاف آشکار فراداده‌ای مشاهده نشد؛ بااین‌حال اعتبار محتوای منابع همچنان باید توسط تحلیلگر کنترل شود."
      )
    );
  }

  return gaps.join(
    "\n"
  );
}


function buildAssumptions(): string {
  return [
    bullet(
      "زمان‌های ثبت‌شده در شواهد برای ترتیب زمانی قابل استفاده فرض شده‌اند."
    ),

    bullet(
      "هر شاهد فقط بیانگر محتوای ثبت‌شده خود است و به‌تنهایی اثبات‌کننده رابطه علّی نیست."
    ),

    bullet(
      "نبود شاهد در پرونده به معنای نبود رویداد یا نبود تهدید در محیط واقعی نیست."
    ),
  ].join(
    "\n"
  );
}


function buildImplications(
  input:
    GenerateAnalysisDraftInput,
  evidence:
    DraftEngineEvidence[]
): string {
  const archiveCount =
    evidence.filter(
      (
        item
      ) =>
        Boolean(
          item.archive?.archiveId
        )
    ).length;

  return [
    bullet(
      `تمرکز فعلی پرونده بر حوزه ${input.domain || "نامشخص"} و محدوده ${input.region || "نامشخص"} است؛ تغییر در این تمرکز باید به‌عنوان علامت تغییر دامنه مسئله ثبت شود.`
    ),

    bullet(
      `${archiveCount} شاهد دارای شناسه آرشیوی است؛ نتیجه‌گیری‌های حساس بهتر است بر شواهد قابل بازبینی و چندمنبعی متکی باشند.`
    ),

    bullet(
      "در صورت افزایش هم‌زمان هشدارها، رویدادهای مکانی و تأیید چندمنبعی، سطح توجه عملیاتی باید مجدداً ارزیابی شود."
    ),
  ].join(
    "\n"
  );
}


function buildJudgment(
  evidence:
    DraftEngineEvidence[],
  ml:
    MlSignals | null
): string {
  const sourceCount =
    unique(
      evidence.map(
        (
          item
        ) =>
          item.archive?.channelName ||
          item.source
      )
    ).length;

  const lines:
    string[] = [];

  if (
    evidence.length ===
    1
  ) {
    lines.push(
      "پیش‌نویس فعلی بر یک شاهد استوار است؛ بنابراین برای قضاوت تحلیلی نهایی کفایت ندارد و باید مقدماتی تلقی شود."
    );
  } else if (
    sourceCount >=
    3
  ) {
    lines.push(
      `پرونده دارای ${evidence.length} شاهد از ${sourceCount} منبع متمایز است و برای مقایسه متقاطع اولیه ظرفیت مناسب‌تری دارد؛ بااین‌حال همگرایی منابع باید توسط تحلیلگر تأیید شود.`
    );
  } else {
    lines.push(
      `پرونده دارای ${evidence.length} شاهد است، اما تنوع منبع هنوز محدود است؛ نتیجه فعلی باید با احتیاط و به‌عنوان ارزیابی مقدماتی استفاده شود.`
    );
  }

  if (
    typeof ml?.negativeShare ===
      "number" &&
    ml.negativeShare >=
      0.6
  ) {
    lines.push(
      "مدل محلی مرورگر در بخش بزرگی از متن شواهد لحن منفی تشخیص داده است؛ این یک سیگنال زبانی است و نباید به‌تنهایی معادل افزایش واقعی تهدید تلقی شود."
    );
  }

  return lines.join(
    "\n\n"
  );
}


function buildScenarios(
  evidence:
    DraftEngineEvidence[]
): RasadyarStructuredAssessment["scenarios"] {
  const alerts =
    evidence.filter(
      (
        item
      ) =>
        item.kind ===
        "alert"
    ).length;

  const sourceCount =
    unique(
      evidence.map(
        (
          item
        ) =>
          item.archive?.channelName ||
          item.source
      )
    ).length;

  return {
    likely: {
      narrative:
        "در سناریوی محتمل، الگوی فعلی شواهد بدون جهش معنی‌دار در تعداد هشدارها یا تنوع منابع ادامه می‌یابد و پرونده در وضعیت پایش و اعتبارسنجی باقی می‌ماند.",

      indicators:
        [
          bullet(
            "حفظ نرخ فعلی ورود شواهد بدون افزایش محسوس."
          ),

          bullet(
            "عدم ظهور تأیید مستقل قوی که ماهیت مسئله را تغییر دهد."
          ),

          bullet(
            "ثبات محدوده جغرافیایی و موضوعی شواهد."
          ),
        ].join(
          "\n"
        ),
    },

    worst: {
      narrative:
        "در سناریوی بدبینانه، شواهد جدید از چند منبع مستقل با هشدارها یا رویدادهای مکانی همگرا می‌شوند و نیاز به بازنگری سطح ریسک و اقدام سریع‌تر ایجاد می‌شود.",

      indicators:
        [
          bullet(
            `افزایش هشدارها نسبت به مقدار فعلی (${alerts}).`
          ),

          bullet(
            `افزایش تنوع منابع مستقل فراتر از مقدار فعلی (${sourceCount}).`
          ),

          bullet(
            "همگرایی زمانی و مکانی چند شاهد درباره یک تحول واحد."
          ),
        ].join(
          "\n"
        ),
    },

    best: {
      narrative:
        "در سناریوی خوش‌بینانه، شواهد بعدی ادعاهای حساس را تأیید نمی‌کنند، شدت علائم کاهش می‌یابد و پرونده بدون گسترش دامنه تهدید به مرحله پایش عادی بازمی‌گردد.",

      indicators:
        [
          bullet(
            "کاهش یا توقف هشدارهای مرتبط."
          ),

          bullet(
            "عدم تأیید ادعاهای حساس توسط منابع مستقل."
          ),

          bullet(
            "کاهش همگرایی جغرافیایی/زمانی رویدادهای مرتبط."
          ),
        ].join(
          "\n"
        ),
    },
  };
}


function buildActions(
  evidence:
    DraftEngineEvidence[]
): RasadyarStructuredAssessment["actions"] {
  const missingArchive =
    evidence.filter(
      (
        item
      ) =>
        !item.archive?.archiveId
    ).length;

  return {
    immediate:
      [
        bullet(
          "اعتبارسنجی دو شاهد کلیدی پرونده با منابع مستقل."
        ),

        bullet(
          "ثبت منشأ، زمان و پیوند منبع برای اقلامی که فراداده ناقص دارند."
        ),
      ].join(
        "\n"
      ),

    shortTerm:
      [
        bullet(
          "پایش تداوم موضوع در منابع مستقل و ثبت شواهد جدید در همین Case."
        ),

        bullet(
          "مقایسه روند زمانی شواهد برای تشخیص افزایش، ثبات یا کاهش شدت علائم."
        ),
      ].join(
        "\n"
      ),

    mediumTerm:
      [
        bullet(
          "تکمیل خط مبنا و شاخص‌های قابل اندازه‌گیری برای موضوع پرونده."
        ),

        bullet(
          "بازنگری سناریوها پس از ورود شواهد جدید یا تغییر معنی‌دار در سطح ریسک."
        ),
      ].join(
        "\n"
      ),

    monitoringRequirements:
      [
        bullet(
          "تعداد شواهد جدید در واحد زمان."
        ),

        bullet(
          "تعداد منابع مستقل تأییدکننده یک ادعا."
        ),

        bullet(
          "تعداد هشدارها و رویدادهای مکانی مرتبط."
        ),

        missingArchive >
          0
          ? bullet(
              `تکمیل آرشیو برای ${missingArchive} شاهد فاقد Archive ID.`
            )
          : bullet(
              "حفظ قابلیت بازبینی Archive ID شواهد موجود."
            ),
      ].join(
        "\n"
      ),
  };
}


export async function generateEvidenceAnalysisDraft(
  input:
    GenerateAnalysisDraftInput
): Promise<
  RasadyarMachineAnalysisDraft
> {
  const evidence =
    newestFirst(
      input.evidence
        .filter(
          (
            item
          ) =>
            cleanText(
              item.id
            ) &&
            cleanText(
              item.title
            )
        )
        .slice(
          0,
          20
        )
    );

  if (
    evidence.length ===
    0
  ) {
    throw new Error(
      "NO_EVIDENCE"
    );
  }

  const mlSignals =
    await collectBrowserMlSignals(
      evidence
    );

  const mode:
    RasadyarMachineAnalysisDraft["engineMode"] =
      mlSignals
        ? "browser-ml-hybrid"
        : "local-grounded";

  const assessment:
    RasadyarStructuredAssessment = {
    situationSummary:
      buildSituationSummary(
        input,
        evidence
      ),

    keyPoints:
      buildKeyPoints(
        evidence
      ),

    actorsFactors:
      buildActorsFactors(
        evidence,
        mlSignals
      ),

    drivers:
      buildDrivers(
        evidence
      ),

    warningIndicators:
      buildWarningIndicators(
        evidence
      ),

    confidence:
      evidence.length >=
        4 &&
      unique(
        evidence.map(
          (
            item
          ) =>
            item.archive?.channelName ||
            item.source
        )
      ).length >=
        3
        ? "زیاد"
        : evidence.length >=
            2
          ? "متوسط"
          : "کم",

    informationGaps:
      buildInformationGaps(
        evidence
      ),

    assumptions:
      buildAssumptions(),

    implications:
      buildImplications(
        input,
        evidence
      ),

    analyticalJudgment:
      buildJudgment(
        evidence,
        mlSignals
      ),

    scenarios:
      buildScenarios(
        evidence
      ),

    actions:
      buildActions(
        evidence
      ),
  };

  const allEvidenceIds =
    evidence.map(
      (
        item
      ) =>
        item.id
    );

  const topEvidenceIds =
    allEvidenceIds.slice(
      0,
      8
    );

  const alertOrMapIds =
    evidence
      .filter(
        (
          item
        ) =>
          item.kind ===
            "alert" ||
          item.kind ===
            "map"
      )
      .map(
        (
          item
        ) =>
          item.id
      );

  const sourcedIds =
    evidence
      .filter(
        (
          item
        ) =>
          Boolean(
            cleanText(
              item.source
            ) ||
            cleanText(
              item.archive?.channelName
            )
          )
      )
      .map(
        (
          item
        ) =>
          item.id
      );

  const evidenceCitations:
    RasadyarMachineAnalysisDraft["evidenceCitations"] = {
    situationSummary:
      topEvidenceIds.slice(
        0,
        4
      ),

    keyPoints:
      topEvidenceIds,

    actorsFactors:
      (
        sourcedIds.length
          ? sourcedIds
          : topEvidenceIds
      ).slice(
        0,
        8
      ),

    drivers:
      topEvidenceIds.slice(
        0,
        6
      ),

    warningIndicators:
      (
        alertOrMapIds.length
          ? alertOrMapIds
          : topEvidenceIds
      ).slice(
        0,
        6
      ),

    informationGaps:
      topEvidenceIds,

    assumptions:
      topEvidenceIds.slice(
        0,
        5
      ),

    implications:
      topEvidenceIds,

    analyticalJudgment:
      topEvidenceIds,

    scenarios:
      topEvidenceIds,

    actions:
      topEvidenceIds,
  };

  return {
    draftId:
      createId(
        "machine-draft"
      ),

    engineVersion:
      "rasadyar-evidence-draft-v1",

    engineMode:
      mode,

    generatedAt:
      new Date().toISOString(),

    evidenceIds:
      evidence.map(
        (
          item
        ) =>
          item.id
      ),

    assessment,

    evidenceCitations,

    mlSignals:
      mlSignals
        ? {
            entityCount:
              mlSignals.entities.length,

            entities:
              mlSignals.entities,

            negativeShare:
              mlSignals.negativeShare,

            neutralShare:
              mlSignals.neutralShare,

            positiveShare:
              mlSignals.positiveShare,
          }
        : undefined,

    note:
      mlSignals
        ? "پیش‌نویس با استفاده از استخراج موجودیت و تحلیل لحن مدل محلی مرورگر، همراه با قواعد تحلیلی مبتنی بر شواهد تولید شده است. هیچ داده‌ای برای تولید این پیش‌نویس به سرویس ابری ارسال نشده است."
        : "مدل محلی مرورگر در دسترس نبود؛ پیش‌نویس با قواعد تحلیلی محلی و فقط بر پایه شواهد ثبت‌شده در پرونده تولید شده است.",
  };
}
