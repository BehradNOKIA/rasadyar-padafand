import type {
  ChinaActivityComparisonState,
  ChinaActivityContribution,
  ChinaActivityDirection,
  ChinaActivityNowcastResponse,
  ChinaActivityProxyFamily,
} from '../../shared/china-activity-nowcast';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';
import { formatIranDate } from '@/utils/persian-datetime';

const STATE_LABELS: Record<ChinaActivityComparisonState, string> = {
  agreement: 'داده رسمی و شاخص‌های جایگزین همسو هستند',
  proxy_leading_divergence: 'واگرایی با پیشتازی شاخص جایگزین',
  official_leading_divergence: 'واگرایی با پیشتازی داده رسمی',
  mixed_signals: 'سیگنال‌های ترکیبی شاخص‌های جایگزین',
  insufficient_data: 'داده قابل مقایسه کافی نیست',
};

const DIRECTION_LABELS: Record<ChinaActivityDirection, string> = {
  strengthening: 'تقویت‌شونده',
  weakening: 'تضعیف‌شونده',
  unchanged: 'بدون تغییر',
};

const FAMILY_LABELS: Record<ChinaActivityProxyFamily, string> = {
  freight: 'باربری',
  maritime: 'دریایی',
  aviation: 'هوانوردی',
  energy: 'انرژی',
  commodity: 'کالای پایه',
  corridor: 'کریدور',
  market: 'بازار',
};


function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

function formatInstant(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'زمان در دسترس نیست';
  return formatIranDate(new Date(parsed), { year: 'numeric', month: 'short', day: 'numeric' });
}

function contributionValue(contribution: ChinaActivityContribution): string {
  if (
    !contribution.included
    || contribution.transformedValue === null
    || contribution.direction === null
  ) {
    return `حذف‌شده · ${humanize(contribution.exclusionReason ?? 'در دسترس نیست')}`;
  }
  const sign = contribution.transformedValue > 0 ? '+' : '';
  return `${DIRECTION_LABELS[contribution.direction]} · ${sign}${contribution.transformedValue.toFixed(2)} ${contribution.registry.unit}`;
}

function contributionHtml(contribution: ChinaActivityContribution): string {
  const status = contribution.included && contribution.direction !== null
    ? contribution.direction
    : 'excluded';
  return `
    <article class="china-nowcast-contribution china-nowcast-contribution--${status}" data-family="${escapeHtml(contribution.family)}">
      <div class="china-nowcast-contribution__heading">
        <div>
          <span class="china-nowcast-family">${escapeHtml(FAMILY_LABELS[contribution.family])}</span>
          <h4>${escapeHtml(contribution.registry.label)}</h4>
        </div>
        <span class="china-nowcast-contribution__state">${escapeHtml(contributionValue(contribution))}</span>
      </div>
      <p>${escapeHtml(contribution.registry.decisionRationale)}</p>
      <dl>
        <div><dt>زمان مشاهده</dt><dd>${escapeHtml(contribution.observedAt ? formatInstant(contribution.observedAt) : 'ناموجود')}</dd></div>
        <div><dt>تناوب</dt><dd>${escapeHtml(contribution.registry.frequency)}</dd></div>
        <div><dt>وقفه زمانی</dt><dd>${escapeHtml(contribution.registry.lagRule.description)}</dd></div>
        <div><dt>تبدیل</dt><dd>${escapeHtml(contribution.registry.transformation.description)}</dd></div>
        <div><dt>بازه تازگی</dt><dd>${escapeHtml(`${contribution.registry.freshnessBudgetMinutes} دقیقه`)}</dd></div>
        <div><dt>منبع</dt><dd><a href="${sanitizeUrl(contribution.registry.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(contribution.registry.source.publisherName)}</a></dd></div>
      </dl>
    </article>`;
}

export function renderChinaActivityNowcastView(
  response: ChinaActivityNowcastResponse,
): string {
  const official = response.official;
  const sensitivity = response.sensitivity.map((item) => `
    <li data-sensitivity-family="${escapeHtml(item.family)}">
      <strong>${escapeHtml(FAMILY_LABELS[item.family])}</strong>
      <span>${escapeHtml(item.changesConclusion
        ? `نتیجه را تغییر می‌دهد ← ${humanize(item.stateWithoutFamily)}`
        : `پایدار ← ${humanize(item.stateWithoutFamily)}`)}</span>
    </li>`).join('');
  const limitations = response.limitations.map((limitation) =>
    `<li>${escapeHtml(limitation)}</li>`).join('');

  return `
    <div class="china-nowcast-view">
      <section class="china-nowcast-summary china-nowcast-summary--${escapeHtml(response.state)}" aria-labelledby="china-nowcast-state">
        <div>
          <span class="china-nowcast-eyebrow">${escapeHtml(response.methodVersion)}</span>
          <h3 id="china-nowcast-state">${escapeHtml(STATE_LABELS[response.state])}</h3>
          <p>${escapeHtml(`بازه مقایسه ${response.comparisonWindow.days} روزه`)} · بدون پرکردن رو‌به‌جلو · بدون درون‌یابی</p>
        </div>
        <div class="china-nowcast-confidence">
          <span>${escapeHtml(response.confidence.level)}</span>
          <strong>${escapeHtml(`${response.confidence.eligibleFamilies}/${response.confidence.totalFamilies} خانواده شاخص جایگزین واجد شرایط`)}</strong>
          <small>${escapeHtml(response.confidence.reason)}</small>
        </div>
      </section>

      <section class="china-nowcast-official" aria-label="سری رسمی مقایسه">
        <span class="china-nowcast-eyebrow">انتشار رسمی</span>
        ${official
          ? `<h4>${escapeHtml(official.label)}</h4>
             <p><strong>${escapeHtml(DIRECTION_LABELS[official.direction])}</strong> · ${escapeHtml(String(official.value))}${escapeHtml(official.unit)} · دوره ${escapeHtml(official.observationPeriod)}</p>
             <dl>
               <div><dt>نسخه داده</dt><dd>${escapeHtml(official.vintageId)}</dd></div>
               <div><dt>زمان انتشار</dt><dd>${escapeHtml(formatInstant(official.releaseTime))}</dd></div>
               <div><dt>زمان دریافت</dt><dd>${escapeHtml(formatInstant(official.retrievalTime))}</dd></div>
             </dl>`
          : '<h4>نسخه رسمی واجد شرایط موجود نیست</h4><p>داده رسمی موجود نیست، قدیمی است، در دسترس نیست یا در زمان ارزیابی هنوز منتشر نشده بود.</p>'}
      </section>

      <section class="china-nowcast-contributions" aria-label="سهم شاخص‌های جایگزین">
        ${response.contributions.map(contributionHtml).join('')}
      </section>

      <details class="china-nowcast-method">
        <summary>روش‌شناسی، حساسیت و ارزیابی تاریخی</summary>
        <div class="china-nowcast-method__grid">
          <section>
            <h4>تحلیل حساسیت با حذف یک خانواده</h4>
            <ul>${sensitivity}</ul>
          </section>
          <section>
            <h4>ارزیابی تاریخی در دسترس نیست</h4>
            <p>${escapeHtml(response.historicalEvaluation.reason)}</p>
            <p>پوشش: ${escapeHtml(`${response.historicalEvaluation.evaluated}/${response.historicalEvaluation.attempted}`)} · بدون استفاده از داده آینده: بله</p>
          </section>
          <section>
            <h4>محدودیت‌ها</h4>
            <ul>${limitations}</ul>
          </section>
        </div>
      </details>
    </div>`;
}
