# Live Translated Captions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show user initiated Chinese captions over live video on desktop Chrome without a paid speech API.

**Architecture:** Request user approved tab audio with `getDisplayMedia`; feed its audio track to Chrome speech recognition and translate final phrases with the desktop `Translator` API. Keep browser API code outside React, use a session ID to reject stale translations, and write each Chinese phrase into a removable video.js subtitle track.

**Tech Stack:** React 19, TypeScript, video.js, Vitest, Chrome Web Speech and Translator APIs.

---

## File map

- `src/player/captions/browser.ts`: browser capability detection, translator preparation, tab capture, speech recognition adapter and browser API types.
- `src/player/captions/session.ts`: caption lifecycle, translation queue, stale-result protection, and cleanup.
- `src/player/captions/liveSubtitleTrack.ts`: removable video.js subtitle track and `VTTCue` lifecycle.
- `src/player/CaptionControls.tsx`: language choice, privacy disclosure, preparation and capture buttons, status and fallback instructions.
- `src/player/PlayerModal.tsx`: own caption session, connect to video.js playback events and subtitle track.
- `src/app/App.tsx`: preserve the modal component across channel changes so tab capture can be reused.
- `tests/captionSession.test.ts`, `tests/captionBrowser.test.ts`, `tests/liveSubtitleTrack.test.ts`, `tests/captionControls.test.tsx`: focused behavior tests.
- `docs/validation/live-captions.md`: record live-browser verification and supported cases.

### Task 1: Browser adapter

**Files:** Create `src/player/captions/browser.ts`.

- [ ] Define typed `Translator`/`SpeechRecognition` browser interfaces only for members used here. `supported()` checks secure context, `getDisplayMedia`, speech recognition, and `Translator` independently and returns a user readable reason.
- [x] `prepare(sourceLanguage, onProgress)` calls `Translator.create` synchronously from the click handler before any awaited action, then awaits creation and reports download progress; unsupported language pairs reject visibly.
- [x] `capture()` calls `navigator.mediaDevices.getDisplayMedia({video:true,audio:true,preferCurrentTab:true,selfBrowserSurface:'include'})` directly from a second click handler. Require an audio track; stop all tracks and show a specific no-audio message if absent. Keep video track unused until cleanup because ending it might end the capture session.
- [x] `recognize(track, language, onFinal, onFailure)` configures `continuous` and `interimResults`, installs an available local speech pack, and begins with `start(track)`. If local recognition is unavailable, require the caller's explicit remote-recognition consent before starting. Expose `stop()` and end/error callbacks.
- [x] Run `npm run typecheck`; expected: zero errors. Commit the adapter after it compiles.

### Task 2: Session behavior

**Files:** Create `src/player/captions/session.ts` and `tests/captionSession.test.ts`.

- [x] Write fake-adapter tests: final phrases translate in arrival order; `invalidate()` clears text and discards late translations; `stop()` closes the recognition, translator and every capture track; ended audio track transitions to error; pause clears text and stops recognition while retaining capture.
- [x] Run `npm test -- tests/captionSession.test.ts`; expected: failures for missing session module.
- [x] Implement a `CaptionSession` with explicit `idle | preparing | ready | needs-consent | active | paused | error` phases. Keep `generation` integer; every asynchronous completion compares its generation with current before publishing. Queue final phrases with a promise chain and catch translation errors into a visible state.
- [x] Run focused tests; expected: all caption session cases pass. Commit the module and tests.

### Task 3: Player interface

**Files:** Create `src/player/CaptionControls.tsx`, `src/player/captions/liveSubtitleTrack.ts`; modify `src/player/PlayerModal.tsx`, `src/app/App.tsx`.

- [x] Add a caption button near the source selector. The controls expose original language, model download status, local/remote recognition disclosure, “准备翻译” and “共享此标签页音频” as separate user actions. Unsupported/mobile states link to Chrome's Live Caption/Live Translate help.
- [x] Add a removable video.js `subtitles` track (`language: zh`, `label: 中文（实时）`); write each translation into a centered `VTTCue` near the bottom of the picture, replacing the previous cue. Remove the track when captions stop. Video.js renders the cue in its full-screen element.
- [x] Connect `playing`, `pause`, `error`, source index and channel ID transitions to the session. Invalidate queued results on source/channel changes; close capture on subtitle off or modal close. Remove `key={playing.id}` from `PlayerModal` so the permission-bearing session survives a channel switch; the existing `useEffect([channel.id])` still recreates video.js.
- [x] Run `npm run typecheck`, `npm test`, `npm run build`; expected: all pass. Commit the player integration.

### Task 4: Real browser validation

**Files:** Create `docs/validation/live-captions.md`; review the changed files.

- [x] On desktop Chrome over HTTPS or localhost, test two playable external HLS channels. DW English and France 24 English passed the real capture → browser-managed recognition → local translation → video.js display path; the local speech-pack path still needs target-device verification.
- [ ] Test ordinary and full-screen caption placement, pause/resume, source switch, channel switch, stopped sharing, refusal, and close. Automated integration covered placement, pause, source switch and close with controlled browser APIs; remaining live cases need manual verification.
- [x] Record results and limitations in `docs/validation/live-captions.md`; run the required project checks once more only if validation produced code changes. Commit the validation note.

## References

- [Approved design](../specs/2026-10-15-live-translated-captions-design.md)
- [Chrome Translator API](https://developer.chrome.com/docs/ai/translator-api)
- [SpeechRecognition.start(audioTrack)](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start)
- [getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
