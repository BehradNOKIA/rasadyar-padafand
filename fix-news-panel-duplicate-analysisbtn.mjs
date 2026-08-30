import fs from "node:fs";
import path from "node:path";

const target = path.join(
  process.cwd(),
  "src",
  "components",
  "NewsPanel.ts"
);

if (!fs.existsSync(target)) {
  console.error("");
  console.error("❌ فایل پیدا نشد:");
  console.error(target);
  console.error("");
  console.error("اسکریپت را از ریشه پروژه، یعنی پوشه دارای package.json اجرا کنید.");
  process.exit(1);
}

const backup =
  `${target}.bak-before-duplicate-analysisbtn-fix`;

if (!fs.existsSync(backup)) {
  fs.copyFileSync(
    target,
    backup
  );
  console.log("✅ Backup:", backup);
}

let src =
  fs.readFileSync(
    target,
    "utf8"
  );

const oldBlock = `      const analysisBtn =
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

const newBlock = `      const newsAnalysisBtn =
        target.closest<HTMLElement>('.item-analysis-btn');

      if (newsAnalysisBtn) {
        e.preventDefault();
        e.stopPropagation();

        const link =
          newsAnalysisBtn.dataset.newsLink;

        if (link) {
          this.addNewsToAnalysis(
            link
          );
        }

        return;
      }`;

if (src.includes(oldBlock)) {
  src =
    src.replace(
      oldBlock,
      newBlock
    );

  fs.writeFileSync(
    target,
    src,
    "utf8"
  );

  console.log("");
  console.log("✅ تداخل analysisBtn اصلاح شد.");
  console.log("✅ متغیر افزوده‌شده به newsAnalysisBtn تغییر نام یافت.");
  console.log("✅ منطق قبلی NewsPanel دست‌نخورده باقی ماند.");
  console.log("");
  console.log("حالا اجرا کنید:");
  console.log("npm.cmd run build");
  console.log("npm.cmd run dev");
  console.log("");
  process.exit(0);
}

/*
 * Fallback:
 * If formatting changed but the injected selector still exists,
 * rename only the declaration and references inside the small injected block.
 */
const marker =
  "target.closest<HTMLElement>('.item-analysis-btn')";

const markerIndex =
  src.indexOf(marker);

if (markerIndex === -1) {
  console.error("");
  console.error("❌ بلوک افزوده‌شده برای .item-analysis-btn پیدا نشد.");
  console.error("فایل NewsPanel.ts را برای اصلاح دقیق ارسال کنید.");
  process.exit(1);
}

const blockStart =
  Math.max(
    0,
    src.lastIndexOf(
      "const analysisBtn",
      markerIndex
    )
  );

const nextReturn =
  src.indexOf(
    "return;",
    markerIndex
  );

if (
  blockStart <= 0 ||
  nextReturn === -1
) {
  console.error("");
  console.error("❌ محدوده امن برای اصلاح خودکار پیدا نشد.");
  console.error("فایل NewsPanel.ts را ارسال کنید.");
  process.exit(1);
}

const blockEnd =
  nextReturn +
  "return;".length;

const before =
  src.slice(
    0,
    blockStart
  );

let block =
  src.slice(
    blockStart,
    blockEnd
  );

const after =
  src.slice(
    blockEnd
  );

block =
  block
    .replace(
      /const analysisBtn/g,
      "const newsAnalysisBtn"
    )
    .replace(
      /\banalysisBtn\b/g,
      "newsAnalysisBtn"
    );

src =
  `${before}${block}${after}`;

fs.writeFileSync(
  target,
  src,
  "utf8"
);

console.log("");
console.log("✅ اصلاح Fallback انجام شد.");
console.log("✅ فقط بلوک .item-analysis-btn تغییر نام یافت.");
console.log("");
console.log("حالا اجرا کنید:");
console.log("npm.cmd run build");
console.log("npm.cmd run dev");
console.log("");
