# Slide Content - Temporal Versioning Workshop

> **Purpose:** This document is the working draft for Keynote slide content. Each section maps to a slide or small group of slides. Talking points are bulleted; diagram descriptions are in `[DIAGRAM]` blocks. The structure follows the chunked format: teach -> exercise -> teach -> exercise.

---

## Session Outline

| Block | Duration | Content |
|---|---|---|
| Opening | ~20 min | The problem, replay primer, deployment strategies, versioning toolkit overview |
| Exercise 1 | ~30 min | Patching + replay testing |
| Bridge to Exercise 2 | ~10-15 min | Patching limitations, worker versioning, PINNED vs AUTO_UPGRADE, trampolining, remediation |
| Exercise 2 | ~30 min | Worker versioning hands-on |
| Break | ~30 min | |
| Bridge to Exercise 3 | ~10 min | Manual to automated, controller concepts, rollout strategies, gates |
| Exercise 3 | ~30 min | K8s with the Worker Controller |
| Wrap-up | ~10 min | Decision framework, what's safe without versioning, resources |

---

# OPENING (~20 min)

---

## Slide: Title

- **Deploying to Durable Executions**
- Workflow Patching, Worker Versioning, and the Worker Controller
- Replay 2026
- Bitovi + Temporal

---

## Slide: The Problem

- You have workflows running in production
- You need to ship a code change
- Some of those workflows started *before* your change - they're mid-execution
- If the new code produces a different command sequence than their history, you get a non-determinism error (NDE)
- This is the fundamental deployment challenge of durable execution

> Talking point: For stateless services, you deploy and move on. For durable executions, the past is always with you - every running workflow carries a history that your new code must be compatible with.

---

## Slide: The Valet Parking Example

- Airport valet parking service built on Temporal
- **ValetParkingWorkflow**: handles a single parking transaction (park the car, wait for the trip, retrieve the car)
- **ParkingLotWorkflow**: long-running singleton managing 30 spaces
- Load simulator continuously starts workflows with random trip durations
- All three exercises evolve this same codebase

[DIAGRAM: Simple visual of a car arriving at valet, being parked, owner flies away, owner returns, car retrieved. Label workflow steps along the sequence: request_space -> move_car -> sleep (trip) -> move_car -> release_space]

---

## Slide: How Replay Works (Primer)

- Temporal workflows are deterministic state machines
- When a worker picks up a workflow task, it replays the workflow's event history to rebuild state
- Each replay must produce the *same sequence of commands* as the original execution
- If replay produces a command the history doesn't expect (or vice versa), that's a non-determinism error

[DIAGRAM: Two-column comparison. Left: "Original execution" showing a command sequence (schedule activity A, schedule activity B, start timer). Right: "Replay" showing the same sequence with checkmarks. Then a third column: "Replay after code change" where activity C appears between A and B, with a red X - mismatch]

> Talking point: This is the 30-second version. The key insight is that replay is not "re-running" your workflow - it's checking that your code would produce the same commands the history already recorded. Any divergence is fatal.

---

## Slide: What Changes Are Non-Replay-Safe?

- Adding, removing, or reordering activity calls
- Adding, removing, or reordering timer/sleep calls
- Changing activity or child workflow arguments in a way that alters the command sequence
- Changing which signals/updates are waited on

