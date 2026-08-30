import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const target = path.join(
  root,
  "src",
  "components",
  "NewsPanel.ts"
);

const sourceIntake = path.join(
  root,
  "src",
  "features",
  "analysis",
  "sourceIntake.ts"
);

if (!fs.existsSync(target)) {
  console.error("");
  console.error("❌ فایل NewsPanel.ts پیدا نشد:");
  console.error(target);
  console.error("");
  console.error("این فایل را از ریشه پروژه اجرا کنید.");
  process.exit(1);
}

if (!fs.existsSync(sourceIntake)) {
  console.error("");
  console.error("❌ فایل P4 Source Intake پیدا نشد:");
  console.error(sourceIntake);
  console.error("");
  console.error("ابتدا P4-Step1 را نصب کنید.");
  process.exit(1);
}

const backup =
  `${target}.bak-before-news-analysis`;

if (!fs.existsSync(backup)) {
  fs.copyFileSync(
    target,
    backup
  );

  console.log(
    "✅ Backup:",
    backup
  );
}

let src =
  fs.readFileSync(
    target,
    "utf8"
  );

let changed =
  false;


/* =========================================================
   1) Import unified Source Intake
========================================================= */

const intakeImport =
  "import { openAnalysisWithSourceObservation } from '@/features/analysis/sourceIntake';";

if (!src.includes(intakeImport)) {
  const preferredAnchor =
    "import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';";

  if (src.includes(preferredAnchor)) {
    src =
      src.replace(
        preferredAnchor,
        `${preferredAnchor}\n${intakeImport}`
      );

    changed =
      true;
  } else {
    const firstImportBlock =
      src.match(
        /^(?:import[\s\S]*?;\s*)+/m
      );

    if (!firstImportBlock) {
      console.error(
        "❌ محل امنی برای افزودن import پیدا نشد."
      );

      process.exit(1);
    }

    src =
      src.replace(
        firstImportBlock[0],
        `${firstImportBlock[0]}${intakeImport}\n`
      );

    changed =
      true;
  }
}


/* =========================================================
   2) Raw-news caches used by delegated click handling
========================================================= */

