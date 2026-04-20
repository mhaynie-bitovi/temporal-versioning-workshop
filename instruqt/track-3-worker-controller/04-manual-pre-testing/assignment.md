---
slug: manual-pre-testing
id: ""
type: challenge
title: "Testing with Synthetic Traffic (Optional)"
teaser: "Pre-test a version with pinned synthetic traffic before promotion"
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

# Part D (Optional) - Testing with synthetic traffic

Not every deployment involves a workflow code change. You might be updating a dependency, rotating credentials, or changing config. Before routing production traffic to the new build, you can test it on real infrastructure using pinned synthetic traffic.

> *__Why Manual?__ The `Manual` strategy tells the controller to create the versioned Deployment and register the version with Temporal, but *not* automatically promote it. The version stays `Inactive` until you explicitly promote it. This gives you time to test.*

1. No code changes are needed for this deploy. Build the 4.0 image as-is (in the **Terminal 1** tab):

```bash
make build tag=4.0
```

   In a real deployment, this new image might contain an updated base image, a dependency bump, or a changed environment variable. The technique is the same regardless of what changed.

2. Update `k8s/valet-worker.yaml` in the **Code Editor** - change the strategy to `Manual` and update the image tag to `4.0`:

   ```yaml
   rollout:
     strategy: Manual
   ```

   ```yaml
   image: valet-worker:4.0
   ```

3. Apply the updated manifest (in the **Terminal 1** tab):

```bash
kubectl apply -f k8s/valet-worker.yaml
```

4. Watch the version state (in the **Terminal 2** tab):

```bash
kubectl get twd -w
```

   v4.0 pods start, register with Temporal, and sit in the **Inactive** state. Production traffic continues flowing to v3.1 - the Manual strategy means the controller won't promote automatically. Note the build ID in the output (e.g., `4.0-9bd4`) - you'll need it in the next step.

> *__Think:__ The version is `Inactive` - Temporal isn't routing any production traffic to it. How will this workflow reach v4.0's workers?*

5. Send synthetic traffic pinned to that version (replace the build ID with yours, in the **Terminal 1** tab):

```bash
make run-synthetic BUILD_ID=4.0-XXXX
```

   This starts a single `ValetParkingWorkflow` pinned to v4.0 with a short 5-second trip. It runs the full workflow end-to-end on v4.0's workers (parks the car, waits, retrieves it, bills the customer) and waits for it to complete successfully.

6. Briefly open `valet/test_version.py` in the **Code Editor** to see how pinning works - the key part is:

   ```python
   versioning_override=PinnedVersioningOverride(
       WorkerDeploymentVersion(deployment_name, build_id),
   ),
   ```

7. Verify in the **Temporal UI** tab:
   - Find the `test-4.0-XXXX` workflow - it completed on v4.0
   - Meanwhile, load simulator workflows are still running on v3.1

> *__Key insight:__ The `Inactive` state + `VersioningOverride` lets you test a new version with synthetic traffic before any production traffic touches it. The test workflow ran the full code path on real infrastructure (same namespace, same Temporal server, same task queue, same ParkingLotWorkflow), with no special test logic or sandbox environment needed. This works whether the deploy contains a code change, a dependency update, or just a config change.*

> *__How would you promote?__ We won't do this in the exercise, but for reference: the simplest way to promote is to change the strategy in `k8s/valet-worker.yaml` from `Manual` to `AllAtOnce` (or `Progressive`) and re-apply with `kubectl apply -f k8s/valet-worker.yaml`. The controller will then promote v4.0 automatically. You could also promote directly via the CLI with `temporal worker deployment set-current-version --deployment-name "default/valet-worker" --build-id 4.0-XXXX`, but be aware that manual CLI changes trigger the controller's [ownership model](https://github.com/temporalio/temporal-worker-controller/blob/main/docs/ownership.md), requiring you to hand control back afterward.*

---

> **Congratulations!** You've completed the Worker Controller track.
