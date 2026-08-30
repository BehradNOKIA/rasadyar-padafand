import { subscribeAuthState, type AuthSession } from '@/services/auth-state';
import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';
import { logoutUser } from '@/auth/userStore';

type RasadyarRole = 'superadmin' | 'admin' | 'analyst' | 'viewer';

interface RasadyarLocalUser {
  name?: string;
  role?: RasadyarRole | string;
}

interface UserMenuItem {
  title: string;
  eventName: string;
}

const ROLE_LABELS: Record<RasadyarRole, string> = {
  superadmin: 'مدیر اصلی',
  admin: 'مدیر',
  analyst: 'تحلیلگر',
  viewer: 'مشاهده‌گر',
};

const ROLE_MENUS: Record<RasadyarRole, UserMenuItem[]> = {
  superadmin: [
    {
      title: 'مدیریت کاربران',
      eventName: 'rasadyar:open-user-management',
    },
    {
      title: 'ویرایش پروفایل',
      eventName: 'rasadyar:open-profile-editor',
    },
  ],

  admin: [
    {
      title: 'مدیریت کاربران',
      eventName: 'rasadyar:open-user-management',
    },
    {
      title: 'ویرایش پروفایل',
      eventName: 'rasadyar:open-profile-editor',
    },
  ],

  analyst: [
    {
      title: 'ویرایش پروفایل',
      eventName: 'rasadyar:open-profile-editor',
    },
  ],

  viewer: [
    {
      title: 'ویرایش پروفایل',
      eventName: 'rasadyar:open-profile-editor',
    },
  ],
};

export class AuthHeaderWidget {
  private container: HTMLElement;
  private unsubscribeAuth: (() => void) | null = null;

  private activeMenu: HTMLElement | null = null;
  private activeUserButton: HTMLButtonElement | null = null;

  private readonly onDocumentPointerDown: (event: PointerEvent) => void;
  private readonly onDocumentKeyDown: (event: KeyboardEvent) => void;

  constructor(
    _onSignInClick?: () => void,
    _onSettingsClick?: () => void,
    _onBillingClick?: () => void,
  ) {
    this.container = document.createElement('div');
    this.container.className = 'auth-header-widget';

    this.onDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (this.container.contains(target)) {
        return;
      }

      this.closeUserMenu();
    };

