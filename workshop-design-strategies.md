# Workshop Design Strategies

> Research-backed decisions and strategies for making this workshop exceptional. Drawn from cognitive science (Kahneman, Csikszentmihalyi), evidence-based teaching practice (The Carpentries), presentation design (Nancy Duarte), and workshop facilitation best practices.

---

## 1. Design for the Peak-End Rule

**The science:** Kahneman's research shows people judge experiences by their most intense moment (peak) and the final moment (end), not the average. Duration is largely neglected.

**Concrete decisions for this workshop:**

- **Engineer a peak moment.** The best candidate is Exercise 2, Part C: the incident simulation. This is the dramatic scene of the workshop, where things go wrong and the audience fixes it live. Lean into the drama. When v3.0 breaks, make the audience *feel* the urgency. Use language like "production is down, workflows are stuck, let's go." This should feel like the climax of a movie.
- **Engineer the ending.** The wrap-up is currently a decision framework and resources slide. That's forgettable. Instead, end with a callback to the opening problem and a moment of reflection: "At the start, we said deploying to durable executions is the fundamental challenge. You just solved it three different ways." Then a brief, genuinely impressive demo or visualization of what they built across all three exercises. People should walk out feeling competent and powerful, not just informed.
- **Don't waste energy flattening the experience.** A mediocre middle is fine if the peak and ending land. Put production polish budget into the incident simulation and the closing.

---

## 2. Build a Single Narrative Arc, Not Three Exercises

**The science:** Nancy Duarte's research on great talks shows the structure of "what is" vs "what could be" - oscillating between the current painful reality and the better future. The best workshops aren't a sequence of exercises; they're a story with rising action.

**Concrete decisions:**

- **Frame the entire workshop as one story:** "You're the valet parking team. You have a production system. Over the next 3.5 hours, you're going to ship three releases, each one harder than the last, and you're going to handle a production incident." Not "Exercise 1, Exercise 2, Exercise 3."
- **Use the valet metaphor ruthlessly.** Right now it's a learning vehicle. Make it the *setting*. "Your airport client just called. They want owner notifications before car retrieval. You need to ship this without breaking the 47 cars currently parked." Every exercise becomes a business requirement arriving, not an academic exercise.
- **Rising stakes, not just rising complexity.** Exercise 1: you're figuring things out (low stakes, safety net of replay tests). Exercise 2: you're running in production with live traffic (medium stakes, then the incident). Exercise 3: you're automating so this never requires manual intervention again (high stakes, but now you have power). The emotional arc is: learning -> crisis -> mastery.

---

## 3. Manage Cognitive Load Ruthlessly

**The science:** The Carpentries instructor training (the gold standard for evidence-based technical teaching) emphasizes that adults can hold roughly 4-7 items in working memory. Novices don't have mental models to chunk information into. Guided practice with frequent formative assessment beats minimal guidance every time.

**Concrete decisions:**

- **One new concept per exercise step, maximum.** The current structure is close to this. Audit each part: if both `workflow.patched()` AND replay testing are introduced in the same step, split them. This is mostly already done well, but be vigilant.
- **Eliminate all unnecessary cognitive load.** Every terminal command the user has to type that isn't the *point* of the step is extraneous load. The Makefile targets are good. Make sure the README never has the user doing setup/boilerplate in the middle of a conceptual moment.
- **Use "faded examples" instead of blank-slate coding.** The TODO comments in practice directories already do this. Push it further: provide the *exact* code they need to type in a clearly marked block, so the cognitive effort goes to *understanding* rather than *implementation*. In a conference workshop, typing is not learning; understanding is.
- **Running glossary.** Have a persistent reference (maybe a cheat-sheet handout or a pinned section at the top of each README) with the 5-6 key terms and their one-line definitions. People will forget what PINNED means by Exercise 3. Don't make them scroll back.

---

## 4. Create Flow State Through Difficulty Calibration

**The science:** Csikszentmihalyi's flow research shows engagement peaks when challenge matches skill level. Too easy = boredom. Too hard = anxiety. The sweet spot is "I can do this, but I have to focus."

**Concrete decisions:**

- **Target 80% success rate on exercises.** If everyone finishes every step easily, it's too easy. If more than 20% get stuck, it's too hard. Calibrate by dry-running with 2-3 people of varying Temporal experience.
- **Provide escape hatches, not hints.** When someone is stuck, the instinct is to give hints. Instead, provide a "skip ahead" mechanism: "If you're stuck, copy the solution file and continue to the next step." This preserves flow for fast participants while not leaving anyone behind. The solution directories enable this.
- **Time-box aggressively.** "You have 8 minutes for this step" is more engaging than "take your time." Time pressure creates flow. Put estimated times on each part.
- **Stretch goals for fast finishers.** Exercise 3 Part D (Extra) is good. Consider adding a small optional challenge to Exercises 1 and 2 as well, so fast finishers stay in flow instead of waiting.

---

## 5. Use the "Teach, Show, Break, Fix" Loop

