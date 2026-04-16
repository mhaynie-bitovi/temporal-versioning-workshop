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
const GRAY = colors.gray;
const WHITE = colors.white;
const LABEL_FAINT = colors.faint;
const EVENT_FILL = colors.eventFill;

const BOX_W = sizes.boxW;
const BOX_H = sizes.boxH;
const GAP = sizes.gap;
const HISTORY_BLOCK_H = sizes.blockH;
const HISTORY_BLOCK_W = sizes.blockW;

export default makeScene2D(function* (view) {
  view.fill(BG);

  // ── 3 main boxes ──────────────────────────────────────────
  const codeBox = createRef<Rect>();
  const sdkBox = createRef<Rect>();
  const historyBox = createRef<Rect>();

  // History event blocks
  const historyBlocks = createRefArray<Rect>();
  const historyLabels = createRefArray<Txt>();
  const checkmarks = createRefArray<Txt>();

  // Arrows
  const arrow1 = createRef<Line>();
  const arrow2 = createRef<Line>();

  // Phase label
  const phaseLabel = createRef<Txt>();

  // Packet (the moving dot/box)
  const packet = createRef<Rect>();
  const packetLabel = createRef<Txt>();

  // "stored durably" label
  const storedLabel = createRef<Txt>();

  // Resume label
  const resumeLabel = createRef<Txt>();

  const events = ["request", "move", "timer"];

  // ── Build the scene ───────────────────────────────────────
  view.add(
    <>
      {/* Phase label at top */}
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

      {/* Three boxes */}
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
          text="Code"
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
        height={BOX_H + events.length * (HISTORY_BLOCK_H + 8) + 20}
        radius={16}
        fill={BOX_FILL}
        stroke={BOX_STROKE}
        lineWidth={2}
        opacity={0}
      >
        <Txt
          text="History"
          fontSize={28}
          fontWeight={600}
          fontFamily="Inter, system-ui, sans-serif"
          fill={WHITE}
          y={-70}
        />
      </Rect>

      {/* Static arrows between boxes */}
      <Line
        ref={arrow1}
        points={[
          new Vector2(-GAP + BOX_W / 2 + 10, 0),
          new Vector2(-BOX_W / 2 - 10, 0),
        ]}
        stroke={GRAY}
        lineWidth={2}
        endArrow
        arrowSize={10}
        opacity={0}
      />
      <Line
        ref={arrow2}
        points={[
          new Vector2(BOX_W / 2 + 10, 0),
          new Vector2(GAP - BOX_W / 2 - 10, 0),
        ]}
        stroke={GRAY}
        lineWidth={2}
        endArrow
        arrowSize={10}
        opacity={0}
      />

      {/* Packet (animated element that moves between boxes) */}
      <Rect
        ref={packet}
        width={100}
        height={36}
        radius={8}
        fill={GREEN}
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

      {/* History event blocks (pre-created, hidden) */}
      {events.map((evt, i) => (
        <Node key={evt}>
          <Rect
            ref={historyBlocks}
            x={GAP}
            y={-20 + i * (HISTORY_BLOCK_H + 8)}
            width={HISTORY_BLOCK_W}
            height={HISTORY_BLOCK_H}
            radius={8}
            fill={EVENT_FILL}
            stroke={GREEN}
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
          {/* Checkmark overlay */}
          <Txt
            ref={checkmarks}
            text="✓"
            fontSize={26}
            fontWeight={700}
            fill={BLUE}
            x={GAP + HISTORY_BLOCK_W / 2 + 20}
            y={-20 + i * (HISTORY_BLOCK_H + 8)}
            opacity={0}
          />
        </Node>
      ))}

      {/* "stored durably" label */}
      <Txt
        ref={storedLabel}
        text="stored durably"
        fontSize={20}
        fontWeight={500}
        fontFamily="Inter, system-ui, sans-serif"
        fill={LABEL_FAINT}
        x={GAP}
        y={-20 + events.length * (HISTORY_BLOCK_H + 8) + 16}
        opacity={0}
      />

      {/* "state recovered" label */}
      <Txt
        ref={resumeLabel}
        text="state recovered"
        fontSize={24}
        fontWeight={600}
        fontFamily="Inter, system-ui, sans-serif"
        fill={BLUE}
        y={200}
        opacity={0}
      />
    </>
  );

  // ════════════════════════════════════════════════════════════
  // ANIMATION
  // ════════════════════════════════════════════════════════════

  // ── Fade in the 3 boxes + arrows ──────────────────────────
  yield* all(
    codeBox().opacity(1, 0.5),
    sdkBox().opacity(1, 0.5),
    historyBox().opacity(1, 0.5),
    delay(0.3, arrow1().opacity(0.4, 0.3)),
    delay(0.3, arrow2().opacity(0.4, 0.3))
  );

  yield* waitFor(0.4);

  // ── PHASE 1: EXECUTION ────────────────────────────────────
  phaseLabel().text("EXECUTION");
  phaseLabel().fill(GREEN);
  yield* phaseLabel().opacity(1, 0.4);

  // Highlight Code box
  yield* codeBox().stroke(GREEN, 0.3);

  for (let i = 0; i < events.length; i++) {
    const evt = events[i];

    // Reset packet at Code
    packet().x(-GAP);
    packet().y(0);
    packet().fill(GREEN);
    packetLabel().text(evt);
    packet().opacity(0);

    // Show packet at Code
    yield* packet().opacity(1, 0.15);

    // Animate packet: Code → SDK
    yield* packet().x(0, 0.4, easeInOutCubic);

    // Animate packet: SDK → History
    yield* packet().x(GAP, 0.4, easeInOutCubic);

    // Hide packet, show the event block in history
    yield* all(
      packet().opacity(0, 0.15),
      historyBlocks[i].opacity(1, 0.3),
      historyBlocks[i].scale(0.8, 0).to(1, 0.3, easeOutCubic)
    );

    yield* waitFor(0.2);
  }

  // Flash "stored durably"
  yield* storedLabel().opacity(1, 0.4);
  yield* waitFor(1.0);

  // ── PHASE 2: REPLAY ───────────────────────────────────────
  phaseLabel().text("REPLAY");
  phaseLabel().fill(BLUE);
  yield* all(
    storedLabel().opacity(0, 0.3),
    codeBox().stroke(BOX_STROKE, 0.3)
  );

  yield* waitFor(0.5);

  // "worker restarts" flash
  const restartLabel = createRef<Txt>();
  view.add(
    <Txt
      ref={restartLabel}
      text="worker restarts"
      fontSize={20}
      fontWeight={500}
      fontFamily="Inter, system-ui, sans-serif"
      fill={LABEL_FAINT}
      y={-220}
      opacity={0}
    />
  );
  yield* restartLabel().opacity(1, 0.3);
  yield* waitFor(0.6);
  yield* restartLabel().opacity(0, 0.3);

  // Code glows blue
  yield* codeBox().stroke(BLUE, 0.3);

  for (let i = 0; i < events.length; i++) {
    const evt = events[i];

    // Send command from Code → SDK (blue)
    packet().x(-GAP);
    packet().y(0);
    packet().fill(BLUE);
    packetLabel().text(evt);
    yield* packet().opacity(1, 0.1);
    yield* packet().x(0, 0.3, easeInOutCubic);

    // SDK checks history - flash the history block
    yield* all(
      historyBlocks[i].stroke(BLUE, 0.2),
      historyBlocks[i].scale(1.05, 0.15).to(1, 0.15)
    );

    // Checkmark appears
    yield* checkmarks[i].opacity(1, 0.2);

    // Result flows back: SDK → Code (blue, dimmer)
    packet().fill(BLUE);
    packetLabel().text("result");
    packet().x(0);
    yield* packet().x(-GAP, 0.3, easeInOutCubic);
    yield* packet().opacity(0, 0.1);

    // Gray out the history block (skipped)
    yield* all(
      historyBlocks[i].stroke(GRAY, 0.2),
      historyBlocks[i].opacity(0.4, 0.3),
      historyLabels[i].fill(GRAY, 0.3)
    );

    yield* waitFor(0.15);
  }

  // "state recovered"
  yield* resumeLabel().opacity(1, 0.5);
  yield* waitFor(1.5);

  // ── Fade out ──────────────────────────────────────────────
  yield* all(
    phaseLabel().opacity(0, 0.5),
    resumeLabel().opacity(0, 0.5),
    codeBox().stroke(BOX_STROKE, 0.3)
  );

  yield* waitFor(0.5);
});
