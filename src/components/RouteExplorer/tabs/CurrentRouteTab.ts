/**
 * Current Route tab — shows the primary lane's chokepoints, transit/freight
 * estimates, disruption score, and war risk tier. Shows a noModeledLane
 * empty state when the origin/destination clusters have no shared route.
 */

import type {
  GetRouteExplorerLaneResponse,
  ChokepointExposureSummary,
} from '@/generated/server/worldmonitor/supply_chain/v1/service_server';
import {
  formatTransitRange,
  formatFreightRange,
  formatExposurePct,
  formatDisruptionScore,
  disruptionScoreClass,
  warRiskTierLabel,
  warRiskTierClass,
  escapeHtml,
} from './route-utils';
import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';


export interface CurrentRouteTabOptions {
  onChokepointSelect?: (chokepointId: string) => void;
}

export class CurrentRouteTab {
  public readonly element: HTMLDivElement;
  private opts: CurrentRouteTabOptions;

  constructor(opts: CurrentRouteTabOptions = {}) {
    this.opts = opts;
    this.element = document.createElement('div');
    this.element.className = 're-tab re-tab--current';
    this.element.setAttribute('role', 'tabpanel');
    this.renderEmpty();
  }

  public update(data: GetRouteExplorerLaneResponse | null): void {
    if (!data || data.noModeledLane) {
      this.renderNoModeledLane();
      return;
    }
    this.renderData(data);
  }

  private renderEmpty(): void {
    setTrustedHtml(this.element, trustedHtml('<div class="re-tab__placeholder">برای دیدن مسیر فعلی، مبدأ، مقصد و محصول را انتخاب کنید.</div>', "legacy direct innerHTML migration"));
  }

  private renderNoModeledLane(): void {
    setTrustedHtml(this.element, trustedHtml('<div class="re-tab__empty">' +
      '<h3>مسیر مدل‌سازی‌شده‌ای وجود ندارد</h3>' +
      '<p>WorldMonitor مسیر دریایی مدل‌سازی‌شده‌ای بین این دو کشور ندارد. ' +
      'ممکن است این دو کشور در مجموعه داده ما کریدور تجاری عمده مشترکی نداشته باشند یا یکی از آن‌ها محصور در خشکی باشد.</p>' +
      '</div>', "legacy direct innerHTML migration"));
  }

  private renderData(data: GetRouteExplorerLaneResponse): void {
    const summaryHtml = this.renderSummary(data);
    const chokepointsHtml = this.renderChokepointList(data.chokepointExposures);
    setTrustedHtml(this.element, trustedHtml(`${summaryHtml}${chokepointsHtml}`, "legacy direct innerHTML migration"));
    this.attachChokepointListeners();
  }

  private renderSummary(data: GetRouteExplorerLaneResponse): string {
    const riskCls = warRiskTierClass(data.warRiskTier);
    const disruptCls = disruptionScoreClass(data.disruptionScore);
    return [
      '<div class="re-current__summary">',
      `  <div class="re-current__metric">`,
      `    <span class="re-current__label">زمان ترانزیت</span>`,
      `    <span class="re-current__value">${formatTransitRange(data.estTransitDaysRange)}</span>`,
      `  </div>`,
      `  <div class="re-current__metric">`,
      `    <span class="re-current__label">کرایه حمل (برآوردی)</span>`,
      `    <span class="re-current__value">${formatFreightRange(data.estFreightUsdPerTeuRange, data.cargoType)}</span>`,
      `  </div>`,
      `  <div class="re-current__metric">`,
      `    <span class="re-current__label">اختلال</span>`,
      `    <span class="re-current__value ${disruptCls}">${formatDisruptionScore(data.disruptionScore)}</span>`,
      `  </div>`,
      `  <div class="re-current__metric">`,
      `    <span class="re-current__label">ریسک جنگ</span>`,
      `    <span class="re-current__value ${riskCls}">${escapeHtml(warRiskTierLabel(data.warRiskTier))}</span>`,
      `  </div>`,
      '</div>',
    ].join('\n');
  }

  private renderChokepointList(exposures: ChokepointExposureSummary[]): string {
    if (exposures.length === 0) {
      return '<div class="re-current__empty">در این مسیر گلوگاه در معرض ریسکی ثبت نشده است.</div>';
    }
    const rows = exposures.map(
      (e, i) =>
        `<tr class="re-current__cp-row" data-cp-id="${escapeHtml(e.chokepointId)}" tabindex="0">` +
        `<td class="re-current__cp-rank">${i + 1}</td>` +
        `<td class="re-current__cp-name">${escapeHtml(e.chokepointName)}</td>` +
        `<td class="re-current__cp-exposure">${formatExposurePct(e.exposurePct)}</td>` +
        `</tr>`,
    );
    return [
      '<table class="re-current__chokepoints">',
      '  <thead><tr><th>#</th><th>گلوگاه</th><th>میزان مواجهه</th></tr></thead>',
      `  <tbody>${rows.join('')}</tbody>`,
      '</table>',
    ].join('\n');
  }

  private attachChokepointListeners(): void {
    const rows = this.element.querySelectorAll<HTMLElement>('.re-current__cp-row');
    rows.forEach((row) => {
      const cpId = row.dataset.cpId;
      if (!cpId) return;
      const select = () => this.opts.onChokepointSelect?.(cpId);
      row.addEventListener('click', select);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
      });
    });
  }
}
