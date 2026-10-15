# Mobile Channel Swipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones, swipe vertically in the player to move through the current country's channels.

**Architecture:** A small pure module determines swipe direction and adjacent channel in the same order as the default list. `PlayerModal` captures touch gestures outside controls and reports a direction. `App` owns the channel sequence and reuses its existing `play` function to switch channels and update the URL.

**Tech Stack:** React 19, TypeScript, video.js, Vitest, Tailwind CSS.

---

### Task 1: Navigation rules

**Files:**
- Create: `src/player/channelNavigation.ts`
- Create: `tests/channelNavigation.test.ts`

- [x] **Step 1: Write failing tests.** Verify that `getSwipeDirection({ x: 0, y: 100, time: 0 }, { x: 0, y: 0, time: 300 })` returns `'next'`; the inverse returns `'previous'`; 30 px, predominantly horizontal, and movements over 1000 ms return `null`. Verify `orderedChannels` sorts names and `adjacentChannel` returns `undefined` at both ends.
- [x] **Step 2: Run `npm test -- tests/channelNavigation.test.ts`.** Expect failure because the new module does not yet exist.
- [x] **Step 3: Implement pure functions.** Export `type Direction = 'next' | 'previous'`; `getSwipeDirection(start: TouchPoint, end: TouchPoint): Direction | null` with a 70 px minimum, vertical distance greater than 1.2 times horizontal distance, and at most 1000 ms; `orderedChannels(channels: Channel[]): Channel[]` using `name.localeCompare`; and `adjacentChannel(channels: Channel[], id: string, direction: Direction): Channel | undefined` with no wraparound.
- [x] **Step 4: Rerun the focused test.** Expect all navigation cases to pass.

### Task 2: Player gesture and channel state

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/player/PlayerModal.tsx`

- [x] **Step 1: In `App`, memoize the ordered current-country channels.** Only use them when `playing?.countryCode === countryCode`; find the current index, derive a one-based position, and pass it to `PlayerModal`.
- [x] **Step 2: Add an `onNavigate(direction: Direction)` callback.** Find the adjacent channel from the ordered sequence and call existing `play(next)` when present. Give `PlayerModal` a `key` of `playing.id` to reset the player session on each switch.
- [x] **Step 3: In `PlayerModal`, capture touch start/end/cancel on the player container.** Only accept a single touch at widths below 640 px with a coarse pointer. Ignore gestures starting or ending in buttons, links, form fields, video.js controls or menus. Pass a valid swipe direction to `onNavigate` once.
- [x] **Step 4: Add a compact mobile-only channel position and swipe hint overlay.** Render it only when the position is known and there are at least two channels. Keep it outside the playback controls and use `pointer-events-none`.
- [x] **Step 5: Lock background scrolling while the player is open.** Save `document.body.style.overflow`, set it to `hidden`, then restore the saved value in the effect cleanup.

### Task 3: Verification

**Files:**
- Review: `src/app/App.tsx`, `src/player/PlayerModal.tsx`, `src/player/channelNavigation.ts`, `tests/channelNavigation.test.ts`

- [x] **Step 1: Run `npm test`, `npm run typecheck`, and `npm run build`.** All must pass.
- [x] **Step 2: On a phone viewport, check upward/downward swipes, list boundaries, close, play/pause, control-bar taps, and source menu interactions.** Each gesture should switch at most one channel and controls should retain their actions.
- [x] **Step 3: Review the final diff and report any unverified device-specific behavior.**
