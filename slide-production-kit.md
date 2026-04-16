# Slide Production Kit

> Generated from `slide-content.md` following the pipeline in `slide-strategy.md`. Contains: spoken narrative scripts, Mermaid diagrams, per-slide speaker notes, and a cheat sheet handout. Tone: experienced colleague explaining over coffee.

---

# Part 1: Narrative Scripts

> These are spoken monologues - literally what you'd say out loud during each bridge section. Read them aloud, cut what feels stale. Each is targeted at ~2 min per subsection.

---

## Opening (10 min)

### The Problem (~4 min)

So here's the thing about Temporal. Your workflows can run for days, weeks, sometimes years. And at some point - guaranteed - you're going to need to change the code while workflows are still running.

Now, normally when you deploy new code, the old code just... goes away. Your new server starts up, handles the next request, nobody cares what the old code looked like. But Temporal doesn't work like that. When a worker picks up a workflow task, it doesn't just continue from where it left off. It *replays* the entire workflow from the beginning, re-executing your code step by step, and checks that the commands your code generates match what's already recorded in the history.

If they don't match - if your new code tries to schedule an activity that the history doesn't have, or skips one that it does - you get a Non-Determinism Error. The workflow is stuck. It can't make progress. And this isn't one workflow. It's *every* workflow that started before your deploy and tries to replay against your new code.

So picture this. You're running the valet parking system at the airport. Right now, 23 cars are parked. Each one has an active workflow - waiting for the owner to come back from their trip. Your client calls and says "we want to notify owners when their car is being parked." Sounds simple, right? Just add an activity call. But if you deploy that change, those 23 in-flight workflows are going to replay against your new code, hit that extra activity call, and blow up. 23 angry customers. 23 stuck cars.

That's the problem we're solving today.

### The Scenario (~2 min)

So let's talk about our example system. We have two workflows.

The first is the ValetParkingWorkflow. It handles a single parking transaction. A customer drives up, the workflow requests an available space, moves the car to that space, and then... waits. The owner goes on their trip. Could be a few minutes in our simulator, could be hours in real life. When they come back, the workflow moves the car back to the valet zone and releases the space. That wait in the middle - that's our danger zone. That's when workflows are in-flight during deploys.

The second is the ParkingLotWorkflow. It's a long-running singleton that manages 30 parking spaces. It handles requests and releases via updates, and it uses continue-as-new to keep its history from growing forever. This one effectively runs indefinitely.

Two workflows, two very different lifetimes, two very different versioning challenges. Keep that in mind - it's going to matter.

### Three Versioning Strategies (~3 min)

Before we dive in, let me frame the three versioning strategies Temporal gives you for handling non-replay-safe changes.

The simplest is workflow type versioning. You literally create a new workflow type - copy the definition, give it a new name like `ValetParkingWorkflowV2`. New executions use the new type, old ones keep running the old type. It's straightforward, but it doesn't help you migrate in-flight workflows, and managing multiple workflow types gets messy fast. Also client code needs to be changed to start workflows of the new type. It breaks the contract.

Next is patching. This is what we'll learn first. You use the patching API to branch your workflow code based on markers in the event history. Old workflows take the old path, new workflows take the new path, all on the same worker. It works everywhere, it's reliable, but every change adds another conditional branch. Over time, your workflow code starts looking like a choose-your-own-adventure book.

Then there's worker versioning. This is where Temporal's infrastructure takes over. Instead of branching in code, you run multiple versions of your worker side by side. Temporal knows which version each workflow belongs to and routes accordingly. No patching needed for most workflows. You'll configure this, deploy a feature, and then - this is the fun part - you'll handle a production incident live.

Now, Exercise 3 introduces the worker controller. That's not a separate versioning strategy - it's a Kubernetes operator that automates the worker versioning deployment lifecycle. Progressive rollouts, gate checks before traffic routes, automatic cleanup of old versions. Same versioning strategy, but the controller handles the ops instead of you.

So the arc of the workshop is: learning, then crisis, then mastery. By the end, you'll have shipped three releases, handled a production incident, and automated the whole deployment lifecycle. Let's get into it.

---

## Exercise 1 Concepts (20 min)

### How Replay Works (~7 min)

Alright, before we touch any code, we need to understand *why* certain changes break workflows. And to understand that, we need to understand replay.

When a workflow executes for the first time, your code runs and generates commands. "Schedule this activity." "Start this timer." "Complete the workflow." The Temporal server records each of those as events in the workflow's history. Activity scheduled, timer started, workflow completed. That history is the source of truth.

Now, here's the key part. When a worker needs to continue a workflow - maybe the worker restarted, maybe the workflow got a signal after sleeping - it doesn't just pick up where it left off. It re-runs your workflow code *from the very beginning*. But it doesn't actually re-execute the activities. Instead, the SDK intercepts each command your code generates and checks it against the history. "You're trying to schedule an activity? Great, I see that event in the history. Here's the result it returned last time." It fast-forwards through the recorded events.

