# Exercise 3: Deploying on K8s with the Worker Controller

**Theme:** "You've been managing versioning by hand. The Worker Controller automates all of that."
**Skills:** TemporalWorkerDeployment CRD, Progressive rollout, rainbow deployments, pre-deployment testing, gate workflows

### Summary

- **Part A:** Build and deploy v1.0 via a `TemporalWorkerDeployment` CRD (AllAtOnce strategy). Start load.
- **Part B:** Add `notify_owner` to the workflow (non-replay-safe). Switch the CRD to a Progressive rollout strategy. Deploy v2.0 - watch the controller ramp traffic 25% → 75% → 100% while 1.0 workers drain.
- **Part C:** Configure a gate workflow that checks downstream credentials. Deploy v3.0 with a bad billing API key - watch the gate block the rollout. Fix the credential, redeploy v3.1, and watch it pass.
- **Part D (Optional):** Deploy v4.0 with a Manual strategy so it stays Inactive. Send synthetic traffic pinned to v4.0, verify the workflow completes.

---

## Pre-Setup

Ensure `minikube`, `kubectl`, `helm`, and the `temporal` CLI are installed and available.

1. In a dedicated terminal, start the Temporal dev server:

```bash
temporal server start-dev
```

> **Note:** Starting a fresh dev server means we're working with a clean slate - no history from previous exercises. The code picks up where Exercise 2 left off, but we'll number our builds from 1.0 again so it's easy to track where we are in this exercise.

2. In a new terminal, navigate to the exercise directory and run setup (starts minikube, installs the Worker Controller CRDs and controller, and applies the Temporal connection config):

```bash
cd exercises/exercise-3/practice
make setup
```

---

## Part A - Deploy 1.0 and generate load

1. Ensure you're still in the `exercises/exercise-3/practice` directory from Pre-Setup.

2. Examine the k8s manifests:
   - `k8s/temporal-connection.yaml` - points to the host Temporal server
   - `k8s/valet-worker.yaml` - `TemporalWorkerDeployment` with `AllAtOnce` strategy

> **Note:** The initial manifest uses `AllAtOnce` - every replica cuts over immediately. This is fine for the first deploy, but for non-replay-safe changes you'll want a `Progressive` strategy so old and new versions coexist safely. We'll switch to that in Part B.

3. Build and deploy 1.0:

```bash
make build tag=1.0
kubectl apply -f k8s/valet-worker.yaml
```

4. Verify the TemporalWorkerDeployment exists, the controller created a versioned Deployment, and worker pods are Running:

```bash
kubectl get twd
kubectl get deployments
kubectl get pods
```

5. Start the load simulator:

