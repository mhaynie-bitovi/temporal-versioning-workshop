---
slug: progressive-rollout
id: ""
type: challenge
title: "Non-replay-safe Change with Progressive Rollout"
teaser: "Ship a breaking change with gradual traffic ramping and automatic draining"
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
difficulty: basic
timelimit: 1500
---

# Part B - Non-replay-safe change with Progressive rollout

Another feature request: notify car owners when their car is being retrieved. This is a non-replay-safe change. Instead of cutting over all at once, you'll use a Progressive rollout to ramp traffic gradually while old workflows complete on their original version.

> *__Why Progressive?__ A Progressive rollout introduces the new version gradually - starting with a small percentage of new workflow executions, pausing to let you verify things are healthy, then ramping up. Meanwhile, in-flight workflows stay pinned to their original version. This is the **rainbow deployment model**: multiple versions coexist, each serving the workflows that belong to it.*

1. Make the code change in the **Code Editor** - open `valet/valet_parking_workflow.py` and add a `notify_owner` call after the sleep (when the car is being retrieved), right before the move back to the valet zone:

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

2. Build the 2.0 image (in the **Terminal 1** tab):

```bash
make build tag=2.0
```

3. Update `k8s/valet-worker.yaml` in the **Code Editor** - change the strategy from `AllAtOnce` to `Progressive` with ramp steps, and update the image tag to `2.0`:

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

> *__Think:__ You're applying a Progressive strategy with 25% as the first ramp step. What percentage of *currently in-flight* v1.0 workflows will move to v2.0? (Hint: they're PINNED.)*

4. Apply the updated manifest (in the **Terminal 1** tab):

```bash
kubectl apply -f k8s/valet-worker.yaml
```

5. Watch the progressive rollout unfold (in the **Terminal 2** tab):

```bash
kubectl get twd -w
```

   - 2.0 starts at **rampPercentage: 25%** - only 25% of *new* workflow executions go to 2.0
   - After 30s, ramps to **75%**
   - After another 30s, reaches **100%** - 2.0 becomes the Current Version

6. While the rollout progresses, observe the rainbow deployment in the **Terminal 1** tab:

```bash
kubectl get deployments
```

   Both 1.0 and 2.0 Deployments run simultaneously:
   - **1.0 workers** continue serving in-flight workflows pinned to version 1.0
   - **2.0 workers** serve new workflow executions (at whatever the current ramp percentage is)

7. Verify in the **Temporal UI** tab:
   - New workflows include a "Your car is being retrieved!" notification before the return trip
   - Older in-flight workflows complete without it
   - Over time, 1.0 workers scale down as their pinned workflows finish

> *__Key insight:__ The Worker Controller orchestrates the entire rainbow deployment automatically. In Exercise 2, you managed all of this by hand - starting workers, running `set-current-version`, watching for draining, stopping old workers. Here, you updated the image tag and the controller handled the rest.*

> *The `sunset` section in the manifest controls when drained versions are cleaned up. `scaledownDelay` sets how long to wait after draining before scaling to zero, and `deleteDelay` sets how long before the versioned Deployment is deleted entirely. Without these, old versions hang around indefinitely.*