But what if your code generates a *different* command than what's in the history? What if the history says "timer started" at position 5, but your new code says "schedule activity" at position 5? That's a mismatch. The SDK can't reconcile it. It throws a Non-Determinism Error and the workflow is stuck.

Think of it like a script. The history is the script that was already performed. Replay is the actors re-reading their lines. If you hand them a new script where the lines are in a different order... the performance falls apart.

*[Show the replay flow diagram here - spend time on this]*

### What's a Non-Replay-Safe Change? (~5 min)

So which changes actually cause this? The rule is simple: anything that changes the *sequence of commands* your workflow generates for a given input.

Adding a new activity call - that's a new command the history doesn't expect. Removing an activity - now the history has an event your code doesn't produce. Reordering activities - the commands come out in a different sequence. Adding or removing a timer. Switching which activity gets called. All of these change the command sequence.

Here's the good news: a lot of changes are totally safe. You can change what happens *inside* an activity - activities aren't replayed, only their results are. You can change timeouts, retry policies, the arguments you pass to activities. You can add new signal or query handlers. You can add logging. None of that affects the command sequence.

There's a quick two-question test from the Temporal courses. One: does this change affect the sequence of commands? Two: will there be open executions when you deploy? If the answer to both is yes, you need versioning. If either is no, you're fine.

In our valet example, we're adding a `notify_owner` activity call. That's a new command. And there are 23 cars parked - 23 open executions. So yes, we need versioning.

### Replay Testing (~3 min)

So how do you catch these problems before they hit production? Replay testing.

The idea is simple. You take a completed workflow, export its history as a JSON file, and then write a test that replays that history against your current code. If the code produces the same command sequence, the test passes. If it doesn't, you get an NDE in your test suite instead of in production.

This is your safety net. Before every deploy, you run your replay tests. If they pass, you know your changes are compatible with any in-flight workflow that might replay. If they fail, you know you need to handle that change with versioning.

In the exercise, you'll capture a history, write the test, then break it on purpose, and then fix it.

### workflow.patched() (~3 min)

Once the replay test catches the problem, here's how you fix it. `workflow.patched()` is basically an if-statement for time.

You wrap your new code in `if workflow.patched("my-change-id")`. When a brand-new workflow runs this code, `patched()` returns True and records a marker in the history. The new code runs. Done.

When an old workflow replays - one that started before your deploy - there's no marker in its history. So `patched()` returns False, and the new code is skipped. The old command sequence is preserved. No NDE.

One worker, two behaviors, based entirely on when the workflow started. That's the magic of it.

There's a lifecycle to patches - you put them in, eventually deprecate them when all old workflows are done, then remove them entirely. We won't dwell on that lifecycle today, but know that it exists.

### Pause and Think

*[Slide: just the question]*

"You just deployed new code. 23 cars are currently parked. What happens to the workflows that started on the old code?"

*[Let the audience think for 10-15 seconds before moving on.]*

---

## Exercise 2 Concepts (30 min)

### Why Patching Isn't Enough (~3 min)

Alright, you just shipped the notification feature using patching. It worked great. But look at your workflow code now. You've got an `if workflow.patched` block wrapping the notify activity. That's one conditional branch.

Now billing is next. That's another activity, another patch. Then maybe your client wants to change the parking space assignment logic. Another patch. Each non-replay-safe change adds another conditional branch to your workflow.

For short-lived workflows, this is manageable. But imagine a workflow that runs for weeks or months. Over several releases, it accumulates layer after layer of `if workflow.patched` blocks. Your workflow code starts to look less like business logic and more like a geological record of every change you've ever made. That's real code complexity and real cognitive overhead.

There's a better way.

### How Worker Versioning Works (~8 min)

The core idea behind worker versioning is: instead of embedding version logic in your workflow code, you declare the versioning behavior at the workflow level and let Temporal's infrastructure handle routing.

Here's how it works. You have a Worker Deployment - think of it as your service name. "Valet." Under that umbrella, you have Worker Deployment Versions - specific snapshots of your code, identified by a Build ID. "Valet 1.0." "Valet 2.0." Each version has its own set of workers, and they all poll the same task queue.

The Temporal server knows which version each workflow belongs to, and it routes workflow tasks to the right workers. Version 1.0 workflows go to version 1.0 workers. Version 2.0 workflows go to version 2.0 workers. They never cross.

This means you can deploy a completely new version of your workflow code - add activities, remove activities, rewrite the whole thing - and as long as old workflows stay on old workers, there's no replay conflict. No patching. No conditional branches. Clean code on both sides.

*[Show the worker versioning architecture diagram here]*

### PINNED vs AUTO_UPGRADE (~5 min)

There are two versioning behaviors, and they serve different needs.

PINNED means: this workflow stays on the version it started on, forever, until it completes. If a workflow starts on version 1.0, it will always run on version 1.0 workers, even after you've deployed 2.0, 3.0, 4.0. It's pinned. The huge benefit? You never need patching. The old code runs the old workflows. The new code runs the new workflows. Clean separation.

