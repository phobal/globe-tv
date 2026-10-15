import type { Channel } from '../data/types';

export type Direction = 'next' | 'previous';

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export function getSwipeDirection(start: TouchPoint, end: TouchPoint): Direction | null {
  const vertical = end.y - start.y;
  const horizontal = end.x - start.x;
  const elapsed = end.time - start.time;
  if (elapsed < 0 || elapsed > 1000 || Math.abs(vertical) < 70 || Math.abs(vertical) <= Math.abs(horizontal) * 1.2) return null;
  return vertical < 0 ? 'next' : 'previous';
}

export function orderedChannels(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => a.name.localeCompare(b.name));
}

export function adjacentChannel(channels: Channel[], id: string, direction: Direction): Channel | undefined {
  const index = channels.findIndex(channel => channel.id === id);
  if (index < 0) return undefined;
  return channels[index + (direction === 'next' ? 1 : -1)];
}
