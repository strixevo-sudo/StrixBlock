// StrixBlock v2 — EasyList format filter engine

import type { ParsedNetworkRule, ParsedCosmeticRule, ResourceType } from '../shared/types.js';
import { DNR_PRIORITY, DNR_MAX_PATTERN_LENGTH } from '../shared/constants.js';

// ─── EasyList Option → Chrome DNR ResourceType mapping ───────────────────────

const OPTION_TO_RESOURCE_TYPE: Record<string, ResourceType> = {
  script: 'script',
  image: 'image',
  stylesheet: 'stylesheet',
  object: 'object',
  xmlhttprequest: 'xmlhttprequest',
  xhr: 'xmlhttprequest',
  subdocument: 'sub_frame',
  sub_frame: 'sub_frame',
  ping: 'ping',
  media: 'media',
  font: 'font',
  websocket: 'websocket',
  other: 'other',
  document: 'main_frame',
};

// ─── Parse a full filter list text ───────────────────────────────────────────

export interface ParseResult {
  networkRules: ParsedNetworkRule[];
  cosmeticRules: ParsedCosmeticRule[];
  errors: number;
}

export function parseFilterList(text: string): ParseResult {
  const networkRules: ParsedNetworkRule[] = [];
  const cosmeticRules: ParsedCosmeticRule[] = [];
  let errors = 0;

  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('!') || line.startsWith('#') || line.startsWith('[')) {
      continue;
    }

    // Cosmetic rule — contains ## or #@#
    if (line.includes('##') || line.includes('#@#') || line.includes('#?#')) {
      try {
        const cosmetic = parseCosmeticRule(line);
        if (cosmetic) cosmeticRules.push(cosmetic);
      } catch {
        errors++;
      }
      continue;
    }

    // Network rule
    try {
      const network = parseNetworkRule(line);
      if (network) networkRules.push(network);
    } catch {
      errors++;
    }
  }

  return { networkRules, cosmeticRules, errors };
}

// ─── Parse a single network filter rule ──────────────────────────────────────

export function parseNetworkRule(line: string): ParsedNetworkRule | null {
  if (!line) return null;

  let type: 'block' | 'allow' | 'redirect' = 'block';
  let remaining = line;

  // Exception rule @@
  if (remaining.startsWith('@@')) {
    type = 'allow';
    remaining = remaining.slice(2);
  }

  // Extract options after $
  let optionsStr = '';
  const dollarIdx = remaining.lastIndexOf('$');
  if (dollarIdx !== -1) {
    // Check it's not part of regex
    const beforeDollar = remaining.slice(0, dollarIdx);
    const isRegex = beforeDollar.startsWith('/') && beforeDollar.endsWith('/');
    if (!isRegex) {
      optionsStr = remaining.slice(dollarIdx + 1);
      remaining = remaining.slice(0, dollarIdx);
    }
  }

  // Parse pattern
  let pattern = remaining;
  let isRegex = false;

  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
    // Regex rule
    isRegex = true;
    pattern = pattern.slice(1, -1);
  }

  if (!pattern) return null;

  // Parse options
  const resourceTypes: ResourceType[] = [];
  let thirdParty: boolean | undefined;
  const initiatorDomains: string[] = [];
  const excludedDomains: string[] = [];
  let redirectExtensionPath: string | undefined;

  if (optionsStr) {
    const options = optionsStr.split(',');
    for (const opt of options) {
      const trimmed = opt.trim().toLowerCase();

      if (trimmed === 'third-party' || trimmed === '3p') {
        thirdParty = true;
      } else if (trimmed === '~third-party' || trimmed === '~3p' || trimmed === 'first-party' || trimmed === '1p') {
        thirdParty = false;
      } else if (trimmed.startsWith('domain=')) {
        const domainList = opt.slice('domain='.length).split('|');
        for (const d of domainList) {
          if (d.startsWith('~')) {
            excludedDomains.push(d.slice(1).toLowerCase());
          } else {
            initiatorDomains.push(d.toLowerCase());
          }
        }
      } else if (trimmed.startsWith('redirect=') || trimmed.startsWith('redirect-rule=')) {
        const redirectTarget = opt.slice(opt.indexOf('=') + 1);
        type = 'redirect';
        if (redirectTarget.includes('empty')) {
          if (redirectTarget.includes('.js') || redirectTarget === 'empty-js') {
            redirectExtensionPath = '/stubs/empty.js';
          } else if (redirectTarget.includes('.gif') || redirectTarget === 'empty-gif') {
            redirectExtensionPath = '/stubs/empty.gif';
          } else {
            redirectExtensionPath = '/stubs/empty.js';
          }
        }
      } else if (trimmed in OPTION_TO_RESOURCE_TYPE) {
        resourceTypes.push(OPTION_TO_RESOURCE_TYPE[trimmed] as ResourceType);
      } else if (trimmed.startsWith('~') && trimmed.slice(1) in OPTION_TO_RESOURCE_TYPE) {
        // Negated resource type — skip (DNR doesn't support exclusion directly)
      }
      // Ignore: csp=, popup, genericblock, generichide, important, badfilter
    }
  }

  // Skip rules that can't be converted
  if (type === 'redirect' && !redirectExtensionPath) return null;

  return {
    type,
    pattern,
    isRegex,
    resourceTypes: resourceTypes.length > 0 ? resourceTypes : getDefaultResourceTypes(type),
    thirdParty,
    initiatorDomains: initiatorDomains.length > 0 ? initiatorDomains : undefined,
    excludedDomains: excludedDomains.length > 0 ? excludedDomains : undefined,
    redirectExtensionPath,
  };
}