AUTO_UPGRADE means: when a new version becomes current, move this workflow to the new version on its next workflow task. The workflow's history replays against the new code. And here's the catch - if the new code is non-replay-safe, you still get an NDE. AUTO_UPGRADE does *not* eliminate patching. It still needs it.

So when do you use which? PINNED is great for workflows that complete in a reasonable timeframe - minutes, hours, maybe a few days. Your parking transactions, for example. They'll finish on their original version and you never think about them again.

AUTO_UPGRADE is for workflows that run indefinitely or for very long periods and need to pick up new behavior. Our ParkingLotWorkflow, for example - it's an immortal singleton. You can't wait for it to "finish" because it never does. You need it to move to the new version.

In our workshop, ValetParkingWorkflow is PINNED. ParkingLotWorkflow is AUTO_UPGRADE. Watch how they behave differently.

### Version Lifecycle and Routing (~5 min)

A version goes through a lifecycle. It starts as Inactive - the worker has registered but it's not getting any traffic. Then you promote it to Active by setting it as the Current Version. Now all new workflows go to it. The previous current version starts Draining - no new workflows, but its pinned workflows are still running. Once every pinned workflow on that version completes, it becomes Drained. Safe to shut down.

*[Show the version lifecycle diagram here]*

There's also Ramping Version - if you set a ramping percentage, that version gets a slice of new workflow executions. Say, 25% go to the new version, 75% stay on current. This is how progressive rollouts work - we'll see it automated in Exercise 3.

The key CLI command is `set-current-version`. That's the one command that controls where new traffic goes. You'll use it a lot.

### Rainbow Deployments (~4 min)

You might be wondering: why do we need multiple worker versions running at the same time? Why not just do a rolling deploy or blue-green?

With a rolling deploy, workers get upgraded in place. There's a window where old and new code is mixed on the same worker pool, and you can't control which version handles which workflow. That's a recipe for NDEs.

Blue-green gives you two environments and you flip traffic between them. Better, but you only get two "colors." What happens when version 1.0 still has draining workflows, you just deployed 2.0 as current, and now you need to deploy 3.0? You need three versions alive at once.

That's rainbow deployment. Like blue-green but with more colors. Each version gets its own workers. Old versions drain naturally as their pinned workflows complete. New versions take new traffic. They all coexist peacefully. Temporal's routing ensures each workflow goes to the right place.

*[Show the rainbow deployment diagram here]*

This is the deployment model that worker versioning enables. In Exercise 2, you'll do it by hand. In Exercise 3, the controller automates it.

### Emergency Remediation (~3 min)

Now, let's talk about when things go wrong. Because they will.

The fastest response is instant rollback. Run `set-current-version` pointing back to the previous version. New traffic redirects in seconds. No code redeploy, no CI pipeline, no waiting. One command.

But here's the thing - the workflows that already started on the broken version are still there. They're pinned to it. New traffic is safe, but those in-flight workflows are stuck. For those, you use `update-options` - a command that can bulk-reassign workflows from one version to another. You query for all running workflows on the broken version and move them to the working version. If the workflow code is the same between versions and only the activity code is different, this is replay-safe.

Then you fix the bug, deploy a new version, set it as current, and you're done. Rollback, evacuate, fix-forward. That's the playbook.

*[Build tension here]*

Everything I just described? You're about to do it live. Your billing deploy has a typo. Workflows are going to break. Let's see how fast you can respond.

### The Tension Builder

*[Slide: narrative text, no bullets]*

"Everything is humming. Billing shipped clean. v1.0 drained on its own. You're feeling good about versioning. Then you make a typo in the tip calculation..."

---

## Exercise 3 Concepts (15 min)

### Welcome Back (~1 min)

Welcome back. Quick recap: in Exercise 1, you learned to patch. In Exercise 2, you deployed versions by hand, handled an incident, and lived to tell about it. You typed a lot of CLI commands. You watched dashboards. You manually stopped old workers.

Now you're going to fire yourself.

Everything you did by hand in Exercise 2 - starting versioned workers, setting current versions, monitoring draining, shutting down old versions - you're going to automate all of it. One YAML file. One Kubernetes operator. That's it.

### Kubernetes in 30 Seconds (~1 min)

Two concepts. That's all you need.

A Pod is a running container. It's your worker process, running in a box.

A Deployment manages a set of Pods - handles scaling, restarts, rolling updates.

That's it. If you know more about Kubernetes, great. If not, those two sentences are enough to follow along.

### What the Worker Controller Does (~4 min)

The Worker Controller is an open-source Kubernetes operator from Temporal. You install it once in your cluster, and then you manage your workers by writing a custom resource called a `TemporalWorkerDeployment`.

