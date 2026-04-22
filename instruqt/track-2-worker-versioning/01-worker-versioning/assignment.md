---
slug: worker-versioning
id: ""
type: challenge
title: "Worker Versioning"
teaser: "Deploy non-replay-safe changes without patching using Temporal Worker Versioning"
tabs:
- type: terminal
  title: Worker v1.0
  hostname: workstation
  working_directory: /root/temporal-versioning-workshop/exercises/2-worker-versioning/practice
- type: terminal
  title: Worker v2.0+
  hostname: workstation
  working_directory: /root/temporal-versioning-workshop/exercises/2-worker-versioning/practice
- type: terminal
  title: Load Simulator
  hostname: workstation
  working_directory: /root/temporal-versioning-workshop/exercises/2-worker-versioning/practice
- type: terminal
  title: Terminal
  hostname: workstation
  working_directory: /root/temporal-versioning-workshop/exercises/2-worker-versioning/practice
- type: code
  title: Code Editor
  hostname: workstation
  path: /root/temporal-versioning-workshop/exercises/2-worker-versioning/practice
- type: service
  title: Temporal UI
  hostname: workstation
  port: 8233
difficulty: basic
timelimit: 4800
---

# Exercise 2: Worker Versioning

Your valet parking system is growing. The notification feature from Exercise 1 shipped fine - durable execution kept everything alive, and patching kept it compatible. But durability is demanding: every non-replay-safe change adds another conditional branch, and the next feature request (billing) is on the way. Instead of accumulating more compatibility code, you'll switch to Worker Versioning where Temporal's infrastructure handles routing workflows to the right code version. Then, when a bad deploy hits production, you'll discover that the same durability that protects your workflows can also trap them - and learn to respond in seconds.

**Temporal features and patterns covered:**
- `VersioningBehavior.PINNED`
- `VersioningBehavior.AUTO_UPGRADE`
- `WorkerDeploymentConfig`
- `set-current-version`
- `set-ramping-version`
- `update-options`
- Rainbow deployments
- Emergency rollback and evacuation

## Summary

- **Part A:** Configure versioning infrastructure (`PINNED`, `AUTO_UPGRADE`, `WorkerDeploymentConfig`) and deploy v1.0.
- **Part B:** Ship a non-replay-safe feature (billing) as v2.0, with no patching required. Monitor version statuses through drain.
- **Part C:** Respond to a bad deploy: rollback, evacuate stuck workflows, and fix-forward.
- **Part D (Optional):** Discover why `AUTO_UPGRADE` workflows still need patching.

> **Note:** The Temporal dev server is already running in the background. Your terminals start in the exercise's `practice/` directory with the Python virtual environment activated.

---

## Part A - Enable Worker Versioning + Deploy Version 1.0

*__Covers:__ `VersioningBehavior.PINNED`, `VersioningBehavior.AUTO_UPGRADE`, `WorkerDeploymentConfig`, `set-current-version`*

Before shipping new features, you'll set up the versioning infrastructure. This is a one-time configuration that makes every future deploy safer.

1. **Set the versioning behavior on both workflows** (follow the `TODO (Part A)` comments in each file):

   **a.** In `valet/valet_parking_workflow.py` add `versioning_behavior=VersioningBehavior.PINNED` to `@workflow.defn`:

   ```python
   @workflow.defn(versioning_behavior=VersioningBehavior.PINNED)
   class ValetParkingWorkflow:
   ```

   > _**Why PINNED?** Each parking transaction should complete on the code version it started on. No mid-execution surprises, no patching needed._

   **b.** In `valet/parking_lot_workflow.py` add `versioning_behavior=VersioningBehavior.AUTO_UPGRADE` to `@workflow.defn`:

   ```python
   @workflow.defn(versioning_behavior=VersioningBehavior.AUTO_UPGRADE)
   class ParkingLotWorkflow:
   ```

   > _**Why AUTO_UPGRADE here?** `ParkingLotWorkflow` is an immortal singleton - it never completes normally. AUTO_UPGRADE means that when a new version becomes Current, the workflow automatically migrates to the new code on its next workflow task. This keeps the singleton on the latest version without manual intervention._
   >
   > _**Important caveat:** AUTO_UPGRADE still requires patching for non-replay-safe changes. When the workflow auto-upgrades, it replays its existing history against the new code. If the new code produces different commands, you get an NDE - just like Exercise 1. We'll explore this in Part D._

