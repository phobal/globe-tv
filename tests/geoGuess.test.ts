import { describe, expect, it } from 'vitest';
import { guessUserCountry } from '../src/data/geo';

interface WindowLike {
  navigator: {
    language?: string;
    languages?: readonly string[];
  };
}

function withWindow(value: WindowLike | undefined, setup: () => void): void {
  const g = globalThis as unknown as { window?: WindowLike };
  const original = g.window;
  if (value === undefined) {
    delete g.window;
  } else {
    g.window = value;
  }
  try {
    setup();
  } finally {
    if (original === undefined) {
      delete g.window;
    } else {
      g.window = original;
    }
  }
}

describe('guessUserCountry', () => {
  it('returns null when window is undefined', () => {
    withWindow(undefined, () => {
      expect(guessUserCountry()).toBeNull();
    });
  });

  it('returns cn for Chinese language even without timezone', () => {
    withWindow({ navigator: { language: 'zh-CN' } }, () => {
      expect(guessUserCountry()).toBe('cn');
    });
  });

  it('returns cn for zh-Hant variant', () => {
    withWindow({ navigator: { language: 'zh-Hant' } }, () => {
      expect(guessUserCountry()).toBe('cn');
    });
  });
});