In that resource, you specify your container image, how many replicas you want, and a rollout strategy. When you update the image tag and re-apply, the controller does everything: it creates a new Kubernetes Deployment for the new version, registers the build ID with Temporal, manages the traffic ramping, runs gate checks, and eventually cleans up old versions after they drain.

*[Show the controller architecture diagram here]*

The key relationship is: one `TemporalWorkerDeployment` resource produces multiple Kubernetes Deployments - one per version. The controller manages all of them. It's the same rainbow deployment model from Exercise 2, but the controller is the ops team instead of you.

### Rollout Strategies (~4 min)

Three rollout strategies, one table.

AllAtOnce: every replica cuts over immediately. Fine for the first deploy or when you know there are no in-flight workflows. Fast but no safety net.

Progressive: ramp traffic gradually. You define steps - 25%, pause, 75%, pause, 100%. New workflows start trickling to the new version while old pinned workflows finish on the old one. This is the automated rainbow deployment with built-in pacing.

Manual: the controller creates the new versioned Deployment and registers it with Temporal, but does *not* promote it. The version stays Inactive. You decide when to promote. This is for pre-deployment testing - you can send synthetic traffic to the inactive version, verify it works, then promote when you're confident.

### Gate Workflows (~3 min)

Here's the feature I'm most excited about. Remember in Exercise 2 when that bad deploy hit production and you had to scramble? A gate workflow prevents that.

When you configure a gate, the controller starts a workflow on the new version's workers while the version is still Inactive - before any production traffic reaches it. That workflow can do whatever checks you want: validate credentials, run smoke tests, check dependencies. If the gate workflow completes successfully, the controller proceeds with the rollout. If it fails, the version stays Inactive. Production is completely unaffected.

In the exercise, you'll see this in action. You'll deploy a version with bad billing credentials. The gate catches it. Production keeps humming. You fix the credentials, deploy again, the gate passes, traffic ramps. No incident. No scramble.

Compare that to Exercise 2. Same kind of bug, completely different outcome.

---

## Wrap-up (15 min)

### The Callback (~2 min)

At 1:30 this afternoon, we said deploying changes to durable executions is the fundamental challenge of working with Temporal. It's tricky because workflows remember their past, and your new code has to be compatible with that past.

You just solved that problem in two different ways, then automated the second one. You patched a workflow so one worker could handle both old and new executions. You deployed versioned workers side by side and let Temporal's routing keep everything clean. And you automated that versioned deployment lifecycle with a Kubernetes operator.

Two versioning strategies, each more powerful. Then automation to make it production-grade.

### Decision Framework (~5 min)

So the question you're going to face Monday morning is: which one do I use?

*[Show the decision flowchart here - this is the slide people photograph]*

Start simple. Are there running workflows when you deploy? If not, just deploy. No versioning needed.

Is the change non-replay-safe? If it's just an activity implementation change or adding a query handler, just deploy. No versioning needed.

Can you run multiple worker versions simultaneously? If you can't - maybe you're not on Kubernetes, maybe your infrastructure doesn't support it - then patching is your tool. It works everywhere, on any infrastructure.

If you *can* run multiple versions: are your workflows short-lived? Use PINNED versioning. No patching, clean separation, old versions drain naturally.

Long-lived workflows that use continue-as-new? PINNED plus upgrade-on-CaN. The workflow upgrades at each continue-as-new boundary. Still no patching within a single run.

Long-lived workflows without continue-as-new? AUTO_UPGRADE plus patching. You need both.

And if you're on Kubernetes, the Worker Controller automates the deployment lifecycle on top of whatever versioning behavior you choose.

### Monday Morning (~3 min)

I want you to think about one workflow you own. One real workflow in your production system. Got it?

*[30 seconds of silence]*

Which versioning strategy would you use? Patching? Worker versioning? Would you automate it with the controller? What would you need to change in your infrastructure to get there?

That's your homework. Not from me - from your future self who doesn't want to handle a production incident at 2 AM.

### Resources (~2 min)

A few links to keep handy. The Temporal docs on worker versioning, the Worker Controller repo on GitHub, the LMS courses on learn.temporal.io, and this workshop's repo with all the exercises and solutions. The Temporal community Slack has a worker-versioning channel where the team is very active.

Thank you. Go ship some changes safely.

---

# Part 2: Mermaid Diagrams

> These are the 5-6 key visuals the slide strategy identifies as highest-leverage. Build these first - they're the slides worth spending 3-5 minutes talking through. Export as SVG/PNG for Keynote.

---

## Diagram 1: The Versioning Spectrum (Opening)

> Mental model for the entire workshop. Shows progression from manual/code-level to automated/infrastructure-level.

*[TODO: diagram]*

---

## Diagram 2: Replay Flow (Exercise 1 Concepts)

> THE diagram for Exercise 1. Show initial execution storing events, then replay checking commands against history. Invest time here.

*[TODO: diagram]*

---

## Diagram 3: Replay Mismatch / NDE (Exercise 1 Concepts)

