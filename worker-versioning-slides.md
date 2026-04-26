# Worker Versioning Slides

---

## Slide 1: Temporal Worker Deployment

**Bullets**
A deployment or service running across one or more versions
Groups workers that share the same code lineage
The unit Temporal uses to route workflows
Lives forever (versions come and go, deployments don't)

**Speaker notes**
A Worker Deployment is just the logical name for your service.

Think of it like the app or microservice as a whole: "billing-worker," "llm-srv," whatever.

It can have multiple versions live at once, and Temporal uses the deployment name to figure out where to send workflow tasks.

Worth noting: Temporal never garbage-collects deployments, only the versions inside them.

---

## Slide 2: Temporal Worker Deployment Version

**Bullets**
One specific build of a deployment
Identified by deployment name + build ID
All workers in a version run the same code
Can poll multiple task queues, but always one build

**Speaker notes**
Inside a deployment you have versions.

A version is a single build, identified by a build ID like "1.0" or a git sha.

Every worker that says "I'm version 1.0" runs identical code.

This is the unit you ramp traffic to, pin workflows to, and eventually drain and sunset.

---

## Slide 3: Configuring a Worker for Deployment

**Bullets**
`use_worker_versioning=True`
`WorkerDeploymentVersion(deployment_name, build_id)`
Optional `default_versioning_behavior`
Build ID typically comes from env or CI

**Speaker notes**
Turning this on is a small config change on the Worker.

You flip versioning on, give it a deployment name and a build ID, and optionally set a default behavior for workflows that don't declare one.

The build ID is the thing you'll change every deploy, so source it from an env var your CI sets.

Everything else stays the same.

---

## Slide 4: Current Version and Ramping Version

**Bullets**
**Current**: where new workflows go by default
**Ramping**: a percentage of new workflows for canary
Both can accept new and auto-upgrade workflows
One Current, optionally one Ramping per deployment

**Speaker notes**
Each deployment has one Current Version, that's your stable target.

You can also designate a Ramping Version and send some percentage of new workflows there.

This is how you do canary or progressive rollouts.

Move the ramp from 5 to 25 to 100, then promote to Current.

Pinned workflows already running stay where they were.

---

## Slide 5: Rolling Out Changes with the CLI

**Bullets**
`temporal worker deployment describe`
`set-current-version --deployment-name --build-id`
`set-ramping-version --percentage`
`temporal workflow describe -w` to verify

**Speaker notes**
The Temporal CLI is how you drive routing.

Describe the deployment to see what versions are polling.

Set a ramping version with a percentage when you want to canary.

Once you're confident, set-current-version flips it over.

You can verify any individual workflow with workflow describe and check the Versioning Info section.

---

## Slide 6: Pinned Versioning Behavior

**Bullets**
Workflow runs to completion on its starting version
No patching needed (code never changes mid-run)
Best for short-to-medium workflows
Designed for rainbow deployments

**Speaker notes**
Pinned is the simplest mental model.

A workflow starts on version 1.0, it finishes on version 1.0.

New deploys do not affect it.

Because the code never changes underneath it, you don't have to patch.

You just need to keep version 1.0 workers around until those workflows drain.

---

## Slide 7: Auto-Upgrade Versioning Behavior

**Bullets**
Workflow moves to the new Current/Ramping version
Code changes mid-run, so patching is required
Best for medium workflows that span deploys
Default for child workflows of auto-upgrade parents

**Speaker notes**
Auto-Upgrade is the legacy-style behavior.

When you ship a new version, running workflows pick it up.

That's flexible but means you're back to dealing with non-determinism, so you still need workflow.patched for breaking changes.

Use this when workflows are too long to wait out, but short enough that patches stay manageable.

---

## Slide 8: Choosing a Versioning Behavior

**Bullets**
Short workflows -> Pinned, no patching
Medium workflows -> Auto-Upgrade + patching
Long + Continue-as-New -> Pinned + upgrade on CaN
Long, no CaN -> Auto-Upgrade + patching

**Speaker notes**
The decision really comes down to: how long do my workflows live compared to how often I deploy?

If they finish before the next deploy, just pin them and forget about it.

If they outlive deploys, you either patch or you find a Continue-as-New boundary to upgrade on.

The longer the workflow, the more attractive Pinned plus Continue-as-New becomes.

---

## Slide 9: Upgrading on Continue-as-New

**Bullets**
Pinned workflows stay on their version per run
Continue-as-New starts the next run on the Target Version
No patching required across runs
Ideal for entity, batch, and AI agent workflows

**Speaker notes**
This is the escape hatch for long-running pinned workflows.

Each run is pinned, so the code is stable while it executes.

When you hit your Continue-as-New boundary, you check whether a new Target Version exists, and if so, the next run starts there.

You get version stability inside a run and free upgrades between runs, no patching required.

---

## Slide 10: Worker Version Statuses

**Bullets**
**Inactive**: polled but never made Current/Ramping
**Active**: Current or Ramping, taking new work
**Draining**: no longer routed to, pinned workflows still running
**Drained**: all pinned workflows finished, safe to shut down

**Speaker notes**
Versions move through a simple lifecycle.

They show up as Inactive when a worker first polls.

They become Active when you make them Current or Ramping.

When you replace them, they go Draining while their pinned workflows finish.

Once those are done, the version is Drained and you can shut the workers down.

Temporal updates this status periodically, so it's not instant.

---

## Slide 11: Sunsetting an Old Deployment Version

**Bullets**
Wait for `DrainageStatus: drained`
`temporal worker deployment describe-version`
Then shut down the workers
Keep some workers if you need queries on closed workflows

**Speaker notes**
Sunsetting is mostly a waiting game.

Once a version stops being Current or Ramping, it drains as its pinned workflows finish.

Use describe-version to monitor.

When it shows drained, the workers aren't doing anything useful and you can scale them to zero.

One caveat: if you query closed workflows, you may need to keep a worker around to serve those queries.

---

## Slide 12: Moving a Pinned Workflow

**Bullets**
`temporal workflow update-options` with a versioning override
Use `--query` to move many at once
Reset-with-Move for incompatible code changes
May still need patching in the target build

**Speaker notes**
Sometimes a bad build is already running pinned workflows and you need to evacuate them.

The update-options command lets you override the version for one workflow or for a whole batch matching a query.

If the change is incompatible, you can pair it with a Reset so the workflow re-runs from a safe event on the new version.

This is the break-glass tool, not your everyday move.
