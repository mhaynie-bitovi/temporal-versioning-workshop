# Slide Strategy & Presentation Guide

## The Balance Problem: What Goes on Slides vs. What Doesn't

### Slides are for THREE things only:

1. **Mental models** - Diagrams, analogies, and conceptual frameworks that help people *organize* information. The rainbow deployment diagram, the replay flow, the "what happens when you deploy a non-replay-safe change" visual. These are worth 5 minutes of slide time each because they're the scaffolding people hang everything else on.

2. **Motivation/stakes** - Why should I care about this next thing? "Your airport client just called..." This is the narrative glue between exercises. The workshop-design-strategies doc calls these the "bridges" and correctly identifies them as the danger zones.

3. **Decision frameworks** - The kind of thing people *can't* just look up. "When do I use patching vs. worker versioning vs. both?" A 2x2 matrix or flowchart they'll actually remember. This is the stuff that separates the workshop from reading the docs.

### Slides are NOT for:

- API signatures, CLI flags, config options (they'll look these up)
- Step-by-step instructions (that's the README's job)
- Exhaustive lists of "types of non-replay-safe changes" (one or two examples + "and others" is enough, link to the docs)
- Definitions of things they can read in 10 seconds (put a cheat sheet handout together instead)

### The litmus test for every slide:
> "If I removed this slide and just *said* it, would the audience lose anything?" If no, cut it.

---

## Using AI Effectively: A Concrete Pipeline

### Stage 1: Narrative Script (AI-heavy)

Turn each section's bullets into a **spoken narrative script** - literally what you'd say out loud. Use AI to:

- Take each section's bullets and generate a 2-minute spoken monologue for each
- Have it adopt the "valet story" framing from the workshop-design-strategies doc
- Iterate on tone: you want "experienced colleague explaining over coffee", not "textbook"
- Read it aloud, cut ruthlessly. If you're bored reading it, the audience is bored hearing it

This is where AI saves the most time. Writing natural-sounding spoken narration from bullet points is exactly what LLMs are good at.

### Stage 2: Visual Storyboarding (AI-assisted)

For each slide concept, decide: **words, diagram, or both?**

- **Diagrams** are the highest-leverage slides. The `[DIAGRAM]` blocks in slide-content.md are well-specified. AI can generate Mermaid diagrams directly, or describe them in enough detail to build in Keynote/Excalidraw.
- **"Pause and think" slides** - Just a question on screen. "Why can't we just use patching for everything?" These are cheap to make and highly effective (the workshop-design-strategies doc recommends them, speaking.io's repetition advice supports them).
- **Progress/where-are-we slides** - A simple recurring visual showing the 3 exercises with the current one highlighted. Reuse the same template with small changes. Shows accumulation.

AI can help here by generating Mermaid diagram code, suggesting visual metaphors, and drafting the minimal text for each slide.

### Stage 3: Slide Production (AI-assisted but mostly manual)

This is the Keynote/Google Slides work. AI can't do this directly, but it can:

- Generate consistent color schemes and typography recommendations
- Create SVG diagrams from descriptions
- Draft speaker notes for each slide
- Generate the "cheat sheet" handout content

### Stage 4: Rehearsal Refinement (AI for feedback)

Record yourself doing a dry run. Use AI to:

- Transcribe and analyze pacing
- Identify sections where you're spending too long on details people will look up anyway
- Suggest cuts

---

## Striking the Balance: Specific Recommendations Per Section

### Opening (10 min) - 5-6 slides max
- **Keep:** The problem framing ("you have production workflows, you need to change code, what could go wrong?"), the valet scenario intro, the 3-strategy overview (workflow type versioning, patching, worker versioning) and how the controller automates worker versioning
- **Cut:** Anything that's a "definition". Don't define what a workflow is - the audience is intermediate/expert
- **Key slide:** A single visual showing "the versioning spectrum" from manual/code-level (type versioning, patching) to infrastructure-managed (worker versioning) to automated (worker controller). This is the mental model for the whole workshop

### Exercise 1 Concepts (20 min) - 8-10 slides max
- **Invest heavily in:** The replay diagram. This is THE concept for Exercise 1. Show what happens when a workflow replays, show the event history, show where the NDE happens. This one diagram teaches more than 10 bullet-point slides
- **Keep light:** Patching API (one slide with a before/after code snippet, max). TDD/replay testing setup (one slide showing the test pattern)
- **Skip on slides:** The full list of non-replay-safe changes (mention 2-3 examples verbally, promise a reference link). How to export history JSON (that's a README step)
- **"Pause and think" moment:** "You just deployed new code. 47 cars are parked. What happens to the workflows that started on the old code?"

### Exercise 2 Concepts (30 min) - This is the biggest and most important bridge
- **Invest heavily in:** The rainbow deployment diagram (why multiple versions coexist), the Current vs. Ramping routing visual, the "what happens to in-flight workflows" animation
- **Keep:** PINNED vs AUTO_UPGRADE as a single comparison slide (two columns, not two separate explanations). Version lifecycle diagram (one visual showing the states)
- **Treat as the emotional setup for the peak:** End this section with "now let's see what happens when things go wrong" to set up the Exercise 2 incident
- **Skip on slides:** CLI command syntax (README), WorkerDeploymentConfig details (README), exhaustive version status definitions (cheat sheet)
- **Key decision framework slide:** "When patching, when worker versioning, when both?" - This is the slide people will photograph

### Exercise 3 Concepts (15 min) - Tight, post-break, low energy
- **Keep extremely focused:** The workshop-design-strategies doc says to start post-break with a bang. "Welcome back. You're going to automate everything you just did by hand."
- **Only 3-4 concept slides:** What the Worker Controller does (one sentence + diagram), the CRD structure (one visual), rollout strategies (one comparison table)
- **Do NOT:** Try to teach Kubernetes. If they don't know K8s, a 15-min bridge won't fix that. Show the minimum (a pod is a running container, a deployment manages pods) and move on. Two sentences, not two slides
- **Key slide:** Side-by-side of "Exercise 2: you typed 6 CLI commands" vs "Exercise 3: the controller does it for you"

### Wrap-up (15 min)
- **The callback:** "At 1:30, we said deploying changes to durable executions is hard. You just solved it with two versioning strategies, then automated the deployment lifecycle."
- **Decision framework:** The "which strategy when?" flowchart. Make it practical and opinionated
- **"Monday morning" moment:** "Think about one workflow you own. Which strategy?" Give 30 seconds of silence
- **Resources slide:** Links, not explanations

---

## What Makes Technical Workshop Presentations Top-Notch

Synthesizing from speaking.io, The Carpentries, and the workshop-design-strategies doc:

1. **Entertainment > Information transfer.** (speaking.io) The audience can read docs. What they can't get from docs is the *experience* of seeing things break and fixing them live. The Teach-Show-Break-Fix loop is already the greatest asset. The slides should amplify the drama, not compete with it.

2. **Repetition is a feature, not a bug.** (speaking.io) Recap before each new section. "You just learned X. But X has a limitation..." Steve Jobs did this at every section boundary. The bridge sections should start with a 1-slide recap and end with a 1-slide preview.

3. **One concept per slide, one new idea per exercise step.** (Carpentries + cognitive load research) If a slide has two concepts, split it. If it has a paragraph, cut it. Slides are cue cards for *you*, not reading material for *them*.

4. **Make failure visceral.** (workshop-design-strategies, section 5) The slides before Exercise 2's incident should build tension. Show the "everything is fine" dashboard, then after the exercise, show the "12 workflows stuck" state. The contrast is the lesson.

5. **Prediction prompts beat quiz questions.** (workshop-design-strategies, section 6) Put "What do you think will happen?" on a slide before key moments. This is the single highest-engagement technique for expert audiences.

6. **Go slowly on diagrams, fast on text.** (Carpentries) The diagrams are the slides worth spending 3-5 minutes on. The text slides should flash by in 15-30 seconds each. This creates natural pacing variation that keeps attention.

---

## Suggested Next Steps

1. **Do the solo dry run first** (the slide-preparation-guide already says this). The slides will be 3x better informed by the experience of doing the exercises with a timer.

2. **Write the spoken narrative for each bridge section** using AI. Give it the bullet points, get back natural spoken monologues to iterate on.

3. **Build the 4-5 key diagrams** (replay flow, rainbow deployment, current/ramping routing, controller architecture, decision framework). These are the slides that matter. AI can generate Mermaid code for all of them.

4. **Draft the cheat sheet handout** with all the "reference" material that doesn't belong on slides (CLI commands, API signatures, full list of non-replay-safe changes, version status definitions). This frees the slides to be conceptual.

5. **Assemble in Keynote using the 3-pass method** from the slide-preparation-guide.