> Companion to Diagram 2. Shows what happens when new code produces a different command than the history expects.

*[TODO: diagram]*

---

## Diagram 4: Rainbow Deployment / Worker Versioning Architecture (Exercise 2 Concepts)

> Shows how multiple worker versions coexist with Temporal routing traffic to the right version.

*[TODO: diagram]*

---

## Diagram 5: Version Lifecycle (Exercise 2 Concepts)

> Shows the progression of a version through its states.

*[TODO: diagram]*

---

## Diagram 6: Worker Controller Architecture (Exercise 3 Concepts)

> Shows the relationship between the TWD CRD, the controller, and the versioned K8s Deployments.

*[TODO: diagram]*

---

## Diagram 7: Decision Framework Flowchart (Wrap-up)

> This is the slide people will photograph. Make it clear and opinionated.

*[TODO: diagram]*

---

# Part 3: Speaker Notes Per Slide

> Organized by section. Each entry = one slide. Notes are what you'd say (abbreviated), plus timing and transition cues.

---

## Opening

### Slide 1: Title
- **Notes:** "Welcome to the Temporal Versioning Workshop. Over the next three and a half hours, you're going to ship three releases, handle a production incident, and automate the whole thing."
- **Time:** 30s
- **Transition:** jump right into the problem

### Slide 2: The Problem
- **Notes:** "Temporal workflows can run for days, weeks, years. You *will* need to change code while they're running. And if the new code generates different commands than the history expects, the workflow is stuck. Non-determinism error. Production is broken."
- **Visual:** Consider a simple before/after showing "deploy new code" -> "replay fails"
- **Time:** 2 min
- **Transition:** "So what does that look like in practice?"

### Slide 3: The Problem (continued) - Valet Framing
- **Notes:** "You're the valet parking team. 23 cars parked right now. Client wants a new feature. How do you ship it without breaking those 23 in-flight transactions? That's the problem we're solving today."
- **Time:** 1.5 min
- **Transition:** "Let me show you the system."

### Slide 4: The Scenario
- **Notes:** "Two workflows. ValetParkingWorkflow handles a single transaction - park, wait, return. ParkingLotWorkflow is a long-running singleton managing 30 spaces. The wait in the middle is the danger zone - that's when workflows are in-flight during deploys."
- **Visual:** Simple flow diagram of the valet workflow: request -> move -> sleep -> move -> release
- **Time:** 1.5 min
- **Transition:** "So how do we ship changes safely?"

### Slide 5: The Versioning Spectrum
- **Notes:** "Three versioning strategies: Workflow Type Versioning - new workflow type for each version. Patching - code-level branching based on history markers. Worker Versioning - infrastructure routing between multiple deployed versions. The Worker Controller automates Worker Versioning on Kubernetes. The arc is: learning, crisis, mastery."
- **Visual:** [Diagram 1 - The Versioning Spectrum]
- **Time:** 2 min
- **Transition:** "Let's start with the foundation."

### Slide 6: Where Are We (Progress)
- **Notes:** [No narration - just flash it] "Exercise 1: Workflow Patching" highlighted.
- **Visual:** Three boxes, first one highlighted
- **Time:** 5s
- **Reuse:** after each exercise with appropriate highlight

---

## Exercise 1 Concepts

### Slide 7: How Replay Works - Initial Execution
- **Notes:** "When a workflow first runs, your code generates commands - schedule activity, start timer. The server records these as events. That history is the source of truth."
- **Visual:** Top half of [Diagram 2 - Replay Flow]
- **Time:** 2 min
- **Pacing:** Go slowly here. This is foundational.

### Slide 8: How Replay Works - The Replay
- **Notes:** "When a worker picks up a workflow task, it re-runs your code from the beginning. The SDK checks each command against the history. Match? Use the stored result. Mismatch?"
- **Visual:** Bottom half of [Diagram 2 - Replay Flow]
- **Time:** 2.5 min
- **Transition:** "So what's a mismatch?"

### Slide 9: Non-Determinism Error (Mismatch)
- **Notes:** "Your new code says 'schedule notify_owner.' The history says 'schedule move_car.' Mismatch. Non-determinism error. Workflow is stuck."
- **Visual:** [Diagram 3 - Replay Mismatch]
- **Time:** 1.5 min
- **Transition:** "Which changes cause this?"

### Slide 10: Non-Replay-Safe Changes
- **Notes:** "Anything that changes the command sequence. Adding, removing, reordering activities. Adding or removing timers. Switching which activity is called. BUT - changing activity *implementation* is safe. Changing timeouts is safe. Adding query handlers is safe. The two-question test: Does it change the command sequence? And are there open executions?"
- **Visual:** Two columns: "Needs Versioning" vs "Safe to Deploy" with 2-3 examples each (not exhaustive - reference the cheat sheet)
- **Time:** 3 min
- **Transition:** "How do you catch these before production?"

