---
slug: configure-versioning
id: ""
type: challenge
title: "Enable Worker Versioning and Deploy v1.0"
teaser: "Configure PINNED and AUTO_UPGRADE versioning behaviors and deploy the first versioned worker"
tabs:
- type: terminal
  title: Worker v1.0
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

# Part A - Enable Worker Versioning + Deploy Version 1.0

Before shipping new features, you'll set up the versioning infrastructure. This is a one-time configuration that makes every future deploy safer.

> **Note:** The Temporal dev server is already running in the background. Your terminals start in the exercise's `practice/` directory with the Python virtual environment activated. Since each track runs in a fresh sandbox, you're starting with a clean slate (no leftover state from Exercise 1).

1. **Set the versioning behavior on both workflows** (follow the `TODO (Part A)` comments in each file):

   **a.** In the **Code Editor**, open `valet/valet_parking_workflow.py` and add `versioning_behavior=VersioningBehavior.PINNED` to `@workflow.defn`:

   ```python
   @workflow.defn(versioning_behavior=VersioningBehavior.PINNED)
   class ValetParkingWorkflow:
   ```

   > *__Why PINNED?__ Each parking transaction should complete on the code version it started on. No mid-execution surprises, no patching needed.*

   **b.** In the **Code Editor**, open `valet/parking_lot_workflow.py` and add `versioning_behavior=VersioningBehavior.AUTO_UPGRADE` to `@workflow.defn`:

   ```python
   @workflow.defn(versioning_behavior=VersioningBehavior.AUTO_UPGRADE)
   class ParkingLotWorkflow:
   ```

   > *__Why AUTO_UPGRADE here?__ `ParkingLotWorkflow` is an immortal singleton - it never completes normally. AUTO_UPGRADE means that when a new version becomes Current, the workflow automatically migrates to the new code on its next workflow task. This keeps the singleton on the latest version without manual intervention.*
   >
   > *__Important caveat:__ AUTO_UPGRADE still requires patching for non-replay-safe changes. When the workflow auto-upgrades, it replays its existing history against the new code. If the new code produces different commands, you get an NDE - just like Exercise 1. We'll explore this in Part D.*

2. **Configure the worker for versioning.** In the **Code Editor**, open `valet/worker.py` and add the `deployment_config` argument to the `Worker` constructor (follow the `TODO (Part A)` comment):

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

   You should see version 1.0 listed as the Current Version.

6. **Start the load simulator** (in the **Load Simulator** tab):

   ```bash
   make run-load-simulator
   ```

   > *Keep this running for the rest of the exercise.*

7. **Verify versioning is working** in the **Temporal UI** tab. Configure the table columns so versioning info is visible at a glance:

   - Click the **gear icon** at the bottom of the workflows table.
   - Add the following columns: **Deployment**, **Deployment Version**, and **Versioning Behavior**.

   You should now see `valet` as the Deployment, `valet:1.0` as the Deployment Version, and `Pinned` or `AutoUpgrade` as the Versioning Behavior for each workflow.
