---
slug: worker-versioning
id: ""
type: challenge
title: "Worker Versioning"
teaser: "In this track, you will deploy non-replay-safe changes without Workflow Patching using Temporal Worker Versioning"
tabs:
- type: terminal
  title: Worker v1.0
  hostname: workstation
  working_directory: /root/temporal-versioning-workshop/exercises/2-worker-versioning/practice
- type: terminal
  title: Worker v2.0
  hostname: workstation
  working_directory: /root/temporal-versioning-workshop/exercises/2-worker-versioning/practice
- type: terminal
  title: Worker v3.0
  hostname: workstation
  working_directory: /root/temporal-versioning-workshop/exercises/2-worker-versioning/practice
- type: terminal
  title: Worker v3.1
  hostname: workstation
  working_directory: /root/temporal-versioning-workshop/exercises/2-worker-versioning/practice
- type: terminal
  title: Worker v4.0
  hostname: workstation
  working_directory: /root/temporal-versioning-workshop/exercises/2-worker-versioning/practice
- type: terminal
  title: Worker v4.1
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
- **Part B:** Ship a non-replay-safe feature (billing) as v2.0 using PINNED versioning. Monitor version statuses through drained.
- **Part C:** Respond to a bad deploy: rollback, evacuate stuck workflows, and fix-forward.
- **Part D (Optional):** Discover why `AUTO_UPGRADE` workflows still need patching.

> [!NOTE]
> **Sandbox Notes:**
> - Use the [button label="Temporal UI" background="#444CE7"](tab-9) tab to interact with the Temporal Web UI
> - Use the [button label="Code Editor" background="#444CE7"](tab-8) tab to make changes to the code
> - Use the various terminal tabs to run the commands found in the instructions
> - This course uses `make` commands (like `make run-worker`) as shortcuts for longer shell commands. This keeps the focus on Temporal concepts rather than managing the Temporal systems. If you're curious what a command does under the hood, check the `Makefile` in the [button label="Code Editor" background="#444CE7"](tab-8) tab.
> - Avoid refreshing your host browser tab as it can interrupt the exercise environment. Use the refresh button at the top of the [button label="Temporal UI" background="#444CE7"](tab-9) tab, or the refresh buttons within the Temporal Web UI itself.

---

## Part A - Enable Worker Versioning + Deploy Version 1.0

*__Covers:__ `VersioningBehavior.PINNED`, `VersioningBehavior.AUTO_UPGRADE`, `WorkerDeploymentConfig`, `set-current-version`*

Before shipping new features, you'll set up the versioning infrastructure. This is a one-time configuration that makes every future deploy safer.

### Step 1: Set the versioning behavior on both workflows

In the [button label="Code Editor" background="#444CE7"](tab-8) tab, follow the `TODO (Part A)` comments in each file:

**a.** In `valet/valet_parking_workflow.py` add `versioning_behavior=VersioningBehavior.PINNED` to `@workflow.defn`:

```python
@workflow.defn(versioning_behavior=VersioningBehavior.PINNED)
class ValetParkingWorkflow:
```

> [!NOTE]
> **Why PINNED?** Each parking transaction should complete on the code version it started on. No mid-execution surprises, no patching needed.

**b.** In `valet/parking_lot_workflow.py` add `versioning_behavior=VersioningBehavior.AUTO_UPGRADE` to `@workflow.defn`:

```python
@workflow.defn(versioning_behavior=VersioningBehavior.AUTO_UPGRADE)
class ParkingLotWorkflow:
```

