# Exercise 2: Worker Versioning

### Summary

- **Part A:** Enable worker versioning - add `PINNED` to `ValetParkingWorkflow`, `AUTO_UPGRADE` to `ParkingLotWorkflow`, configure `WorkerDeploymentConfig` in the worker. Deploy v1.0 and run load.
- **Part B:** Add `bill_customer` to the workflow (a non-replay-safe change). Deploy v2.0 alongside v1.0. Observe that new workflows bill, in-flight v1.0 workflows complete without it - no patching needed.
- **Part C:** Introduce a bug in v3.0 → instant rollback via `set-current-version` → evacuate stuck v3.0 workflows to v2.0 with `update-options` → fix-forward with v3.1.

---

## Setup: Clean Slate

If your Temporal dev server is still running from Exercise 1, stop it (Ctrl+C) and restart it so there are no leftover workflow executions:

```bash
temporal server start-dev
```

> **Note:** Keep this running for the entire exercise. All code changes in this exercise happen before any workers or workflows start - every workflow will be versioned from birth.

---

## Part A - Enable Worker Versioning + Deploy Version 1.0 (~12 min)

**Goal:** Configure worker versioning infrastructure and deploy the first versioned worker.

1. Navigate to the exercise folder:

```bash
cd exercises/exercise-2/practice
```

2. Review the starting code. This is the Exercise 1 solution - `ValetParkingWorkflow` already calls `notify_owner` (guarded by `workflow.patched("add-notify-owner")`). The `bill_customer` activity and its models are already defined - you'll use them later.

3. **Make three code changes** (follow the `TODO (Part A)` comments in each file):

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

   **c.** In `valet/worker.py` create the deployment config from environment variables, and pass it to the `Worker`:

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

4. Start the versioned 1.0 worker (in a **new terminal**):

```bash
make run-worker BUILD_ID=1.0
```

5. Register version 1.0 as the **Current Version** for the deployment:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 1.0 \
    --yes
```

6. Inspect the deployment to confirm:

```bash
temporal worker deployment describe --name valet
```

   You should see version 1.0 listed as the Current Version.

7. Start the load simulator (in a **new terminal**):

```bash
make run-load-simulator
```

8. Open the Temporal Web UI at [http://localhost:8233](http://localhost:8233) and watch workflows flow through the versioned 1.0 worker.

---

## Part B - Deploy a Breaking Change - No Patching Needed (~15 min)

**Motivation:** "Product wants billing at the end of the valet workflow. This adds a new activity - a non-replay-safe change. In Exercise 1, you'd have needed a patch. With PINNED versioning, you don't."

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

3. Set 2.0 as the Current Version:

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

## Part C - Emergency Rollback & Remediation (~10 min)

**Motivation:** "Things don't always go smoothly. Let's see what happens when a bad deploy makes it to production - and how Worker Versioning gives you tools to respond immediately."

**Scenario:** A developer deploys v3.0 with a bug in the `bill_customer` activity - they reference a field that doesn't exist on the input dataclass.

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

3. Set 3.0 as current:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 3.0 \
    --yes
```

4. **Watch the damage** in the Temporal Web UI or worker logs - new workflows start on 3.0, but crash at the billing step. The activity retries forever.

### Step 1 - Instant rollback (stop the bleeding)

5. Set v2.0 back as current - no code redeploy needed:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 2.0 \
    --yes
```

**Immediately**, new workflows are routed to v2.0 with working billing. But in-flight v3.0 workflows are still pinned to v3.0 - they're stuck.

### Step 2 - Evacuate in-flight v3.0 workflows to v2.0

6. Find the stuck v3.0 workflows using the `WorkerDeploymentVersion` search attribute (format: `<deployment>:<build-id>`):

```bash
temporal workflow list \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"'
```

7. Bulk-reassign all v3.0 workflows to v2.0 using the same query:

```bash
temporal workflow update-options \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"' \
    --versioning-override-behavior pinned \
    --versioning-override-deployment-name valet \
    --versioning-override-build-id 2.0 \
    --yes
```

   > **Why is this replay-safe?** The workflow code between v2.0 and v3.0 is identical - the bug is in the activity implementation, not the workflow definition. The v2.0 worker replays the workflow history, reaches the billing step, and calls the working v2.0 `bill_customer`. Failed activity attempts in history don't cause replay errors - the workflow just sees "activity not yet completed" and retries.

8. **Observe:** the previously-stuck workflows now complete successfully on v2.0.

### Step 3 - Fix the bug and deploy v3.1

9. **Fix the bug.** Remove the `tip = input.tip_percentage` line you added in step 1.

10. Start a v3.1 worker (in a **new terminal**):

```bash
make run-worker BUILD_ID=3.1
```

11. Set v3.1 as current:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 3.1 \
    --yes
```

New workflows now flow through v3.1 with working billing.

### Step 4 - Clean up

12. **Stop the v3.0 worker** (Ctrl+C).

13. Once v2.0 has fully drained, **stop the v2.0 worker** (Ctrl+C) as well.

---

> **🎉 Congratulations!** You've completed Exercise 2.