### Slide 11: Replay Testing
- **Notes:** "Export a completed workflow's history as JSON. Write a test that replays it against your current code. If the commands don't match, the test fails. This is your safety net before every deploy."
- **Visual:** Simple flow: Export History JSON -> Write Test -> Run Against New Code -> Pass/Fail
- **Time:** 1.5 min
- **Transition:** "And when the test catches a problem..."

### Slide 12: workflow.patched()
- **Notes:** "Wrap new code in `if workflow.patched('change-id')`. New workflows: returns True, records marker, runs new code. Old workflows replaying: no marker in history, returns False, skips new code. One worker, two behaviors."
- **Visual:** Before/after code snippet (keep it to 5-6 lines)
- **Time:** 2 min
- **Transition:** Pause and think slide

### Slide 13: Pause and Think
- **Notes:** [Read the question, then wait 10-15 seconds of silence.] "You just deployed new code. 23 cars are currently parked. What happens to the workflows that started on the old code?"
- **Visual:** Just the question on screen. Nothing else.
- **Time:** 30s
- **Transition:** "Let's find out. Open your exercise."

---

## Exercise 2 Concepts

### Slide 14: Where Are We (Progress)
- **Notes:** [Flash it] "Exercise 2: Worker Versioning" highlighted. Exercise 1 completed.
- **Time:** 5s

### Slide 15: Recap + Why Patching Isn't Enough
- **Notes:** "You just shipped a feature with patching. It worked. But look at your code now - one conditional branch. Billing is next. Another branch. Then another change. Another branch. Long-lived workflows accumulate layers of patches. Your code looks less like business logic and more like a geological record."
- **Visual:** Code snippet showing 2-3 nested `if workflow.patched(...)` blocks (illustrative, not real)
- **Time:** 2 min
- **Transition:** "There's a better way."

### Slide 16: Worker Versioning - Core Idea
- **Notes:** "Instead of branching in code, declare versioning at the workflow level. Run multiple worker versions side by side. Temporal routes each workflow to the right version. No patching, no conditional branches."
- **Visual:** [Diagram 4 - Rainbow Deployment / Worker Versioning Architecture]
- **Time:** 3 min
- **Pacing:** Spend time on this diagram. Walk through each arrow.

### Slide 17: Worker Versioning - Key Concepts
- **Notes:** "Worker Deployment is the service name - 'valet'. Worker Deployment Version is the code snapshot - 'valet:1.0'. Build ID identifies the version. All versions poll the same task queue, Temporal routes to the right one."
- **Visual:** Simple hierarchy: Deployment -> Version 1.0, Version 2.0, Version 3.0
- **Time:** 2 min

### Slide 18: PINNED vs AUTO_UPGRADE
- **Notes:** "Two behaviors. PINNED: stays on original version forever. No patching needed. Great for short-to-medium workflows. AUTO_UPGRADE: moves to new version on next task. Replays history. Still needs patching for non-replay-safe changes. ValetParkingWorkflow is PINNED. ParkingLotWorkflow is AUTO_UPGRADE."
- **Visual:** Two-column comparison table (from slide-content.md)
- **Time:** 3 min
- **Transition:** "How does a version's life unfold?"

### Slide 19: Version Lifecycle
- **Notes:** "Inactive, Active, Draining, Drained. The key command is set-current-version. That's what moves traffic."
- **Visual:** [Diagram 5 - Version Lifecycle]
- **Time:** 2 min

### Slide 20: Rainbow Deployments
- **Notes:** "Rolling deploys mix old and new code. Blue-green only gives you two colors. Rainbow gives you as many as you need. Old versions drain, new versions take traffic, they all coexist."
- **Visual:** Three-column comparison: Rolling (bad) / Blue-Green (better) / Rainbow (best for Temporal)
- **Time:** 2.5 min

### Slide 21: Emergency Remediation
- **Notes:** "When things go wrong. Step one: set-current-version back to previous. Instant. Step two: update-options to evacuate stuck workflows. Step three: fix the bug, deploy new version, set as current."
- **Visual:** Three-step flow: Rollback -> Evacuate -> Fix Forward
- **Time:** 2 min

### Slide 22: Pause and Think / Tension Builder
- **Notes:** "Everything is humming. Billing shipped clean. v1.0 drained on its own. You're feeling good about versioning. Then you make a typo in the tip calculation..." [Let it hang for 3-4 seconds.] "Let's see how fast you can respond."
- **Visual:** Narrative text on screen. Maybe a fake "all green" dashboard that's about to go red.
- **Time:** 30s
- **Transition:** "Open Exercise 2."

---

## Exercise 3 Concepts

### Slide 23: Where Are We (Progress)
- **Notes:** [Flash it] "Exercise 3: Worker Controller" highlighted. Exercises 1 and 2 completed.
- **Time:** 5s

### Slide 24: "You're About to Fire Yourself"
- **Notes:** "Welcome back. For the last two exercises, you were the ops team. Starting workers, running CLI commands, watching dashboards. Now you're going to automate all of that."
- **Visual:** Side-by-side: "Exercise 2: 6+ CLI commands" vs "Exercise 3: update a YAML file"
- **Time:** 1 min

