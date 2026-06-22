// StrixBlock v2 — Shared TypeScript types

// ─── Chrome DNR Resource Types ───────────────────────────────────────────────

export type ResourceType =
  | 'main_frame'
  | 'sub_frame'
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'object'
  | 'xmlhttprequest'
  | 'ping'
  | 'csp_report'
  | 'media'
  | 'websocket'
  | 'webtransport'
  | 'webbundle'
  | 'other';

// ─── Filter Parser Types ─────────────────────────────────────────────────────

export interface ParsedNetworkRule {
  type: 'block' | 'allow' | 'redirect';
  pattern: string;
  isRegex: boolean;
  resourceTypes: ResourceType[];
  thirdParty?: boolean;
  initiatorDomains?: string[];
  excludedDomains?: string[];
  redirectUrl?: string;
  redirectExtensionPath?: string;
}

export interface ParsedCosmeticRule {
  type: 'hide' | 'unhide';
  selector: string;
  domains: string[];
  excludedDomains: string[];
}

// ─── Filter Lists ─────────────────────────────────────────────────────────────

export type FilterCategory = 'ads' | 'privacy' | 'malware' | 'annoyances' | 'custom';

export interface FilterList {
  id: string;
  name: string;
  url: string;
  homepage?: string;
  enabled: boolean;
  lastUpdated: number; // Unix timestamp ms
  ruleCount: number;
  category: FilterCategory;
  description?: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface FeatureSettings {
  ads: boolean;
  trackers: boolean;
  malware: boolean;
  cookieBanners: boolean;
  annoyances: boolean;
  cosmetic: boolean;
  antiAdblock: boolean;
  youtube: boolean;
  twitch: boolean;
}

export interface UISettings {
  theme: 'dark' | 'light' | 'system';
  showBadge: boolean;
  badgeColor: string;
}

export interface PrivacySettings {
  blockFingerprinting: boolean;
  sendDNT: boolean;
  blockGPC: boolean;
}

export interface UpdateSettings {
  checkExtension: boolean;
  checkFilterLists: boolean;
  intervalHours: number;
  githubRepo: string;
}

export interface Settings {
  enabled: boolean;
  features: FeatureSettings;
  ui: UISettings;
  privacy: PrivacySettings;
  updates: UpdateSettings;
  filterLists: FilterList[];
  customRules: string;
  whitelist: string[];
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface CategoryStats {
  ads: number;
  trackers: number;
  malware: number;
  annoyances: number;
  other: number;
}

export interface Stats {
  total: number;
  session: number;
  byCategory: CategoryStats;
  byDomain: Record<string, number>;
  lastReset: number;
}

export interface TabStats {
  tabId: number;
  url: string;
  domain: string;
  blocked: number;
  whitelisted: boolean;
}

// ─── Update Info ──────────────────────────────────────────────────────────────

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  checkedAt: number;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export type MessageType =
  | 'GET_TAB_INFO'
  | 'GET_STATS'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'TOGGLE_SITE'
  | 'WHITELIST_SITE'
  | 'REMOVE_FROM_WHITELIST'
  | 'CLEAR_STATS'
  | 'FETCH_FILTER_LIST'
  | 'CHECK_UPDATE'
  | 'STATS_INCREMENT'
  | 'GET_COSMETIC_RULES'
  | 'GET_UPDATE_INFO';

export interface BaseMessage {
  type: MessageType;
}

export interface GetTabInfoMessage extends BaseMessage {
  type: 'GET_TAB_INFO';
  tabId?: number;
}

export interface GetStatsMessage extends BaseMessage {
  type: 'GET_STATS';
}

export interface GetSettingsMessage extends BaseMessage {
  type: 'GET_SETTINGS';
}

export interface UpdateSettingsMessage extends BaseMessage {
  type: 'UPDATE_SETTINGS';
  settings: Partial<Settings>;
}

export interface ToggleSiteMessage extends BaseMessage {
  type: 'TOGGLE_SITE';
  domain: string;
}

export interface WhitelistSiteMessage extends BaseMessage {
  type: 'WHITELIST_SITE';
  domain: string;
}

export interface RemoveFromWhitelistMessage extends BaseMessage {
  type: 'REMOVE_FROM_WHITELIST';
  domain: string;
}

export interface ClearStatsMessage extends BaseMessage {
  type: 'CLEAR_STATS';
}

export interface FetchFilterListMessage extends BaseMessage {
  type: 'FETCH_FILTER_LIST';
  listId: string;
}

export interface CheckUpdateMessage extends BaseMessage {
  type: 'CHECK_UPDATE';
}

export interface StatsIncrementMessage extends BaseMessage {
  type: 'STATS_INCREMENT';
  tabId: number;
  domain: string;
  category: string;
}

export interface GetCosmeticRulesMessage extends BaseMessage {
  type: 'GET_COSMETIC_RULES';
}

export interface GetUpdateInfoMessage extends BaseMessage {
  type: 'GET_UPDATE_INFO';
}

export type Message =
  | GetTabInfoMessage
  | GetStatsMessage
  | GetSettingsMessage
  | UpdateSettingsMessage
  | ToggleSiteMessage
  | WhitelistSiteMessage
  | RemoveFromWhitelistMessage
  | ClearStatsMessage
  | FetchFilterListMessage
  | CheckUpdateMessage
  | StatsIncrementMessage
  | GetCosmeticRulesMessage
  | GetUpdateInfoMessage;

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
