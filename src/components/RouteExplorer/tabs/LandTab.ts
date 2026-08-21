/**
 * Land tab — filters bypass options to `type === 'land_bridge'` only.
 * Excludes proposed and unavailable corridors from the primary list but
 * shows them in a secondary "other corridors" section with honest labels.
 * Empty state when no land-bridge corridors exist for this lane.
 */

import type {
  BypassCorridorOption,
  GetRouteExplorerLaneResponse,
} from '@/generated/server/worldmonitor/supply_chain/v1/service_server';
import { renderRouteCard } from '../components/RouteCard';
import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';


export interface LandTabOptions {
  onSelectBypass: (option: BypassCorridorOption) => void;
}

export class LandTab {
  public readonly element: HTMLDivElement;
  private opts: LandTabOptions;

  constructor(opts: LandTabOptions) {
    this.opts = opts;
    this.element = document.createElement('div');
    this.element.className = 're-tab re-tab--land';
    this.element.setAttribute('role', 'tabpanel');
    this.renderEmpty();
  }

  public update(data: GetRouteExplorerLaneResponse | null): void {
    if (!data || data.noModeledLane) {
      this.renderNoLane();
      return;
    }

    const landBridges = data.bypassOptions.filter((o) => o.type === 'land_bridge');
    const active = landBridges.filter(
      (o) => o.status !== 'CORRIDOR_STATUS_PROPOSED' && o.status !== 'CORRIDOR_STATUS_UNAVAILABLE',
    );
    const other = landBridges.filter(
      (o) => o.status === 'CORRIDOR_STATUS_PROPOSED' || o.status === 'CORRIDOR_STATUS_UNAVAILABLE',
    );

    if (landBridges.length === 0) {
      this.renderEmptyLand();
      return;
    }
    this.renderList(active, other);
  }

  private renderEmpty(): void {
    setTrustedHtml(this.element, trustedHtml('<div class="re-tab__placeholder">برای دیدن کریدورهای زمینی، مبدأ، مقصد و محصول را انتخاب کنید.</div>', "legacy direct innerHTML migration"));
  }

  private renderNoLane(): void {
    setTrustedHtml(this.element, trustedHtml('<div class="re-tab__empty"><p>مسیر مدل‌سازی‌شده‌ای وجود ندارد. کریدورهای زمینی به مسیر اصلی نیاز دارند.</p></div>', "legacy direct innerHTML migration"));
  }

  private renderEmptyLand(): void {
    setTrustedHtml(this.element, trustedHtml('<div class="re-tab__empty">' +
      '<h3>مسیر زمینی جایگزینی وجود ندارد</h3>' +
      '<p>برای گلوگاه اصلی این مسیر، کریدور پل زمینی مدل‌سازی نشده است. ' +
      'در حال حاضر فقط ۵ کریدور زمینی در مجموعه داده وجود دارد (عقبه، جیبوتی–آدیس‌آبابا، ' +
      'باکو–تفلیس–باتومی، راه‌آهن آمریکا، راه‌آهن اوکراین).</p>' +
      '</div>', "legacy direct innerHTML migration"));
  }

  private renderList(active: BypassCorridorOption[], other: BypassCorridorOption[]): void {
    setTrustedHtml(this.element, trustedHtml('', "legacy direct innerHTML migration"));

    if (active.length > 0) {
      const header = document.createElement('h3');
      header.className = 're-land__header';
      header.textContent = 'کریدورهای زمینی';
      this.element.append(header);

      const listEl = document.createElement('div');
      listEl.className = 're-land__list';
      listEl.setAttribute('role', 'listbox');
      active.forEach((option, idx) => {
        listEl.append(
          renderRouteCard({
            option,
            index: idx,
            isActive: false,
            onSelect: (o) => this.opts.onSelectBypass(o),
          }),
        );
      });
      this.element.append(listEl);
    }

    if (other.length > 0) {
      const otherHeader = document.createElement('h4');
      otherHeader.className = 're-land__other-header';
      otherHeader.textContent = 'سایر کریدورها (در حال حاضر قابل استفاده نیستند)';
      this.element.append(otherHeader);

      const otherEl = document.createElement('div');
      otherEl.className = 're-land__other';
      other.forEach((option, idx) => {
        otherEl.append(
          renderRouteCard({
            option,
            index: active.length + idx,
            isActive: false,
            onSelect: () => {},
          }),
        );
      });
      this.element.append(otherEl);
    }
  }
}
