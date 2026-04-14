# Exercise 1: Patching a Non-Deterministic Change + Replay Testing

### Summary

- **Part A:** Run the v1.0 workflow, export a completed workflow's history, and run a replay test against it.
- **Part B:** Add a `notify_owner` activity call to the workflow. Run the replay test - it fails with a non-determinism error.
- **Part C:** Wrap the new call in `workflow.patched()`. Replay test passes.
- **Part D:** Restart the worker with patched code. Observe that pre-patch in-flight workflows skip the notification, while new workflows include it.

---

## Part A - Run v1.0, capture a history, and write a replay test

1. Navigate to the exercise folder:

```bash
cd exercises/exercise-1/practice
```

2. Examine the v1.0 `ValetParkingWorkflow` in `valet/valet_parking_workflow.py`. Note the command sequence:
   - `request_parking_space` → `move_car` (to parking space) → `sleep` → `move_car` (back) → `release_parking_space`
   - The `sleep` simulates the owner's trip - workflows will be "in flight" during this window.

3. Start the Temporal dev server (in a **dedicated terminal**):

```bash
temporal server start-dev
```

> **Note:** Keep this running for the entire exercise.

4. Start the worker (in a **new terminal** from the same directory):

```bash
make run-worker
```

> **Note:** Keep this worker running - you'll be instructed when to restart it later.

5. Start the load simulator (in a **new terminal** from the same directory):

```bash
make run-load-simulator
```

6. Wait for a workflow to complete (trip durations are 5–30 seconds). Then **stop the load simulator** (Ctrl+C) and export a completed workflow's history:

```bash
temporal workflow show --workflow-id <WORKFLOW ID HERE> --output json > history/valet_v1_history.json
```

> **Tip:** The workflow ID follows the format `valet-<STATE>-<PLATE>` (e.g., `valet-CA-1ABC123`). You can copy a workflow ID from the Temporal Web UI at [http://localhost:8233](http://localhost:8233), or use `temporal workflow list` to find one.

7. Open `tests/test_replay.py` and review the replay test. It loads the history you just captured and replays it against the current workflow code. If the code produces a different command sequence than the history, the test fails with a non-determinism error (NDE).

8. Run the test - it should **pass**, confirming the replay infrastructure works:

```bash
make run-tests
```

---

## Part B - Make the NDE-inducing change & see it fail

Product wants us to send the car owner a notification when their car is about to be parked. A `notify_owner` activity and its models (`NotifyOwnerInput`, `NotifyOwnerOutput`) are already defined in `valet/activities.py` and `valet/models.py`. Your job is to call it from the workflow.

1. Insert the activity call into `valet/valet_parking_workflow.py` **after** `request_parking_space` and **before** the first `move_car`:

```python
# After request_parking_space, before move_car:
await workflow.execute_activity(
    notify_owner,
    NotifyOwnerInput(
        license_plate=input.license_plate,
        message="Your car is being parked!",
    ),
    start_to_close_timeout=timedelta(seconds=10),
)
```

2. Run the replay test - **it fails** with a non-determinism error:

```bash
make run-tests
```

> **This is the "aha" moment.** The old workflow history doesn't have a `notify_owner` command after `request_parking_space`, but the new code expects one. The command sequence doesn't match → non-determinism error.

---

## Part C - Patch it

1. Wrap the new activity call with `workflow.patched()`:

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

> Old histories skip the patched block. New executions run it. The `workflow.patched()` marker tells the replayer "this code was added after the history was captured."

---

## Part D - See it in action

The worker you started in Part A is still running the **original v1.0 code**. Even though you edited the file in Parts B and C, the running Python process loaded the workflow at startup and doesn't see your changes. We'll use this to create a "pre-patch" workflow, then restart the worker to pick up the patched code and watch a **single worker** handle both old and new executions correctly.

1. With the **old worker still running** (from Part A), start a workflow in a **new terminal**:

```bash
make run-starter
```

   Note the workflow ID (e.g. `valet-CA-1ABC123`). This is your **pre-patch workflow**. The old worker begins executing it with the v1.0 code - no `notify_owner`, no patch marker in the history. The starter sets a 30-second trip, so the workflow is now sitting in `sleep`.

2. While that workflow is still sleeping, **stop the old worker** (Ctrl+C) and restart it to pick up your patched code:

```bash
make run-worker
```

   The restarted worker now has your Part C code with `workflow.patched("add-notify-owner")`.

3. Start a **second** workflow:

```bash
make run-starter
```

   Note this workflow ID - this is your **post-patch workflow**.

4. Watch **both** workflows complete in the Temporal Web UI at [http://localhost:8233](http://localhost:8233). The same worker handles both, but the outcomes differ:

   - **Pre-patch workflow:** Completes **without** `notify_owner`. When the new worker replays this workflow's history, it finds no patch marker, so `workflow.patched()` returns `False` and the notification block is skipped.
   - **Post-patch workflow:** Includes `notify_owner` right after `request_parking_space`. This is a fresh execution, so `workflow.patched()` returns `True` and writes a marker into the history.

5. Stop the worker when you're satisfied (Ctrl+C).

---

> **🎉 Congratulations!** You've completed Exercise 1.