2. **Configure the worker for versioning.** In `valet/worker.py`, add the `deployment_config` argument to the `Worker` constructor (follow the `TODO (Part A)` comment):

   ```python
    worker = Worker(
        # ... other args
        deployment_config=WorkerDeploymentConfig(
            version=WorkerDeploymentVersion(
                deployment_name=os.environ["TEMPORAL_DEPLOYMENT_NAME"],
                build_id=os.environ["TEMPORAL_WORKER_BUILD_ID"],
            ),
            use_worker_versioning=True,
        ),
        # ... other args
    )
   ```

3. **Start the versioned 1.0 worker** (in the **Worker v1.0** tab):

   The `BUILD_ID` env var feeds into the `WorkerDeploymentConfig` you just wired up. When this worker connects, Temporal registers it under the deployment name `valet` with build ID `1.0`.

   ```bash
   make run-worker BUILD_ID=1.0
   ```

4. **Register version 1.0 as the Current Version** for the deployment (in the **Terminal** tab):

   A running worker alone isn't enough. Temporal needs to know which version should receive new workflow executions. The `set-current-version` command tells Temporal: "route all new traffic for the `valet` deployment to build ID `1.0`." Until you run this, no workflows will be dispatched to your worker.

   ```bash
   temporal worker deployment set-current-version \
       --deployment-name valet \
       --build-id 1.0 \
       --yes
   ```

5. **Inspect the deployment** to confirm everything is wired up:

   ```bash
   temporal worker deployment describe --name valet
   ```

   You should see version 1.0 listed as the Current Version. This is the command you'll use throughout the exercise to check deployment state, see which versions are active, and confirm when old versions have fully drained.

6. **Start the load simulator** (in the **Load Simulator** tab) to generate continuous traffic:

   ```bash
   make run-load-simulator
   ```

    > _**Note:** Keep this running for the rest of the exercise._

7. **Verify versioning is working** in the **Temporal UI** tab. Configure the table columns so versioning info is visible at a glance:

   - Click the **gear icon** at the bottom of the workflows table.
   - Add the following columns: **Deployment**, **Deployment Version**, and **Versioning Behavior**.

   You should now see `valet` as the Deployment, `valet:1.0` as the Deployment Version, and `Pinned` or `AutoUpgrade` as the Versioning Behavior for each workflow. This confirms Temporal is routing traffic through your versioned worker - every workflow knows which version it belongs to, and that metadata is visible and queryable.

---

## Part B - Deploy a Breaking Change - No Patching Needed

*__Covers:__ Rainbow deployment with PINNED workflows, version coexistence, zero-patching deploys, version lifecycle statuses*

Your next feature request is adding billing. This adds a new activity to the workflow - a non-replay-safe change. In Exercise 1, that required `workflow.patched()`. With PINNED versioning, you'll deploy v2.0 alongside v1.0 and let Temporal route traffic. Along the way, you'll see how Temporal tracks each version through its lifecycle - from active to drained.

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

2. Start a 2.0 worker **alongside** the running 1.0 worker (in the **Worker v2.0+** tab):

```bash
make run-worker BUILD_ID=2.0
```

> _**Think:** The load simulator has been creating workflows on v1.0 for a while now. Some are mid-trip. In the next step when you set v2.0 as the Current Version, what happens to those in-flight v1.0 workflows?_

3. Set 2.0 as the Current Version (in the **Terminal** tab):

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 2.0 \
    --yes