> [!NOTE]
> **Why AUTO_UPGRADE here?** `ParkingLotWorkflow` is an [Entity Workflow](https://temporal.io/blog/very-long-running-workflows) - it represents a durable object (the parking lot) and never completes normally. AUTO_UPGRADE means that when a new version becomes Current, the workflow automatically migrates to the new code on its next workflow task. This keeps the entity on the latest version without manual intervention.
>
> **Important caveat:** AUTO_UPGRADE still requires patching for non-replay-safe changes. When the workflow auto-upgrades, it replays its existing history against the new code. If the new code produces different commands, you get an NDE - just like Exercise 1. We'll explore this in Part D.

### Step 2: Configure the worker for versioning

In `valet/worker.py`, add the `deployment_config` argument to the `Worker` constructor (follow the `TODO (Part A)` comment):

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

### Step 3: Start the versioned 1.0 worker

The `BUILD_ID` env var feeds into the `WorkerDeploymentConfig` you just wired up. When this worker connects, Temporal registers it under the deployment name `valet` with build ID `1.0`.

_NOTE: This track has many terminal tabs - you may need to scroll horizontally to find the right one._

Click the [button label="Worker v1.0" background="#444CE7"](tab-0) tab.

```bash,run
make run-worker BUILD_ID=1.0
```

### Step 4: Start the load simulator

Click the [button label="Load Simulator" background="#444CE7"](tab-6) tab.

```bash,run
make run-load-simulator
```

> [!NOTE]
> Keep this running for the rest of the exercise.

### Step 5: Observe what happens without a Current Version

Open the [button label="Temporal UI" background="#444CE7"](tab-9) tab. You should see workflows appearing in the table, but none of them are making progress - they're stuck in a Running state without completing. The worker is connected, but Temporal doesn't know which version should receive workflow tasks. Without a Current Version set, there's no routing rule, so workflow tasks sit in the task queue with no worker polling for them.

Now navigate to the **Deployments** tab and click on the `valet` deployment. You should see version 1.0 listed with an **Inactive** status - the worker registered itself, but it's not receiving any traffic yet.

> [!IMPORTANT]
> **Key insight:** A versioned worker registering itself is not enough. Temporal requires an explicit `set-current-version` (or `set-ramping-version`) command to begin routing. This is a safety mechanism - it separates "deploy" from "activate," giving you a window to verify the worker is healthy before it receives traffic.

> [!NOTE]
> **Try:** Click on **Go to Workflows**, to see if there's any workflows registered to the current worker.

### Step 6: Register version 1.0 as the Current Version

Click the [button label="Terminal" background="#444CE7"](tab-7) tab.

```bash,run
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 1.0 \
    --yes
```

> [!NOTE]
> In this exercise we use `set-current-version` for instant cutover to keep things moving, but in production you'd likely prefer `set-ramping-version`, which routes a configurable percentage of new traffic to the new version while the rest stays on the Current Version. You can increase the percentage over time as confidence grows, then promote with `set-current-version` when ready. In Exercise 3, the Worker Controller automates this same pattern via its `Progressive` rollout strategy.

### Step 7: Inspect the deployment

Click the [button label="Terminal" background="#444CE7"](tab-7) tab.

```bash,run
temporal worker deployment describe --name valet
```

You should see version 1.0 listed as the Current Version. This is the command you'll use throughout the exercise to check deployment state, see which versions are active, and confirm when old versions have fully drained.

### Step 8: Verify versioning is working

Check the [button label="Temporal UI" background="#444CE7"](tab-9) tab. The workflows that were stuck should now be completing, and new workflows should be flowing through successfully. Configure the table columns so versioning info is visible at a glance:

- Click the **gear icon** at the bottom of the workflows table.
- Add the following columns: **Deployment**, **Deployment Version**, and **Versioning Behavior**.

You should now see `valet` as the Deployment, `valet:1.0` as the Deployment Version, and `Pinned` or `AutoUpgrade` as the Versioning Behavior for each workflow. This confirms Temporal is routing traffic through your versioned worker - every workflow knows which version it belongs to, and that metadata is visible and queryable.

Navigate back to the **Deployments** tab and open the `valet` deployment again. Version 1.0 should now show as **Active** - it's the Current Version and receiving all new workflow traffic.

---

## Part B - Deploy a Non-Replay-Safe Change with PINNED Versioning

*__Covers:__ Rainbow deployment with PINNED workflows, version coexistence, version lifecycle statuses*

Your next feature request is adding billing. This adds a new activity to the workflow - a non-replay-safe change. In Exercise 1, that required `workflow.patched()`. With PINNED versioning, you'll deploy v2.0 alongside v1.0 and let Temporal route traffic. Along the way, you'll see how Temporal tracks each version through its lifecycle - from active to drained.

### Step 1: Add the billing activity

In the [button label="Code Editor" background="#444CE7"](tab-8) tab, open `valet/valet_parking_workflow.py` and add `bill_customer` at the end of the workflow (follow the `TODO (Part B)` comment):

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

### Step 2: Start a 2.0 worker

Click the [button label="Worker v2.0" background="#444CE7"](tab-1) tab.
Start a 2.0 worker **alongside** the running 1.0 worker:

```bash,run
make run-worker BUILD_ID=2.0
```

> [!IMPORTANT]
> **Think:** The load simulator has been creating workflows on v1.0 for a while now. Some are mid-trip. In the next step when you set v2.0 as the Current Version, what happens to those in-flight v1.0 workflows?

### Step 3: Set 2.0 as the Current Version

Click the [button label="Terminal" background="#444CE7"](tab-7) tab.

```bash,run
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 2.0 \
    --yes
```

### Step 4: Observe the version coexistence

Check the [button label="Temporal UI" background="#444CE7"](tab-9) tab:

- **New workflows** start on version 2.0 - they include billing.
- **In-flight 1.0 workflows** stay pinned to version 1.0 - they complete on the 1.0 worker with no billing, and no replay issues.
- **`ParkingLotWorkflow`** (AUTO_UPGRADE) automatically migrates to v2.0 on its next workflow task.

**Nice!** You just deployed a non-replay-safe change without needing any patching.

> [!NOTE]
> **Version Statuses**
> Temporal tracks each deployment version through a [lifecycle](https://docs.temporal.io/worker-versioning#versioning-statuses) which progresses through the following statuses:
> - **Inactive**: worker registered, not yet serving traffic
> - **Active**: currently Current or Ramping, accepting new workflows
> - **Draining**: no longer active, but still has open pinned workflows
> - **Drained**: all pinned workflows completed, no remaining work
>
> Drained means no open workflows, but completed workflows still exist in the namespace until the retention period expires (default 3 days). You can view a completed workflow's history in the UI without a worker, but querying it (programmatic queries, stack traces) triggers a replay that requires a worker with that version's code. In production, keep old workers running through the retention period if you need to query those completed executions.
>
> In the next step, you'll watch v1.0 move from Draining to Drained in real time.

### Step 5: Wait for v1.0 to drain

After setting v2.0 as Current, no new workflows are routed to v1.0. But existing PINNED workflows are still running there.

Once there are no more open workflows on v1.0, the version is considered "drained" - meaning it has no remaining work and its worker can be safely shut down. In this exercise, that's just the PINNED `ValetParkingWorkflow` executions finishing their trips. The `ParkingLotWorkflow` execution already migrated to v2.0 when you set it as current.

_NOTE: Draining may take 1-3 minutes. The workflows themselves finish in 5-30 seconds, but Temporal's visibility system (which tracks open workflows per version) is **eventually** consistent. The version won't show as "Drained" until visibility catches up, which can lag behind actual workflow completion by a minute or two._

**Check drain status** using either method:

- **CLI:** Run `watch temporal worker deployment describe --name valet` and wait for `Drained` status on the 1.0 version. Press **Ctrl+C** to stop watching once you see it.

  Click the [button label="Terminal" background="#444CE7"](tab-7) tab.

  ```bash,run
  watch temporal worker deployment describe --name valet
  ```

  Press **Ctrl+C** to stop watching once you see it.

- **Web UI:** Open the [button label="Temporal UI" background="#444CE7"](tab-9) tab and navigate to the **Deployments** tab. Click on the `valet` deployment to see per-version status. When 1.0 shows as drained, it has no remaining workflows.

### Step 6: Stop the 1.0 worker

Once v1.0 is drained, **stop the 1.0 worker** (Ctrl+C in the [button label="Worker v1.0" background="#444CE7"](tab-0) tab).

---

## Part C - When a Bad Deploy Hits Production

*__Covers:__ Instant rollback (`set-current-version`), evacuating stuck workflows (`update-options`), fix-forward deployment, `WorkerDeploymentVersion` search attribute*

Everything is humming along. Billing shipped cleanly with zero patching. The v1.0 worker drained and you shut it down. You're feeling good about versioning.

Then you add a tip calculation to the billing activity. Quick change, no big deal. You deploy v3.0, set it as current, and go back to what you were doing.

A minute later, you glance at the Web UI. Something looks off. The number of Running workflows is climbing, and none of them are completing. You check the worker logs: `AttributeError`, over and over. Temporal is faithfully retrying the billing activity on each workflow, but every attempt hits the same error.

You made a typo. You referenced `input.tip_percentage`, a field that doesn't exist. And it's live. You need to act *now*.

### The bad deploy

### Step 1: Introduce the bug

In the [button label="Code Editor" background="#444CE7"](tab-8) tab, open `valet/activities.py` and add this line to the beginning of `bill_customer`:

```python
@activity.defn
async def bill_customer(input: BillCustomerInput) -> BillCustomerOutput:
    # ... rest of the function
    tip = input.tip_percentage  # BUG: tip_percentage doesn't exist on BillCustomerInput
    # ... rest of the function
```

This will cause an `AttributeError` every time billing runs.

### Step 2: Start a 3.0 worker

Click the [button label="Worker v3.0" background="#444CE7"](tab-2) tab.

```bash,run
make run-worker BUILD_ID=3.0
```

> [!IMPORTANT]
> **Think:** The load simulator is still running. What happens to new workflows the instant you run the next command?

### Step 3: Set 3.0 as current

Click the [button label="Terminal" background="#444CE7"](tab-7) tab.

```bash,run
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 3.0 \
    --yes
```

### Step 4: Watch the damage

Open the [button label="Temporal UI" background="#444CE7"](tab-9) tab. New workflows are starting on 3.0 and their count in Running status is growing, but none are completing. They all reach the billing step and get stuck there. Temporal keeps retrying the activity, so the workflows don't fail - they just can't make progress. Check the worker logs in the [button label="Worker v3.0" background="#444CE7"](tab-2) tab and you'll see `AttributeError` on every billing attempt, followed by another retry. Every few seconds, the load simulator starts another workflow, and it joins the same pileup.

### Step 5: Check the damage

Before you fix anything, see exactly how bad it is:

Click the [button label="Terminal" background="#444CE7"](tab-7) tab.

```bash,run
temporal workflow list \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"'
```

Each of these workflows is stuck in an activity retry loop, unable to complete.

### Stop the bleeding

The fastest possible response: redirect new traffic away from the broken version. No code redeploy, no CI pipeline, no waiting. One command.

### Step 6: Roll back to v2.0

Click the [button label="Terminal" background="#444CE7"](tab-7) tab.

```bash,run
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 2.0 \
    --yes
```

### Step 7: Verify the rollback

Check the [button label="Temporal UI" background="#444CE7"](tab-9) tab - new workflows should now be starting on v2.0 and completing successfully with working billing. That took seconds, not minutes. Nice!

But look closer. The workflows that already started on v3.0 are still there, still stuck in their retry loops. They're PINNED to v3.0 - new traffic is safe, but those in-flight workflows aren't going anywhere.

### Rescue the stuck workflows

Rollback stopped the bleeding for new workflows, but the PINNED workflows that already started on v3.0 are still retrying the broken activity in a loop. They won't move on their own because PINNED means "stay on this version forever." You need to explicitly override their version assignment, moving them from the broken v3.0 to the working v2.0. Temporal's `update-options` command lets you do this in bulk with a single query.

### Step 8: Evacuate stuck workflows to v2.0

Click the [button label="Terminal" background="#444CE7"](tab-7) tab.

```bash,run
temporal workflow update-options \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"' \
    --versioning-override-behavior pinned \
    --versioning-override-deployment-name valet \
    --versioning-override-build-id 2.0 \
    --yes
```

> [!NOTE]
> **Why is this replay-safe?** The workflow code between v2.0 and v3.0 is identical - the bug is in the activity implementation, not the workflow definition. The v2.0 worker replays the workflow history, reaches the billing step, and calls the working v2.0 `bill_customer`. Failed activity attempts in history don't cause replay errors - the workflow just sees "activity not yet completed" and retries.

### Step 9: Watch them recover

Go back to the [button label="Temporal UI" background="#444CE7"](tab-9) tab. The workflows that were stuck on v3.0 are now completing successfully on v2.0. Those customers just got billed correctly.

Run the same query from step 5 again:

Click the [button label="Terminal" background="#444CE7"](tab-7) tab.

```bash,run
temporal workflow list \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"'
```

Zero results. Every stuck workflow has been rescued.

### Fix forward

Rollback bought you time. Now ship the fix.

### Step 10: Fix the bug

In `valet/activities.py`, remove the `tip = input.tip_percentage` line you added in step 1.

```python
@activity.defn
async def bill_customer(input: BillCustomerInput) -> BillCustomerOutput:
    # simply remove/comment out the bug you introduced in this function
```

### Step 11: Start a v3.1 worker

Click the [button label="Worker v3.1" background="#444CE7"](tab-3) tab.

```bash,run
make run-worker BUILD_ID=3.1
```

### Step 12: Set v3.1 as current

Click the [button label="Terminal" background="#444CE7"](tab-7) tab.

```bash,run
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 3.1 \
    --yes
```

New workflows now flow through v3.1 with working billing. Incident resolved. You can verify this by inspecting new workflows in the [button label="Temporal UI" background="#444CE7"](tab-9) tab.

> [!IMPORTANT]
> **Recap what just happened.** A bad deploy hit production. Within seconds of noticing, you redirected new traffic (no redeploy). Then you bulk-rescued every stuck workflow (one command). Then you shipped a fix. Total production impact: the time it took you to notice and type two commands. That's the power of version routing at the infrastructure level.

### Clean up

### Step 13: Stop the v3.0 worker

**Stop the v3.0 worker** (Ctrl+C in the [button label="Worker v3.0" background="#444CE7"](tab-2) tab).

### Step 14: Stop the v2.0 worker

Once v2.0 has fully drained, you can **stop the v2.0 worker** (Ctrl+C in the [button label="Worker v2.0" background="#444CE7"](tab-1) tab).

---

## Part D (Optional) - The AUTO_UPGRADE Catch

*__Covers:__ AUTO_UPGRADE replay behavior, patching for auto-upgraded workflows, trampolining concept*

In Parts A-C, `PINNED` versioning meant no patching. But `ParkingLotWorkflow` uses `AUTO_UPGRADE` - when a new version becomes `Current`, it automatically migrates. That means it replays its existing history against your new code. If the commands don't match, you get an NDE.

Let's see it happen.

### Make a non-replay-safe change to ParkingLotWorkflow

### Step 1: Add a warm-up delay

In `valet/parking_lot_workflow.py`, add a 2-second warm-up delay after the parking spaces are initialized:

```python
# Warm-up delay: let external systems sync before accepting requests
await workflow.sleep(2)
```

This is a non-replay-safe change: it adds a timer command that doesn't exist in the workflow's current history.

### Deploy and watch it break

### Step 2: Start a v4.0 worker

Click the [button label="Worker v4.0" background="#444CE7"](tab-4) tab.

```bash,run
make run-worker BUILD_ID=4.0
```

> [!IMPORTANT]
> **Think:** `ParkingLotWorkflow` is AUTO_UPGRADE. What happens to it when a new version becomes Current?

### Step 3: Set v4.0 as current

Click the [button label="Terminal" background="#444CE7"](tab-7) tab.

```bash,run
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 4.0 \
    --yes
```

### Step 4: Watch the v4.0 worker logs

The `ParkingLotWorkflow` auto-upgrades to v4.0 and immediately hits a non-determinism error (NDE). The v4.0 code expects a timer (the 2-second sleep), but the existing history doesn't have one.

> [!IMPORTANT]
> **Wait - didn't versioning eliminate patching?** Only for **PINNED** workflows. PINNED workflows never replay old history against new code because they stay on their original version. AUTO_UPGRADE moves workflows to the latest code, which involves replaying old history against the new code - and that opens us up to the risk of NDEs (non-determinism errors). So AUTO_UPGRADE still requires patching for non-replay-safe changes, just like the unversioned worker in Exercise 1.

### Fix it with a patch

### Step 5: Wrap the sleep in workflow.patched()

In `valet/parking_lot_workflow.py`, wrap the sleep in `workflow.patched()` - the same technique from Exercise 1:

```python
 # Warm-up delay: let external systems sync before accepting requests
 if workflow.patched("add-warmup-delay"):
    await workflow.sleep(2)
```

### Step 6: Start a v4.1 worker

Click the [button label="Worker v4.1" background="#444CE7"](tab-5) tab.

```bash,run
make run-worker BUILD_ID=4.1
```

### Step 7: Set v4.1 as current

Click the [button label="Terminal" background="#444CE7"](tab-7) tab.

```bash,run
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 4.1 \
    --yes
```

### Step 8: Observe the fix

`ParkingLotWorkflow` auto-upgrades to v4.1. This time, `workflow.patched("add-warmup-delay")` returns `False` during replay (no patch marker in the old history), so the sleep is skipped. The workflow continues without an NDE. Future runs (after `continue_as_new`) will include the sleep.

> [!IMPORTANT]
> **The takeaway:** PINNED eliminates patching. AUTO_UPGRADE does not. When an AUTO_UPGRADE workflow migrates to new code, it replays its history - so the new code must be replay-compatible. Patching is still the tool for that.

## Aside: Upgrade on Continue as New (or "Trampolining")

**Notice something.** `ParkingLotWorkflow` uses `continue_as_new`. After the auto-upgrade, the *current run* replays with the patch guard. But the *next run* (after `continue_as_new`) starts fresh on v4.1 with no prior history to conflict with. The patch only matters during the transition of the current run. In a production workflow with frequent `continue_as_new` boundaries, these patches are naturally short-lived - they're only needed for the one run that bridges the version change.

This is the core insight behind **trampolining** (upgrade on continue-as-new): if you made `ParkingLotWorkflow` PINNED instead of AUTO_UPGRADE, each run would complete on its original version with zero patching. At the `continue_as_new` boundary, the new run could start on the latest version. No patching, ever - just a clean handoff at the seam. For long-running workflows with natural `continue_as_new` boundaries, this is the best of both worlds.

---

> [!NOTE]
> **Congratulations!** You've completed this exercise!