function getDefaultResourceTypes(type: 'block' | 'allow' | 'redirect'): ResourceType[] {
  if (type === 'redirect') {
    return ['script'];
  }
  // Block all common resource types by default
  return ['script', 'image', 'stylesheet', 'xmlhttprequest', 'sub_frame', 'font', 'media', 'ping', 'other'];
}

// ─── Parse a single cosmetic filter rule ─────────────────────────────────────

export function parseCosmeticRule(line: string): ParsedCosmeticRule | null {
  // Detect separator: ##, #@#, #?# (extended CSS — skip)
  let sepIdx = line.indexOf('#@#');
  let isUnhide = false;

  if (sepIdx !== -1) {
    isUnhide = true;
  } else {
    sepIdx = line.indexOf('##');
    if (sepIdx === -1) return null;
  }

  const domainPart = line.slice(0, sepIdx);
  const selectorPart = line.slice(sepIdx + (isUnhide ? 3 : 2));

  if (!selectorPart) return null;

  // Skip extended CSS selectors (not standard CSS)
  if (selectorPart.includes(':has(') ||
      selectorPart.includes(':matches-') ||
      selectorPart.startsWith('+js(') ||
      selectorPart.startsWith('js(') ||
      line.includes('#?#')) {
    return null;
  }

  const domains: string[] = [];
  const excludedDomains: string[] = [];

  if (domainPart) {
    const parts = domainPart.split(',');
    for (const d of parts) {
      const trimmed = d.trim().toLowerCase();
      if (!trimmed) continue;
      if (trimmed.startsWith('~')) {
        excludedDomains.push(trimmed.slice(1));
      } else {
        domains.push(trimmed);
      }
    }
  }

  return {
    type: isUnhide ? 'unhide' : 'hide',
    selector: selectorPart,
    domains,
    excludedDomains,
  };
}

// ─── Compile parsed network rules to DNR format ───────────────────────────────

export function compileToDNR(
  rules: ParsedNetworkRule[],
  startId: number
): chrome.declarativeNetRequest.Rule[] {
  const dnrRules: chrome.declarativeNetRequest.Rule[] = [];
  let id = startId;

  for (const rule of rules) {
    // Skip over-long patterns
    if (rule.pattern.length > DNR_MAX_PATTERN_LENGTH) continue;

    // Build condition
    const condition: chrome.declarativeNetRequest.RuleCondition = {};

    if (rule.isRegex) {
      condition.regexFilter = rule.pattern;
    } else {
      condition.urlFilter = rule.pattern;
    }

    if (rule.resourceTypes.length > 0) {
      condition.resourceTypes =
        rule.resourceTypes as chrome.declarativeNetRequest.ResourceType[];
    }

    if (rule.thirdParty !== undefined) {
      condition.domainType = rule.thirdParty ? 'thirdParty' : 'firstParty';
    }

    if (rule.initiatorDomains && rule.initiatorDomains.length > 0) {
      condition.initiatorDomains = rule.initiatorDomains;
    }

    if (rule.excludedDomains && rule.excludedDomains.length > 0) {
      condition.excludedInitiatorDomains = rule.excludedDomains;
    }

    // Build action
    let action: chrome.declarativeNetRequest.RuleAction;
    let priority: number;

    if (rule.type === 'allow') {
      action = { type: 'allow' };
      priority = DNR_PRIORITY.ALLOW;
    } else if (rule.type === 'redirect') {
      if (!rule.redirectExtensionPath) continue;
      action = {
        type: 'redirect',
        redirect: { extensionPath: rule.redirectExtensionPath },
      };
      priority = DNR_PRIORITY.REDIRECT;
    } else {
      action = { type: 'block' };
      priority = DNR_PRIORITY.BLOCK;
    }

    dnrRules.push({ id: id++, priority, action, condition });
  }

  return dnrRules;
}

// ─── Compile cosmetic rules to a CSS stylesheet ───────────────────────────────

export function compileToCSS(rules: ParsedCosmeticRule[]): string {
  const genericHide: string[] = [];
  const domainHide: Map<string, string[]> = new Map();

  for (const rule of rules) {
    if (rule.type !== 'hide') continue;
    if (!rule.selector) continue;

    // Basic selector validation — skip obviously broken ones
    if (rule.selector.length > 500) continue;

    if (rule.domains.length === 0) {
      // Generic cosmetic rule
      genericHide.push(rule.selector);
    } else {
      // Domain-specific — we can't easily scope with @-rules in injected CSS
      // For now, add domain-specific rules as generic (the content script
      // will check the domain before injecting domain-specific rules)
      for (const domain of rule.domains) {
        if (!domainHide.has(domain)) domainHide.set(domain, []);
        domainHide.get(domain)!.push(rule.selector);
      }
    }
  }

  const parts: string[] = [];

  if (genericHide.length > 0) {
    // Batch selectors into groups of 200 to avoid too-long selectors
    const chunks: string[][] = [];
    for (let i = 0; i < genericHide.length; i += 200) {
      chunks.push(genericHide.slice(i, i + 200));
    }
    for (const chunk of chunks) {
      parts.push(`${chunk.join(',\n')} { display: none !important; }`);
    }
  }

  // Serialize domain rules as a JSON comment for the content script to read
  if (domainHide.size > 0) {
    const domainMap: Record<string, string[]> = {};
    domainHide.forEach((selectors, domain) => {
      domainMap[domain] = selectors;
    });
    parts.push(`/* DOMAIN_RULES:${JSON.stringify(domainMap)} */`);
  }

  return parts.join('\n\n');
}
