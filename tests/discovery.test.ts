import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Node build script.
import { buildDiscoveryCatalog } from '../scripts/build-discovery.mjs';
const channel = { id: 'a', name: '台', countryCode: '', languages: [], sources: [{ kind: 'hls', url: 'https://test/a.m3u8', order: 0 }] };
describe('discovery generation', () => {
  it('keeps mixed sources in more and applies explicit multi-category overrides without sources', () => {
    const result = buildDiscoveryCatalog([{ slug: 'mixed', channels: [channel] }], { groups: {}, channels: { a: { primaryCategory: 'sports', categoryIds: ['sports', 'central'] } } });
    expect(result.catalog.channels[0]).toMatchObject({ primaryCategory: 'sports', categoryIds: ['sports', 'central'] });
    expect(JSON.stringify(result.catalog)).not.toContain('m3u8');
    expect(result.catalog.categories).toHaveLength(7);
    expect(buildDiscoveryCatalog([{ slug: 'mixed', channels: [channel] }]).catalog.channels[0].primaryCategory).toBe('more');
  });
  it('reports invalid entries and duplicate IDs rather than losing them silently', () => {
    const result = buildDiscoveryCatalog([{ slug: 'a', channels: [channel, channel, { name: 'broken' }] }]);
    expect(result.diagnostics).toHaveLength(2);
    expect(result.catalog.channels).toHaveLength(1);
  });
});
it('lazy loads a group, shares successful requests and retries a failed fetch', async () => {
  vi.resetModules();
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 500 })).mockResolvedValueOnce(Response.json([channel]));
  vi.stubGlobal('fetch', fetchMock);
  const { loadDiscoveryChannel } = await import('../src/data/discovery');
  const summary = { ...channel, groupSlug: 'a', groupName: 'A', categoryIds: ['more' as const], primaryCategory: 'more' as const, contentType: 'live' as const };
  await expect(loadDiscoveryChannel(summary)).rejects.toThrow();
  expect(await loadDiscoveryChannel(summary)).toEqual(channel);
  await loadDiscoveryChannel(summary);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  vi.unstubAllGlobals();
});