**The science:** The most effective technical workshops follow a repeating loop: explain a concept briefly, demonstrate it working, then have the learner *experience the failure mode* before learning the solution. Failure creates a knowledge gap that the brain is motivated to fill.

**Concrete decisions:**

- **Let things break on purpose.** This is already done brilliantly in Exercise 1 (make a breaking change, see the NDE, then patch it) and Exercise 2 (deploy v3.0 with a bug, experience the failure, then remediate). This is the single best structural decision in the workshop. Protect it.
- **Make the failure visceral.** When the replay test fails in Exercise 1, don't just print a stack trace. Have the README say: "Look at that error. That's what happens in production when you deploy a non-replay-safe change. Every workflow that replays against your new code dies." Make the user *feel the consequence* before learning the solution.
- **The "before" photo matters.** Before each fix, ask the user to observe the broken state explicitly. "Run `temporal workflow list` and notice that 12 workflows are stuck on v3.0." This makes the fix satisfying. Without the observation, the fix is abstract.

---

## 6. Formative Assessment Without Being Annoying

**The science:** The Carpentries research shows that frequent, low-stakes formative assessment (checking understanding) is one of the highest-leverage teaching techniques. But quizzes feel patronizing to expert audiences.

**Concrete decisions:**

- **Use prediction prompts instead of quiz questions.** Before each key step, ask: "Before you run this, what do you expect to happen?" This engages the same mental model verification as a quiz but feels like collaboration, not testing. Put these in the README as callout boxes.
- **Use the slides for "pause and think" moments.** Between exercises, put up a slide with a question like "Why can't we just use patching for everything?" and give people 30 seconds to think before you answer. This is dramatically more effective than just telling them.
- **Observation steps are assessment.** "Run `temporal worker-deployment describe` and look at the output. You should see Version 2.0 as Current." If they don't see it, they know they're off track. These self-correcting observation steps are the best kind of assessment for expert audiences.

---

## 7. Social Dynamics and Energy Management

**The science:** Group work is consistently rated as the highest-enjoyment activity in workshops. Energy follows a predictable curve: high at start, drops at 60-90 minutes, crashes after lunch/break, recovers.

**Concrete decisions:**

- **Pair programming option.** Tell people they can pair up for exercises. Don't force it, but suggest it. "If you want, grab a partner. One person drives, the other navigates." This turns a solo typing exercise into a social experience. People who pair will remember the workshop more fondly.
- **Break placement is perfect.** After Exercise 2 (the dramatic incident) is the ideal break point. People will talk about what just happened over coffee. That social processing reinforces learning.
- **Bridge sections need energy.** The 10-15 minute bridges are where people get lost. Keep them to 10 minutes max. Use visuals heavily. Ask questions. Move physically if possible. These are the danger zones.
- **Start Exercise 3 with a bang.** Post-break energy is lowest. Exercise 3 starts with K8s setup, which is not exciting. Consider reframing: "Welcome back. For the last two exercises, you were the ops team. Now you're going to fire yourself. We're going to automate everything you just did by hand."

---

## 8. The Details That Separate Good from Legendary

- **Name the versions.** Instead of v1.0, v2.0, v3.0, give them names that tell the story: "v1.0: baseline", "v2.0: billing", "v3.0: the bad deploy", "v3.1: the fix." People remember narratives better than numbers.
- **Timestamp the README steps.** "Part A (~8 min) | Part B (~10 min) | Part C (~12 min)". This gives people pacing awareness and reduces anxiety about falling behind.
- **Have a "where are we" slide.** After each exercise, show a simple visual of what they've accomplished. Highlight the layer they just learned. This creates a sense of accumulation.
- **Error messages should be expected.** Every time the user will see an error (NDE, gate failure, etc.), the README should say "You should see an error like this:" followed by the key snippet. Nothing is more anxiety-inducing in a workshop than an unexpected error.
- **End with the "you can do this at work on Monday" moment.** The decision framework slide is good but make it personal: "Think about one workflow you own. Which versioning strategy would you use? Take 30 seconds." Then close.

---

## 9. What to Cut

Workshop quality is usually improved more by cutting than by adding:

- **Cut any step where the user is waiting.** Temporal operations that take 30+ seconds should have the user doing something else (reading, observing the UI, discussing with a neighbor).
- **Cut slides that duplicate the README.** If it's in the exercise, don't put it on a slide. Use slides for concepts and narrative; use READMEs for instructions.
- **Cut Trampolining from slides.** The coverage audit shows it's Not Covered and would require a dedicated example. For a workshop this dense, mentioning it as "one more technique exists, here's the doc link" in the resources slide is fine. Don't dilute the three things being taught well.

---

## Summary: The Five Things That Will Make This Legendary

1. **Narrative arc** - one story with rising stakes, not three exercises
2. **Engineered peak** - the Exercise 2 incident simulation should be unforgettable
3. **Engineered ending** - close with reflection and empowerment, not a resource list
4. **Let things break** - the failure-then-fix loop is the superpower; lean into it
5. **Difficulty calibration** - dry-run with real humans, time-box steps, provide escape hatches
