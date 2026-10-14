export type PlaybackPhase = 'idle' | 'loading' | 'playing' | 'trying-next' | 'failed' | 'awaiting-gesture';
export interface SourceState { session: number; phase: PlaybackPhase; sourceIndex: number; sourceCount: number; cancelled: boolean }
export function beginSession(previous: SourceState, sourceCount: number): SourceState {
  return { session: previous.session + 1, phase: sourceCount ? 'loading' : 'failed', sourceIndex: 0, sourceCount, cancelled: false };
}
export function nextSource(state: SourceState, session: number): SourceState {
  if (state.session !== session || state.cancelled) return state;
  return state.sourceIndex + 1 < state.sourceCount
    ? { ...state, sourceIndex: state.sourceIndex + 1, phase: 'trying-next' }
    : { ...state, phase: 'failed' };
}
export function chooseSource(state: SourceState, index: number): SourceState {
  if (index < 0 || index >= state.sourceCount) return state;
  return { ...state, sourceIndex: index, phase: 'loading', cancelled: false, session: state.session + 1 };
}
export function cancelSource(state: SourceState): SourceState {
  return { ...state, cancelled: true, phase: 'idle', session: state.session + 1 };
}
