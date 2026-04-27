# Patching Slides

---

## Slide 1: What Is Workflow Patching?

**Bullets**
Code branch for a change, like a feature flag
`patched("id")` returns `True` for new, `False` for old
Inserts a marker event into Workflow History
Safe to deploy alongside in-flight workflows
Pinned workflows don't need patching

**Speaker notes**
Patching lets you change workflow code while in-flight executions are still running.

`workflow.patched("id")` acts like a feature flag: new executions return True and take the new path, while replaying pre-patch workflows return False and take the old path.

The mechanism is a marker event written into history on first call - during replay, the SDK checks for that marker to decide which branch to take.

---

## Slide 2: Deprecating a Patch

**Bullets**
Phase 1: Add if/else with old and new code paths
Phase 2: `deprecate_patch()`, remove old code path
Phase 3: Remove `deprecate_patch()` entirely
Each phase must fully drain before advancing

**Speaker notes**
Patches have a strict three-phase lifecycle - skip a phase and you'll break running workflows.

Phase one: add the if/else with both code paths.

Phase two: once all pre-patch workflows have finished, swap the branch for `deprecate_patch()` and remove the old code - it still writes the marker but won't fail replay if the marker is absent.

Phase three: once deprecated workflows are done too, remove `deprecate_patch()` entirely.

---

## Slide 3: Patching Does a Search Attribute Upsert

**Bullets**
First `patched()` call upserts `TemporalChangeVersion`
Value is the patch ID that was applied
Filter running workflows by patch ID
Find who still needs to drain before deprecating

**Speaker notes**
Most people don't know that `patched()` also upserts the `TemporalChangeVersion` search attribute with the patch ID.

This lets you query which running workflows have seen a given patch - useful for knowing when it's safe to advance to the next lifecycle phase.

When `TemporalChangeVersion = "my-patch-id" AND ExecutionStatus = "Running"` returns zero results, you're clear to deprecate.

---

## Slide 4: Patching Downsides

**Bullets**
If/else branches accumulate with each deploy
Strict three-phase lifecycle - no shortcuts
Loops need indexed IDs due to memoization
Pinned workflows bypass patching entirely

**Speaker notes**
Every breaking change adds another if/else tree, and you can't remove it until all pre-patch workflows drain - which can take months for long-running workflows.

Over time, that code becomes a history of every deploy you've ever made.

There's also a loop gotcha: `patched()` memoizes on first call, so calling it in a loop returns the same value every iteration - you need indexed IDs as a workaround.

If you're using Pinned Worker Versioning, none of this applies - the code never changes under a running workflow.

---

## Slide 5: Safe vs. Unsafe Workflow Changes

**Bullets**
Safe: activity args, retry policy, timeouts, logging
Unsafe: add/remove/reorder activities or timers
Unsafe: swap the activity type being called
Replay testing tells you which category your change is in

**Speaker notes**
Not every change to workflow code requires patching - only changes that alter the sequence of Commands the workflow produces.

Safe changes include anything that doesn't affect what gets recorded in history: activity arguments, retry policies, timeouts, logging, and activity implementations themselves.

Unsafe changes are structural: adding, removing, reordering, or swapping activities and timers will produce a different Command sequence and break replay for in-flight workflows.

Replay testing is how you find out which category your change falls into before you deploy.

---

## Slide 6: Replay Testing - First Line of Defense

**Bullets**
Replays history against current code before deploying
Catches NDEs before they hit production
Export history via CLI or Web UI download
Commit JSON files alongside your workflow code

**Speaker notes**
Replay testing lets you validate a code change against real workflow history before you ever deploy.

You take a history file exported from a previous execution, run it through your updated code, and if the command sequence doesn't match, you get a non-determinism error in your test suite - not in production.

Export history with the CLI: `temporal workflow show --output json > history.json`, or use the download button in the Web UI.

Commit those files with your code - they're the compatibility contract that keeps every future deploy honest.

---

## Slide 7: Writing a Replay Test

**Bullets**
`Replayer(workflows=[YourWorkflow])` - no activities
`replay_workflow(WorkflowHistory.from_json(...))`
Non-determinism raises an error - test fails
Run in CI before every deploy

**Speaker notes**
Create a `Replayer` with the workflow type - no activities needed, since they aren't replayed.

Load the JSON history file, pass it to `replay_workflow`, and if the current code produces a different command sequence than the history recorded, it raises a non-determinism error and the test fails.

Run this in CI on every deploy that touches workflow code - a passing test means your change is safe for in-flight executions, a failing test means you need to patch.

```python
async def test_replay_workflow():
    with open("history/my-workflow-history.json", "r") as f:
        history_json = f.read()

    replayer = Replayer(workflows=[MyWorkflow])
    await replayer.replay_workflow(
        WorkflowHistory.from_json("my-workflow-id", history_json)
    )
```

---

## Slide 8: Why Patching Isn't Enough

**Bullets**
Each deploy adds a branch - version debt grows
Old code takes weeks or months to remove
Long-running workflows stack overlapping patches
Temporal recommends Worker Versioning over patching

**Speaker notes**
Patching works, but every deploy adds another branch and cleanup is slow - you can't remove a patch until all pre-patch workflows drain, which for long-running workflows can take months.

Patch a workflow that already has patches and you're nesting conditionals on conditionals.

The Temporal docs are clear: if you can run versioned deployments, prefer Worker Versioning over patching.

Patching is the fallback while you work toward a better deployment model, not the destination.

---

## Slide 9: Deployment Strategies

**Bullets**
**Rolling**: in-place upgrade, no routing control
**Blue-green**: two versions, instant rollback
**Rainbow**: N versions, Pinned workflows drain safely

**Speaker notes**
Rolling upgrades workers in place with no routing control - incompatible with Worker Versioning.

Blue-green keeps two versions live, giving you routing control, canary ramps, and instant rollback - but two slots isn't enough if you deploy faster than workflows drain.

Rainbow is blue-green with as many slots as you need: each deploy gets its own version, old versions drain naturally, and Temporal tells you when each one is safe to shut down.

Rainbow is the deployment model Worker Versioning is designed for.

