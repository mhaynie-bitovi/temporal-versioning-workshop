# Exercise 2: Worker Versioning

Your valet parking system is growing. The notification feature from Exercise 1 shipped fine, but patching is already adding complexity - and the next feature request (billing) is on the way. Instead of accumulating more conditional branches, you'll switch to Worker Versioning where Temporal's infrastructure handles routing workflows to the right code version. Then, when a bad deploy hits production, you'll learn to respond in seconds.

**Temporal features and patterns covered:**
- `VersioningBehavior.PINNED`
- `VersioningBehavior.AUTO_UPGRADE`
- `WorkerDeploymentConfig`
- `set-current-version`
- `update-options`
- Rainbow deployments
- Emergency rollback and evacuation

## Summary

- **Part A:** Configure versioning infrastructure (`PINNED`, `AUTO_UPGRADE`, `WorkerDeploymentConfig`) and deploy v1.0.
- **Part B:** Ship a non-replay-safe feature (billing) as v2.0, with no patching required.
- **Part C:** Respond to a bad deploy: rollback, evacuate stuck workflows, and fix-forward.
- **Part D (Optional):** Discover why `AUTO_UPGRADE` workflows still need patching.

---

## Setup: Clean Slate

1. Navigate to the exercise folder:

    ```bash
    cd exercises/2-worker-versioning/practice
    ```

2. If your Temporal dev server is still running from Exercise 1, stop it (Ctrl+C) and restart it so there are no leftover workflow executions:

    ```bash
    temporal server start-dev
    ```

    > **Note:** Keep this running for the entire exercise. All code changes in this exercise happen before any workers or workflows start - every workflow will be versioned from birth.

---

## Part A - Enable Worker Versioning + Deploy Version 1.0

**Covers:** `VersioningBehavior.PINNED`, `VersioningBehavior.AUTO_UPGRADE`, `WorkerDeploymentConfig`, `set-current-version`

Before shipping new features, you'll set up the versioning infrastructure. This is a one-time configuration that makes every future deploy safer.

**Goal:** Configure worker versioning infrastructure and deploy the first versioned worker.

1. **Set the versioning behavior on both workflows** (follow the `TODO (Part A)` comments in each file):

   **a.** In `valet/valet_parking_workflow.py` add `versioning_behavior=VersioningBehavior.PINNED` to `@workflow.defn`:

   ```python
   @workflow.defn(versioning_behavior=VersioningBehavior.PINNED)
   class ValetParkingWorkflow:
   ```

   > **Why PINNED?** Each parking transaction should complete on the code version it started on. No mid-execution surprises, no patching needed.

   **b.** In `valet/parking_lot_workflow.py` add `versioning_behavior=VersioningBehavior.AUTO_UPGRADE` to `@workflow.defn`:

   ```python
   @workflow.defn(versioning_behavior=VersioningBehavior.AUTO_UPGRADE)
   class ParkingLotWorkflow:
   ```

   > **Why AUTO_UPGRADE here?** `ParkingLotWorkflow` is an immortal singleton - it never completes normally. AUTO_UPGRADE means that when a new version becomes Current, the workflow automatically migrates to the new code on its next workflow task. This keeps the singleton on the latest version without manual intervention.
   >
   > **Important caveat:** AUTO_UPGRADE still requires patching for non-replay-safe changes. When the workflow auto-upgrades, it replays its existing history against the new code. If the new code produces different commands, you get an NDE - just like Exercise 1. We'll explore this in Part D.

2. **Configure the worker for versioning.** In `valet/worker.py`, create the deployment config from environment variables and pass it to the `Worker` (follow the `TODO (Part A)` comment):

   ```python
    worker = Worker(
        # ... other params
        deployment_config=WorkerDeploymentConfig(
            version=WorkerDeploymentVersion(
                deployment_name=os.environ["TEMPORAL_DEPLOYMENT_NAME"],
                build_id=os.environ["TEMPORAL_WORKER_BUILD_ID"],
            ),
            use_worker_versioning=True,
        ),
        # ... other params
    )
   ```

3. Start the versioned 1.0 worker (in a **new terminal**):

```bash
make run-worker BUILD_ID=1.0
```

4. Register version 1.0 as the **Current Version** for the deployment:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 1.0 \
    --yes
