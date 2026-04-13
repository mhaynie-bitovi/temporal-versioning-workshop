# Exercise 3: Deploying on K8s with the Worker Controller

**Time:** ~40 minutes
**Theme:** "You've been managing versioning by hand. The Worker Controller automates all of that."
**Skills:** TemporalWorkerDeployment CRD, Progressive rollout, rainbow deployments, pre-deployment testing, gate workflows

### Summary

- **Part A:** Build and deploy v1.0 via a `TemporalWorkerDeployment` CRD (AllAtOnce strategy). Start load.
- **Part B:** Add `notify_owner` to the workflow (non-replay-safe). Switch the CRD to a Progressive rollout strategy. Deploy v2.0 -- watch the controller ramp traffic 25% → 75% → 100% while 1.0 workers drain.
- **Part C:** Deploy v3.0 with a Manual strategy so it stays Inactive. Send a test workflow pinned to v3.0 using `VersioningOverride`. After verifying, promote v3.0 to Current via the CLI.
- **Part D:** Add a gate workflow to the rollout config. Deploy v4.0 with Progressive strategy -- watch the controller run the gate before ramping any traffic.

---

## Pre-Setup

Ensure `minikube`, `kubectl`, `helm`, and the `temporal` CLI are installed and available.

1. In a dedicated terminal, start the Temporal dev server:

```bash
temporal server start-dev
```

> **Note:** Starting a fresh dev server means we're working with a clean slate — no history from previous exercises. The code picks up where Exercise 2 left off, but we'll number our builds from 1.0 again so it's easy to track where we are in this exercise.

2. In a new terminal, navigate to the exercise directory and run setup (starts minikube, installs the Worker Controller CRDs and controller, and applies the Temporal connection config):

```bash
cd exercises/exercise-3/practice
make setup
```

---

## Part A — Deploy 1.0 and generate load (~10 min)

1. Ensure you're still in the `exercises/exercise-3/practice` directory from Pre-Setup.

2. Examine the k8s manifests:
   - `k8s/temporal-connection.yaml` — points to the host Temporal server
   - `k8s/valet-worker.yaml` — `TemporalWorkerDeployment` with `AllAtOnce` strategy

> **Note:** The initial manifest uses `AllAtOnce` — every replica cuts over immediately. This is fine for the first deploy, but for non-replay-safe changes you'll want a `Progressive` strategy so old and new versions coexist safely. We'll switch to that in Part B.

3. Build and deploy 1.0:

```bash
make build tag=1.0
kubectl apply -f k8s/valet-worker.yaml
```

4. Verify:

```bash
kubectl get twd          # TemporalWorkerDeployment shows up
kubectl get deployments  # Controller created a versioned Deployment
kubectl get pods         # Worker pods are Running
```

5. Start the load simulator:

