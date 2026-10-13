# Relaxed motion proposal (Phase G, 2026-10-13)

**Owner note:** "Animations feel too fast — make them more relaxed and calm"

This is a proposal only. Nothing in the source code has been changed. The owner picks the pace on the canvas (`pick-motion-pace`, section 3, with a "Today vs Relaxed" tracker demo that plays once per tap).

## What runs today

The source is `nativeMotion` in `packages/design-tokens/src/index.ts`. Its durations must match `webMotion` in `apps/web/src/lib/motion.ts`, which `tests/native-motion-tokens.test.ts` checks.

| Token | Today | Used by (grep of `packages/mobile-ui/src`; app screens use these components) |
| --- | --- | --- |
| `control` | 120 ms | CheckRow tick, PressableScale reduced-motion dim, SaveHeart pop, list exit fade |
| `selection` | 180 ms | MoodHeader mood change, PhotoRing photo fade-in |
| `content` | 220 ms | FadeSwap, list entering and layout, CheckRow dim, StateArt, MoodFill |
| `feature` | 320 ms | RantangTrack stage change, MoodArc marker, LaunchCover, SheetHeader focus delay |
| `ease` | cubic-bezier(.16, 1, .3, 1) | Every timing above. An expo-out curve: about half the move happens in the first tenth of the time and 83% in the first quarter, which makes it feel like a lunge. |
| `spring` | damping 18, stiffness 260 (mass 1) | PressableScale press, SaveHeart settle. Damping ratio 18 / (2 × √260) = 0.56, so it overshoots and wobbles. |
| Fixed | `HEART_BURST_MS` 380, `SUCCESS_RIG_MS` 1200 | Heart burst; the success rig, which follows the rig's choreography |
| Loops | `MascotLoading`, `MascotReading` (2400 ms), `Skeleton` pulse (700 ms per half) | Run only while waiting (D3) |

## Proposed values

| Token | Today | **Relaxed (proposed)** | Even slower |
| --- | --- | --- | --- |
| `control` | 120 | **160** | 200 |
| `selection` | 180 | **280** | 340 |
| `content` | 220 | **360** | 440 |
| `feature` | 320 | **520** | 680 |
| `ease` | (.16, 1, .3, 1) | **(.33, 1, .68, 1)**: ease-out cubic, a gentle start and a long, soft landing | (.33, 1, .68, 1) |
| `spring` | damping 18, stiffness 260 (ratio 0.56) | **damping 26, stiffness 170 (ratio 1.0, no overshoot)** | damping 22, stiffness 120 (ratio 1.0) |
| `HEART_BURST_MS` | 380 | **560** | 680 |
| `SUCCESS_RIG_MS` | 1200 | unchanged; the timing belongs to the rig art | unchanged |

Why these values:

- **About 1.6 times longer, not 2 times.** Every move gets longer, but a tap still answers within 160 ms, so press feedback stays immediate (apple-design: respond on press-down). The longest regular move, a tracker stage change, takes about half a second.
- **Most of the calm comes from the ease, not the length.** With (.33, 1, .68, 1), 27% of the move happens in the first tenth of the time (49% today) and 58% in the first quarter (83% today). So a 520 ms move starts gently instead of jumping and then crawling.
- **The press spring loses its bounce.** At a damping ratio of 1.0 it settles without the small wobble that reads as busy. That matches apple-design's default of a critically damped spring for anything not thrown by a gesture.
- **Selection stays shorter than content, and content shorter than feature.** The order of the tokens is kept, so the hierarchy of moves is unchanged.

## Rules that do not change

- **No loops (D3).** Motion happens only on a change of state. The tracker moves only when the stage changes. The mascot and skeleton loops still run only while waiting, and their timing is not part of this proposal.
- **Reduced motion.** Every animation stays instant (or a plain fade, as today) when the device asks for reduced motion. All the components above already check it, so new durations do not change that path.
- **Only transform and opacity move.** No layout properties are animated.

## Implementation notes for G7 or the motion task

1. Change `nativeMotion` and `webMotion` together, so `tests/native-motion-tokens.test.ts` keeps passing and the web and native apps feel the same. If the owner wants only native slowed down, that test's parity rule has to be loosened deliberately and recorded in DESIGN.md.
2. Do not tie `SheetHeader`'s TalkBack focus delay to `feature`. A 520 ms delay would make the G1(d) focus problem worse. Focus should follow the sheet's present event, as the G-b fix already plans.
3. `LaunchCover` becomes 520 ms. Check that the cold start does not feel slower than the splash it hands over from.
4. Update the duration line in DESIGN.md's motion section to match the picked values.
