/**
 * JobTrack Site Adapter Registry
 * Manages platform-specific adapters and matches current tab URL/DOM to the right adapter.
 */

import { linkedinAdapter } from './linkedinAdapter.js';
import { indeedAdapter } from './indeedAdapter.js';

const adapters = [
  linkedinAdapter,
  indeedAdapter
];

/**
 * Finds matching site adapter for the current page
 * @param {string} url - Tab URL
 * @param {Document} doc - DOM document reference
 * @returns {Object|null} Matching Adapter or null
 */
export function findMatchingAdapter(url, doc = document) {
  for (const adapter of adapters) {
    try {
      if (adapter.matches(url, doc)) {
        console.log(`[JobTrack] Matched Site Adapter: ${adapter.name}`);
        return adapter;
      }
    } catch (e) {
      console.warn(`[JobTrack] Error evaluating adapter ${adapter.id}:`, e);
    }
  }
  return null;
}
