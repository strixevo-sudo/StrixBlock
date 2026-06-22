// StrixBlock v2 — Shared constants

import type { Settings, FilterList } from './types.js';

export const VERSION = '2.0.0';

// ─── DNR Constants ────────────────────────────────────────────────────────────

export const DNR_MAX_DYNAMIC_RULES = 5000;
export const DNR_MAX_REGEX_RULES = 1000;
export const DNR_MAX_UNSAFE_RULES = 100;

export const DNR_PRIORITY = {
  BLOCK: 1,
  REDIRECT: 2,
  WHITELIST_DOMAIN: 3,
  ALLOW: 4,
} as const;

export const DNR_DYNAMIC_RULESET_ID = 'dynamic';
export const DNR_STATIC_RULESET_ID = 'default_rules';

// Maximum pattern length for DNR rules
export const DNR_MAX_PATTERN_LENGTH = 2000;

// Starting ID for dynamically compiled rules (static rules use IDs 1-499)
export const DNR_DYNAMIC_START_ID = 10000;

// ─── Storage Keys ─────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  STATS: 'stats',
  COSMETIC_RULES: 'cosmetic_rules',
  UPDATE_INFO: 'update_info',
  FILTER_LIST_PREFIX: 'filter_list_',
} as const;

// ─── Alarm Names ──────────────────────────────────────────────────────────────

export const ALARM_NAMES = {
  UPDATE_CHECK: 'strix_update_check',
  FILTER_REFRESH: 'strix_filter_refresh',
} as const;

// ─── Built-in Filter Lists ───────────────────────────────────────────────────

export const BUILT_IN_FILTER_LISTS: FilterList[] = [
  {
    id: 'easylist',
    name: 'EasyList',
    url: 'https://easylist.to/easylist/easylist.txt',
    homepage: 'https://easylist.to',
    enabled: true,
    lastUpdated: 0,
    ruleCount: 0,
    category: 'ads',
    description: 'The primary filter list that removes most adverts from international webpages',
  },
  {
    id: 'easyprivacy',
    name: 'EasyPrivacy',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    homepage: 'https://easylist.to',
    enabled: true,
    lastUpdated: 0,
    ruleCount: 0,
    category: 'privacy',
    description: 'Supplementary filter list that completely removes all forms of tracking',
  },
  {
    id: 'peter-lowe',
    name: "Peter Lowe's Ad and tracking server list",
    url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0',
    homepage: 'https://pgl.yoyo.org/adservers/',
    enabled: false,
    lastUpdated: 0,
    ruleCount: 0,
    category: 'ads',
    description: 'A list of servers used for ads, tracking, and malware',
  },
  {
    id: 'ublock-filters',
    name: 'uBlock filters',
    url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
    homepage: 'https://github.com/uBlockOrigin/uAssets',
    enabled: false,
    lastUpdated: 0,
    ruleCount: 0,
    category: 'ads',
    description: 'uBlock Origin main filter list with additional ad blocking rules',
  },
  {
    id: 'ublock-privacy',
    name: 'uBlock filters – Privacy',
    url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt',
    homepage: 'https://github.com/uBlockOrigin/uAssets',
    enabled: false,
    lastUpdated: 0,
    ruleCount: 0,
    category: 'privacy',
    description: 'uBlock Origin privacy-focused filter list',
  },
  {
    id: 'annoyances',
    name: 'uBlock filters – Annoyances',
    url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances.txt',
    homepage: 'https://github.com/uBlockOrigin/uAssets',
    enabled: false,
    lastUpdated: 0,
    ruleCount: 0,
    category: 'annoyances',
    description: 'Remove annoyances like cookie banners, newsletter popups, etc.',
  },
];

// ─── Default Settings ─────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  features: {
    ads: true,
    trackers: true,
    malware: true,
    cookieBanners: true,
    annoyances: true,
    cosmetic: true,
    antiAdblock: false,
    youtube: true,
    twitch: true,
  },
  ui: {
    theme: 'dark',
    showBadge: true,
    badgeColor: '#e74c3c',
  },
  privacy: {
    blockFingerprinting: true,
    sendDNT: true,
    blockGPC: false,
  },
  updates: {
    checkExtension: true,
    checkFilterLists: true,
    intervalHours: 24,
    githubRepo: 'strixevo-sudo/StrixBlock',
  },
  filterLists: BUILT_IN_FILTER_LISTS,
  customRules: '',
  whitelist: [],
};

// ─── GitHub API ───────────────────────────────────────────────────────────────

export const GITHUB_RELEASES_API = (repo: string) =>
  `https://api.github.com/repos/${repo}/releases/latest`;

// ─── Badge text limits ────────────────────────────────────────────────────────

export const BADGE_MAX_COUNT = 9999;
