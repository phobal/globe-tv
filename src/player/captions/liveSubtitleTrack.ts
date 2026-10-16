interface CueLike {
  startTime: number;
  endTime: number;
  text: string;
}

interface TrackLike<Cue extends CueLike> {
  mode: string;
  addCue(cue: Cue): void;
  removeCue(cue: Cue): void;
}

export interface SubtitlePlayer<Cue extends CueLike> {
  currentTime(): number | undefined;
  addRemoteTextTrack(options: { kind: string; label: string; language: string }, manualCleanup: boolean): { track: TrackLike<Cue> };
  removeRemoteTextTrack(remote: { track: TrackLike<Cue> }): unknown;
}

function browserCue(startTime: number, endTime: number, text: string): VTTCue {
  const browser = globalThis as typeof globalThis & { vttjs?: { VTTCue?: typeof VTTCue } };
  const Constructor = browser.VTTCue ?? browser.vttjs?.VTTCue;
  if (!Constructor) throw new Error('当前浏览器无法创建实时字幕。');
  const cue = new Constructor(startTime, endTime, text);
  cue.align = 'center';
  cue.position = 50;
  cue.size = 80;
  cue.line = -3;
  return cue;
}

export function attachLiveSubtitleTrack<Cue extends CueLike>(
  player: SubtitlePlayer<Cue>,
  makeCue: (startTime: number, endTime: number, text: string) => Cue = browserCue as unknown as (startTime: number, endTime: number, text: string) => Cue,
) {
  // Programmatic tracks cannot be removed. A remote track with manual cleanup
  // survives HLS source replacement and can be removed when captions stop.
  const remote = player.addRemoteTextTrack({ kind: 'subtitles', label: '中文（实时）', language: 'zh' }, true);
  const track = remote.track;
  track.mode = 'showing';
  let cue: Cue | null = null;
  let disposed = false;

  const clear = () => {
    if (cue) track.removeCue(cue);
    cue = null;
    // video.js retains an active cue after its cue list becomes empty. Hiding
    // the track clears its rendered caption until the next phrase arrives.
    track.mode = 'disabled';
  };

  return {
    show(text: string) {
      if (disposed) return;
      clear();
      const now = player.currentTime() ?? 0;
      cue = makeCue(Math.max(0, now - 0.1), now + 8, text);
      track.addCue(cue);
      track.mode = 'showing';
    },
    clear,
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      track.mode = 'disabled';
      player.removeRemoteTextTrack(remote);
    },
  };
}