```

5. Inspect the deployment to confirm:

```bash
temporal worker deployment describe --name valet
```

   You should see version 1.0 listed as the Current Version.

6. Start the load simulator (in a **new terminal**):

```bash
make run-load-simulator
```

7. Open the Temporal Web UI at [http://localhost:8233](http://localhost:8233). Click on a running workflow and check its details - you should see `valet:1.0` as the Worker Deployment Version. This confirms Temporal is routing traffic through your versioned worker.

---

## Part B - Deploy a Breaking Change - No Patching Needed

**Covers:** Rainbow deployment with PINNED workflows, version coexistence, zero-patching deploys

Your next feature request is adding billing. This adds a new activity to the workflow - a non-replay-safe change. In Exercise 1, that required `workflow.patched()`. With PINNED versioning, you'll deploy v2.0 alongside v1.0 and let Temporal route traffic.

1. In `valet/valet_parking_workflow.py` add `bill_customer` at the end of the workflow (follow the `TODO (Part B)` comment):

   ```python
   await workflow.execute_activity(
       bill_customer,
       BillCustomerInput(
           license_plate=input.license_plate,
           duration_seconds=input.trip_duration_seconds,
           total_distance=(
               move_to_parking_space_result.distance_driven
               + move_to_valet_result.distance_driven
           ),
       ),
       start_to_close_timeout=timedelta(seconds=10),
   )
   ```

2. Start a 2.0 worker **alongside** the running 1.0 worker (in a **new terminal**):

```bash
make run-worker BUILD_ID=2.0
```

3. Think: the load simulator has been creating workflows on v1.0 for a while now. Some are mid-trip. When you set v2.0 as the Current Version, what happens to those in-flight v1.0 workflows?

   Set 2.0 as the Current Version:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 2.0 \
    --yes
```

4. **Observe in the Temporal Web UI:**
   - **New workflows** start on version 2.0 - they include billing.
   - **In-flight 1.0 workflows** stay pinned to version 1.0 - they complete on the 1.0 worker with no billing, no patching, no replay issues.
   - **`ParkingLotWorkflow`** (AUTO_UPGRADE) automatically migrates to v2.0 on its next workflow task.

   > **This is the "aha" moment.** You just deployed a non-replay-safe change with zero patching. Version isolation replaced the `workflow.patched()` guard from Exercise 1.

5. Verify the deployment state:

```bash
temporal worker deployment describe --name valet
```

6. Wait until the 1.0 deployment version is explicitly marked as "drained" in the deployment state (see the `Drained` status in the output of `temporal worker deployment describe --name valet`). Only after it is marked as drained, **stop the 1.0 worker** (Ctrl+C in its terminal).

---

## Part C - Incident: Bad Deploy, Live Traffic

**Covers:** Instant rollback (`set-current-version`), evacuating stuck workflows (`update-options`), fix-forward deployment, `WorkerDeploymentVersion` search attribute

A developer ships v3.0 with a bug in the billing activity. Production traffic is flowing. Workflows start failing. You need to respond - now.

### The bad deploy

A developer references a field that doesn't exist on `BillCustomerInput`. The deploy goes out.

1. **Introduce the bug.** In `valet/activities.py`, add this line to the beginning of `bill_customer`:

   ```python
   @activity.defn
   async def bill_customer(input: BillCustomerInput) -> BillCustomerOutput:
       # ... rest of the function
       tip = input.tip_percentage  # BUG: tip_percentage doesn't exist on BillCustomerInput
       # ... rest of the function
   ```

   This will cause an `AttributeError` every time billing runs.

2. Start a 3.0 worker (in a **new terminal**):

```bash
make run-worker BUILD_ID=3.0
```

3. The load simulator is still running. Think: what happens to new workflows the instant you run this command?

   Set 3.0 as current:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 3.0 \
    --yes
```

4. **Watch the damage.** Open the Temporal Web UI at [http://localhost:8233](http://localhost:8233). New workflows are starting on 3.0, hitting the billing step, and failing. Look at the worker logs - you'll see `AttributeError` on every billing attempt, retrying forever. These workflows are stuck. Every few seconds, the load simulator starts another one, and it goes straight into the same failure loop.

5. **Count the damage.** Before you fix anything, see exactly how bad it is:

```bash
temporal workflow list \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"'
```

   Count the stuck workflows. Each one is a customer whose car is parked but whose billing is failing in a retry loop. Remember this number.

### Stop the bleeding

The fastest possible response: redirect new traffic away from the broken version. No code redeploy, no CI pipeline, no waiting. One command.

6. Set v2.0 back as current:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 2.0 \
    --yes
```

7. **Verify it worked.** Check the Temporal Web UI - new workflows should now be starting on v2.0 with working billing. That took seconds, not minutes.

   But look closer. The workflows that already started on v3.0 are still there, still failing. They're PINNED to v3.0 - new traffic is safe, but those in-flight workflows are stuck.

### Rescue the stuck workflows

8. Evacuate them all to v2.0 in one command:

```bash
temporal workflow update-options \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"' \
    --versioning-override-behavior pinned \
    --versioning-override-deployment-name valet \
    --versioning-override-build-id 2.0 \
    --yes
```

   > **Why is this replay-safe?** The workflow code between v2.0 and v3.0 is identical - the bug is in the activity implementation, not the workflow definition. The v2.0 worker replays the workflow history, reaches the billing step, and calls the working v2.0 `bill_customer`. Failed activity attempts in history don't cause replay errors - the workflow just sees "activity not yet completed" and retries.

