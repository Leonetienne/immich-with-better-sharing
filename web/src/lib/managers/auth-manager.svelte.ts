import {
  getAboutInfo,
  getMyPreferences,
  getMyUser,
  getPartners,
  logout,
  PartnerDirection,
  type UserAdminResponseDto,
  type UserPreferencesResponseDto,
} from '@immich/sdk';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { eventManager } from '$lib/managers/event-manager.svelte';
import { Route } from '$lib/route';
import { isSharedLinkRoute } from '$lib/utils/navigation';

class AuthManager {
  isPurchased = $state(false);
  isSharedLink = $derived(isSharedLinkRoute(page.route?.id));
  params = $derived(this.isSharedLink ? { key: page.params.key, slug: page.params.slug } : {});

  #user = $state<UserAdminResponseDto>();
  #preferences = $state<UserPreferencesResponseDto>();
  #partnerIds = $state<Set<string>>(new Set());
  #editorOfIds = $state<Set<string>>(new Set());

  get authenticated() {
    return !!(this.#user && this.#preferences);
  }

  get user() {
    if (!this.#user) {
      throw new TypeError('AuthManager.user is undefined');
    }

    return this.#user;
  }

  get preferences() {
    if (!this.#preferences) {
      throw new TypeError('AuthManager.preferences is undefined');
    }

    return this.#preferences;
  }

  // Owners and partners who share with the current user may favorite and stack.
  canCurate(ownerId: string) {
    return this.authenticated && (ownerId === this.user.id || this.#partnerIds.has(ownerId));
  }

  // Owners and partners who granted edit permission may edit asset content and metadata.
  canEdit(ownerId: string) {
    return this.authenticated && (ownerId === this.user.id || this.#editorOfIds.has(ownerId));
  }

  async refreshPartners() {
    const partners = await getPartners({ direction: PartnerDirection.SharedWith }).catch(() => []);
    this.#partnerIds = new Set(partners.map(({ id }) => id));
    this.#editorOfIds = new Set(partners.filter(({ allowEdits }) => allowEdits).map(({ id }) => id));
  }

  constructor() {
    eventManager.on({
      SessionDelete: () => goto(Route.logout()),
    });
  }

  async load() {
    if (authManager.authenticated) {
      return;
    }

    if (!this.#hasAuthCookie()) {
      return;
    }

    return this.refresh();
  }

  async refresh() {
    try {
      const [user, preferences] = await Promise.all([getMyUser(), getMyPreferences()]);
      this.#preferences = preferences;
      this.#user = user;
      await this.refreshPartners();

      if (user.license?.activatedAt) {
        this.isPurchased = true;
      } else {
        // check server status
        const serverInfo = await getAboutInfo().catch(() => {});
        if (serverInfo?.licensed) {
          this.isPurchased = true;
        }
      }

      eventManager.emit('AuthUserLoaded', user);
    } catch {
      // noop
    }
  }

  setUser(user: UserAdminResponseDto) {
    this.#user = user;
  }

  setPreferences(preferences: UserPreferencesResponseDto) {
    this.#preferences = preferences;
  }

  async logout() {
    let redirectUri = Route.login();

    try {
      const response = await logout();
      if (response.redirectUri) {
        redirectUri = response.redirectUri;
      }
    } catch {
      // noop
    }

    if (redirectUri.startsWith('/')) {
      this.isPurchased = false;

      this.reset();
      eventManager.emit('AuthLogout');

      await goto(redirectUri);
    } else {
      location.assign(redirectUri);
    }
  }

  reset() {
    this.#user = undefined;
    this.#preferences = undefined;
    this.#partnerIds = new Set();
    this.#editorOfIds = new Set();
  }

  #hasAuthCookie() {
    if (!browser) {
      return;
    }

    for (const cookie of document.cookie.split('; ')) {
      const [name] = cookie.split('=', 1);
      if (name === 'immich_is_authenticated') {
        return true;
      }
    }

    return false;
  }
}

export const authManager = new AuthManager();