    this.onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeUserMenu(true);
      }
    };

    document.addEventListener('pointerdown', this.onDocumentPointerDown);
    document.addEventListener('keydown', this.onDocumentKeyDown);

    this.unsubscribeAuth = subscribeAuthState((state: AuthSession) => {
      if (state.isPending) {
        this.renderPending();
        return;
      }

      this.render(state);
    });
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public destroy(): void {
    this.closeUserMenu();

    document.removeEventListener('pointerdown', this.onDocumentPointerDown);
    document.removeEventListener('keydown', this.onDocumentKeyDown);

    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }

    this.container.remove();
  }

  private render(state: AuthSession): void {
    this.closeUserMenu();

    this.container.classList.remove('auth-header-widget-pending');
    this.container.removeAttribute('aria-busy');

    setTrustedHtml(
      this.container,
      trustedHtml('', 'clear auth header before render'),
    );

    if (!state.user) {
      this.renderSignedOut();
      return;
    }

    this.renderSignedIn();
  }

  private renderPending(): void {
    this.closeUserMenu();

    this.container.classList.add('auth-header-widget-pending');
    this.container.setAttribute('aria-busy', 'true');

    setTrustedHtml(
      this.container,
      trustedHtml('', 'clear auth header pending state'),
    );

    const userSkeleton = document.createElement('span');
    userSkeleton.className =
      'auth-header-skeleton auth-header-skeleton-signin';
    userSkeleton.setAttribute('aria-hidden', 'true');

    this.container.appendChild(userSkeleton);
  }

  private renderSignedOut(): void {
    const currentUser = this.getCurrentUser();

    if (!currentUser) {
      return;
    }

    this.renderSignedIn();
  }

  private renderSignedIn(): void {
    const currentUser = this.getCurrentUser();

    if (!currentUser) {
      return;
    }

    const role = this.normalizeRole(currentUser.role);
    const roleLabel = role ? ROLE_LABELS[role] : 'کاربر';
    const userName = currentUser.name?.trim() || 'کاربر';

    const wrapper = document.createElement('div');
    wrapper.className = 'auth-user-menu-wrapper';

    const userButton = document.createElement('button');
    userButton.type = 'button';
    userButton.className = 'auth-user-dropdown-btn';
    userButton.setAttribute('aria-haspopup', 'menu');
    userButton.setAttribute('aria-expanded', 'false');

    const userNameSpan = document.createElement('span');
    userNameSpan.className = 'auth-user-name';
    userNameSpan.textContent = userName;

    const roleSpan = document.createElement('span');
    roleSpan.className = 'auth-user-role';
    roleSpan.textContent = roleLabel;

    const chevronSpan = document.createElement('span');
    chevronSpan.className = 'auth-user-chevron';
    chevronSpan.setAttribute('aria-hidden', 'true');
    chevronSpan.textContent = '▾';

    userButton.append(userNameSpan, roleSpan, chevronSpan);
    wrapper.appendChild(userButton);

    const menu = document.createElement('div');
    menu.className = 'auth-user-dropdown hidden';
    menu.setAttribute('role', 'menu');

    const menuHeader = document.createElement('div');
    menuHeader.className = 'auth-user-dropdown-header';

    const menuHeaderName = document.createElement('div');
    menuHeaderName.className = 'auth-user-dropdown-name';
    menuHeaderName.textContent = userName;

    const menuHeaderRole = document.createElement('div');
    menuHeaderRole.className = 'auth-user-dropdown-role';
    menuHeaderRole.textContent = roleLabel;

    menuHeader.append(menuHeaderName, menuHeaderRole);
    menu.appendChild(menuHeader);

    const dividerTop = document.createElement('div');
    dividerTop.className = 'auth-user-dropdown-divider';
    dividerTop.setAttribute('aria-hidden', 'true');
    menu.appendChild(dividerTop);

    const roleMenuItems = role ? ROLE_MENUS[role] : [];

    for (const item of roleMenuItems) {
      menu.appendChild(
        this.createMenuItem(item.title, item.eventName, menu),
      );
    }

    const dividerBottom = document.createElement('div');
    dividerBottom.className = 'auth-user-dropdown-divider';
    dividerBottom.setAttribute('aria-hidden', 'true');
    menu.appendChild(dividerBottom);

    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = 'auth-menu-item auth-menu-item-danger';
    signOut.setAttribute('role', 'menuitem');
    signOut.textContent = 'خروج';

    signOut.addEventListener('click', () => {
      this.closeUserMenu();
      signOut.disabled = true;

      void logoutUser()
        .catch((error) => {
          console.error('[RasadyarAuth] Logout failed:', error);
        })
        .finally(() => {
          window.location.reload();
        });
    });

    menu.appendChild(signOut);

    userButton.addEventListener('click', (event) => {
      event.stopPropagation();

      const isHidden = menu.classList.contains('hidden');

      if (isHidden) {
        this.openUserMenu(menu, userButton);
      } else {
        this.closeUserMenu();
      }
    });

    wrapper.appendChild(menu);
    this.container.appendChild(wrapper);
  }

  private createMenuItem(
    title: string,
    eventName: string,
    menu: HTMLElement,
  ): HTMLButtonElement {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'auth-menu-item';
    button.setAttribute('role', 'menuitem');
    button.textContent = title;

    button.addEventListener('click', () => {
      menu.classList.add('hidden');

      if (this.activeUserButton) {
        this.activeUserButton.setAttribute('aria-expanded', 'false');
      }

      this.activeMenu = null;
      this.activeUserButton = null;

      window.dispatchEvent(new CustomEvent(eventName));
    });

    return button;
  }

  private openUserMenu(
    menu: HTMLElement,
    userButton: HTMLButtonElement,
  ): void {
    if (this.activeMenu && this.activeMenu !== menu) {
      this.activeMenu.classList.add('hidden');
    }

    if (this.activeUserButton && this.activeUserButton !== userButton) {
      this.activeUserButton.setAttribute('aria-expanded', 'false');
    }

    menu.classList.remove('hidden');
    userButton.setAttribute('aria-expanded', 'true');

    this.activeMenu = menu;
    this.activeUserButton = userButton;
  }

  private closeUserMenu(restoreFocus = false): void {
    if (this.activeMenu) {
      this.activeMenu.classList.add('hidden');
    }

    if (this.activeUserButton) {
      this.activeUserButton.setAttribute('aria-expanded', 'false');

      if (restoreFocus) {
        this.activeUserButton.focus();
      }
    }

    this.activeMenu = null;
    this.activeUserButton = null;
  }

  private getCurrentUser(): RasadyarLocalUser | null {
    const raw =
      localStorage.getItem('rasadyar_user') ??
      localStorage.getItem('user');

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      return parsed as RasadyarLocalUser;
    } catch {
      return null;
    }
  }

  private normalizeRole(
    role: RasadyarLocalUser['role'],
  ): RasadyarRole | null {
    if (
      role === 'superadmin' ||
      role === 'admin' ||
      role === 'analyst' ||
      role === 'viewer'
    ) {
      return role;
    }

    return null;
  }
}
