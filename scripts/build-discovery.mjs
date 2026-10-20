import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import defaultMapping from './discovery-mapping.json' with { type: 'json' };
const definitions = [['central', '央视卫视'], ['local', '地方频道'], ['sports', '体育'], ['entertainment', '影视娱乐'], ['kids', '少儿'], ['overseas', '海外频道'], ['more', '更多']];
const categoryIds = new Set(definitions.map(([id]) => id));
const compare = (a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN') || a.id.localeCompare(b.id);
export function buildDiscoveryCatalog(groups, mapping = defaultMapping) {
  const diagnostics = [];
  const channels = [];
  const seen = new Set();
  for (const group of [...groups].sort((a,b) => a.slug.localeCompare(b.slug))) {
    if (!Array.isArray(group.channels)) { diagnostics.push({ group: group.slug, error: '分组必须是数组' }); continue; }
    for (const channel of group.channels) {
      if (!channel || typeof channel.id !== 'string' || !channel.id || typeof channel.name !== 'string' || !channel.name.trim() || !Array.isArray(channel.sources) || !channel.sources.length || channel.sources.some(s => s?.kind !== 'hls' || typeof s.url !== 'string' || !/^https?:\/\//i.test(s.url))) {
        diagnostics.push({ group: group.slug, id: channel?.id, error: '频道字段或播放源无效' }); continue;
      }
      if (seen.has(channel.id)) { diagnostics.push({ group: group.slug, id: channel.id, error: '频道 ID 重复' }); continue; }
      const rule = mapping.channels?.[channel.id] ?? mapping.groups?.[group.slug] ?? { primaryCategory: 'more', categoryIds: ['more'] };
      if (!categoryIds.has(rule.primaryCategory) || !Array.isArray(rule.categoryIds) || !rule.categoryIds.includes(rule.primaryCategory) || rule.categoryIds.some(id => !categoryIds.has(id))) throw new Error(`分类映射无效: ${channel.id}`);
      seen.add(channel.id);
      const contentType = rule.contentType ?? (group.slug === 'event-replay' ? 'replay' : group.slug.includes('on-demand') ? 'on-demand' : group.slug === 'radio-live' ? 'radio' : group.slug === 'surveillance-live' ? 'scenic' : 'live');
      channels.push({ id: channel.id, name: channel.name, ...(channel.logo ? { logo: channel.logo } : {}), countryCode: channel.countryCode ?? '', languages: Array.isArray(channel.languages) ? channel.languages : [], groupSlug: group.slug, groupName: channel.group || group.name || group.slug, primaryCategory: rule.primaryCategory, categoryIds: [...new Set(rule.categoryIds)], contentType });
    }
  }
  channels.sort(compare);
  const catalog = { version: '1', categories: definitions.map(([id, name]) => ({ id, name, channelCount: channels.filter(c => c.categoryIds.includes(id)).length })), groups: [...new Map(channels.map(c => [c.groupSlug, { slug: c.groupSlug, name: c.groupName }])).values()].sort((a,b) => a.slug.localeCompare(b.slug)), channels };
  return { catalog, diagnostics };
}
export async function generateDiscovery(outputDir = 'public/data', reportPath = path.join(outputDir, 'category-report.json')) {
  const categoryDir = path.join(outputDir, 'category');
  const files = (await readdir(categoryDir)).filter(f => f.endsWith('.json')).sort();
  const groups = [];
  const parseDiagnostics = [];
  for (const file of files) {
    try { groups.push({ slug: file.slice(0,-5), channels: JSON.parse(await readFile(path.join(categoryDir,file),'utf8')) }); }
    catch (error) { parseDiagnostics.push({ group: file, error: String(error) }); }
  }
  const { catalog, diagnostics } = buildDiscoveryCatalog(groups);
  diagnostics.push(...parseDiagnostics);
  const report = { generatedAt: new Date().toISOString(), categoryCount: groups.length, channelCount: catalog.channels.length, sourceCount: groups.reduce((sum,g) => sum + (Array.isArray(g.channels) ? g.channels.reduce((s,c) => s + (c?.sources?.length || 0),0) : 0),0), categories: catalog.groups.map(g => ({ ...g, channelCount: catalog.channels.filter(c => c.groupSlug === g.slug).length })), diagnostics };
  await writeFile(path.join(outputDir, 'discovery.json'), JSON.stringify(catalog, null, 2) + '\n');
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  for (const diagnostic of diagnostics) console.warn('目录诊断:', JSON.stringify(diagnostic));
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await generateDiscovery(process.argv[2]);