```

4. **Observe in the Temporal UI:**
   - **New workflows** start on version 2.0 - they include billing.
   - **In-flight 1.0 workflows** stay pinned to version 1.0 - they complete on the 1.0 worker with no billing, no patching, no replay issues.
   - **`ParkingLotWorkflow`** (AUTO_UPGRADE) automatically migrates to v2.0 on its next workflow task.

   > _**Nice!** You just deployed a non-replay-safe change without needing any patching._

   > **Version Statuses** 
   > Temporal tracks each deployment version through a [lifecycle](https://docs.temporal.io/worker-versioning#versioning-statuses) which progresses through the following statuses:
   > - **Inactive**: worker registered, not yet serving traffic
   > - **Active**: currently Current or Ramping, accepting new workflows
   > - **Draining**: no longer active, but still has open pinned workflows
   > - **Drained**: all pinned workflows completed, safe to decommission
   > 
   > In the next step, you'll watch v1.0 move from Draining to Drained in real time.

5. **Wait for v1.0 to drain.** After setting v2.0 as Current, no new workflows are routed to v1.0. But existing PINNED workflows are still running there.

    Once there are no more open workflows on v1.0, the version is considered "drained" - meaning it has no remaining work and its worker can be safely shut down. In this exercise, that's just the PINNED `ValetParkingWorkflow` executions finishing their trips. The `ParkingLotWorkflow` executions already migrated to v2.0 when you set it as current.

    Since the load simulator creates short-lived workflows (5-30 second trips), draining should only take about 30 seconds.

   **Check drain status** using either method:

   - **CLI:** Run `temporal worker deployment describe --name valet` and look for `Drained` status on the 1.0 version.

     ```bash
     temporal worker deployment describe --name valet
     ```

   - **Web UI:** Open the **Temporal UI** tab and navigate to the **Deployments** tab. Click on the `valet` deployment to see per-version status. When 1.0 shows as drained, it has no remaining workflows.

6. Once v1.0 is drained, **stop the 1.0 worker** (Ctrl+C in the **Worker v1.0** tab).

> _**Note:** In this exercise we use `set-current-version` for instant cutover to keep things moving, but in production you'd likely prefer `set-ramping-version`, which routes a configurable percentage of new traffic to the new version while the rest stays on the Current Version. You can increase the percentage over time as confidence grows, then promote with `set-current-version` when ready. In Exercise 3, the Worker Controller automates this same pattern via its `Progressive` rollout strategy._

---

## Part C - When a Bad Deploy Hits Production

*__Covers:__ Instant rollback (`set-current-version`), evacuating stuck workflows (`update-options`), fix-forward deployment, `WorkerDeploymentVersion` search attribute*

Everything is humming along. Billing shipped cleanly with zero patching. The v1.0 worker drained and shut down on its own. You're feeling good about versioning.

Then you add a tip calculation to the billing activity. Quick change, no big deal. You deploy v3.0, set it as current, and go back to what you were doing.

A minute later, you glance at the Web UI. Red everywhere. Every new workflow is hitting the billing step and failing. You check the worker logs: `AttributeError`, over and over.

You made a typo. You referenced `input.tip_percentage`, a field that doesn't exist. And it's live. You need to act *now*.

### The bad deploy

1. **Introduce the bug.** In `valet/activities.py`, add this line to the beginning of `bill_customer`:

   ```python
   @activity.defn
   async def bill_customer(input: BillCustomerInput) -> BillCustomerOutput:
       # ... rest of the function
       tip = input.tip_percentage  # BUG: tip_percentage doesn't exist on BillCustomerInput
       # ... rest of the function
   ```

   This will cause an `AttributeError` every time billing runs.

2. Start a 3.0 worker (in the **Worker v1.0** tab, which should be free now):

```bash
make run-worker BUILD_ID=3.0
```

> _**Think:** The load simulator is still running. What happens to new workflows the instant you run the next command?_

3. Set 3.0 as current (in the **Terminal** tab):

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 3.0 \
    --yes
```

4. **Watch the damage.** Open the **Temporal UI** tab. New workflows are starting on 3.0, hitting the billing step, and failing. Look at the worker logs - you'll see `AttributeError` on every billing attempt, retrying forever. These workflows are stuck. Every few seconds, the load simulator starts another one, and it goes straight into the same failure loop.

5. **Check the damage.** Before you fix anything, see exactly how bad it is (in the **Terminal** tab):

```bash
temporal workflow list \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"'
```

   Each of these workflows is failing in a retry loop.

### Stop the bleeding

The fastest possible response: redirect new traffic away from the broken version. No code redeploy, no CI pipeline, no waiting. One command.

6. Set v2.0 back as current:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 2.0 \
    --yes