### Slide 25: K8s in 30 Seconds
- **Notes:** "Pod: a running container, your worker process. Deployment: manages a set of Pods. That's all you need."
- **Visual:** Two terms, two one-line definitions. That's the whole slide.
- **Time:** 30s

### Slide 26: Worker Controller Architecture
- **Notes:** "Open-source K8s operator. You write a TemporalWorkerDeployment resource. The controller creates versioned Kubernetes Deployments, registers build IDs, manages ramping, runs gate checks, and cleans up old versions."
- **Visual:** [Diagram 6 - Worker Controller Architecture]
- **Time:** 3 min
- **Pacing:** Walk through the arrows. One TWD -> multiple K8s Deployments.

### Slide 27: Rollout Strategies
- **Notes:** "AllAtOnce: instant cutover. Progressive: gradual ramp with pauses. Manual: deploy but don't promote, test first."
- **Visual:** Comparison table, 3 columns, 3-4 rows (strategy, when to use, automation level, safety level)
- **Time:** 2 min

### Slide 28: Gate Workflows
- **Notes:** "The gate runs on new version workers while the version is still Inactive. If it passes, traffic ramps. If it fails, production is untouched. Compare to Exercise 2 - same kind of bug, completely different outcome."
- **Visual:** Flow: New Version Deployed -> Gate Runs -> Pass: Begin Rollout / Fail: Stay Inactive
- **Time:** 2 min
- **Transition:** "Let's automate everything. Open Exercise 3."

---

## Wrap-up

### Slide 29: The Callback
- **Notes:** "At 1:30, we said deploying changes to durable executions is the fundamental challenge. You just solved it with two versioning strategies, then automated the deployment lifecycle."
- **Visual:** [Where Are We - all 3 completed]
- **Time:** 1 min

### Slide 30: Decision Framework
- **Notes:** Walk through the flowchart top to bottom. "Start simple. Running workflows? Non-replay-safe change? Can you run multiple versions?..." Make it feel like a conversation, not a lecture.
- **Visual:** [Diagram 7 - Decision Framework Flowchart]
- **Time:** 4 min
- **Pacing:** This is the slide people photograph. Give them time.

### Slide 31: Recap
- **Notes:** "Five tools in your belt. Replay testing - your safety net. Patching - code-level branching, works everywhere. Worker Versioning - PINNED eliminates patching, AUTO_UPGRADE keeps long workflows current. Worker Controller - automates the Worker Versioning deployment lifecycle on Kubernetes. Emergency remediation - rollback, evacuate, fix-forward."
- **Visual:** Five items, one line each. Not a wall of text.
- **Time:** 2 min

### Slide 32: Monday Morning
- **Notes:** "Think about one workflow you own. Which strategy?" [30 seconds silence] "That's your homework."
- **Visual:** Just the question. Nothing else.
- **Time:** 1.5 min

### Slide 33: Resources
- **Notes:** "Temporal docs, Worker Controller repo, LMS courses, this workshop repo, community Slack. Thank you."
- **Visual:** Links only. No descriptions.
- **Time:** 1 min

---

# Part 4: Cheat Sheet Handout

> All the "reference" material that doesn't belong on slides. Print this or make it available as a PDF. Frees the slides to be conceptual.

---

## Temporal Versioning Workshop - Reference Cheat Sheet

### Key Terms

| Term | Definition |
|---|---|
| **Non-Determinism Error (NDE)** | Error thrown when replayed workflow code generates a different command sequence than what's recorded in the history. Workflow is stuck until fixed. |
| **Replay** | Process where a worker re-executes workflow code from the beginning, checking generated commands against the stored event history. |
| **Command** | An action generated by workflow code (e.g., ScheduleActivityTask, StartTimer). Recorded as Events in history. |
| **Worker Deployment** | Logical grouping of all versions of a worker service (e.g., "valet"). |
| **Worker Deployment Version** | A specific code snapshot, identified by deployment name + Build ID (e.g., "valet:1.0"). |
| **Build ID** | Identifier for a code version. Typically a git SHA, version number, or timestamp. |
| **PINNED** | Versioning behavior where a workflow stays on the version it started on until completion. |
| **AUTO_UPGRADE** | Versioning behavior where a workflow moves to the current version on its next workflow task. |
| **Current Version** | The version receiving all new workflow executions (unless ramping is configured). |
| **Ramping Version** | A version receiving a configured percentage of new workflow executions. |
| **Rainbow Deployment** | Deployment model where multiple worker versions coexist, each serving their own workflows. |
| **TemporalWorkerDeployment (TWD)** | Kubernetes CRD that declares desired worker deployment state. The Worker Controller reconciles it. |
| **Gate Workflow** | A workflow run on a new version's workers before production traffic routes to it. Blocks rollout if it fails. |

