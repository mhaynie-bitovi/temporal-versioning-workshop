# replay-flow

## Purpose

Show how Temporal replays a workflow after a worker restart. This is the "happy path" - code hasn't changed, so replay succeeds.

## Visual Elements

- Three boxes in a horizontal row: **Code**, **SDK**, **History**
- Two faint arrows connecting them left-to-right
- A moving **packet** (small rounded rect with a 1-word label) that animates between boxes
- **History event blocks** that appear inside the History box as events are recorded
- **Checkmarks** that appear next to history blocks during replay to show matches

## Animation Phases

### Phase 1: EXECUTION (green)

1. Fade in the three boxes and arrows
2. Show "EXECUTION" phase label at top in green
3. For each event ("request", "move", "timer"):
   - A green packet with the event name appears at Code
   - Packet slides Code -> SDK -> History
   - Packet disappears, a labeled block appears in the History box
4. Show "stored durably" label under History

### Phase 2: REPLAY (blue)

1. Switch phase label to "REPLAY" in blue
2. Flash "worker restarts" briefly
3. Code box glows blue
4. For each event:
   - A blue packet with the event name appears at Code
   - Packet slides Code -> SDK
   - SDK checks the matching history block (flash/pulse)
   - Checkmark appears next to that history block
   - A blue "result" packet slides SDK -> Code
   - History block grays out (consumed)
5. Show "state recovered" label at bottom

### Fade out

## Timing

- Total duration: ~12-15 seconds
- Each event cycle: ~1.5s for execution, ~1s for replay
- Pauses between phases: ~0.5-1s

## Style

- Dark background, clean box outlines
- Green = execution, Blue = replay
- Uses shared theme from `styles/theme.ts`
