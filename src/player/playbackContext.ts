export interface PlaybackContext { categoryId: string; channelIds: string[] }
interface CategorizedChannel { id: string; name: string; primaryCategory: string; categoryIds: readonly string[] }

/** Capture a stable category queue; searching and later browsing cannot mutate it. */
export function resolvePlaybackContext(channels: readonly CategorizedChannel[], id: string, preferredCategory?: string): PlaybackContext | undefined {
  const channel = channels.find(item => item.id === id);
  if (!channel) return undefined;
  const categoryId = preferredCategory && channel.categoryIds.includes(preferredCategory) ? preferredCategory : channel.primaryCategory;
  const channelIds = channels.filter(item => item.categoryIds.includes(categoryId))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN') || a.id.localeCompare(b.id))
    .map(item => item.id);
  return { categoryId, channelIds };
}