**Safe changes (no versioning needed):**
- Changing activity *implementation* (the code inside the activity function)
- Adding new query handlers
- Changing log messages or other side-effect-free code
- Adding new signal/update handlers (as long as existing flow isn't altered)

> Talking point: The mental model is - if it changes the *commands* the workflow sends to the server, it's non-replay-safe. If it only changes what happens inside an activity or doesn't affect the command sequence, you're fine.

---

## Slide: Deployment Strategies

[DIAGRAM: Three rows, each showing a deployment pattern over time:

Row 1 - "Rolling": Single row of boxes, old version gradually replaced by new. Arrow: "Workers upgraded in-place. No control over routing. Slow rollback." Label: "Incompatible with workflow pinning"

Row 2 - "Blue-Green": Two rows (blue and green). Traffic switches from blue to green. Arrow: "Two versions max. Fast cutover and rollback. Works for AUTO_UPGRADE." Label: "Good for short-lived workflows"

Row 3 - "Rainbow": Multiple rows, 3+ colors. Each drains independently. Arrow: "N versions coexist. Each workflow completes on its original version." Label: "Required for PINNED workflows"]

- **Rolling**: workers upgraded in-place. No version isolation. Only works with patching.
- **Blue-green**: two versions, controlled cutover. Fast rollback. Limited to two simultaneous versions.
- **Rainbow**: N versions coexist. Each pinned workflow completes on its original version. Old versions drain and are retired.
- Temporal's Worker Versioning enables blue-green and rainbow deployments with built-in routing.

> Talking point: Most of you probably use rolling deployments today and rely on patching to stay replay-safe. The industry is moving toward rainbow - and Temporal is making that easy.

---

## Slide: The Versioning Toolkit (Overview)

Three layers, each building on the last:

| Layer | What it does | When to use |
|---|---|---|
| **Patching** | Conditional branches in workflow code (old path vs new path) | Foundational skill. Fallback when you can't run multiple worker versions. Still needed for AUTO_UPGRADE workflows. |
| **Worker Versioning** | Pin workflows to specific worker build IDs. Temporal routes traffic. | Recommended default for production. Eliminates patching for PINNED workflows. |
| **Worker Controller** | K8s operator that automates rainbow deployments, ramping, draining, sunsetting. | When you're on Kubernetes and want the operational overhead handled for you. |

> Talking point: Think of these as layers, not replacements. You'll use patching knowledge to understand *why* versioning matters. You'll use versioning to deploy safely. And the controller automates the operational dance. Today we'll hands-on all three.

---

## Slide: Exercise 1 Setup

- Open Instruqt environment
- Navigate to `exercises/exercise-1/practice`
- You'll: run v1.0, capture a history, write a replay test, make a breaking change, see it fail, patch it, see it work
- ~30 minutes

---

# BRIDGE TO EXERCISE 2 (~10-15 min)

---

## Slide: What You Just Did

- You added an activity call - a non-replay-safe change
- Replay test caught it (the safety net)
- `workflow.patched()` made it compatible - old executions skip the new code, new ones run it
- A single worker handled both old and new workflows

> Talking point: This works. It's battle-tested. But...

---

## Slide: The Problem with Patching (at Scale)

- Every non-replay-safe change adds a conditional branch
- Over time, your workflow code accumulates `if patched(...)` blocks
- Each patch is a branching point - old path and new path must both be correct
- Removing old patches requires confirming no running workflows need them
- Long-running workflows (entity workflows, subscriptions) compound the problem - patches from months ago might still be active

[DIAGRAM: A workflow function's code growing over time. Version 1: clean, linear. Version 5: riddled with nested if/else patch blocks. Visual complexity increasing. Maybe a "spaghetti" metaphor with tangled valet parking lanes.]

> Talking point: For one or two changes, patching is fine. For a team shipping weekly to a workflow that runs for days? Patches become the dominant source of complexity. This is the pain Worker Versioning was built to solve.

---

## Slide: Worker Versioning - The Recommended Default

- Instead of embedding version logic in workflow code, version at the *worker* level
- Each workflow execution is pinned to (or auto-upgraded to) a specific Worker Deployment Version
- Temporal's server handles routing - no load balancer games, no task queue tricks
- Non-replay-safe changes "just work" when workers are versioned and workflows are PINNED

> Talking point: Temporal's docs are clear - "For most teams, Worker Versioning should be the default. Treat patching as a fallback." This is the shift from version logic in your code to version routing in the infrastructure.

---

## Slide: PINNED vs AUTO_UPGRADE

**PINNED:**
- Workflow runs on the version it started on, for its entire lifetime
- No patching needed - ever
- Requires rainbow deployments (multiple worker versions running simultaneously)
- Old workers stay alive until their pinned workflows drain

**AUTO_UPGRADE:**
- Workflow automatically migrates to the latest version on its next workflow task
- Still requires patching (new code must be replay-compatible)
- Single worker pool possible (like rolling deployments, but with routing control)
- Good for long-lived singletons you don't want to keep old workers around for

[DIAGRAM: Split panel.

Left "PINNED": Two worker boxes (v1, v2) side by side. Workflows started on v1 stay on v1 (arrow stays in v1 lane). New workflows go to v2. v1 eventually drains and is retired.

Right "AUTO_UPGRADE": Single worker timeline. v1 workers replaced by v2. Existing workflows hop to v2 on next task. Requires patch guards for compatibility.]

---

## Slide: Choosing the Right Behavior

| Workflow type | Duration | Recommended | Patching? |
|---|---|---|---|
| Order processing | Minutes | PINNED | Never |
| Payment retry | Hours | PINNED or AUTO_UPGRADE | Depends on deploy frequency |
| Subscription billing | Days | AUTO_UPGRADE | Yes |
| Entity workflow | Months-years, uses continue-as-new | PINNED + upgrade on CaN | Never |
| Compliance audit | Months, needs full history | AUTO_UPGRADE + patching | Yes |

> Talking point: The deciding factor is how long your workflow runs relative to how often you deploy. Short-lived? PINNED, done. Long-lived with continue-as-new? PINNED + trampolining. Long-lived without CaN? AUTO_UPGRADE + patching.

---

## Slide: Trampolining (Upgrade on Continue-as-New)

- Long-running workflows that use continue-as-new can upgrade at CaN boundaries
- Each *run* stays pinned (no patching needed within a run)
- When a new version becomes Current, the workflow detects it and opts into the upgrade at its next CaN
- The new run starts on the new version
- Ideal for entity workflows, batch processors, AI agents

[DIAGRAM: A timeline showing a workflow's "runs" as segments. Run 1 on v1.0, Run 2 on v1.0, then a "CaN boundary" where v2.0 becomes available. Run 3 starts on v2.0. Each run is short and pinned; the upgrade happens at the boundary. Label: "Each run is pinned. The upgrade happens at the seam."]

> Talking point: This is public preview and a game-changer for long-running workflows. It means you can use PINNED for everything - even entity workflows - as long as you have continue-as-new boundaries. No patching, ever.

---

## Slide: Emergency Remediation Techniques

When things go wrong in production, Worker Versioning gives you tools to respond:

**1. Instant rollback (`set-current-version`)**
- Point new traffic back to a known-good version immediately
- No code redeploy needed - just a CLI/API call
- In-flight workflows on the bad version are still stuck (PINNED)

**2. Evacuate stuck workflows (`update-options`)**
- Bulk-reassign workflows from the bad version to a working one
- Query by `WorkerDeploymentVersion` search attribute to find them
- Safe when the workflow *definition* is the same (bug is in activity implementation)

**3. Fix-forward**
- Deploy a corrected version (v3.1 after a bad v3.0)
- Set it as current, let the bad version drain or evacuate it
- Often faster than trying to revert

> Talking point: The key insight is that rollback and evacuation are *instant* - they don't require a code deploy. That's the power of routing at the infrastructure level. You'll practice all three of these in Exercise 2.

---

## Slide: Exercise 2 Setup

- Navigate to `exercises/exercise-2/practice`
- You'll: enable versioning, deploy v1.0, add a breaking change as v2.0 (no patching!), simulate a bad v3.0 deploy, rollback, evacuate, fix-forward
- ~30 minutes

---

# BREAK (30 min)

---

# BRIDGE TO EXERCISE 3 (~10 min)

---

## Slide: What You Just Did

- Deployed a non-replay-safe change with zero patching (PINNED + rainbow)
- Managed version lifecycle manually (start workers, set-current-version, drain, stop)
- Handled an incident: instant rollback, evacuation, fix-forward

> Talking point: It works great, but there's a lot of manual orchestration. Start the new worker, run the CLI command, watch for draining, stop the old worker... Imagine doing that on every deploy in a CI/CD pipeline. That's what the Worker Controller automates.

---

## Slide: From Manual to Automated - The Worker Controller

- Open-source Kubernetes operator for Temporal workers
- You define a `TemporalWorkerDeployment` CRD with your image tag and rollout strategy
- The controller handles: creating versioned K8s Deployments, registering versions with Temporal, ramping traffic, draining old versions, cleaning up

[DIAGRAM: Left side "Manual (Exercise 2)": numbered steps - 1. Start new worker, 2. CLI: set-current-version, 3. Watch for drain, 4. Stop old worker. Right side "Automated (Exercise 3)": single step - 1. kubectl apply (update image tag). Arrow from CRD to controller to "versioned K8s Deployments, traffic routing, drain, cleanup" all happening automatically.]

> Talking point: The controller turns your deploy into a single `kubectl apply`. Everything else - the rainbow deployment, ramping, draining, sunsetting - is automated.

---

## Slide: Rollout Strategies

| Strategy | Behavior | Use case |
|---|---|---|
| **AllAtOnce** | Instant cutover to new version | First deploy, or safe changes you're confident about |
| **Progressive** | Ramp traffic in steps (e.g. 25% -> 75% -> 100%) with pause durations | Non-replay-safe changes where you want gradual rollout |
| **Manual** | Version stays Inactive until explicitly promoted | Pre-deployment testing with synthetic traffic |

[DIAGRAM: Three timelines showing traffic distribution:
AllAtOnce: instant switch from v1 (100%) to v2 (100%)
Progressive: v1 100% -> v1 75% / v2 25% -> v1 25% / v2 75% -> v2 100%
Manual: v1 100%, v2 sits at 0% (Inactive) indefinitely until promoted]

---

## Slide: Gate Workflows - Pre-Deployment Checks

- Configure a gate workflow in the CRD's `rollout.gate` field
- Before any traffic ramps, the controller starts the gate workflow on the new version's workers
- If the gate fails, the version stays Inactive - zero production impact
- Use cases: credential validation, dependency health checks, smoke tests

[DIAGRAM: Sequence showing: New version deploys -> Controller starts gate workflow on new version -> Gate checks billing service credentials -> FAIL -> version stays Inactive, production traffic unaffected on old version. Then: Fix -> Redeploy -> Gate passes -> Ramp begins.]

> Talking point: The gate is your automated pre-flight check. In Exercise 3, you'll see it catch a misconfigured API key before any production workflow is affected.

---

## Slide: Exercise 3 Setup

- Navigate to `exercises/exercise-3/practice`
- You'll: deploy v1.0 with AllAtOnce, deploy v2.0 with Progressive rollout, set up a gate workflow that catches a bad credential, fix it and watch it pass
- Optional Part D: test with synthetic traffic using Manual strategy
- ~30 minutes

---

# WRAP-UP (~10 min)

---

## Slide: The Full Picture

[DIAGRAM: A layered diagram (like a cake or stack):

Bottom layer: "Replay Testing" - your safety net, catches non-replay-safe changes before they hit production
Middle layer: "Patching" - conditional branches for replay compatibility. Still needed for AUTO_UPGRADE workflows.
Upper layer: "Worker Versioning" - PINNED + rainbow deployments. The recommended default. Eliminates patching for most workflows.
Top layer: "Worker Controller" - automates the operational lifecycle on Kubernetes.

The valet parking lot could be the visual metaphor - different "levels" of the parking garage, each one a higher level of automation/safety.]

> Talking point: These aren't competing tools - they're layers. Replay testing is always your safety net. Patching is the foundational technique. Worker Versioning is the recommended production approach. The controller automates the ops. Use the layer that fits your situation.

---

## Slide: Decision Framework

**Start here:** Can you run multiple worker versions simultaneously (rainbow deploys)?

- **Yes** -> Use Worker Versioning with PINNED for most workflows
  - Long-running with CaN? Add trampolining (upgrade on CaN)
  - Long-running without CaN? Consider AUTO_UPGRADE + patching for those types
  - On Kubernetes? Use the Worker Controller

- **Not yet** -> Use patching as your primary tool
  - Invest in replay testing to catch issues early
  - Work toward rainbow deployment support

---

## Slide: What's Safe Without Versioning?

Quick reference - changes you can deploy with a simple rolling update:

- Activity implementation changes (the code *inside* the activity)
- Adding new query or update handlers
- Changing timeouts on activities/timers (for *new* executions)
- Modifying logging, metrics, or observability code
- Infrastructure changes (dependencies, environment variables) that don't affect workflow logic

**When in doubt, write a replay test.**

---

## Slide: Resources

- Worker Versioning docs: docs.temporal.io/worker-versioning
- Worker Controller repo: github.com/temporalio/temporal-worker-controller
- Choosing versioning behavior: docs.temporal.io/production-deployment/worker-deployments/worker-versioning#choosing-behavior
- Upgrade on Continue-as-New: docs.temporal.io/production-deployment/worker-deployments/worker-versioning#upgrade-on-continue-as-new
- This workshop's repo: (link)

---

## Slide: Thank You

- Questions?
- (Contact info / Bitovi + Temporal logos)
