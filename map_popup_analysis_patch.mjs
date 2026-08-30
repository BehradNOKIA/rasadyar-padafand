import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const target = path.join(
  root,
  "src",
  "components",
  "MapPopup.ts"
);

const bridge = path.join(
  root,
  "src",
  "features",
  "analysis",
  "analysisBridge.ts"
);

/* =========================================
   CHECK FILES
========================================= */

if (!fs.existsSync(target)) {
  console.error("❌ MapPopup.ts پیدا نشد:");
  console.error(target);
  process.exit(1);
}

if (!fs.existsSync(bridge)) {
  console.error("❌ analysisBridge.ts پیدا نشد:");
  console.error(bridge);
  process.exit(1);
}

/* =========================================
   BACKUP
========================================= */

const backup =
  target + ".bak-analysis-map";

if (!fs.existsSync(backup)) {
  fs.copyFileSync(
    target,
    backup
  );

  console.log(
    "✅ Backup ساخته شد"
  );
}

/* =========================================
   READ MAPPOPUP
========================================= */

let code = fs.readFileSync(
  target,
  "utf8"
);

/* =========================================
   IMPORT
========================================= */

const analysisImport =
  "import { openAnalysisWithEvidence } from '@/features/analysis/analysisBridge';";

if (
  !code.includes(
    analysisImport
  )
) {
  const anchor =
    "import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';";

  if (code.includes(anchor)) {
    code = code.replace(
      anchor,
      `${anchor}
${analysisImport}`
    );
  } else {
    const imports =
      [...code.matchAll(
        /^import .*;$/gm
      )];

    if (!imports.length) {
      console.error(
        "❌ محل Import پیدا نشد"
      );

      process.exit(1);
    }

    const last =
      imports[
        imports.length - 1
      ];

    const end =
      last.index +
      last[0].length;

    code =
      code.slice(0, end) +
      "\n" +
      analysisImport +
      code.slice(end);
  }

  console.log(
    "✅ Import مرکز تحلیل اضافه شد"
  );
}

/* =========================================
   HELPER METHODS
========================================= */

const showMarker =
  "  public show(data: PopupData): void {";

