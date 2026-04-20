---
slug: gate-workflow
id: ""
type: challenge
title: "Gate Workflow"
teaser: "Block bad deploys before they take traffic with a pre-deployment gate"
tabs:
- type: terminal
  title: Terminal 1
  hostname: workstation
- type: terminal
  title: Terminal 2
  hostname: workstation
- type: terminal
  title: Load Simulator
  hostname: workstation
- type: code
  title: Code Editor
  hostname: workstation
  path: /root/temporal-versioning-workshop/exercises/3-worker-controller/practice
- type: service
  title: Temporal UI
  hostname: workstation
  port: 8233
difficulty: intermediate
timelimit: 1500
---

# Part C - Gate workflow

Progressive rollouts ramp traffic automatically, but what if the new version has a problem? In Exercise 2, a bad deploy hit production and you had to scramble to roll back. A gate workflow catches problems *before* any production traffic is affected.

One possible use case for such a gate is verifying credentials after a secret rotation. Imagine you've rotated the billing service API key and deployed a new image with the updated secret. The gate workflow authenticates against the billing service to confirm the new credentials are valid - before any production traffic reaches the new version.

> *__How it works:__ When `spec.rollout.gate` is configured, the controller starts the gate workflow on the new version's workers while the version is still `Inactive`. Only after the gate workflow completes successfully does the controller begin ramping traffic. If the gate fails, the version stays `Inactive` and production is unaffected.*

1. Briefly open `valet/gate_workflow.py` in the **Code Editor** and read through the `ValetGateWorkflow`. It runs connectivity checks against the downstream services the valet workflow depends on:

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

2. Briefly open `valet/activities.py` in the **Code Editor** and look at `check_billing_service`. It's currently rigged to simulate a misconfigured API key:

   ```python
   raise ApplicationError(
       "Billing service: invalid API key",
       type="InvalidCredentials",
       non_retryable=True,
   )
   ```

   The error is raised as a non-retryable `ApplicationError` so the activity fails immediately instead of retrying forever. A bad credential is a permanent failure, not a transient one.

   Leave this in place for now - we want to see the gate catch it.

3. Update `k8s/valet-worker.yaml` in the **Code Editor** - switch to `Progressive` strategy with a `gate`, and update the image tag to `3.0`:

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

> *__Think:__ The gate workflow checks billing credentials, and you know those credentials are bad. What should happen to production traffic when you apply this manifest?*

4. Build and deploy v3.0 (in the **Terminal 1** tab):

```bash
make build tag=3.0
kubectl apply -f k8s/valet-worker.yaml
```

5. Verify in the **Temporal UI** tab:
   - Open the **Deployments** tab - v3.0 should show as `Inactive`. Production traffic is still routing to v2.0.
   - Find the failed gate workflow and open it - the error shows `Billing service: invalid API key`. This is exactly what would happen if a rotated secret was misconfigured.

> *__Key observation:__ Production traffic is still flowing to v2.0. Unlike the Exercise 2 incident where the bad deploy hit live traffic before you could respond, the gate caught the bad credential before any routing change happened.*

6. Now fix the activity. In the **Code Editor**, open `valet/activities.py` and replace the `raise` in `check_billing_service` with a passing check:

   ```python
   @activity.defn
   async def check_billing_service() -> str:
       """Verify credentials for the billing service are valid."""
       activity.logger.info("Billing service: credentials valid")
       return "ok"
   ```

7. Rebuild with a new image tag (in the **Terminal 1** tab):

```bash
make build tag=3.1
```

8. Update `k8s/valet-worker.yaml` in the **Code Editor** to use the fixed image:

   ```yaml
   image: valet-worker:3.1
   ```

9. Apply (in the **Terminal 1** tab):

```bash
kubectl apply -f k8s/valet-worker.yaml
```

10. Watch the rollout this time (in the **Terminal 2** tab):

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

11. Find the successful gate workflow in the **Temporal UI** tab. Compare it to the failed one from v3.0.

> *__Key takeaway:__ Compare this to Exercise 2's incident response. There, a bad deploy reached production, workflows started failing, and you had to manually roll back and evacuate. Here, the gate blocked the rollout before any customer was affected. After fixing the credentials and redeploying, the gate passed and traffic ramped automatically.*
