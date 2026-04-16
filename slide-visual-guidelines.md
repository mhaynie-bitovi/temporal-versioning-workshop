# Slide Visual Guidelines

> Concrete rules for what each slide should look like. Every slide in the deck must be one of these five types. If a slide doesn't fit, it needs to be split or cut.

---

## The Five Slide Types

### 1. Diagram Slide (~8 slides in the deck)

These are the highest-value slides. You spend 2-5 minutes *talking through* the diagram.

- **Title:** Short label (e.g., "How Replay Works", "Rainbow Deployment")
- **Body:** One diagram, centered, filling most of the space
- **Text:** None. No bullet points, no paragraphs. Everything else is spoken.
- **Examples:** Replay flow, replay mismatch/NDE, rainbow deployment architecture, version lifecycle, worker controller architecture, decision framework flowchart

### 2. Concept Slide (~8 slides in the deck)

The "one idea" slides. One glance should convey the idea.

- **Title:** The concept name (e.g., "PINNED vs AUTO_UPGRADE", "Non-Replay-Safe Changes")
- **Body:** ONE of the following (never more than one):
  - A single comparison table (2-3 columns, 3-5 rows max)
  - A single code snippet (5-6 lines max)
  - 2-3 short phrases (not sentences)
- **Rule:** If you can't absorb it in one glance, split it into two slides.
- **Examples:** PINNED vs AUTO_UPGRADE comparison, non-replay-safe vs safe changes, rollout strategies table, K8s in 30 seconds (two terms, two definitions)

### 3. Narrative Slide (~4 slides in the deck)

Emotional and story beats. These set tone and build tension.

- **Title:** None, or a single provocative line
- **Body:** 1-2 sentences of narrative text, large font, centered. Like a title card in a movie.
- **Tone:** Dramatic, personal, conversational
- **Delivery:** Read it, pause, let it land.
- **Examples:**
  - "23 cars are parked right now. Your client wants a new feature."
  - "Then you make a typo in the tip calculation..."
  - "You're about to fire yourself."

### 4. Question Slide (~3 slides in the deck)

Pause-and-think moments. The single highest-engagement technique for expert audiences.

- **Title:** None
- **Body:** One question, large font, centered. Nothing else on the slide.
- **Delivery:** Read the question, then shut up for 10-15 seconds.
- **Examples:**
  - "You just deployed new code. 23 cars are parked. What happens to the workflows that started on the old code?"
  - "Think about one workflow you own. Which versioning strategy would you use?"

### 5. Progress Slide (reused 4-5 times)

The "where are we" orientation marker.

- **Layout:** Three boxes in a row. Current exercise highlighted. Previous exercises checked/completed.
- **Delivery:** Flash for 5 seconds. No narration needed.
- **Reuse:** Show after each exercise and at the start of each concept section.

---

## Rules That Apply to All Slides

- **One concept per slide.** If a slide has two concepts, split it.
- **If it has a paragraph, cut it.** Slides are cue cards for you, not reading material for the audience.
- **Go slowly on diagrams, fast on text.** Diagram slides get 2-5 minutes. Text-heavy concept slides flash by in 15-30 seconds. This pacing variation keeps attention.
- **Don't slide the README.** If a slide just says "run this command," delete it. That's the README's job.
- **The litmus test:** "If I removed this slide and just *said* it, would the audience lose anything?" If no, cut it.
