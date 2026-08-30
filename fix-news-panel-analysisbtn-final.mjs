import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const file = path.join(
  projectRoot,
  "src",
  "components",
  "NewsPanel.ts"
);

if (!fs.existsSync(file)) {
  console.error("❌ NewsPanel.ts پیدا نشد:");
  console.error(file);
  console.error("اسکریپت را از پوشه‌ای اجرا کنید که package.json داخل آن است.");
  process.exit(1);
}

const backup =
  `${file}.bak-before-final-analysisbtn-fix`;

if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
  console.log("✅ Backup ساخته شد:");
  console.log(backup);
}

let src = fs.readFileSync(file, "utf8");
const original = src;

/*
 * خطایی که در تصویر دیده می‌شود ناشی از تعریف دوباره analysisBtn
 * در همان scope است. این الگو فقط handler دکمه خبر متنی را هدف می‌گیرد:
 *
 * const analysisBtn =
 *   target.closest<HTMLElement>('.item-analysis-btn');
 *
 * و آن را به newsAnalysisBtn تغییر می‌دهد.
 */

const declarationRegex =
  /const\s+analysisBtn\s*=\s*target\.closest<HTMLElement>\(\s*['"]\.item-analysis-btn['"]\s*\)\s*;/g;

let count = 0;

src = src.replace(
  declarationRegex,
  () => {
    count += 1;
    return `const newsAnalysisBtn =
        target.closest<HTMLElement>('.item-analysis-btn');`;
  }
);

/*
 * حالا فقط در بلوک نزدیک همان selector، ارجاعات analysisBtn
 * را به newsAnalysisBtn تغییر می‌دهیم.
 */
const selector = ".item-analysis-btn";
let searchFrom = 0;

while (true) {
  const selectorIndex = src.indexOf(selector, searchFrom);
  if (selectorIndex === -1) break;

  const declarationIndex = src.lastIndexOf(
    "const newsAnalysisBtn",
    selectorIndex
  );

  if (declarationIndex === -1) {
    searchFrom = selectorIndex + selector.length;
    continue;
  }

  const nextReturn = src.indexOf(
    "return;",
    selectorIndex
  );

  if (nextReturn === -1) {
    searchFrom = selectorIndex + selector.length;
    continue;
  }

  const blockEnd =
    nextReturn + "return;".length;

  const before = src.slice(0, declarationIndex);
  let block = src.slice(declarationIndex, blockEnd);
  const after = src.slice(blockEnd);

  block = block
    .replace(/\bif\s*\(\s*analysisBtn\s*\)/g, "if (newsAnalysisBtn)")
    .replace(/\banalysisBtn\.dataset\b/g, "newsAnalysisBtn.dataset")
    .replace(/\banalysisBtn\b/g, "newsAnalysisBtn");

  src = before + block + after;

  searchFrom =
    declarationIndex + block.length;
}

/*
 * اگر declaration با فرمت دیگری وجود داشت، یک fallback محدود اجرا کن.
 */
if (count === 0 && src.includes(".item-analysis-btn")) {
  const fallback =
    /const\s+analysisBtn\b([\s\S]{0,180}?\.item-analysis-btn[\s\S]{0,420}?return;)/;

  const match = src.match(fallback);

  if (match) {
    const full = match[0];
    const fixed = full.replace(
      /\banalysisBtn\b/g,
      "newsAnalysisBtn"
    );

    src = src.replace(full, fixed);
    count = 1;
  }
}

if (count === 0) {
  console.error("");
  console.error("❌ بلوک مشکل‌دار پیدا نشد.");
  console.error("هیچ تغییری در NewsPanel.ts انجام نشد.");
  console.error("فایل فعلی NewsPanel.ts را ارسال کنید تا مستقیم اصلاح شود.");
  process.exit(1);
}

/*
 * کنترل ساده: نباید همان selector هنوز با const analysisBtn همراه باشد.
 */
const stillBad =
  /const\s+analysisBtn\s*=[\s\S]{0,120}?\.item-analysis-btn/.test(src);

if (stillBad) {
  console.error("");
  console.error("❌ هنوز یک تعریف تکراری analysisBtn برای .item-analysis-btn باقی مانده است.");
  console.error("فایل به حالت قبل برگردانده شد.");
  fs.writeFileSync(file, original, "utf8");
  process.exit(1);
}

fs.writeFileSync(file, src, "utf8");

console.log("");
console.log("✅ NewsPanel.ts اصلاح شد.");
console.log(`✅ ${count} بلوک مربوط به دکمه تحلیل خبر اصلاح شد.`);
console.log("✅ analysisBtn مخصوص NewsPanel به newsAnalysisBtn تغییر نام یافت.");
console.log("");
console.log("حالا اجرا کنید:");
console.log("npm.cmd run build");
console.log("npm.cmd run dev");
console.log("");
console.log("سپس Chrome:");
console.log("Ctrl + Shift + R");
console.log("");