```bash
make run-load-simulator
```

   Check the Temporal UI at [http://localhost:8233](http://localhost:8233) - workflows are flowing.

   **Leave the load simulator running.**

---

## Part B - Non-replay-safe change with Progressive rollout

**Scenario:** Add a notification when the owner's car is being retrieved. This adds a new activity call to the workflow sequence - a non-replay-safe change. With worker versioning (`PINNED` behavior), each version runs its own code, so the Worker Controller will keep 1.0 workers alive for in-flight workflows while ramping up 2.0 for new ones.

> **Why Progressive?** A Progressive rollout introduces the new version gradually - starting with a small percentage of new workflow executions, pausing to let you verify things are healthy, then ramping up. Meanwhile, in-flight workflows stay pinned to their original version. This is the **rainbow deployment model**: multiple versions coexist, each serving the workflows that belong to it.

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

4. Apply the updated manifest:

```bash
kubectl apply -f k8s/valet-worker.yaml
```

5. Watch the progressive rollout unfold:

```bash
kubectl get twd -w
```

   - 2.0 starts at **rampPercentage: 25%** - only 25% of *new* workflow executions go to 2.0
   - After 30s, ramps to **75%**
   - After another 30s, reaches **100%** - 2.0 becomes the Current Version

6. While the rollout progresses, observe the rainbow deployment in another terminal:

```bash
kubectl get deployments
```

   Both 1.0 and 2.0 Deployments run simultaneously:
   - **1.0 workers** continue serving in-flight workflows pinned to version 1.0
   - **2.0 workers** serve new workflow executions (at whatever the current ramp percentage is)

7. Verify in the Temporal UI at [http://localhost:8233](http://localhost:8233):
   - New workflows include a "Your car is being retrieved!" notification before the return trip
   - Older in-flight workflows complete without it
   - Over time, 1.0 workers scale down as their pinned workflows finish

> **Key insight:** The Worker Controller orchestrates the entire rainbow deployment automatically. You didn't need to manually manage traffic routing, scale replicas, or coordinate draining - just update the image tag and the controller handles the rest.

---

## Part C - Gate workflow

**Scenario:** Part B showed a Progressive rollout that ramps traffic automatically. But what if the new version has a problem? You want to catch it *before* any production traffic is affected. The Worker Controller's **gate workflow** automates pre-deployment checks: before any traffic ramps, the controller starts a workflow on the new version. If it fails, the rollout is blocked.

One possible use case for such a gate is verifying credentials after a secret rotation. Imagine you've rotated the billing service API key and deployed a new image with the updated secret. The gate workflow authenticates against the billing service to confirm the new credentials are valid - before any production traffic reaches the new version.

> **How it works:** When `spec.rollout.gate` is configured, the controller starts the gate workflow on the new version's workers while the version is still `Inactive`. Only after the gate workflow completes successfully does the controller begin ramping traffic. If the gate fails, the version stays `Inactive` and production is unaffected.

1. Open `valet/gate_workflow.py` and read through the `ValetGateWorkflow`. It runs connectivity checks against the downstream services the valet workflow depends on:

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

2. Open `valet/activities.py` and look at `check_billing_service`. It's currently rigged to simulate a misconfigured API key:

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

4. Build and deploy v3.0:

```bash
make build tag=3.0
kubectl apply -f k8s/valet-worker.yaml
```

5. Watch the version state:

```bash
kubectl get twd -w
```

   v3.0 pods start and register, but the gate workflow **fails**. The version stays `Inactive` - no production traffic is affected.

6. Find the failed gate workflow in the Temporal UI at [http://localhost:8233](http://localhost:8233). Open it and look at the error: `Billing service: invalid API key`. This is exactly what would happen if a rotated secret was misconfigured.

> **Key observation:** Production traffic is still flowing to v2.0. The gate caught the bad credential before any routing change happened.

7. Now fix the activity. In `valet/activities.py`, replace the `raise` in `check_billing_service` with a passing check:

   ```python
   @activity.defn
   async def check_billing_service() -> str:
       """Verify credentials for the billing service are valid."""
       activity.logger.info("Billing service: credentials valid")
       return "ok"
   ```

8. Rebuild and redeploy with a new image tag:

```bash
make build tag=3.1
```

9. Update `k8s/valet-worker.yaml` to use the fixed image:

   ```yaml
   image: valet-worker:3.1
   ```

10. Apply:

```bash
kubectl apply -f k8s/valet-worker.yaml
```

11. Watch the rollout this time:

```bash
kubectl get twd -w
```

   Observe the sequence:
   1. v3.1 pods start and register with Temporal (Inactive)
   2. The controller starts a `ValetGateWorkflow` on v3.1
   3. The gate checks the notification service - passes
   4. The gate checks the billing service - passes this time
   5. The gate completes successfully
   6. Ramping begins (25% -> 75% -> 100%)

12. Find the successful gate workflow in the Temporal UI. Compare it to the failed one from v3.0.

> **Key takeaway:** Instead of running a test script and promoting by hand, the controller runs the gate workflow before any routing changes. When the billing credentials were bad, the gate blocked the rollout and production was unaffected. After fixing the credentials and redeploying, the gate passed and traffic ramped automatically.

---

## Part D (Optional) - Testing with synthetic traffic

**Scenario:** Not every deployment involves a workflow code change. You might be updating a dependency, applying a security patch, rotating credentials, or changing an environment variable. Whatever the reason, you want to verify the new build works before routing production traffic to it. Worker Versioning's `Inactive` state is designed for exactly this: workers are polling but only receive workflows explicitly pinned to them via `VersioningOverride`. By combining a `Manual` rollout strategy with pinned synthetic traffic, you can test a new version on real infrastructure without touching production traffic.

> **Why Manual?** The `Manual` strategy tells the controller to create the versioned Deployment and register the version with Temporal, but *not* automatically promote it. The version stays `Inactive` until you explicitly promote it. This gives you time to test.

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
kubectl get twd -w
```

   v4.0 pods start, register with Temporal, and sit in the **Inactive** state. Production traffic continues flowing to v3.1 - the Manual strategy means the controller won't promote automatically. Note the build ID in the output (e.g., `4.0-9bd4`) - you'll need it in the next step.

5. Send synthetic traffic pinned to that version (replace the build ID with yours):

```bash
make run-synthetic BUILD_ID=4.0-XXXX
```

   This starts a single `ValetParkingWorkflow` pinned to v4.0 with a short 5-second trip. It runs the full workflow end-to-end on v4.0's workers (parks the car, waits, retrieves it, bills the customer) and waits for it to complete successfully.

   Open `valet/test_version.py` to see how pinning works - the key part is:

   ```python
   versioning_override=PinnedVersioningOverride(
       WorkerDeploymentVersion(deployment_name, build_id),
   ),
   ```

6. Verify in the Temporal UI at [http://localhost:8233](http://localhost:8233):
   - Find the `test-4.0-XXXX` workflow - it completed on v4.0
   - Meanwhile, load simulator workflows are still running on v3.1

> **Key insight:** The `Inactive` state + `VersioningOverride` lets you test a new version with synthetic traffic before any production traffic touches it. The test workflow ran the full code path on real infrastructure (same namespace, same Temporal server, same task queue, same ParkingLotWorkflow), with no special test logic or sandbox environment needed. This works whether the deploy contains a code change, a dependency update, or just a config change.

> **How would you promote?** We won't do this in the exercise, but for reference: the simplest way to promote is to change the strategy in `k8s/valet-worker.yaml` from `Manual` to `AllAtOnce` (or `Progressive`) and re-apply with `kubectl apply -f k8s/valet-worker.yaml`. The controller will then promote v4.0 automatically. You could also promote directly via the CLI with `temporal worker deployment set-current-version --deployment-name "default/valet-worker" --build-id 4.0-XXXX`, but be aware that manual CLI changes trigger the controller's [ownership model](https://github.com/temporalio/temporal-worker-controller/blob/main/docs/ownership.md), requiring you to hand control back afterward.

---

> **🎉 Congratulations!** You've completed Exercise 3.
