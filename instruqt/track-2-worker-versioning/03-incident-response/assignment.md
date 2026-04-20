---
slug: incident-response
id: ""
type: challenge
title: "When a Bad Deploy Hits Production"
teaser: "Roll back, evacuate stuck workflows, and fix forward in seconds"
tabs:
- type: terminal
  title: Worker v2.0
  hostname: workstation
- type: terminal
  title: Worker v3.x
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
timelimit: 1800
---

# Part C - When a Bad Deploy Hits Production

Everything is humming along. Billing shipped cleanly with zero patching. The v1.0 worker drained and shut down on its own. You're feeling good about versioning.

Then you add a tip calculation to the billing activity. Quick change, no big deal. You deploy v3.0, set it as current, and go back to what you were doing.

A minute later, you glance at the Web UI. Red everywhere. Every new workflow is hitting the billing step and failing. You check the worker logs: `AttributeError`, over and over.

You made a typo. You referenced `input.tip_percentage`, a field that doesn't exist. And it's live. You need to act *now*.

## The bad deploy

1. **Introduce the bug.** In the **Code Editor**, open `valet/activities.py` and add this line to the beginning of `bill_customer`:

   ```python
   @activity.defn
   async def bill_customer(input: BillCustomerInput) -> BillCustomerOutput:
       # ... rest of the function
       tip = input.tip_percentage  # BUG: tip_percentage doesn't exist on BillCustomerInput
       # ... rest of the function
   ```

   This will cause an `AttributeError` every time billing runs.

2. Start a 3.0 worker (in the **Worker v3.x** tab):

```bash
make run-worker BUILD_ID=3.0
```

> *__Think:__ The load simulator is still running. What happens to new workflows the instant you run the next command?*

3. Set 3.0 as current (in the **Terminal** tab):

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 3.0 \
    --yes
```

4. **Watch the damage.** Open the **Temporal UI** tab. New workflows are starting on 3.0, hitting the billing step, and failing. Look at the worker logs in the **Worker v3.x** tab - you'll see `AttributeError` on every billing attempt, retrying forever.

5. **Check the damage** (in the **Terminal** tab):

```bash
temporal workflow list \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"'
```

   Each of these workflows is failing in a retry loop.

## Stop the bleeding

The fastest possible response: redirect new traffic away from the broken version. No code redeploy, no CI pipeline, no waiting. One command.

6. Set v2.0 back as current:

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 2.0 \
    --yes
```

7. **Verify it worked** in the **Temporal UI** tab - new workflows should now be starting on v2.0 with working billing. That took seconds, not minutes.

   But look closer. The workflows that already started on v3.0 are still there, still failing. They're PINNED to v3.0 - new traffic is safe, but those in-flight workflows are stuck.

## Rescue the stuck workflows

8. Evacuate them all to v2.0 in one command:

```bash
temporal workflow update-options \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"' \
    --versioning-override-behavior pinned \
    --versioning-override-deployment-name valet \
    --versioning-override-build-id 2.0 \
    --yes
```

   > *__Why is this replay-safe?__ The workflow code between v2.0 and v3.0 is identical - the bug is in the activity implementation, not the workflow definition. The v2.0 worker replays the workflow history, reaches the billing step, and calls the working v2.0 `bill_customer`. Failed activity attempts in history don't cause replay errors - the workflow just sees "activity not yet completed" and retries.*

9. **Watch them recover** in the **Temporal UI** tab. The workflows that were stuck on v3.0 are now completing successfully on v2.0.

   Run the same query from step 5 again:

```bash
temporal workflow list \
    --query 'WorkerDeploymentVersion="valet:3.0" AND ExecutionStatus="Running"'
```

   Zero results. Every stuck workflow has been rescued.

## Fix forward

Rollback bought you time. Now ship the fix.

10. **Fix the bug.** In the **Code Editor**, open `valet/activities.py` and remove the `tip = input.tip_percentage` line you added in step 1.

    ```python
    @activity.defn
    async def bill_customer(input: BillCustomerInput) -> BillCustomerOutput:
        # simply remove/comment out the bug you introduced in this function
    ```

11. Stop the v3.0 worker (Ctrl+C in the **Worker v3.x** tab) and start v3.1:

```bash
make run-worker BUILD_ID=3.1
```

12. Set v3.1 as current (in the **Terminal** tab):

```bash
temporal worker deployment set-current-version \
    --deployment-name valet \
    --build-id 3.1 \
    --yes
```

New workflows now flow through v3.1 with working billing. Incident resolved.

> *__Recap what just happened.__ A bad deploy hit production. Within seconds, you redirected new traffic (no redeploy). Then you bulk-rescued every stuck workflow (one command). Then you shipped a fix. Total production impact: the time it took you to notice and type two commands. That's the power of version routing at the infrastructure level.*

## Clean up

13. **Stop the v3.0 worker** (Ctrl+C) if still running.

14. Once v2.0 has fully drained, **stop the v2.0 worker** (Ctrl+C in the **Worker v2.0** tab) as well.
