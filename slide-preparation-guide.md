# Slide Preparation Guide

## 1. Lock the Narrative Arc First, Not Individual Slides

The `slide-content.md` is a script draft, not a slide deck yet. Before touching Keynote:

- **Read it aloud with a timer.** The bridges are budgeted at 10-15 min but have 6-8 slides each. At ~2 min/slide with talking points, that's tight. Cut or merge now, not in Keynote.
- **Mark the three emotional beats**: the "oh no" (Exercise 1 NDE), the peak (Exercise 2 incident), and the closing callback. Everything else serves those moments.

## 2. Build Slides in Three Passes

**Pass 1 - Structure (1-2 hours):** Create blank/title-only slides in Keynote matching each `##` header in `slide-content.md`. No visuals yet. Just section flow. This lets you reorder cheaply.

**Pass 2 - Diagrams (the real work):** The `[DIAGRAM]` blocks are the slides that matter most. Build these one at a time. The replay comparison diagram and the rainbow deployment diagram are the two that will get reused mentally by attendees. Invest here.

**Pass 3 - Polish:** Talking points, transitions, animations. Last priority.

## 3. Preparation Methodology

| Phase | What | When |
|---|---|---|
| **Content freeze** | Finalize exercise READMEs and code. Slides depend on what the exercises actually do. | First |
| **Dry run solo** | Walk through all 3 exercises end-to-end, timing each part. Note where you wait, stumble, or get confused. | Before slides are done |
| **Slides from experience** | Build slides based on what you learned in the dry run, not the other way around. You'll know which concepts need a visual and which don't. | After first dry run |
| **Dry run with 2-3 humans** | The `workshop-design-strategies.md` says to calibrate for 80% success rate. This is where you find out. Watch where they get stuck, bored, or confused. | After slides v1 |
| **Cut ruthlessly** | "Workshop quality is usually improved more by cutting than by adding." Kill slides that duplicate the README. | After human dry run |

## 4. Tactical Advice (Derived from Existing Workshop Materials)

- **Don't slide the README.** The strategy doc says this explicitly. Slides are for concepts and narrative; READMEs are for instructions. If a slide just says "run this command," delete it.
- **The Exercise Setup slides are wasted real estate.** "Navigate to 2-worker-versioning/practice" doesn't need a slide, it needs a spoken sentence. Replace those slides with the "where are we" progress visual the strategy doc recommends.
- **Trampolining: cut it.** The coverage audit already flags it as Not Covered with no exercise support. Mention it in one bullet on the resources slide. Don't build slides for something you can't demo.
- **The bridge sections are the danger zones.** Keep them to 10 min max. For each bridge slide, ask: "Does this teach something the exercise didn't, or is it just summarizing?" Cut summaries. Keep only forward-looking motivation ("here's why what you just learned isn't enough").

## 5. Tool Choice

Use whatever you're fastest in for the diagram pass. If Keynote's shape tools slow you down, consider building diagrams in something like Excalidraw or Mermaid first, then importing as images. The `[DIAGRAM]` blocks in `slide-content.md` are detailed enough to be Mermaid specs almost directly.

## The Single Highest-Leverage Action

Do a timed solo dry run of all three exercises before building any slides. The slides will be 3x better if they're informed by the actual experience of doing the workshop.