const helperMethods = `

  private canAddPopupToAnalysis(): boolean {
    try {
      const user = JSON.parse(
        localStorage.getItem(
          'rasadyar_user'
        ) || 'null'
      );

      return (
        user?.role === 'superadmin' ||
        user?.role === 'analyst'
      );
    } catch {
      return false;
    }
  }

  private appendAnalysisButton(
    data: PopupData
  ): void {

    if (
      !this.popup ||
      !this.canAddPopupToAnalysis()
    ) {
      return;
    }

    /*
     * PopupData در لایه‌های مختلف
     * ممکن است ساختار متفاوتی داشته باشد.
     * بنابراین داده را به شکل عمومی
     * بررسی می‌کنیم.
     */

    const raw =
      data as unknown as
      Record<string, unknown>;

    const asRecord = (
      value: unknown
    ): Record<string, unknown> => {

      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        return value as
          Record<string, unknown>;
      }

      return {};
    };

    const payload =
      asRecord(raw['data']);

    const properties =
      asRecord(
        payload['properties'] ??
        raw['properties']
      );

    const location =
      asRecord(
        payload['location'] ??
        raw['location']
      );

    const position =
      asRecord(
        payload['position'] ??
        raw['position']
      );

    const geometry =
      asRecord(
        payload['geometry'] ??
        raw['geometry']
      );

    const values = {
      ...properties,
      ...payload,
      ...raw,
    };

    /* -----------------------
       HELPERS
    ----------------------- */

    const pickString = (
      ...candidates: unknown[]
    ): string | undefined => {

      for (
        const candidate
        of candidates
      ) {
        if (
          typeof candidate ===
            'string' &&
          candidate.trim()
        ) {
          return candidate.trim();
        }
      }

      return undefined;
    };

    const pickNumber = (
      ...candidates: unknown[]
    ): number | undefined => {

      for (
        const candidate
        of candidates
      ) {
        if (
          typeof candidate ===
            'number' &&
          Number.isFinite(
            candidate
          )
        ) {
          return candidate;
        }

        if (
          typeof candidate ===
            'string' &&
          candidate.trim()
        ) {
          const number =
            Number(candidate);

          if (
            Number.isFinite(
              number
            )
          ) {
            return number;
          }
        }
      }

      return undefined;
    };

    const normalizeTime = (
      candidate: unknown
    ): string | undefined => {

      if (
        candidate instanceof Date
      ) {
        return candidate
          .toISOString();
      }

      if (
        typeof candidate ===
        'number'
      ) {

        const ms =
          candidate <
            10000000000
            ? candidate * 1000
            : candidate;

        const date =
          new Date(ms);

        if (
          !Number.isNaN(
            date.getTime()
          )
        ) {
          return date
            .toISOString();
        }
      }

      if (
        typeof candidate ===
          'string' &&
        candidate.trim()
      ) {

        const date =
          new Date(candidate);

        if (
          !Number.isNaN(
            date.getTime()
          )
        ) {
          return date
            .toISOString();
        }

        return candidate;
      }

      return undefined;
    };

    /* -----------------------
       RELATED NEWS
    ----------------------- */

    const relatedNewsRaw =
      raw['relatedNews'];

    const relatedNews =
      Array.isArray(
        relatedNewsRaw
      )
        ? relatedNewsRaw
        : [];

    const firstNews =
      asRecord(
        relatedNews[0]
      );

    /* -----------------------
       TITLE
    ----------------------- */

    const title =
      pickString(
        values['title'],
        values['name'],
        values['headline'],
        values['eventName'],
        values['label'],
        values['city']
      ) ||
      'رویداد نقشه';

    /* -----------------------
       SOURCE
    ----------------------- */

    const source =
      pickString(
        values['source'],
        values['provider'],
        values['agency'],
        values['operator'],
        values['organization'],
        firstNews['source']
      );

    /* -----------------------
       COUNTRY / REGION
    ----------------------- */

    const country =
      pickString(
        values['country'],
        values['countryName'],
        location['country'],
        properties['country']
      );

    const region =
      pickString(
        values['region'],
        values['area'],
        values['state'],
        values['province'],
        location['region']
      );

    /* -----------------------
       COORDINATES
    ----------------------- */

    let lat =
      pickNumber(
        values['lat'],
        values['latitude'],
        location['lat'],
        location['latitude'],
        position['lat'],
        position['latitude']
      );

    let lon =
      pickNumber(
        values['lon'],
        values['lng'],
        values['longitude'],
        location['lon'],
        location['lng'],
        location['longitude'],
        position['lon'],
        position['lng'],
        position['longitude']
      );

    const coordinates =
      Array.isArray(
        geometry[
          'coordinates'
        ]
      )
        ? geometry[
            'coordinates'
          ] as unknown[]
        : Array.isArray(
            values[
              'coordinates'
            ]
          )
        ? values[
            'coordinates'
          ] as unknown[]
        : [];

    /*
     * GeoJSON:
     * [longitude, latitude]
    */

    if (
      (
        lat === undefined ||
        lon === undefined
      ) &&
      coordinates.length >= 2
    ) {

      const geoLon =
        pickNumber(
          coordinates[0]
        );

      const geoLat =
        pickNumber(
          coordinates[1]
        );

      if (
        geoLat !== undefined &&
        geoLon !== undefined
      ) {
        lat = geoLat;
        lon = geoLon;
      }
    }

    /* -----------------------
       TIME
    ----------------------- */

    const timestamp =
      normalizeTime(
        values['timestamp'] ??
        values['time'] ??
        values['date'] ??
        values['datetime'] ??
        values['updatedAt'] ??
        values['startTime'] ??
        values['startDate'] ??
        firstNews['pubDate']
      ) ||
      new Date()
        .toISOString();

    /* -----------------------
       SUMMARY
    ----------------------- */

    const summary =
      pickString(
        values['description'],
        values['summary'],
        values['details'],
        values['message'],
        values['status'],
        firstNews['snippet']
      ) ||
      'رویداد مکانی ثبت‌شده در سامانه رصدیار پدافند غیرعامل.';

    /* -----------------------
       URL
    ----------------------- */

    const url =
      pickString(
        values['url'],
        values['link'],
        values['website'],
        firstNews['link']
      );

    /* =======================
       BUTTON CONTAINER
    ======================= */

    const actions =
      document.createElement(
        'div'
      );

    actions.className =
      'rasadyar-map-analysis-actions';

    actions.style.cssText = \`
      display:flex;
      justify-content:flex-start;
      align-items:center;
      gap:8px;

      margin-top:10px;
      padding-top:8px;

      border-top:
        1px solid
        rgba(255,255,255,.12);

      direction:rtl;
    \`;

    /* =======================
       BUTTON
    ======================= */

    const button =
      document.createElement(
        'button'
      );

    button.type =
      'button';

    button.textContent =
      'افزودن به تحلیل';

    button.title =
      'ارسال این رویداد به مرکز تحلیل';

    button.style.cssText = \`
      padding:7px 11px;

      border:
        1px solid #22c55e;

      border-radius:6px;

      background:#14532d;

      color:#ffffff;

      cursor:pointer;

      font-family:inherit;

      font-size:12px;
    \`;

    button.addEventListener(
      'mouseenter',
      () => {
        button.style.background =
          '#166534';
      }
    );

    button.addEventListener(
      'mouseleave',
      () => {
        button.style.background =
          '#14532d';
      }
    );

    /* =======================
       SEND TO ANALYSIS
    ======================= */

    button.addEventListener(
      'click',
      (event) => {

        event.preventDefault();

        event.stopPropagation();

        openAnalysisWithEvidence({
          kind: 'map',

          title,

          source,

          url,

          country,

          region,

          lat,

          lon,

          timestamp,

          summary
        });
      }
    );

    actions.appendChild(
      button
    );

    this.popup.appendChild(
      actions
    );
  }

`;

if (
  !code.includes(
    "private appendAnalysisButton("
  )
) {
  if (
    !code.includes(
      showMarker
    )
  ) {
    console.error(
      "❌ تابع show در MapPopup پیدا نشد"
    );

    process.exit(1);
  }

  code =
    code.replace(
      showMarker,
      helperMethods +
      showMarker
    );

  console.log(
    "✅ توابع اتصال نقشه به تحلیل اضافه شد"
  );
}

/* =========================================
   CALL BUTTON INSIDE SHOW()
========================================= */

const positionMarker =
  "    // Get container's viewport position for absolute positioning";

if (
  !code.includes(
    "this.appendAnalysisButton(data);"
  )
) {

  if (
    !code.includes(
      positionMarker
    )
  ) {
    console.error(
      "❌ محل مناسب در show() پیدا نشد"
    );

    process.exit(1);
  }

  code =
    code.replace(
      positionMarker,
      `    this.appendAnalysisButton(data);

${positionMarker}`
    );

  console.log(
    "✅ دکمه به MapPopup متصل شد"
  );
}

/* =========================================
   SAVE
========================================= */

fs.writeFileSync(
  target,
  code,
  "utf8"
);

console.log("");
console.log(
  "🎉 MapPopup.ts اصلاح شد"
);

console.log("");
console.log(
  "Backup:"
);

console.log(
  backup
);

console.log("");
console.log(
  "مرحله بعد:"
);

console.log(
  "npm.cmd run build"
);