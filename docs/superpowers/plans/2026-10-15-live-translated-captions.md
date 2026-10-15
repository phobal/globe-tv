# Live Translated Captions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show user initiated Chinese captions over live video on desktop Chrome without a paid speech API.

**Architecture:** Request user approved tab audio with `getDisplayMedia`; feed its audio track to Chrome speech recognition and translate final phrases with the desktop `Translator` API. Keep browser API code outside React, use a session ID to reject stale translations, and render the caption inside video.js's fullscreen element.

**Tech Stack:** React 19, TypeScript, video.js, Vitest, Chrome Web Speech and Translator APIs.

---

## File map

- `src/player/captions/browser.ts`: browser capability detection, translator preparation, tab capture, speech recognition adapter and browser API types.
- `src/player/captions/session.ts`: caption lifecycle, translation queue, stale-result protection, and cleanup.
- `src/player/CaptionControls.tsx`: language choice, privacy disclosure, preparation and capture buttons, status and fallback instructions.
- `src/player/PlayerModal.tsx`: own caption session, connect to video.js playback events, overlay in fullscreen element.
- `src/app/App.tsx`: preserve the modal component across channel changes so tab capture can be reused.
- `src/app.css`: caption overlay styling.
- `tests/captionSession.test.ts`: behavior tests with fake browser dependencies.
- `docs/validation/live-captions.md`: record live-browser verification and supported cases.

### Task 1: Browser adapter

**Files:** Create `src/player/captions/browser.ts`.

- [ ] Define typed `Translator`/`SpeechRecognition` browser interfaces only for members used here. `supported()` checks secure context, `getDisplayMedia`, speech recognition, and `Translator` independently and returns a user readable reason.
- [ ] `prepare(sourceLanguage, onProgress)` calls `Translator.availability({sourceLanguage,targetLanguage:'zh'})`; reject `unavailable`; call `Translator.create` synchronously from the click handler before any unrelated awaited action, then await creation and report download progress.
- [ ] `capture()` calls `navigator.mediaDevices.getDisplayMedia({video:true,audio:true,preferCurrentTab:true,selfBrowserSurface:'include'})` directly from a second click handler. Require an audio track; stop all tracks and throw a specific `no-audio` error if absent. Keep video track unused until cleanup because ending it might end the capture session.
- [ ] `recognize(track, language, onFinal, onFailure)` configures `continuous` and `interimResults`, checks local recognition availability, and begins with `start(track)`. If local recognition is unavailable, require the caller's explicit remote-recognition consent before starting. Expose `stop()` and end/error callbacks.
- [ ] Run `npm run typecheck`; expected: zero errors. Commit the adapter after it compiles.

### Task 2: Session behavior

**Files:** Create `src/player/captions/session.ts` and `tests/captionSession.test.ts`.

- [ ] Write fake-adapter tests: final phrases translate in arrival order; `invalidate()` clears text and discards late translations; `stop()` closes the recognition, translator and every capture track; ended audio track transitions to error; pause clears text and stops recognition while retaining capture.
- [ ] Run `npm test -- tests/captionSession.test.ts`; expected: failures for missing session module.
- [ ] Implement a `CaptionSession` with explicit `idle | preparing | ready | needs-consent | active | paused | error` phases. Keep `generation` integer; every asynchronous completion compares its generation with current before publishing. Queue final phrases with a promise chain and catch translation errors into a visible state.
- [ ] Run focused tests; expected: all caption session cases pass. Commit the module and tests.

### Task 3: Player interface

**Files:** Create `src/player/CaptionControls.tsx`; modify `src/player/PlayerModal.tsx`, `src/app/App.tsx`, `src/app.css`.

- [ ] Add a desktop-only caption button near the source selector. The controls expose original language, model download status, local/remote recognition disclosure, “准备翻译” and “共享此标签页音频” as separate user actions. Unsupported/mobile states link to Chrome's Live Caption/Live Translate help.
- [ ] Create a caption overlay element inside `player.el()` and render Chinese text into it, with `pointer-events:none`, a maximum of two lines, centered above the video.js control bar. Remove the element when disposing the player. Keep the control panel outside the fullscreen element but ensure caption text remains visible in fullscreen.
- [ ] Connect `playing`, `pause`, `error`, source index and channel ID transitions to the session. Invalidate queued results on source/channel changes; close capture on subtitle off or modal close. Remove `key={playing.id}` from `PlayerModal` so the permission-bearing session survives a channel switch; the existing `useEffect([channel.id])` still recreates video.js.
- [ ] Run `npm run typecheck`, `npm test`, `npm run build`; expected: all pass. Commit the player integration.

### Task 4: Real browser validation

**Files:** Create `docs/validation/live-captions.md`; review the changed files.

- [ ] On desktop Chrome over HTTPS or localhost, test two playable external HLS channels. Confirm current-tab audio capture returns a live track, original sound remains audible, recognition emits nonempty text, and `en → zh` produces captions. If an expected capability is missing, record the browser version and exact failure; do not claim success.
- [ ] Test ordinary and full-screen caption placement, pause/resume, source switch, channel switch, stopped sharing, refusal, and close. Confirm no obsolete caption survives or capture indicator remains after close.
- [ ] Record results and limitations in `docs/validation/live-captions.md`; run the required project checks once more only if validation produced code changes. Commit the validation note.

## References

- [Approved design](../specs/2026-10-15-live-translated-captions-design.md)
- [Chrome Translator API](https://developer.chrome.com/docs/ai/translator-api)
- [SpeechRecognition.start(audioTrack)](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start)
- [getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