```

7. **Verify it worked.** Check the **Temporal UI** tab - new workflows should now be starting on v2.0 with working billing. That took seconds, not minutes.

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

   > _**Why is this replay-safe?** The workflow code between v2.0 and v3.0 is identical - the bug is in the activity implementation, not the workflow definition. The v2.0 worker replays the workflow history, reaches the billing step, and calls the working v2.0 `bill_customer`. Failed activity attempts in history don't cause replay errors - the workflow just sees "activity not yet completed" and retries._

9. **Watch them recover.** Go back to the **Temporal UI** tab. The workflows that were stuck on v3.0 are now completing successfully on v2.0. Those customers just got billed correctly.

   Run the same query from step 5 again:

```bash
temporal workflow list \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"'
```

   Zero results. Every stuck workflow has been rescued.

### Fix forward

Rollback bought you time. Now ship the fix.

10. **Fix the bug.** In `valet/activities.py`, remove the `tip = input.tip_percentage` line you added in step 1.

    ```python
    @activity.defn
    async def bill_customer(input: BillCustomerInput) -> BillCustomerOutput:
        # simply remove/comment out the bug you introduced in this function
    ```

11. Start a v3.1 worker (in the **Worker v1.0** tab, stopping the 3.0 worker first with Ctrl+C):

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

> _**Recap what just happened.** A bad deploy hit production. Within seconds, you redirected new traffic (no redeploy). Then you bulk-rescued every stuck workflow (one command). Then you shipped a fix. Total production impact: the time it took you to notice and type two commands. That's the power of version routing at the infrastructure level._

### Clean up

13. Once v2.0 has fully drained, **stop the v2.0 worker** (Ctrl+C in the **Worker v2.0+** tab).

---

## Part D (Optional) - The AUTO_UPGRADE Catch

*__Covers:__ AUTO_UPGRADE replay behavior, patching for auto-upgraded workflows, trampolining concept*

In Parts A-C, `PINNED` versioning meant no patching. But `ParkingLotWorkflow` uses `AUTO_UPGRADE` - when a new version becomes `Current`, it automatically migrates. That means it replays its existing history against your new code. If the commands don't match, you get an NDE.

Let's see it happen.

### Make a non-replay-safe change to ParkingLotWorkflow

1. In `valet/parking_lot_workflow.py`, add a 2-second warm-up delay after the parking spaces are initialized (the `timedelta` import is already available via `temporalio`):

   ```python
   # Warm-up delay: let external systems sync before accepting requests
   await workflow.sleep(2)
   ```

   This is a non-replay-safe change: it adds a timer command that doesn't exist in the workflow's current history.

### Deploy and watch it break

2. Start a v4.0 worker (in the **Worker v1.0** tab, stopping the previous worker first with Ctrl+C):

```bash
make run-worker BUILD_ID=4.0
```

> _**Think:** `ParkingLotWorkflow` is AUTO_UPGRADE. What happens to it when a new version becomes Current?_

3. **Set v4.0 as current** (in the **Terminal** tab):

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 4.0 \
    --yes
```

4. **Watch the v4.0 worker logs.** The `ParkingLotWorkflow` auto-upgrades to v4.0 and immediately hits a non-determinism error (NDE). The v4.0 code expects a timer (the 2-second sleep), but the existing history doesn't have one.

   > _**Wait - didn't versioning eliminate patching?** Only for **PINNED** workflows. PINNED workflows never replay old history against new code because they stay on their original version. AUTO_UPGRADE moves workflows to the latest code, which involves replaying old history against the new code - and that opens us up to the risk of NDEs (non-determinism errors). So AUTO_UPGRADE still requires patching for non-replay-safe changes, just like the unversioned worker in Exercise 1._

### Fix it with a patch

5. In `valet/parking_lot_workflow.py`, wrap the sleep in `workflow.patched()` - the same technique from Exercise 1:

   ```python
    # Warm-up delay: let external systems sync before accepting requests
    if workflow.patched("add-warmup-delay"):
       await workflow.sleep(2)
   ```

6. **Stop the v4.0 worker** (Ctrl+C) and start v4.1 (in the same tab):

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

> _**The takeaway:** PINNED eliminates patching. AUTO_UPGRADE does not. When an AUTO_UPGRADE workflow migrates to new code, it replays its history - so the new code must be replay-compatible. Patching is still the tool for that._

## Aside: Upgrade on Continue as New (or "trampolining")

**But notice something.** `ParkingLotWorkflow` uses `continue_as_new`. After the auto-upgrade, the *current run* replays with the patch guard. But the *next run* (after `continue_as_new`) starts fresh on v4.1 with no prior history to conflict with. The patch only matters during the transition of the current run. In a production workflow with frequent `continue_as_new` boundaries, these patches are naturally short-lived - they're only needed for the one run that bridges the version change.

This is the core insight behind **trampolining** (upgrade on continue-as-new): if you made `ParkingLotWorkflow` PINNED instead of AUTO_UPGRADE, each run would complete on its original version with zero patching. At the `continue_as_new` boundary, the new run could start on the latest version. No patching, ever - just a clean handoff at the seam. For long-running workflows with natural `continue_as_new` boundaries, this is the best of both worlds.

---

> _**Congratulations!** You've completed Exercise 2._
