import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const file = path.join(
  root,
  "src",
  "components",
  "NewsPanel.ts"
);

if (!fs.existsSync(file)) {
  console.error("NewsPanel.ts پیدا نشد:");
  console.error(file);
  process.exit(1);
}

/* -------------------------
   BACKUP
------------------------- */

const backup =
  file + ".bak-analysis";

if (!fs.existsSync(backup)) {
  fs.copyFileSync(
    file,
    backup
  );

  console.log(
    "✅ Backup ساخته شد"
  );
}

/* -------------------------
   READ
------------------------- */

let code =
  fs.readFileSync(
    file,
    "utf8"
  );

/* -------------------------
   IMPORT
------------------------- */

const analysisImport = `
import { openAnalysisWithEvidence } from '@/features/analysis/analysisBridge';
`.trim();

if (
  !code.includes(
    "openAnalysisWithEvidence"
  )
) {
  const anchor =
    "import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';";

  if (!code.includes(anchor)) {
    console.error(
      "❌ محل import پیدا نشد"
    );

    process.exit(1);
  }

  code =
    code.replace(
      anchor,
      `${anchor}
${analysisImport}`
    );

  console.log(
    "✅ analysisBridge اضافه شد"
  );
}

/* -------------------------
   HELPER METHODS
------------------------- */

const helperMethods = `

  private canAddToAnalysis(): boolean {
    try {
      const user = JSON.parse(
        localStorage.getItem(
          'rasadyar_user'
        ) || 'null'
      );

      return (
        user?.role ===
          'superadmin' ||
        user?.role ===
          'analyst'
      );
    } catch {
      return false;
    }
  }

  private renderAnalysisButton(
    link: string
  ): string {

    if (
      !this.canAddToAnalysis()
    ) {
      return '';
    }

    return \`
      <button
        type="button"

        class="item-analysis-btn"

        data-news-link="\${escapeHtml(
          link
        )}"

        title="افزودن این خبر به مرکز تحلیل"

        style="
          margin-inline-start:6px;
          padding:4px 8px;

          border:
            1px solid #22c55e;

          border-radius:5px;

          background:#14532d;

          color:#fff;

          cursor:pointer;

          font-size:11px;

          font-family:inherit;
        "
      >
        افزودن به تحلیل
      </button>
    \`;
  }

  private addNewsToAnalysis(
    link: string
  ): void {

    const item =
      this.lastRawItems?.find(
        (news) =>
          news.link === link
      );

    if (item) {
      openAnalysisWithEvidence({
        kind: 'news',

        title:
          item.title,

        source:
          item.source,

        url:
          item.link,

        timestamp:
          item.pubDate,

        summary:
          item.snippet ||
          \`خبر منتشرشده توسط \${item.source}\`
      });

      return;
    }

    const cluster =
      this.lastRawClusters?.find(
        (c) =>
          c.primaryLink === link ||
          c.allItems.some(
            (news) =>
              news.link === link
          )
      );

    if (!cluster) {

      console.warn(
        '[NewsPanel] خبر برای تحلیل پیدا نشد:',
        link
      );

      return;
    }

    const primaryItem =
      cluster.allItems.find(
        (news) =>
          news.link ===
          cluster.primaryLink
      ) ||
      cluster.allItems[0];

    openAnalysisWithEvidence({
      kind: 'news',

      title:
        cluster.primaryTitle,

      source:
        cluster.primarySource,

      url:
        cluster.primaryLink,

      timestamp:
        cluster.lastUpdated
          .toISOString(),

      summary:
        primaryItem?.snippet ||
        \`خبر خوشه‌بندی‌شده از \${cluster.primarySource}\`
    });
  }

`;

/* قبل از renderFlat اضافه می‌کنیم */

if (
  !code.includes(
    "private canAddToAnalysis()"
  )
) {

  const marker =
    "  private renderFlat(items: NewsItem[]): void {";

  if (
    !code.includes(marker)
  ) {
    console.error(
      "❌ renderFlat پیدا نشد"
    );

    process.exit(1);
  }

  code =
    code.replace(
      marker,
      helperMethods +
      marker
    );

  console.log(
    "✅ توابع تحلیل اضافه شدند"
  );
}

/* -------------------------
   ADD BUTTON TO FLAT NEWS
------------------------- */

if (
  !code.includes(
    "${this.renderAnalysisButton(item.link)}"
  )
) {

  const timeMarker =
    "${formatTime(item.pubDate)}";

  const position =
    code.indexOf(
      timeMarker
    );

  if (position === -1) {

    console.error(
      "❌ بخش زمان خبر پیدا نشد"
    );

    process.exit(1);
  }

  /*
   فقط اولین formatTime بعد
   از renderFlat را تغییر می‌دهیم
  */

  const before =
    code.substring(
      0,
      position
    );

  const after =
    code.substring(
      position +
      timeMarker.length
    );

  code =
    before +
    timeMarker +
    `

          \${this.renderAnalysisButton(
            item.link
          )}
` +
    after;

  console.log(
    "✅ دکمه به اخبار اضافه شد"
  );
}

/* -------------------------
   CLICK HANDLER
------------------------- */

const handlerSearch =
  "const target = e.target as HTMLElement;";

if (
  !code.includes(
    "item-analysis-btn"
  )
) {

  console.error(
    "❌ دکمه تحلیل ایجاد نشده"
  );

  process.exit(1);
}

/*
 اگر Handler قبلاً اضافه نشده
*/

if (
  !code.includes(
    "analysisBtn.dataset.newsLink"
  )
) {

  const index =
    code.indexOf(
      handlerSearch
    );

  if (index === -1) {

    console.warn(
      "⚠️ setupContentDelegation پیدا نشد."
    );

  } else {

    const replacement = `const target = e.target as HTMLElement;

      /*
       * افزودن خبر به مرکز تحلیل
       */

      const analysisBtn =
        target.closest<HTMLElement>(
          '.item-analysis-btn'
        );

      if (analysisBtn) {

        e.preventDefault();

        e.stopPropagation();

        const link =
          analysisBtn.dataset
            .newsLink;

        if (link) {
          this.addNewsToAnalysis(
            link
          );
        }

        return;
      }`;

    code =
      code.replace(
        handlerSearch,
        replacement
      );

    console.log(
      "✅ کلیک دکمه فعال شد"
    );
  }
}

/* -------------------------
   SAVE
------------------------- */

fs.writeFileSync(
  file,
  code,
  "utf8"
);

console.log("");
console.log(
  "🎉 NewsPanel.ts اصلاح شد"
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
  "حالا مرورگر را با Ctrl+Shift+R رفرش کن."
);