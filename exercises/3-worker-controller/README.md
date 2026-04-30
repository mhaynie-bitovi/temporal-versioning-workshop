# Exercise 3: Worker Controller

In Exercise 2, you managed versioned deployments by hand - starting workers, setting current versions, draining and stopping old ones. It worked, but durable execution never sleeps, and managing it manually required constant attention. The Worker Controller automates all of that: progressive rollouts, draining, and pre-deployment checks, all driven by a Kubernetes CRD (Custom Resource Definition).

**Temporal features and patterns covered:**
- `TemporalWorkerDeployment` CRD
- `AllAtOnce`/`Progressive`/`Manual` rollout strategies
- Progressive ramping
- Gate workflows
- Pre-deployment testing with `VersioningOverride`

## Summary

- **Part A:** Deploy v1.0 via a `TemporalWorkerDeployment` CRD with an `AllAtOnce` strategy.
- **Part B:** Ship a non-replay-safe change using a `Progressive` rollout (ramped traffic + automatic draining).
- **Part C:** Add a gate workflow that blocks bad deploys before they take traffic.
- **Part D (Optional):** Use a `Manual` strategy to pre-test a version with synthetic traffic before promotion.

---

## Pre-Setup

Ensure `minikube`, `kubectl`, `helm`, and the `temporal` CLI are installed and available.

1. Close **all** terminals from the previous exercise, including the Temporal dev server.

2. Navigate to the exercise directory:

```bash
# in a new terminal
cd exercises/3-worker-controller/practice
```

3. Start a fresh Temporal dev server:

```bash
# in another terminal
temporal server start-dev
```

> _**Note**: Keep this running for the rest of the exercise._

4. Setup the minikube environment:

```bash
# in another terminal
make setup
```

   This does three things:
   - **Starts minikube** (if not already running) - a local, single-node Kubernetes cluster on your machine.
   - **Installs the [Temporal Worker Controller](https://github.com/temporalio/temporal-worker-controller)** via Helm - a Kubernetes operator that watches for `TemporalWorkerDeployment` custom resources and manages versioned worker rollouts automatically. Helm is a package manager for Kubernetes.
   - **Applies a `TemporalClusterConnection` resource** - a configuration object that tells the controller how to reach the Temporal dev server running on your host machine.

---

## Part A - Deploy on Kubernetes

*__Covers:__ `TemporalWorkerDeployment` CRD, `AllAtOnce` rollout strategy*

Your valet parking system is moving to Kubernetes. Instead of starting workers by hand like you did in Exercises 1 and 2, you'll declare the desired state in a `TemporalWorkerDeployment` k8s manifest and let the Worker Controller handle the rest - creating versioned Deployments, registering build IDs with Temporal, and managing pod lifecycles.

1. Briefly examine the k8s manifests:
   - `k8s/temporal-connection.yaml` - points to the host Temporal server. We will not modify this manifest during this exercise.
   - `k8s/valet-worker.yaml` - This is the main manifest we'll modify throughout this exercise - updating it and re-applying it is how we'll make changes to the Kubernetes cluster.

> _**Note:** Initially, this manifest uses the `AllAtOnce` rollout strategy where every replica cuts over immediately. This is fine for the first deploy, but for non-replay-safe changes you'll want a `Progressive` strategy so old and new versions coexist safely. We'll switch to that in Part B._

2. Build the v1.0 container image:

```bash
make build tag=1.0
```

   This compiles your worker code into a Docker image tagged `valet-worker:1.0` inside minikube.

3. Deploy the worker to Kubernetes by applying the manifest:

```bash
kubectl apply -f k8s/valet-worker.yaml
```

   The Worker Controller will read the `TemporalWorkerDeployment` resource, create a versioned Deployment, and start worker pods automatically:

4. Verify that the TemporalWorkerDeployment exists, the controller created a versioned Deployment, and worker pods are Running:

```bash
kubectl get twd
kubectl get deployments
kubectl get pods
```

   You should see the following:
   - A `valet-worker` TWD (Temporal Worker Deployment)
   - A Deployment named something like `valet-worker-<build-id>-<hash>`
   - And pods in `Running` status with `1/1` ready.

5. Start the load simulator:

```bash
make run-load-simulator
```

> _**Note**: Keep this running for the rest of the exercise._

6. Check the Temporal UI at [http://localhost:8233](http://localhost:8233) - workflows are flowing.

You now have a Temporal worker running on Kubernetes, managed entirely through a declarative manifest. You didn't start the worker process directly - you described the desired state in a CRD and the Worker Controller handled the rest. Next, you'll see how this approach handles non-replay-safe code changes.

---

## Part B - Non-replay-safe change with Progressive rollout

*__Covers:__ Progressive rollout strategy, ramp steps, rainbow deployment model*

Another feature request: notify car owners when their car is being retrieved. This is a non-replay-safe change. Instead of cutting over all at once, you'll use a Progressive rollout to ramp traffic gradually while old workflows complete on their original version.

> _**Why Progressive?** A Progressive rollout introduces the new version gradually - starting with a small percentage of new workflow executions, pausing to let you verify things are healthy, then ramping up. Meanwhile, in-flight workflows stay pinned to their original version. This is the **rainbow deployment model**: multiple versions coexist, each serving the workflows that belong to it._

1. Make the code change in `valet/valet_parking_workflow.py` - add a `notify_owner` call after the sleep (when the car is being retrieved), right before the move back to the valet zone:

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

3. Update `k8s/valet-worker.yaml` - change the strategy from `AllAtOnce` to `Progressive` with ramp steps, and update the image tag to `2.0`:

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

> _**Think:** You're applying a Progressive strategy with 25% as the first ramp step. What percentage of *currently in-flight* v1.0 workflows will move to v2.0? (Hint: they're PINNED.)_

4. Apply the updated manifest:

```bash
kubectl apply -f k8s/valet-worker.yaml
```

5. Observe the rainbow deployment - both versions running side by side:

```bash
kubectl get deployments
```

   Both 1.0 and 2.0 Deployments run simultaneously:
   - **1.0 workers** continue serving in-flight workflows pinned to version 1.0
   - **2.0 workers** serve new workflow executions (at whatever the current ramp percentage is)

6. Now watch the progressive rollout unfold:

```bash
watch kubectl get twd
# Ctrl+C to stop watching
```

   This prints the `TemporalWorkerDeployment` status and refreshes every 2 seconds. You'll see columns like `CURRENT VERSION`, `TARGET`, and `RAMP %` update in real time as the rollout progresses. Press **Ctrl+C** to stop watching once the rollout completes.

   - 2.0 starts at **rampPercentage: 25%** - only 25% of *new* workflow executions go to 2.0
   - After 30s, ramps to **75%**
   - After another 30s, reaches **100%** - 2.0 becomes the Current Version

7. Verify in the Temporal UI at [http://localhost:8233](http://localhost:8233):
   - New workflows include a "Your car is being retrieved!" notification before the return trip
   - Older in-flight workflows complete without it

> _**Key insight:** The Worker Controller orchestrates the entire rainbow deployment automatically. In Exercise 2, you managed all of this by hand - starting workers, running `set-current-version` or `set-ramping-version`, watching for draining, stopping old workers. Here, you updated the image tag and the controller handled the rest._

> _**Note:** The `sunset` section in the manifest controls when drained versions are cleaned up. `scaledownDelay` sets how long to wait after draining before scaling to zero, and `deleteDelay` sets how long before the versioned Deployment is deleted entirely. Without these, old versions hang around indefinitely. In production, consider aligning `scaledownDelay` with the namespace's retention period (default 3 days) if you need to query completed workflows, since queries trigger a replay that requires a worker with that version's code._

---

## Part C - Gate workflow

*__Covers:__ Gate workflows, pre-deployment validation, non-retryable `ApplicationError`*

Progressive rollouts ramp traffic automatically, but what if the new version has a problem? In Exercise 2, a bad deploy hit production and you had to scramble to roll back. A gate workflow catches problems *before* any production traffic is affected.

One possible use case for such a gate is verifying credentials after a secret rotation. Imagine you've rotated the billing service API key and deployed a new image with the updated secret. The gate workflow authenticates against the billing service to confirm the new credentials are valid - before any production traffic reaches the new version.

> _**How it works:** When `spec.rollout.gate` is configured, the controller starts the gate workflow on the new version's workers before any production traffic is routed to them. Only after the gate workflow completes successfully does the controller begin ramping traffic. If the gate fails, the version never receives production traffic._

1. Briefly open `valet/gate_workflow.py` and read through the `ValetGateWorkflow`. It runs connectivity checks against the downstream services the valet workflow depends on:

   ```python
   await workflow.execute_activity(
       check_notification_service,
       start_to_close_timeout=timedelta(seconds=10),
   )

   await workflow.execute_activity(
       check_billing_service,
       start_to_close_timeout=timedelta(seconds=10),
   )
   ```

2. Briefly open `valet/activities.py` and look at `check_billing_service`. It's currently rigged to simulate a misconfigured API key:

   ```python
   raise ApplicationError(
       "Billing service: invalid API key",
       type="InvalidCredentials",
       non_retryable=True,
   )
   ```

   The error is raised as a non-retryable `ApplicationError` so the activity fails immediately instead of retrying forever. A bad credential is a permanent failure, not a transient one.

   Leave this in place for now - we want to see the gate catch it.

3. Update `k8s/valet-worker.yaml` - switch to `Progressive` strategy with a `gate`, and update the image tag to `3.0`:

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
   image: valet-worker:3.0
   ```

> _**Think:** The gate workflow checks billing credentials, and you know those credentials are bad. What should happen to production traffic when you apply this manifest?_

4. Build and deploy v3.0:

```bash
make build tag=3.0
kubectl apply -f k8s/valet-worker.yaml
```

5. Verify in the Temporal UI at [http://localhost:8233](http://localhost:8233):
   - Navigate to **Workers > Deployments** - v3.0 should show that it is not receiving production traffic. v2.0 is still the current version.
   - Find the failed gate workflow and open it - the error shows `Billing service: invalid API key`. This is exactly what would happen if a rotated secret was misconfigured.

> _**Key observation:** Production traffic is still flowing to v2.0. Unlike the Exercise 2 incident where the bad deploy hit live traffic before you could respond, the gate caught the bad credential before any routing change happened._

6. Now fix the activity. In `valet/activities.py`, replace the `raise` in `check_billing_service` with a passing check:

   ```python
   @activity.defn
   async def check_billing_service() -> str:
       """Verify credentials for the billing service are valid."""
       activity.logger.info("Billing service: credentials valid")
       return "ok"
   ```

7. Rebuild with a new image tag:

```bash
make build tag=3.1
```

8. Update `k8s/valet-worker.yaml` to use the fixed image:

   ```yaml
   image: valet-worker:3.1
   ```

9. Apply:

```bash
kubectl apply -f k8s/valet-worker.yaml
```

10. Watch the rollout this time:

```bash
watch kubectl get twd
# Ctrl+C to stop watching
```

   Observe the sequence:
   1. v3.1 pods start and register with Temporal
   2. The controller starts a `ValetGateWorkflow` on v3.1
   3. The gate checks the notification service - passes
   4. The gate checks the billing service - passes this time
   5. The gate completes successfully
   6. Ramping begins (25% -> 75% -> 100%)

11. Find the successful gate workflow in the Temporal UI. Compare it to the failed one from v3.0.

> _**Key takeaway:** Compare this to Exercise 2's incident response. There, a bad deploy reached production, workflows started failing, and you had to manually roll back and evacuate. Here, the gate blocked the rollout before any customer was affected. After fixing the credentials and redeploying, the gate passed and traffic ramped automatically._

---

## Part D (Optional) - Testing with synthetic traffic

*__Covers:__ `Manual` rollout strategy, `Inactive` version state, `VersioningOverride` for pinned synthetic traffic*

Not every deployment involves a workflow code change. You might be updating a dependency, rotating credentials, or changing config. Before routing production traffic to the new build, you can test it on real infrastructure using pinned synthetic traffic.

> _**Why Manual?** The `Manual` strategy tells the controller to create the versioned Deployment and register the version with Temporal, but *not* automatically promote it. The version stays `Inactive` until you explicitly promote it. This gives you time to test._

1. No code changes are needed for this deploy. Build the 4.0 image as-is:

```bash
make build tag=4.0
```

   In a real deployment, this new image might contain an updated base image, a dependency bump, or a changed environment variable. The technique is the same regardless of what changed.

2. Update `k8s/valet-worker.yaml` - change the strategy to `Manual` and update the image tag to `4.0`:

   ```yaml
   rollout:
     strategy: Manual
   ```

   ```yaml
   image: valet-worker:4.0
   ```

3. Apply the updated manifest:

```bash
kubectl apply -f k8s/valet-worker.yaml
```

4. Watch the version state:

```bash
watch kubectl get twd
# Ctrl+C to stop watching
```

   v4.0 pods start, register with Temporal, and sit in the **Inactive** state. Production traffic continues flowing to v3.1 - the Manual strategy means the controller won't promote automatically. Note the build ID in the output (e.g., `4.0-9bd4`) - you'll need it in the next step.

> _**Think:** The version is `Inactive` - Temporal isn't routing any production traffic to it. How will this workflow reach v4.0's workers?_

5. Send synthetic traffic pinned to that version (replace the build ID with yours):

```bash
make run-synthetic BUILD_ID=4.0-XXXX
```

   This starts a single `ValetParkingWorkflow` pinned to v4.0 with a short 5-second trip. It runs the full workflow end-to-end on v4.0's workers (parks the car, waits, retrieves it, bills the customer) and waits for it to complete successfully.

6. Briefly open `valet/test_version.py` to see how pinning works - the key part is:

   ```python
   versioning_override=PinnedVersioningOverride(
       WorkerDeploymentVersion(deployment_name, build_id),
   ),
   ```

7. Verify in the Temporal UI at [http://localhost:8233](http://localhost:8233):
   - Find the `test-4.0-XXXX` workflow - it completed on v4.0
   - Meanwhile, load simulator workflows are still running on v3.1

> _**Key insight:** The `Inactive` state + `VersioningOverride` lets you test a new version with synthetic traffic before any production traffic touches it. The test workflow ran the full code path on real infrastructure (same namespace, same Temporal server, same task queue, same ParkingLotWorkflow), with no special test logic or sandbox environment needed. This works whether the deploy contains a code change, a dependency update, or just a config change._

> _**How would you promote?** We won't do this in the exercise, but for reference: the simplest way to promote is to change the strategy in `k8s/valet-worker.yaml` from `Manual` to `AllAtOnce` (or `Progressive`) and re-apply with `kubectl apply -f k8s/valet-worker.yaml`. The controller will then promote v4.0 automatically. You could also promote directly via the CLI with `temporal worker deployment set-current-version --deployment-name "default/valet-worker" --build-id 4.0-XXXX`, but be aware that manual CLI changes trigger the controller's [ownership model](https://github.com/temporalio/temporal-worker-controller/blob/main/docs/ownership.md), requiring you to hand control back afterward._

---

> _**Congratulations!** You've completed Exercise 3._