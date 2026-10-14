import { describe, expect, it } from 'vitest';
import { beginSession, cancelSource, chooseSource, nextSource } from '../src/player/sourceMachine';

describe('备用源状态', () => {
  it('按顺序尝试并在用尽时失败', () => {
    const first = beginSession({ session: 0, phase: 'idle', sourceIndex: 0, sourceCount: 0, cancelled: false }, 2);
    const second = nextSource(first, first.session);
    expect(second.sourceIndex).toBe(1);
    expect(nextSource(second, second.session).phase).toBe('failed');
  });
  it('忽略旧会话错误，允许取消和手选源', () => {
    const first = beginSession({ session: 0, phase: 'idle', sourceIndex: 0, sourceCount: 0, cancelled: false }, 2);
    const changed = chooseSource(first, 1);
    expect(nextSource(changed, first.session)).toBe(changed);
    expect(nextSource(cancelSource(changed), changed.session).phase).toBe('idle');
  });
});
