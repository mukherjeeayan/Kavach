// contentScanner.ts
// Linear-time multi-pattern content scanner using the Aho-Corasick
// automaton. Replaces naive regex/includes() keyword matching which is
// vulnerable to ReDoS and fails against unicode homoglyphs, leetspeak,
// and zero-width character injection.
//
// Complexity: O(n + m + z) where n = text length, m = total keyword
// length, z = number of matches. No catastrophic backtracking.

import AhoCorasick from 'ahocorasick';
import { query } from '../config/database';
import logger from '../utils/logger';

// Zero-width characters that are commonly injected to evade simple
// substring matching (U+200B SPACE, U+200C ZERO WIDTH NON-JOINER,
// U+200D ZERO WIDTH JOINER, U+FEFF BOM, U+2060 WORD JOINER,
// U+00AD SOFT HYPHEN, U+200E/U+200F LTR/RTL MARK).
const ZERO_WIDTH_RE = /[\u200B-\u200F\uFEFF\u2060\u00AD]/g;

// Common leetspeak and homoglyph normalization map
const NORMALIZE_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
  '7': 't', '@': 'a', '$': 's', '!': 'i', '+': 't',
  // Cyrillic homoglyphs → Latin
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p',
  '\u0441': 'c', '\u0443': 'y', '\u0445': 'x',
};

export interface ScanResult {
  flagged: boolean;
  matches: string[];
  maxSeverity: string;
  categories: string[];
}

interface KeywordEntry {
  keyword: string;
  category: string;
  severity: string;
}

/**
 * Normalize input text for robust matching:
 * 1. Unicode NFKC normalization (compatibility decomposition)
 * 2. Strip zero-width characters
 * 3. Lowercase
 * 4. Collapse whitespace
 */
export function normalizeText(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(ZERO_WIDTH_RE, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Apply leetspeak/homoglyph normalization for matching purposes only.
 * This is applied ON TOP of the standard normalization.
 */
function normalizeLeet(text: string): string {
  return text
    .split('')
    .map((ch) => NORMALIZE_MAP[ch] ?? ch)
    .join('');
}

// Severity ordering for max-severity calculation
const SEVERITY_ORDER: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

/**
 * FastContentScanner caches the Aho-Corasick automaton in memory
 * and rebuilds it periodically from the keyword_dictionaries table.
 */
export class FastContentScanner {
  private trie: AhoCorasick | null = null;
  private keywords: KeywordEntry[] = [];
  private lastRefresh = 0;
  private refreshIntervalMs: number;
  private loading = false;

  constructor(refreshIntervalMs = 5 * 60 * 1000) {
    this.refreshIntervalMs = refreshIntervalMs;
  }

  /**
   * Load keywords from the database and rebuild the automaton.
   * Thread-safe: only one refresh runs at a time.
   */
  async refresh(): Promise<void> {
    if (this.loading) return;
    this.loading = true;

    try {
      const result = await query(
        `SELECT keyword, category, severity FROM keyword_dictionaries WHERE is_active = TRUE`
      );

      const entries = result.rows as KeywordEntry[];
      if (entries.length === 0) {
        this.keywords = [];
        this.trie = null;
        this.lastRefresh = Date.now();
        return;
      }

      // Build patterns: both the original keyword and a leet-normalized variant
      const patterns: string[] = [];
      for (const entry of entries) {
        const normalized = normalizeText(entry.keyword);
        patterns.push(normalized);
        // Also add leet-normalized variant if it differs
        const leetNorm = normalizeLeet(normalized);
        if (leetNorm !== normalized) {
          patterns.push(leetNorm);
        }
      }

      // Deduplicate patterns
      const uniquePatterns = [...new Set(patterns)];

      this.keywords = entries;
      this.trie = new AhoCorasick(uniquePatterns);
      this.lastRefresh = Date.now();
      logger.info(
        `Content scanner refreshed: ${entries.length} keywords, ${uniquePatterns.length} patterns`
      );
    } catch (err) {
      logger.error('Failed to refresh content scanner:', err);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Ensure the automaton is loaded. Refreshes if stale or never loaded.
   */
  private async ensureReady(): Promise<void> {
    if (!this.trie || Date.now() - this.lastRefresh > this.refreshIntervalMs) {
      await this.refresh();
    }
  }

  /**
   * Core matching logic shared by scan() and scanSync().
   * Resolves matched patterns back to keyword metadata.
   */
  private resolveMatches(matchedPatterns: Set<string>): ScanResult {
    if (matchedPatterns.size === 0) {
      return { flagged: false, matches: [], maxSeverity: 'LOW', categories: [] };
    }

    const matchedKeywords = new Set<string>();
    const matchedCategories = new Set<string>();
    let maxSeverityScore = 0;
    let maxSeverity = 'LOW';

    for (const entry of this.keywords) {
      const normalizedKw = normalizeText(entry.keyword);
      const leetKw = normalizeLeet(normalizedKw);

      if (matchedPatterns.has(normalizedKw) || matchedPatterns.has(leetKw)) {
        matchedKeywords.add(entry.keyword);
        matchedCategories.add(entry.category);
        const score = SEVERITY_ORDER[entry.severity] ?? 0;
        if (score > maxSeverityScore) {
          maxSeverityScore = score;
          maxSeverity = entry.severity;
        }
      }
    }

    return {
      flagged: true,
      matches: Array.from(matchedKeywords),
      maxSeverity,
      categories: Array.from(matchedCategories),
    };
  }

  /**
   * Scan text against all loaded keywords.
   * Returns flagged status, matched keywords, highest severity, and categories.
   */
  async scan(rawText: string): Promise<ScanResult> {
    await this.ensureReady();

    if (!this.trie || this.keywords.length === 0) {
      return { flagged: false, matches: [], maxSeverity: 'LOW', categories: [] };
    }

    const normalized = normalizeText(rawText);
    const leetNormalized = normalizeLeet(normalized);

    const rawMatches = this.trie.search(normalized);
    const leetMatches = this.trie.search(leetNormalized);

    const matchedPatterns = new Set<string>();
    for (const match of rawMatches) {
      for (const pattern of match[1]) {
        matchedPatterns.add(pattern);
      }
    }
    for (const match of leetMatches) {
      for (const pattern of match[1]) {
        matchedPatterns.add(pattern);
      }
    }

    return this.resolveMatches(matchedPatterns);
  }

  /**
   * Synchronous scan for hot paths where async is not desired.
   * Uses whatever is currently cached — does NOT trigger a refresh.
   * Returns empty results if scanner is not yet initialized.
   */
  scanSync(rawText: string): ScanResult {
    if (!this.trie || this.keywords.length === 0) {
      return { flagged: false, matches: [], maxSeverity: 'LOW', categories: [] };
    }

    const normalized = normalizeText(rawText);
    const leetNormalized = normalizeLeet(normalized);

    const rawMatches = this.trie.search(normalized);
    const leetMatches = this.trie.search(leetNormalized);

    const matchedPatterns = new Set<string>();
    for (const match of rawMatches) {
      for (const pattern of match[1]) {
        matchedPatterns.add(pattern);
      }
    }
    for (const match of leetMatches) {
      for (const pattern of match[1]) {
        matchedPatterns.add(pattern);
      }
    }

    return this.resolveMatches(matchedPatterns);
  }

  /**
   * Number of loaded keywords.
   */
  get keywordCount(): number {
    return this.keywords.length;
  }

  /**
   * Whether the scanner has been initialized at least once.
   */
  get isReady(): boolean {
    return this.trie !== null;
  }
}

// Singleton instance shared across the application
export const contentScanner = new FastContentScanner();
