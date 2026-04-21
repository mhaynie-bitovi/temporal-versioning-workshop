---
slug: workflow-patching
id: ""
type: challenge
title: "Workflow Patching"
teaser: "Safely evolve running Temporal workflows with replay testing and workflow.patched()"
tabs:
- type: terminal
  title: Worker
  hostname: workstation
  working_directory: /root/temporal-versioning-workshop/exercises/1-workflow-patching/practice
- type: terminal
  title: Terminal
  hostname: workstation
  working_directory: /root/temporal-versioning-workshop/exercises/1-workflow-patching/practice
- type: code
  title: Code Editor
  hostname: workstation
  path: /root/temporal-versioning-workshop/exercises/1-workflow-patching/practice
- type: service
  title: Temporal UI
  hostname: workstation
  port: 8233
difficulty: basic
timelimit: 4800
---

# Exercise 1: Workflow Patching

Your valet parking system is running in production. Durable execution is keeping every parking transaction alive - through restarts, crashes, whatever you throw at it. Then a feature request arrives: notify car owners when their car is being parked. It sounds simple, but adding a new activity call is a non-replay-safe change - the same replay mechanism that makes your workflows durable will break if the new code doesn't match the recorded history. In this exercise, you'll learn to catch that with replay testing and fix it with `workflow.patched()`.

**Temporal features and patterns covered:**
- `workflow.patched()`
- Replay testing with exported history
- Non-determinism errors (NDEs)

## Summary

- **Part A:** Establish a replay-test safety net for the current v1.0 workflow.
- **Part B:** Make a non-replay-safe change and see the replay test catch it.
- **Part C:** Fix the change with `workflow.patched()` so replay stays safe.
- **Part D:** Deploy the patched code and observe how in-flight vs. new workflows behave differently.

> **Note:** The Temporal dev server is already running in the background. Your terminals start in the exercise's `practice/` directory with the Python virtual environment activated.

---

## Part A - Export workflow history, and write a replay test

*__Covers:__ Exporting workflow history, replay test infrastructure*

Before making any changes, you'll establish a safety net. Run the current v1.0 workflow, capture a completed workflow's history, and set up a replay test that verifies the code is compatible with that history.

1. Examine `valet/valet_parking_workflow.py` in the **Code Editor** tab. Note the command sequence:
   - `request_parking_space` → `move_car` (to parking space) → `sleep` → `move_car` (back) → `release_parking_space`
   - The `sleep` simulates the owner's trip - workflows will be "in flight" during this window.

2. Start the worker (in the **Worker** tab):

```bash
make run-worker
```

> _**Note:** Keep this worker running - you'll be instructed when to restart it later._

3. Start a single workflow (in the **Terminal** tab):

```bash
make run-starter
```

   Note the workflow ID in the output (e.g. `valet-CA-1ABC123`). Wait for it to complete (about 30 seconds). You can check its status in the **Temporal UI** tab.

4. Export the completed workflow's history:

```bash
temporal workflow show --workflow-id <WORKFLOW ID HERE> --output json > history/valet_v1_history.json
```

5. Briefly open `history/valet_v1_history.json` and skim the exported history. Each entry in the `events` array represents something the workflow did - starting activities, recording results, firing timers, etc. This is the sequence of commands the replayer will compare against your code.

6. Briefly open `tests/test_replay.py` and review the replay test. It loads the history you just captured and replays it against the current workflow code. If the code produces a different command sequence than the history, the test fails with a non-determinism error (NDE).

7. Run the test - it should **pass**, confirming the replay infrastructure works:

```bash
make run-tests
```

---

## Part B - Add a new activity and break replay

*__Covers:__ Non-replay-safe changes, non-determinism errors*

Now we need to ship the feature. A `notify_owner` activity is already defined. Your job is to call it from the workflow - and see what happens when the replay test catches the incompatibility.

1. In `valet/valet_parking_workflow.py`, find the `TODO (Part B)` comment and **uncomment** the `notify_owner` activity call below it. The result should look like this:

```python
# Notify the owner their car is being parked
await workflow.execute_activity(
    notify_owner,
    NotifyOwnerInput(
        license_plate=input.license_plate,
        message="Your car is being parked!",
    ),
    start_to_close_timeout=timedelta(seconds=10),
)
```

> _**Think:** You just added a new activity call after `request_parking_space`. The captured history doesn't have that command. What will the replayer do when the new code produces a command the history doesn't expect?_

2. Run the replay test - **it fails** with a non-determinism error:

```bash
make run-tests
```

   **That error is exactly what would happen in production.** If you deployed this change, every in-flight workflow that replayed against the new code would fail with this same error. Not just one - every workflow that started before your deploy. The replay test caught it before it got that far.

---

## Part C - Patch the workflow

*__Covers:__ `workflow.patched()` for backward-compatible workflow evolution*

The replay test caught the problem before it reached production. Now we'll fix it using `workflow.patched()`. This tells Temporal: "this code is newer." In-flight workflows will skip it, while workflows started after the deploy will run it.

1. In `valet/valet_parking_workflow.py`, wrap the new activity call with `workflow.patched()`:

```python
if workflow.patched("add-notify-owner"):
    await workflow.execute_activity(
        notify_owner,
        NotifyOwnerInput(
            license_plate=input.license_plate,
            message="Your car is being parked!",
        ),
        start_to_close_timeout=timedelta(seconds=10),
    )
```

3. Run the replay test - **it passes**:

```bash
make run-tests
```

---

## Part D - See it in action

*__Covers:__ How `workflow.patched()` behaves at runtime for old vs. new executions*

With the patch in place, a single worker can now handle both old and new workflows. You'll create a pre-patch workflow, restart the worker with the patched code, and watch it handle both correctly.

The worker you started in Part A is still running the **original v1.0 code**. Even though you edited the file in Parts B and C, the running Python process loaded the workflow at startup and doesn't see your changes. We'll use this to create a "pre-patch" workflow, then restart the worker to pick up the patched code and watch a **single worker** handle both old and new executions correctly.

1. With the **old worker still running** (from Part A), start a workflow in the **Terminal** tab:

```bash
make run-starter
```

   Note the workflow ID (e.g. `valet-CA-1ABC123`). This is your **pre-patch workflow**.

2. Immediately **stop the old worker** (Ctrl+C in the **Worker** tab) and restart it to pick up your patched code:

```bash
make run-worker
```

3. Start a **second** workflow (in the **Terminal** tab):

```bash
make run-starter
```
   Note the workflow ID (e.g. `valet-CA-1ABC123`). This is your **post-patch workflow**.

4. Open the **Temporal UI** tab. Find both workflow executions and open their detail pages side by side so you can compare their event histories. They should both complete within about 30 seconds.

5. Compare the two executions. The same worker handled both, but the histories differ:

   - **Pre-patch workflow:** Completes **without** `notify_owner`. When the new worker replayed this workflow's history, it found no patch marker, so `workflow.patched()` returned `False` and the notification block was skipped. You won't see a `notify_owner` activity in this history.
   - **Post-patch workflow:** Includes `notify_owner` right after `request_parking_space`. This was a fresh execution, so `workflow.patched()` returned `True`, wrote a marker into the history, and ran the notification activity. You'll see the extra `notify_owner` activity in this history.

   Notice how a single deploy of the same code produced two different execution paths. That's the power of `workflow.patched()` - it lets one worker safely handle both old and new workflows without breaking replay.

6. Stop the worker when you're satisfied (Ctrl+C).

> _**Looking ahead:** The notification feature is shipped and working. Durable execution is humming along again. But notice the cost: you added a conditional branch to the workflow. Durability demands that your code stay compatible with open execution, so every future non-replay-safe change adds another branch. Over time, long-lived workflows accumulate layers of `if workflow.patched(...)` blocks. In Exercise 2, you'll see how Worker Versioning can eliminate patching entirely for most workflows._

---

> _**Congratulations!** You've completed Exercise 1._