if (
  !src.includes(
    "private lastRawItems:"
  )
) {
  const classAnchor =
    /export class NewsPanel[^{]*\{/;

  const match =
    src.match(
      classAnchor
    );

  if (!match) {
    console.error(
      "❌ کلاس NewsPanel پیدا نشد."
    );

    process.exit(1);
  }

  src =
    src.replace(
      match[0],
      `${match[0]}
  private lastRawItems: NewsItem[] = [];
  private lastRawClusters: NewsCluster[] = [];
`
    );

  changed =
    true;
}


/* =========================================================
   3) Helper methods
========================================================= */

if (
  !src.includes(
    "private renderAnalysisButton("
  )
) {
  const helperAnchor =
    "  private renderFlat(";

  if (!src.includes(helperAnchor)) {
    console.error(
      "❌ تابع renderFlat در NewsPanel پیدا نشد."
    );

    process.exit(1);
  }

  const helpers = `  private canAddToAnalysis(): boolean {
    try {
      const user = JSON.parse(
        localStorage.getItem('rasadyar_user') || 'null'
      );

      return (
        user?.role === 'superadmin' ||
        user?.role === 'analyst'
      );
    } catch {
      return false;
    }
  }

  private cleanAnalysisText(value: unknown): string {
    const raw =
      String(value ?? '');

    try {
      const textarea =
        document.createElement('textarea');

      textarea.innerHTML =
        raw;

      return (
        textarea.value ||
        textarea.textContent ||
        raw
      )
        .replace(/<[^>]*>/g, ' ')
        .replace(/\\u00a0/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\\s+/g, ' ')
        .trim();
    } catch {
      return raw
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\\s+/g, ' ')
        .trim();
    }
  }

  private renderAnalysisButton(link: string): string {
    if (!this.canAddToAnalysis()) {
      return '';
    }

    return \`
      <button
        type="button"
        class="item-analysis-btn"
        data-news-link="\${escapeHtml(link)}"
        title="افزودن این خبر به مرکز تحلیل"
        aria-label="افزودن این خبر به مرکز تحلیل"
        style="
          margin-inline-start:6px;
          padding:3px 7px;
          border:1px solid rgba(34,197,94,.65);
          border-radius:5px;
          background:rgba(20,83,45,.88);
          color:#dcfce7;
          cursor:pointer;
          font-size:10px;
          line-height:1.4;
          font-family:inherit;
          white-space:nowrap;
        "
      >
        + تحلیل
      </button>
    \`;
  }

  private addNewsToAnalysis(link: string): void {
    const flatItem =
      this.lastRawItems?.find(
        (item) =>
          item.link === link
      );

    if (flatItem) {
      openAnalysisWithSourceObservation({
        kind: 'news',

        title:
          this.cleanAnalysisText(
            flatItem.title
          ),

        provider:
          this.cleanAnalysisText(
            flatItem.source
          ) || 'News',

        source:
          this.cleanAnalysisText(
            flatItem.source
          ),

        url:
          flatItem.link,

        observedAt:
          flatItem.pubDate,

        summary:
          this.cleanAnalysisText(
            flatItem.snippet ||
            \`خبر منتشرشده توسط \${flatItem.source}\`
          ),

        observationType:
          'news-item',

        tags:
          [
            'news',
            flatItem.isAlert
              ? 'alert'
              : 'standard',
          ],
      });

      return;
    }

    const cluster =
      this.lastRawClusters?.find(
        (item) =>
          item.primaryLink === link ||
          item.allItems.some(
            (news) =>
              news.link === link
          )
      );

    if (!cluster) {
      console.warn(
        '[NewsPanel] News item not found for analysis:',
        link
      );

      return;
    }

    const primaryItem =
      cluster.allItems.find(
        (item) =>
          item.link ===
          cluster.primaryLink
      ) ||
      cluster.allItems[0];

    openAnalysisWithSourceObservation({
      kind: 'news',

      title:
        this.cleanAnalysisText(
          cluster.primaryTitle
        ),

      provider:
        this.cleanAnalysisText(
          cluster.primarySource
        ) || 'News',

      source:
        this.cleanAnalysisText(
          cluster.primarySource
        ),

      url:
        cluster.primaryLink,

      observedAt:
        cluster.lastUpdated.toISOString(),

      summary:
        this.cleanAnalysisText(
          primaryItem?.snippet ||
          \`خبر خوشه‌بندی‌شده از \${cluster.primarySource}\`
        ),

      observationType:
        'news-cluster',

      metadata: {
        clusterSize:
          cluster.allItems.length,
      },

      tags:
        [
          'news',
          'cluster',
        ],
    });
  }

`;

  src =
    src.replace(
      helperAnchor,
      `${helpers}${helperAnchor}`
    );

  changed =
    true;
}


/* =========================================================
   4) Cache raw flat items
========================================================= */

if (
  !src.includes(
    "this.lastRawItems = items;"
  )
) {
  const flatStart =
    "  private renderFlat(items: NewsItem[]): void {";

  if (!src.includes(flatStart)) {
    console.error(
      "❌ امضای renderFlat با نسخه مورد انتظار همخوان نیست."
    );

    process.exit(1);
  }

  src =
    src.replace(
      flatStart,
      `${flatStart}
    this.lastRawItems = items;`
    );

  changed =
    true;
}


/* =========================================================
   5) Cache raw clusters
========================================================= */

if (
  !src.includes(
    "this.lastRawClusters = clusters;"
  )
) {
  const clusterSignatures = [
    "  private renderClusters(clusters: NewsCluster[]): void {",
    "  private renderClusters(clusters: NewsCluster[],",
  ];

  let patched =
    false;

  for (
    const signature of
    clusterSignatures
  ) {
    if (
      src.includes(
        signature
      )
    ) {
      src =
        src.replace(
          signature,
          `${signature}
    this.lastRawClusters = clusters;`
        );

      patched =
        true;
      changed =
        true;

      break;
    }
  }

  if (!patched) {
    console.warn(
      "⚠️ renderClusters signature پیدا نشد؛ Cache خوشه‌ها ممکن است نیازمند بررسی دستی باشد."
    );
  }
}


/* =========================================================
   6) Add button to flat news cards
========================================================= */

if (
  !src.includes(
    "${this.renderAnalysisButton(item.link)}"
  )
) {
  const flatPattern =
    /(<div class="item-time">[\s\S]*?\$\{formatTime\(item\.pubDate\)\}[\s\S]*?)(<\/div>)/;

  const match =
    src.match(
      flatPattern
    );

  if (!match) {
    console.error(
      "❌ محل item-time برای خبرهای معمولی پیدا نشد."
    );

    process.exit(1);
  }

  const replacement =
    `${match[1]}

          \${this.renderAnalysisButton(item.link)}
        ${match[2]}`;

  src =
    src.replace(
      match[0],
      replacement
    );

  changed =
    true;
}


/* =========================================================
   7) Add button to clustered news cards
========================================================= */

if (
  !src.includes(
    "${this.renderAnalysisButton(cluster.primaryLink)}"
  )
) {
  const knownClusterTranslation =
    "${getCurrentLanguage() !== 'en' ? `<button class=\"item-translate-btn\" title=\"Translate\" data-text=\"${escapeHtml(cluster.primaryTitle)}\">文</button>` : ''}";

  if (
    src.includes(
      knownClusterTranslation
    )
  ) {
    src =
      src.replace(
        knownClusterTranslation,
        `${knownClusterTranslation}
          \${this.renderAnalysisButton(cluster.primaryLink)}`
      );

    changed =
      true;
  } else {
    const clusterTimePattern =
      /(<div class="item-time">[\s\S]*?cluster[\s\S]*?)(<\/div>)/;

    const match =
      src.match(
        clusterTimePattern
      );

    if (match) {
      src =
        src.replace(
          match[0],
          `${match[1]}
          \${this.renderAnalysisButton(cluster.primaryLink)}
        ${match[2]}`
        );

      changed =
        true;
    } else {
      console.warn(
        "⚠️ محل دکمه در کارت Cluster پیدا نشد؛ خبرهای معمولی همچنان اصلاح شدند."
      );
    }
  }
}


/* =========================================================
   8) Delegated click handling
========================================================= */

if (
  !src.includes(
    "target.closest<HTMLElement>('.item-analysis-btn')"
  )
) {
  const delegationMarker =
    "const target = e.target as HTMLElement;";

  if (!src.includes(delegationMarker)) {
    console.error(
      "❌ setupContentDelegation پیدا نشد."
    );

    process.exit(1);
  }

  const delegationBlock = `const target = e.target as HTMLElement;

      const analysisBtn =
        target.closest<HTMLElement>('.item-analysis-btn');

      if (analysisBtn) {
        e.preventDefault();
        e.stopPropagation();

        const link =
          analysisBtn.dataset.newsLink;

        if (link) {
          this.addNewsToAnalysis(
            link
          );
        }

        return;
      }`;

  src =
    src.replace(
      delegationMarker,
      delegationBlock
    );

  changed =
    true;
}


/* =========================================================
   9) Save
========================================================= */

if (!changed) {
  console.log("");
  console.log(
    "ℹ️ NewsPanel.ts قبلاً اصلاح شده است؛ تغییری لازم نبود."
  );
  console.log("");

  process.exit(0);
}

fs.writeFileSync(
  target,
  src,
  "utf8"
);

console.log("");
console.log(
  "✅ NewsPanel.ts اصلاح شد."
);
console.log(
  "✅ دکمه «+ تحلیل» به خبرهای متنی اضافه شد."
);
console.log(
  "✅ admin/superadmin و analyst مجاز هستند."
);
console.log(
  "✅ Viewer دکمه را نمی‌بیند."
);
console.log(
  "✅ متن خبر قبل از ورود به تحلیل از HTML Entityهایی مثل &nbsp; پاک می‌شود."
);
console.log(
  "✅ ورودی از P4 Unified Source Intake عبور می‌کند."
);
console.log("");
console.log(
  "Backup:",
  backup
);
console.log("");
console.log(
  "حالا اجرا کنید:"
);
console.log(
  "npm.cmd run build"
);
console.log(
  "npm.cmd run dev"
);
console.log(
  "و مرورگر را با Ctrl+Shift+R رفرش کنید."
);
