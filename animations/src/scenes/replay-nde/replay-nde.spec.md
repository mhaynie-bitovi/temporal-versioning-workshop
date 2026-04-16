# replay-nde

## Purpose

Show what happens when code changes between executions cause a Non-Determinism Error (NDE) during replay. The workflow was executed with v1 code, but the worker now runs v2 code that produces a different command at position 3.

## Visual Elements

- Same three-box layout as replay-flow: **Code v2**, **SDK**, **History v1**
- The "v2" and "v1" labels on Code and History emphasize the version mismatch
- History blocks are pre-filled (already recorded from v1 execution)
- A moving packet, checkmarks, and an **X mark** for the mismatch
- Mismatch detail labels showing `history: "timer"` vs `code: "notify"`
- Large red **"Non-Determinism Error"** text

## Animation Phases

### Setup

1. Fade in all three boxes
2. Show pre-existing history blocks at reduced opacity (they exist from v1)

### REPLAY WITH CHANGED CODE (blue)

1. Show phase label in blue
2. Code box glows blue
3. First two events ("request", "move") replay successfully:
   - Blue packet slides Code -> SDK
   - SDK checks history block, checkmark appears
   - Result packet returns to Code
   - History block grays out
4. These are fast (~0.5s each) to build momentum

### MISMATCH (red)

1. Code sends "notify" (the new v2 activity) as a blue packet to SDK
2. SDK checks history block 3 which says "timer" - turns red
3. Pause for dramatic effect
4. Everything goes red simultaneously:
   - Packet turns red
   - All box strokes turn red
   - X mark appears at history block 3
   - Mismatch detail labels appear (`history: "timer"` / `code: "notify"`)
5. Packet fades
6. Large "Non-Determinism Error" text fades in with a scale pulse
7. "workflow stuck" label appears below

### Fade out

## Timing

- Total duration: ~10-12 seconds
- Matching events are fast to contrast with the dramatic mismatch
- Hold on the NDE display for ~2s so it registers

## Style

- Same dark background and box styling as replay-flow
- Blue for replay, Red for error/mismatch
- The mismatch moment should feel abrupt and alarming
- Uses shared theme from `styles/theme.ts`