### Non-Replay-Safe Changes (Need Versioning)

- Adding, removing, or reordering activity calls
- Adding or removing timer/sleep calls
- Switching which activity or child workflow is called
- Changing execution order of activities/timers relative to each other
- Starting or cancelling child workflows
- Starting or cancelling signals or nexus operations

### Safe to Deploy Without Versioning

- Changing activity *implementation* code (activities aren't replayed)
- Changing activity/child workflow options (timeouts, retry policies)
- Changing arguments passed to activities or child workflows
- Changing timer durations (except to/from zero in Python/Go/Java)
- Adding new signal, query, or update handlers (additive only)
- Adding logging or non-command-generating statements

### The Two-Question Test

1. Does this change affect the sequence of Commands generated by the workflow?
2. Will there be open (running) executions when you deploy?

**If both are YES** -> you need versioning. **If either is NO** -> just deploy.

### CLI Commands Reference

```bash
# Start Temporal dev server
temporal server start-dev

# Export workflow history as JSON (for replay tests)
temporal workflow show --workflow-id <WF_ID> --output json > history.json

# Describe a worker deployment (see versions, routing config)
temporal worker deployment describe --deployment-name <NAME>

# Set a version as current (routes all new traffic to it)
temporal worker deployment set-current-version \
    --deployment-name <NAME> \
    --version "<NAME>:<BUILD_ID>" \
    --yes

# List workflows on a specific version
temporal workflow list \
    --query 'WorkerDeploymentVersion="<NAME>:<BUILD_ID>" AND ExecutionStatus="Running"'

# Evacuate workflows from one version to another
temporal workflow update-options \
    --query 'WorkerDeploymentVersion="<NAME>:<BUILD_ID>" AND ExecutionStatus="Running"' \
    --versioning-override deployment-redirect="<NAME>:<TARGET_BUILD_ID>" \
    --yes
```

### PINNED vs AUTO_UPGRADE Decision Guide

| Workflow Duration | Uses Continue-as-New? | Recommended | Patching Required? |
|---|---|---|---|
| Short (completes before next deploy) | N/A | PINNED | Never |
| Medium (spans multiple deploys) | No | AUTO_UPGRADE | Yes |
| Long (weeks to years) | Yes | PINNED + upgrade on CaN | Never (within a run) |
| Long (weeks to years) | No | AUTO_UPGRADE + patching | Yes |

### Worker Controller Rollout Strategies

| Strategy | Behavior | Best For |
|---|---|---|
| **AllAtOnce** | Instant cutover, all replicas | Initial deploys, no in-flight workflows |
| **Progressive** | Gradual ramp (25% -> 75% -> 100%) with pauses | Production deploys with in-flight workflows |
| **Manual** | Deploy but don't promote (stays Inactive) | Pre-deployment testing with synthetic traffic |

### Version Lifecycle States

```
Inactive ──[set-current-version]──> Active (Current or Ramping)
Active ──[new version becomes Current]──> Draining
Draining ──[all PINNED workflows complete]──> Drained
Drained ──> Safe to shut down workers
```

### Emergency Remediation Playbook

1. **Stop the bleeding:** `set-current-version` to previous working version (instant, no redeploy)
2. **Assess damage:** `temporal workflow list` with `WorkerDeploymentVersion` filter to see stuck workflows
3. **Evacuate:** `update-options` to bulk-move stuck workflows to working version
4. **Fix forward:** Fix the bug, deploy as new version (e.g., v3.1), set as current
5. **Drain and clean up:** Wait for broken version to drain, stop its workers

### Python SDK Quick Reference

```python
# Versioning behavior on a workflow
@workflow.defn(versioning_behavior=VersioningBehavior.PINNED)
class MyWorkflow:
    ...

# Worker deployment config
Worker(
    client,
    task_queue="my-queue",
    workflows=[MyWorkflow],
    activities=[my_activity],
    deployment_config=WorkerDeploymentConfig(
        deployment_name=os.environ["TEMPORAL_DEPLOYMENT_NAME"],
        build_id=os.environ["TEMPORAL_WORKER_BUILD_ID"],
        use_worker_versioning=True,
    ),
)

# Patching
if workflow.patched("my-change-id"):
    # New code path
    await workflow.execute_activity(new_activity, ...)
else:
    # Old code path (optional)
    ...

# Replay test
from temporalio.worker import Replayer

async def test_replay():
    replayer = Replayer(workflows=[MyWorkflow])
    await replayer.replay_workflow(
        WorkflowHistory.from_json("history_file", json_data)
    )
```

### Links

- Temporal Docs - Worker Versioning: https://docs.temporal.io/worker-versioning
- Temporal Docs - Determinism: https://docs.temporal.io/workflow-definition#deterministic-constraints
- Worker Controller: https://github.com/temporalio/temporal-worker-controller
- LMS Courses: https://learn.temporal.io
- Community Slack: https://temporalio.slack.com (#worker-versioning)