9. **Watch them recover.** Go back to the Temporal Web UI. The workflows that were stuck on v3.0 are now completing successfully on v2.0. Those customers just got billed correctly.

   Run the same query from step 5 again:

```bash
temporal workflow list \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"'
```

   Zero results. Every stuck workflow has been rescued.

### Fix forward

Rollback bought you time. Now ship the fix.

10. **Fix the bug.** Remove the `tip = input.tip_percentage` line you added in step 1.

11. Start a v3.1 worker (in a **new terminal**):

```bash
make run-worker BUILD_ID=3.1
```

12. Set v3.1 as current:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 3.1 \
    --yes
```

New workflows now flow through v3.1 with working billing. Incident resolved.

> **Recap what just happened.** A bad deploy hit production. Within seconds, you redirected new traffic (no redeploy). Then you bulk-rescued every stuck workflow (one command). Then you shipped a fix. Total production impact: the time it took you to notice and type two commands. That's the power of version routing at the infrastructure level.

### Clean up

13. **Stop the v3.0 worker** (Ctrl+C).

14. Once v2.0 has fully drained, **stop the v2.0 worker** (Ctrl+C) as well.

---

## Part D (Optional) - The AUTO_UPGRADE Catch

**Covers:** AUTO_UPGRADE replay behavior, patching for auto-upgraded workflows, trampolining concept

In Parts A-C, PINNED versioning meant no patching. But `ParkingLotWorkflow` uses AUTO_UPGRADE - when a new version becomes Current, it automatically migrates. That means it replays its existing history against your new code. If the commands don't match, you get an NDE.

Let's see it happen.

Let's see it happen.

### Make a non-replay-safe change to ParkingLotWorkflow

1. In `valet/parking_lot_workflow.py`, add a 2-second warm-up delay after the parking spaces are initialized (the `timedelta` import is already available via `temporalio`):

   ```python
   # Warm-up delay: let external systems sync before accepting requests
   await workflow.sleep(2)
   ```

   This is a non-replay-safe change: it adds a timer command that doesn't exist in the workflow's current history.

### Deploy and watch it break

2. Start a v4.0 worker (in a **new terminal**):

```bash
make run-worker BUILD_ID=4.0
```

3. Think: `ParkingLotWorkflow` is AUTO_UPGRADE. What happens to it when a new version becomes Current?

   Set v4.0 as current:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 4.0 \
    --yes
```

4. **Watch the v4.0 worker logs.** The `ParkingLotWorkflow` auto-upgrades to v4.0 and immediately hits a non-determinism error (NDE). The v4.0 code expects a timer (the 2-second sleep), but the existing history doesn't have one.

   > **Wait - didn't versioning eliminate patching?** Only for **PINNED** workflows. PINNED workflows never replay old history against new code because they stay on their original version. AUTO_UPGRADE workflows *do* replay old history against new code - that's the whole point of auto-upgrading. So AUTO_UPGRADE still requires patching for non-replay-safe changes, just like the unversioned worker in Exercise 1.

### Fix it with a patch

5. Wrap the sleep in `workflow.patched()` - the same technique from Exercise 1:

   ```python
    # Warm-up delay: let external systems sync before accepting requests
    if workflow.patched("add-warmup-delay"):
       await workflow.sleep(2)
   ```

6. **Stop the v4.0 worker** (Ctrl+C) and start v4.1:

```bash
make run-worker BUILD_ID=4.1
```

7. Set v4.1 as current:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 4.1 \
    --yes
```

8. **Observe:** `ParkingLotWorkflow` auto-upgrades to v4.1. This time, `workflow.patched("add-warmup-delay")` returns `False` during replay (no patch marker in the old history), so the sleep is skipped. The workflow continues without an NDE. Future runs (after `continue_as_new`) will include the sleep.

### Clean up

9. **Stop old workers.** Stop the v3.1 worker once drained. Keep v4.1 running or stop everything if you're done.

> **The takeaway:** PINNED eliminates patching. AUTO_UPGRADE does not. When an AUTO_UPGRADE workflow migrates to new code, it replays its history - so the new code must be replay-compatible. Patching is still the tool for that.
>
> **But notice something.** `ParkingLotWorkflow` already uses `continue_as_new`. After the auto-upgrade, the *current run* replays with the patch guard. But the *next run* (after `continue_as_new`) starts fresh on v4.1 with no prior history to conflict with. The patch only matters during the transition of the current run. In a production workflow with frequent `continue_as_new` boundaries, these patches are naturally short-lived - they're only needed for the one run that bridges the version change.
>
> This is the core insight behind **trampolining** (upgrade on continue-as-new): if you made `ParkingLotWorkflow` PINNED instead of AUTO_UPGRADE, each run would complete on its original version with zero patching. At the `continue_as_new` boundary, the new run could start on the latest version. No patching, ever - just a clean handoff at the seam. For long-running workflows with natural `continue_as_new` boundaries, this is the best of both worlds.

---

> **🎉 Congratulations!** You've completed Exercise 2.