import { describe, expect, it, vi } from 'vitest';
import { attachLiveSubtitleTrack } from '../src/player/captions/liveSubtitleTrack';

function fixture() {
  const cues: Array<{ startTime: number; endTime: number; text: string }> = [];
  const track = {
    mode: 'disabled',
    addCue: vi.fn((cue: typeof cues[number]) => { cues.push(cue); }),
    removeCue: vi.fn((cue: typeof cues[number]) => { cues.splice(cues.indexOf(cue), 1); }),
  };
  const remote = { track };
  const player = {
    currentTime: () => 120,
    addRemoteTextTrack: vi.fn(() => remote),
    removeRemoteTextTrack: vi.fn(),
  };
  const makeCue = (startTime: number, endTime: number, text: string) => ({ startTime, endTime, text });
  return { cues, track, remote, player, makeCue };
}

describe('live video.js subtitle track', () => {
  it('adds Chinese subtitles to a removable video.js track and replaces old cues', () => {
    const f = fixture();
    const subtitles = attachLiveSubtitleTrack(f.player, f.makeCue);
    expect(f.player.addRemoteTextTrack).toHaveBeenCalledWith({ kind: 'subtitles', label: '中文（实时）', language: 'zh' }, true);
    expect(f.track.mode).toBe('showing');
    subtitles.show('你好');
    subtitles.show('世界');
    expect(f.cues.map(cue => cue.text)).toEqual(['世界']);
    expect(f.cues[0].startTime).toBeLessThanOrEqual(120);
    expect(f.cues[0].endTime).toBeGreaterThan(120);
    subtitles.dispose();
    expect(f.cues).toEqual([]);
    expect(f.player.removeRemoteTextTrack).toHaveBeenCalledWith(f.remote);
  });

  it('clears the active subtitle when playback pauses or the source changes', () => {
    const f = fixture();
    const subtitles = attachLiveSubtitleTrack(f.player, f.makeCue);
    subtitles.show('旧频道');
    subtitles.clear();
    expect(f.cues).toEqual([]);
    expect(f.track.mode).toBe('disabled');
    subtitles.show('新频道');
    expect(f.track.mode).toBe('showing');
    expect(f.cues.map(cue => cue.text)).toEqual(['新频道']);
  });
});
