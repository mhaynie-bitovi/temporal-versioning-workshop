import {
  Rect,
  Txt,
  Line,
  Node,
  makeScene2D,
} from "@motion-canvas/2d";
import {
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  sequence,
  waitFor,
  Vector2,
} from "@motion-canvas/core";
import { colors, fonts, sizes, textProps, boxProps } from "../../styles/theme";

// ── Aliases for readability ─────────────────────────────────
const BG = colors.bg;
const BOX_FILL = colors.boxFill;
const BOX_STROKE = colors.boxStroke;
const GREEN = colors.green;
const BLUE = colors.blue;
const RED = colors.red;
const GRAY = colors.gray;
const WHITE = colors.white;
const LABEL_FAINT = colors.faint;
const EVENT_FILL = colors.eventFill;

const BOX_W = sizes.boxW;
const BOX_H = sizes.boxH;
const GAP = sizes.gap;
const BLOCK_H = sizes.blockH;
const BLOCK_W = sizes.blockW;

export default makeScene2D(function* (view) {
  view.fill(BG);

  const events = ["request", "move", "timer"];

  const codeBox = createRef<Rect>();
  const sdkBox = createRef<Rect>();
  const historyBox = createRef<Rect>();

  const historyBlocks = createRefArray<Rect>();
  const historyLabels = createRefArray<Txt>();
  const checkmarks = createRefArray<Txt>();

  const phaseLabel = createRef<Txt>();
  const packet = createRef<Rect>();
  const packetLabel = createRef<Txt>();

  const codeLabel = createRef<Txt>();

  // Mismatch indicators
  const xMark = createRef<Txt>();
  const ndeLabel = createRef<Txt>();
  const stuckLabel = createRef<Txt>();
  const mismatchExpected = createRef<Txt>();
  const mismatchGot = createRef<Txt>();

  view.add(
    <>
      <Txt
        ref={phaseLabel}
        text=""
        fontSize={36}
        fontWeight={700}
        fontFamily="Inter, system-ui, sans-serif"
        fill={WHITE}
        y={-280}
        opacity={0}
      />

      {/* Code box - labeled v2 */}
      <Rect
        ref={codeBox}
        x={-GAP}
        width={BOX_W}
        height={BOX_H}
        radius={16}
        fill={BOX_FILL}
        stroke={BOX_STROKE}
        lineWidth={2}
        opacity={0}
      >
        <Txt
          ref={codeLabel}
          text="Code v2"
          fontSize={28}
          fontWeight={600}
          fontFamily="Inter, system-ui, sans-serif"
          fill={WHITE}
        />
      </Rect>

      <Rect
        ref={sdkBox}
        x={0}
        width={BOX_W}
        height={BOX_H}
        radius={16}
        fill={BOX_FILL}
        stroke={BOX_STROKE}
        lineWidth={2}
        opacity={0}
      >
        <Txt
          text="SDK"
          fontSize={28}
          fontWeight={600}
          fontFamily="Inter, system-ui, sans-serif"
          fill={WHITE}
        />
      </Rect>

      <Rect
        ref={historyBox}
        x={GAP}
        width={BOX_W}
        height={BOX_H + events.length * (BLOCK_H + 8) + 20}
        radius={16}
        fill={BOX_FILL}
        stroke={BOX_STROKE}
        lineWidth={2}
        opacity={0}
      >
        <Txt
          text="History v1"
          fontSize={28}
          fontWeight={600}
          fontFamily="Inter, system-ui, sans-serif"
          fill={WHITE}
          y={-70}
        />
      </Rect>

      {/* Connector arrows (faint) */}
      <Line
        points={[
          new Vector2(-GAP + BOX_W / 2 + 10, 0),
          new Vector2(-BOX_W / 2 - 10, 0),
        ]}
        stroke={GRAY}
        lineWidth={2}
        endArrow
        arrowSize={10}
        opacity={0.4}
      />
      <Line
        points={[
          new Vector2(BOX_W / 2 + 10, 0),
          new Vector2(GAP - BOX_W / 2 - 10, 0),
        ]}
        stroke={GRAY}
        lineWidth={2}
        endArrow
        arrowSize={10}
        opacity={0.4}
      />

      {/* Packet */}
      <Rect
        ref={packet}
        width={100}
        height={36}
        radius={8}
        fill={BLUE}
        opacity={0}
        x={-GAP}
      >
        <Txt
          ref={packetLabel}
          text=""
          fontSize={16}
          fontWeight={600}
          fontFamily="JetBrains Mono, monospace"
          fill={BG}
        />
      </Rect>

      {/* History blocks (pre-filled from v1 execution) */}
      {events.map((evt, i) => (
        <Node key={evt}>
          <Rect
            ref={historyBlocks}
            x={GAP}
            y={-20 + i * (BLOCK_H + 8)}
            width={BLOCK_W}
            height={BLOCK_H}
            radius={8}
            fill={EVENT_FILL}
            stroke={GRAY}
            lineWidth={2}
            opacity={0}
          >
            <Txt
              ref={historyLabels}
              text={evt}
              fontSize={18}
              fontWeight={500}
              fontFamily="JetBrains Mono, monospace"
              fill={WHITE}
            />
          </Rect>
          <Txt
            ref={checkmarks}
            text=""
            fontSize={26}
            fontWeight={700}
            fill={BLUE}
            x={GAP + BLOCK_W / 2 + 20}
            y={-20 + i * (BLOCK_H + 8)}
            opacity={0}
          />
        </Node>
      ))}

      {/* X mark for mismatch */}
      <Txt
        ref={xMark}
        text="✕"
        fontSize={48}
        fontWeight={900}
        fill={RED}
        x={GAP + BLOCK_W / 2 + 20}
        y={-20 + 2 * (BLOCK_H + 8)}
        opacity={0}
      />

      {/* Mismatch detail labels */}
      <Txt
        ref={mismatchExpected}
        text={'history: "timer"'}
        fontSize={18}
        fontWeight={500}
        fontFamily="JetBrains Mono, monospace"
        fill={LABEL_FAINT}
        y={160}
        x={80}
        opacity={0}
      />
      <Txt
        ref={mismatchGot}
        text={'code: "notify"'}
        fontSize={18}
        fontWeight={500}
        fontFamily="JetBrains Mono, monospace"
        fill={RED}
        y={190}
        x={80}
        opacity={0}
      />

      {/* NDE label */}
      <Txt
        ref={ndeLabel}
        text="Non-Determinism Error"
        fontSize={32}
        fontWeight={800}
        fontFamily="Inter, system-ui, sans-serif"
        fill={RED}
        y={240}
        opacity={0}
      />

      {/* Stuck label */}
      <Txt
        ref={stuckLabel}
        text="workflow stuck"
        fontSize={22}
        fontWeight={500}
        fontFamily="Inter, system-ui, sans-serif"
        fill={LABEL_FAINT}
        y={280}
        opacity={0}
      />
    </>
  );

  // ════════════════════════════════════════════════════════════
  // ANIMATION
  // ════════════════════════════════════════════════════════════

  // ── Fade in everything ────────────────────────────────────
  yield* all(
    codeBox().opacity(1, 0.4),
    sdkBox().opacity(1, 0.4),
    historyBox().opacity(1, 0.4)
  );

  // Show pre-existing history blocks (from v1)
  yield* sequence(
    0.15,
    ...events.map((_, i) => historyBlocks[i].opacity(0.7, 0.3))
  );

  yield* waitFor(0.4);

  // ── REPLAY WITH CHANGED CODE ──────────────────────────────
  phaseLabel().text("REPLAY WITH CHANGED CODE");
  phaseLabel().fill(BLUE);
  yield* phaseLabel().opacity(1, 0.4);

  yield* codeBox().stroke(BLUE, 0.3);
  yield* waitFor(0.3);

  // First two events match (fast)
  for (let i = 0; i < 2; i++) {
    packet().x(-GAP);
    packet().fill(BLUE);
    packetLabel().text(events[i]);
    yield* packet().opacity(1, 0.1);
    yield* packet().x(0, 0.25, easeInOutCubic);

    yield* all(
      historyBlocks[i].stroke(BLUE, 0.15),
      historyBlocks[i].opacity(1, 0.15)
    );

    checkmarks[i].text("✓");
    yield* checkmarks[i].opacity(1, 0.15);

    packetLabel().text("result");
    yield* packet().x(-GAP, 0.25, easeInOutCubic);
    yield* packet().opacity(0, 0.1);

    yield* all(
      historyBlocks[i].stroke(GRAY, 0.2),
      historyBlocks[i].opacity(0.35, 0.2)
    );

    yield* waitFor(0.1);
  }

  yield* waitFor(0.3);

  // ── THE MISMATCH ──────────────────────────────────────────
  // Code sends "notify" (the new activity)
  packet().x(-GAP);
  packet().fill(BLUE);
  packetLabel().text("notify");
  yield* packet().opacity(1, 0.1);
  yield* packet().x(0, 0.35, easeInOutCubic);

  // SDK checks history block 3 which says "timer"
  yield* all(
    historyBlocks[2].stroke(RED, 0.2),
    historyBlocks[2].opacity(1, 0.2)
  );

  yield* waitFor(0.3);

  // ── EVERYTHING GOES RED ───────────────────────────────────
  phaseLabel().text("MISMATCH");
  phaseLabel().fill(RED);
  yield* all(
    packet().fill(RED, 0.3),
    sdkBox().stroke(RED, 0.3),
    codeBox().stroke(RED, 0.3),
    historyBox().stroke(RED, 0.3),
    xMark().opacity(1, 0.3),
    mismatchExpected().opacity(1, 0.4),
    mismatchGot().opacity(1, 0.4)
  );

  yield* packet().opacity(0, 0.2);

  yield* waitFor(0.5);

  // Flash NDE
  yield* ndeLabel().opacity(1, 0.4);

  // Pulse the NDE text
  yield* ndeLabel().scale(1.1, 0.15).to(1, 0.15);

  yield* stuckLabel().opacity(1, 0.4);

  yield* waitFor(2.0);

  // ── Fade out ──────────────────────────────────────────────
  yield* all(
    phaseLabel().opacity(0, 0.5),
    ndeLabel().opacity(0, 0.5),
    stuckLabel().opacity(0, 0.5),
    mismatchExpected().opacity(0, 0.5),
    mismatchGot().opacity(0, 0.5)
  );

  yield* waitFor(0.5);
});
