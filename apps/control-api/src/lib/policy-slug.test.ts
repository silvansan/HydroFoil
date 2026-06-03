import { describe, expect, it } from 'vitest';

import {
  ensureUniquePolicySlug,
  resolvePolicySlug,
  slugifyPolicyName,
} from './policy-slug.js';

describe('policy-slug', () => {
  it('slugifies display names', () => {
    expect(slugifyPolicyName('Partner Sites Only!')).toBe('partner-sites-only');
    expect(slugifyPolicyName('  Live Event #2  ')).toBe('live-event-2');
  });

  it('resolves from name when slug omitted', () => {
    expect(resolvePolicySlug('My Policy')).toBe('my-policy');
  });

  it('normalizes explicit slug input', () => {
    expect(resolvePolicySlug('Ignored', 'Custom_Slug')).toBe('custom-slug');
  });

  it('dedupes against existing slugs', () => {
    const taken = new Set(['partner-sites', 'partner-sites-2']);
    expect(ensureUniquePolicySlug('partner-sites', taken)).toBe('partner-sites-3');
  });
});
