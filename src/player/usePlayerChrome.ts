import { useCallback, useEffect, useState } from 'react';
interface Options { playing: boolean; expanded: boolean; autoHide?: boolean; blocking?: boolean; channelId?: string }
export function usePlayerChrome({ playing, expanded, autoHide = true, blocking = false, channelId }: Options) {
  const [visible, setVisible] = useState(true), [focused, setFocused] = useState(false), [pulse, setPulse] = useState(0);
  const reveal = useCallback(() => { setVisible(true); setPulse(value => value + 1); }, []);
  const focus = useCallback(() => { setFocused(true); setVisible(true); }, []);
  const blur = useCallback(() => { setFocused(false); setPulse(value => value + 1); }, []);
  useEffect(() => { setVisible(true); setPulse(value => value + 1); }, [channelId, expanded]);
  useEffect(() => {
    if (!expanded || !autoHide || !playing || blocking || focused || !visible) return;
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [playing, expanded, autoHide, blocking, focused, visible, channelId, pulse]);
  return { visible, reveal, focus, blur };
}
