---
slug: rainbow-deploy
id: ""
type: challenge
title: "Deploy a Breaking Change - No Patching Needed"
teaser: "Ship a non-replay-safe feature with PINNED versioning and zero patching"
tabs:
- type: terminal
  title: Worker v1.0
  hostname: workstation
- type: terminal
  title: Worker v2.0
  hostname: workstation
- type: terminal
  title: Load Simulator
  hostname: workstation
- type: terminal
  title: Terminal
  hostname: workstation
- type: code
  title: Code Editor
  hostname: workstation
  path: /root/temporal-versioning-workshop/exercises/2-worker-versioning/practice
- type: service
  title: Temporal UI
  hostname: workstation
  port: 8233
difficulty: basic
timelimit: 1200
---

# Part B - Deploy a Breaking Change - No Patching Needed

Your next feature request is adding billing. This adds a new activity to the workflow - a non-replay-safe change. In Exercise 1, that required `workflow.patched()`. With PINNED versioning, you'll deploy v2.0 alongside v1.0 and let Temporal route traffic.

1. In the **Code Editor**, open `valet/valet_parking_workflow.py` and add `bill_customer` at the end of the workflow (follow the `TODO (Part B)` comment):

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

2. Start a 2.0 worker **alongside** the running 1.0 worker (in the **Worker v2.0** tab):

```bash
make run-worker BUILD_ID=2.0
```

> *__Think:__ The load simulator has been creating workflows on v1.0 for a while now. Some are mid-trip. In the next step when you set v2.0 as the Current Version, what happens to those in-flight v1.0 workflows?*

3. Set 2.0 as the Current Version (in the **Terminal** tab):

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 2.0 \
    --yes
```

4. **Observe in the Temporal UI** tab:
   - **New workflows** start on version 2.0 - they include billing.
   - **In-flight 1.0 workflows** stay pinned to version 1.0 - they complete on the 1.0 worker with no billing, no patching, no replay issues.
   - **`ParkingLotWorkflow`** (AUTO_UPGRADE) automatically migrates to v2.0 on its next workflow task.

   > *You just deployed a non-replay-safe change without needing any patching.*

5. **Wait for v1.0 to drain.** After setting v2.0 as Current, no new workflows are routed to v1.0. Once every in-flight v1.0 workflow completes, the version is considered "drained."

   Since the load simulator creates short-lived workflows (5-30 second trips), draining should only take about 30 seconds.

   **Check drain status:**

   - **CLI:** Run `temporal worker deployment describe --name valet` and look for `Drained` status on the 1.0 version.

     ```bash
     temporal worker deployment describe --name valet
     ```

   - **Web UI:** Open the **Temporal UI** tab, navigate to the **Deployments** tab, and click on `valet` to see per-version status.

6. Once v1.0 is drained, **stop the 1.0 worker** (Ctrl+C in the **Worker v1.0** tab).
