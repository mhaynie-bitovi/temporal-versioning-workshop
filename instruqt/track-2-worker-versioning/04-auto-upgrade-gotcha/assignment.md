---
slug: auto-upgrade-gotcha
id: ""
type: challenge
title: "The AUTO_UPGRADE Catch (Optional)"
teaser: "Discover why AUTO_UPGRADE workflows still need patching"
tabs:
- type: terminal
  title: Worker
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
difficulty: intermediate
timelimit: 1200
---

# Part D (Optional) - The AUTO_UPGRADE Catch

In Parts A-C, `PINNED` versioning meant no patching. But `ParkingLotWorkflow` uses `AUTO_UPGRADE` - when a new version becomes `Current`, it automatically migrates. That means it replays its existing history against your new code. If the commands don't match, you get an NDE.

Let's see it happen.

## Make a non-replay-safe change to ParkingLotWorkflow

1. In the **Code Editor**, open `valet/parking_lot_workflow.py` and add a 2-second warm-up delay after the parking spaces are initialized:

   ```python
   # Warm-up delay: let external systems sync before accepting requests
   await workflow.sleep(2)
   ```

   This is a non-replay-safe change: it adds a timer command that doesn't exist in the workflow's current history.

## Deploy and watch it break

2. Start a v4.0 worker (in the **Worker** tab):

```bash
make run-worker BUILD_ID=4.0
```

> *__Think:__ `ParkingLotWorkflow` is AUTO_UPGRADE. What happens to it when a new version becomes Current?*

3. **Set v4.0 as current** (in the **Terminal** tab):

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 4.0 \
    --yes
```

4. **Watch the worker logs** in the **Worker** tab. The `ParkingLotWorkflow` auto-upgrades to v4.0 and immediately hits a non-determinism error (NDE). The v4.0 code expects a timer (the 2-second sleep), but the existing history doesn't have one.

   > *__Wait - didn't versioning eliminate patching?__ Only for **PINNED** workflows. PINNED workflows never replay old history against new code because they stay on their original version. AUTO_UPGRADE workflows *do* replay old history against new code - that's the whole point of auto-upgrading. So AUTO_UPGRADE still requires patching for non-replay-safe changes, just like the unversioned worker in Exercise 1.*

## Fix it with a patch

5. In the **Code Editor**, open `valet/parking_lot_workflow.py` and wrap the sleep in `workflow.patched()`:

   ```python
    # Warm-up delay: let external systems sync before accepting requests
    if workflow.patched("add-warmup-delay"):
       await workflow.sleep(2)
   ```

6. **Stop the v4.0 worker** (Ctrl+C in the **Worker** tab) and start v4.1:

```bash
make run-worker BUILD_ID=4.1
```

7. Set v4.1 as current (in the **Terminal** tab):

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 4.1 \
    --yes
```

8. **Observe:** `ParkingLotWorkflow` auto-upgrades to v4.1. This time, `workflow.patched("add-warmup-delay")` returns `False` during replay (no patch marker in the old history), so the sleep is skipped. The workflow continues without an NDE. Future runs (after `continue_as_new`) will include the sleep.

> *__The takeaway:__ PINNED eliminates patching. AUTO_UPGRADE does not. When an AUTO_UPGRADE workflow migrates to new code, it replays its history - so the new code must be replay-compatible. Patching is still the tool for that.*

## Aside: Upgrade on Continue as New (or "trampolining")

**But notice something.** `ParkingLotWorkflow` uses `continue_as_new`. After the auto-upgrade, the *current run* replays with the patch guard. But the *next run* (after `continue_as_new`) starts fresh on v4.1 with no prior history to conflict with. The patch only matters during the transition of the current run. In a production workflow with frequent `continue_as_new` boundaries, these patches are naturally short-lived - they're only needed for the one run that bridges the version change.

This is the core insight behind **trampolining** (upgrade on continue-as-new): if you made `ParkingLotWorkflow` PINNED instead of AUTO_UPGRADE, each run would complete on its original version with zero patching. At the `continue_as_new` boundary, the new run could start on the latest version. No patching, ever - just a clean handoff at the seam.

---

> **Congratulations!** You've completed the Worker Versioning track.