```bash
make run-load-simulator
```

   Check the Temporal UI at [http://localhost:8233](http://localhost:8233) — workflows are flowing.

   **Leave the load simulator running.**

---

## Part B — Non-replay-safe change with Progressive rollout (~14 min)

**Scenario:** Add a notification when the owner's car is being retrieved. This adds a new activity call to the workflow sequence — a non-replay-safe change. With worker versioning (`PINNED` behavior), each version runs its own code, so the Worker Controller will keep 1.0 workers alive for in-flight workflows while ramping up 2.0 for new ones.

> **Why Progressive?** A Progressive rollout introduces the new version gradually — starting with a small percentage of new workflow executions, pausing to let you verify things are healthy, then ramping up. Meanwhile, in-flight workflows stay pinned to their original version. This is the **rainbow deployment model**: multiple versions coexist, each serving the workflows that belong to it.

1. Make the code change in `valet/valet_parking_workflow.py` — add a `notify_owner` call after the sleep (when the car is being retrieved), right before the move back to the valet zone:

   ```python
   # Notify the owner their car is being retrieved
   await workflow.execute_activity(
       notify_owner,
       NotifyOwnerInput(
           license_plate=input.license_plate,
           message="Your car is being retrieved!",
       ),
       start_to_close_timeout=timedelta(seconds=10),
   )
   ```

2. Build the 2.0 image:

```bash
make build tag=2.0
```

3. Update `k8s/valet-worker.yaml` — change the strategy from `AllAtOnce` to `Progressive` with ramp steps, and update the image tag to `2.0`:

   ```yaml
   rollout:
     strategy: Progressive
     steps:
       - rampPercentage: 25
         pauseDuration: 30s
       - rampPercentage: 75
         pauseDuration: 30s
   ```

   ```yaml
   image: valet-worker:2.0
   ```

4. Apply the updated manifest:

```bash
kubectl apply -f k8s/valet-worker.yaml
```

5. Watch the progressive rollout unfold:

```bash
kubectl get twd -w
```

   - 2.0 starts at **rampPercentage: 25%** — only 25% of *new* workflow executions go to 2.0
   - After 30s, ramps to **75%**
   - After another 30s, reaches **100%** — 2.0 becomes the Current Version

6. While the rollout progresses, observe the rainbow deployment in another terminal:

```bash
kubectl get deployments
```

   Both 1.0 and 2.0 Deployments run simultaneously:
   - **1.0 workers** continue serving in-flight workflows pinned to version 1.0
   - **2.0 workers** serve new workflow executions (at whatever the current ramp percentage is)

7. Watch individual pods serving their respective versions:

```bash
kubectl get pods -l temporal.io/deployment-name=valet-worker --show-labels
```

8. Verify in the Temporal UI at [http://localhost:8233](http://localhost:8233):
   - New workflows include a "Your car is being retrieved!" notification before the return trip
   - Older in-flight workflows complete without it
   - Over time, 1.0 workers scale down as their pinned workflows finish

> **Key insight:** The Worker Controller orchestrates the entire rainbow deployment automatically. You didn't need to manually manage traffic routing, scale replicas, or coordinate draining — just update the image tag and the controller handles the rest.

---

## Part C -- Pre-deployment testing with synthetic traffic (~10 min)

**Scenario:** You want to deploy v3.0 but test it before any real traffic touches it. Worker Versioning's `Inactive` state is designed for exactly this: workers are polling but only receive workflows explicitly pinned to them via `VersioningOverride`. By combining a `Manual` rollout strategy with a pinned test workflow, you get a staging lane inside your production environment.

> **Why Manual?** The `Manual` strategy tells the controller to create the versioned Deployment and register the version with Temporal, but *not* automatically promote it. The version stays `Inactive` until you explicitly promote it via the CLI. This gives you time to test.

1. Make a small code change in `valet/valet_parking_workflow.py` -- update the retrieval notification message:

   ```python
   message="Your car is being retrieved shortly!",
   ```

2. Build the 3.0 image:

```bash
make build tag=3.0
```

3. Update `k8s/valet-worker.yaml` -- change the strategy to `Manual` and update the image tag to `3.0`:

   ```yaml
   rollout:
     strategy: Manual
   ```

   ```yaml
   image: valet-worker:3.0
   ```

4. Apply the updated manifest:

```bash
kubectl apply -f k8s/valet-worker.yaml
```

5. Watch the version state:

```bash
kubectl get twd
```

   v3.0 pods start, register with Temporal, and sit in the **Inactive** state. Production traffic continues flowing to v2.0 -- the Manual strategy means the controller won't promote automatically.

6. Now send a test workflow pinned to v3.0. Run the pre-deployment test script:

```bash
PYTHONPATH=. python valet/test_version.py
```

   This script starts a `ValetParkingWorkflow` with a `versioning_override` that pins it to v3.0 specifically. Open `valet/test_version.py` to see how it works -- the key line is:

   ```python
   versioning_override=PinnedVersioningOverride(
       WorkerDeploymentVersion(deployment_name, build_id),
   ),
   ```

7. Verify in the Temporal UI at [http://localhost:8233](http://localhost:8233):
   - Find the `test-3.0` workflow -- it completed on v3.0
   - Run `temporal workflow describe -w test-3.0` to confirm it's pinned to `default/valet-worker.3.0`
   - Meanwhile, load simulator workflows are still running on v2.0

8. Once satisfied, promote v3.0 to Current via the CLI:

```bash
temporal worker deployment set-current-version \
    --deployment-name "default/valet-worker" \
    --build-id "3.0"
```

9. Verify the promotion:

```bash
kubectl get twd
temporal worker deployment describe --name "default/valet-worker"
```

   v3.0 is now Current. New workflows go to 3.0. v2.0 starts draining as its pinned workflows complete.

> **Key insight:** The `Inactive` state + `VersioningOverride` gives you a staging lane inside production. You deployed v3.0 pods alongside v2.0, tested with real infrastructure (same namespace, same Temporal server, same task queue), and only promoted after confirming it works. No separate staging environment needed, no side effects on production traffic.

---

## Part D -- Gate workflow (~7 min)

**Scenario:** Part C showed manual testing -- you ran a script and promoted by hand. That's useful for exploratory testing or first-time deploys, but you don't want to do that for every deploy. The Worker Controller's **gate workflow** automates this: before any traffic ramps, the controller starts a workflow on the new version. If it fails, the rollout is blocked.

> **How it works:** When `spec.rollout.gate` is configured, the controller starts the gate workflow on the new version's workers while the version is still `Inactive`. Only after the gate workflow completes successfully does the controller begin ramping traffic. If the gate fails, the version stays `Inactive` and production is unaffected.

1. Open `valet/gate_workflow.py` and examine the `ValetGateWorkflow`. You'll see it's a simple workflow that returns "ok", with comments showing what a production gate would check:

   ```python
   # In production, a gate workflow would verify things like:
   # - Downstream dependencies are reachable (database, APIs)
   # - Activities can execute correctly
   # - Replay tests pass with recent workflow histories
   ```

2. Register the gate workflow on the worker -- in `valet/worker.py`, uncomment the import and add `ValetGateWorkflow` to the `workflows=` list.

3. Update `k8s/valet-worker.yaml` -- switch back to `Progressive` strategy with a `gate`, and update the image tag to `4.0`:

   ```yaml
   rollout:
     strategy: Progressive
     steps:
       - rampPercentage: 25
         pauseDuration: 30s
       - rampPercentage: 75
         pauseDuration: 30s
     gate:
       workflowType: "ValetGateWorkflow"
   ```

   ```yaml
   image: valet-worker:4.0
   ```

4. Build and deploy v4.0:

```bash
make build tag=4.0
kubectl apply -f k8s/valet-worker.yaml
```

5. Watch the rollout:

```bash
kubectl get twd -w
```

   Observe the sequence:
   1. v4.0 pods start and register with Temporal (Inactive)
   2. The controller starts a `ValetGateWorkflow` on v4.0 -- find it in the Temporal UI
   3. The gate completes successfully
   4. *Then* ramping begins (25% → 75% → 100%)

6. Find the gate workflow in the Temporal UI at [http://localhost:8233](http://localhost:8233). It ran on v4.0 workers, before any production traffic was routed there.

> **Key takeaway:** The gate automates what you did manually in Part C. In production, you'd replace the placeholder with real checks: verifying database connectivity, running a test workflow end-to-end, or replaying recent workflow histories against the new code. The gate runs on the new version's workers (so it tests the real code path), but it runs before any routing changes. If it fails, production is unaffected.
