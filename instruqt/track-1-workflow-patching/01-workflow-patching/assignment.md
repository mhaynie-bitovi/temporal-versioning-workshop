---
slug: workflow-patching
id: ""
type: challenge
title: "Workflow Patching"
teaser: "In this track, you will safely evolve running Temporal workflows with Replay Testing and Workflow Patching."
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

Your valet parking system is running in production. Durable execution keeps every workflow alive despite any restarts or crashes. Then, a feature request arrives: notify car owners when their car is being parked. Adding a new activity call is a non-replay-safe change - the same replay mechanism that makes your workflows durable will break if the new code doesn't match the recorded history.

In this track, you'll learn to catch that with replay testing and fix it with workflow patching.


**Temporal features and patterns covered:**
- `workflow.patched()`
- Replay testing with exported history
- Non-determinism errors (NDEs)

## Summary

- **Part A:** Establish a replay-test safety net for the current v1.0 workflow.
- **Part B:** Make a non-replay-safe change and see the replay test catch it.
- **Part C:** Fix the change with `workflow.patched()` so replay stays safe.
- **Part D:** Deploy the patched code and observe how in-flight vs. new workflows behave differently.

> **Sandbox Notes:**
> - Use the **Temporal UI** tab to interact with the Temporal Web UI
> - Use the **Code Editor** tab to make changes to the code
> - Use the various terminal tabs to run the commands found in the instructions
> - This course uses `make` commands (like `make run-worker`) as shortcuts for longer shell commands. This keeps the focus on Temporal concepts rather than boilerplate. If you're curious what a command does under the hood, check the `Makefile` in the **Code Editor** tab.
> - Avoid refreshing your host browser tab as it can interrupt the exercise environment. Use the refresh button at the top of the **Temporal UI** tab, or the refresh buttons within the Temporal Web UI itself.
---

## Part A - Export workflow history, and write a replay test

*__Covers:__ Exporting workflow history, replay test infrastructure*

Before making any changes, you'll establish a safety net. Run the current v1.0 workflow, capture a completed workflow's history, and set up a replay test that verifies the code is compatible with that history.

1. Briefely examine `valet/valet_parking_workflow.py` in the **Code Editor** tab. Note the sequence of steps:
   1. `request_parking_space`
   2. `move_car` (to parking space)
   3. `sleep` (simulate the owners trip)
   4. `move_car` (back)
   5. `release_parking_space`
   
2. Start the worker:

```bash
# in the 'Worker' tab
make run-worker
```

> _**Note:** Keep this worker running - you'll be instructed when to restart it later._

3. Start a single workflow:

```bash
# in the 'Terminal' tab
make run-starter WORKFLOW_ID=valet-CA-1ABC123
```

   Wait for it to complete (about 30 seconds). You can check its status in the **Temporal UI** tab.

4. Export the completed workflow's history:

```bash
# in the 'Terminal' tab
temporal workflow show --workflow-id valet-CA-1ABC123 --output json > history/valet-CA-1ABC123-history.json
```

> _**Note:** You may need to refresh the file explorer in the **Code Editor** tab to see the json file you just created._

5. In the **Code Editor** tab, briefly open `history/valet-CA-1ABC123-history.json` and skim the exported history. Each entry in the `events` array represents something the workflow did - starting activities, recording results, firing timers, etc. This is the sequence of commands the replayer will compare against your code.

6. Briefly open `tests/test_replay.py` and review the replay test. It loads the history you just captured and replays it against the current workflow code. If the code produces a different command sequence than the history, the test fails with a non-determinism error (NDE).

7. Run the tests:

```bash
# in the 'Terminal' tab
make run-tests
```

   The test should pass, confirming the replay infrastructure works.


---

## Part B - Add a new activity and break replay

*__Covers:__ Non-replay-safe changes, non-determinism errors*

Now that you have a replay test guarding the current workflow, it's time to ship the feature. A `notify_owner` activity is already defined. Your job is to call it from the workflow, and see what happens when the replay test catches the incompatibility.

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

> _**Think:** You just added a new activity call after `request_parking_space`. The JSON history you captured doesn't have that command. What will the replayer do when the new code produces a command the history doesn't expect?_

2. Run the replay test again:

```bash
# in the 'Terminal' tab
make run-tests
```

   **The test should fail** with a non-determinism error.

   **That error is exactly what would happen in production.** If you deployed this change, any in-flight workflow that has already progressed past the point where the new activity is inserted would fail with this same error during replay. The replay test caught it before it got that far.

---

## Part C - Patch the workflow

*__Covers:__ `workflow.patched()` for backward-compatible workflow evolution*

The replay test caught the problem before it reached production. Now we'll fix it using `workflow.patched()`. This tells Temporal: "this code is newer." In-flight workflows will skip it, while workflows that started after the deploy will run it.

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

2. Run the replay test again:

```bash
# in the 'Terminal' tab
make run-tests
```
   
   **The test should pass** now that `workflow.patched()` tells the replayer to skip the new activity call when replaying old histories.

---

## Part D - Deploy and verify with real workflows

*__Covers:__ How `workflow.patched()` behaves at runtime for old vs. new executions*

With the patch in place, a single worker can now handle both old and new workflows. In this part, you'll start two more workflows (one **before** deploying the patch, and one **after**).

The worker you started in Part A is still running the **original v1.0 code**. Even though you edited the file in Parts B and C, the running Python process loaded the workflow at startup and doesn't see your changes. We'll use this to create a "pre-patch" workflow, then restart the worker to pick up the patched code, start another "post-patch" workflow, and watch a **single worker** handle both old and new executions correctly.

1. With the **old worker still running** (from Part A), start another workflow:

```bash
# in the 'Terminal' tab
make run-starter
```

   This is your **pre-patch workflow**.

2. Immediately **stop the old worker** (Ctrl+C) and restart it to pick up your patched code:

```bash
# in the 'Worker' tab
make run-worker
```

3. Start a **second** workflow:

```bash
# in the 'Terminal' tab
make run-starter
```

   This is your **post-patch workflow**.

4. Open the **Temporal UI** tab. Find both workflow executions and open their detail pages. They should both complete within about 30 seconds.

5. Compare the two executions. The same worker handled both, but the histories differ:

   - **Pre-patch workflow:** Completes **without** `notify_owner`. When the new worker replayed this workflow's history, it found no patch marker, so `workflow.patched()` returned `False` and the notification block was skipped. You won't see a `notify_owner` activity in this history.
   - **Post-patch workflow:** Includes `notify_owner` right after `request_parking_space`. This was a fresh execution, so `workflow.patched()` returned `True`, wrote a marker into the history, and ran the notification activity. You'll see the extra `notify_owner` activity in this history.

   Notice how a single deploy of the same code produced two different execution paths. That's the power of `workflow.patched()` - it lets one worker safely handle both old and new workflows without breaking replay.

6. You can stop the worker in the **Worker** tab when you're satisfied (Ctrl+C).

> _**Looking ahead:** The notification feature is shipped and working. Durable execution is humming along again. But notice the cost: you added a conditional branch to the workflow. Durability demands that your code stay compatible with open executions, so every future non-replay-safe change adds another branch. Over time, long-lived workflows accumulate layers of `if workflow.patched(...)` blocks. In Exercise 2, you'll see how **Worker Versioning** can eliminate the need for patching entirely for most workflows._

---

> _**Congratulations!** You've completed this exercise!_
