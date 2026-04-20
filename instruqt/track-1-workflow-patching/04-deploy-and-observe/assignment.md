---
slug: deploy-and-observe
id: ""
type: challenge
title: "Deploy and Observe"
teaser: "Watch workflow.patched() handle old and new workflows on a single worker"
tabs:
- type: terminal
  title: Worker
  hostname: workstation
- type: terminal
  title: Terminal
  hostname: workstation
- type: code
  title: Code Editor
  hostname: workstation
  path: /root/temporal-versioning-workshop/exercises/1-workflow-patching/practice
- type: service
  title: Temporal UI
  hostname: workstation
  port: 8233
difficulty: basic
timelimit: 1200
---

# Part D - See it in action

With the patch in place, a single worker can now handle both old and new workflows. You'll create a pre-patch workflow, restart the worker with the patched code, and watch it handle both correctly.

The worker you started in Part A is still running the **original v1.0 code**. Even though you edited the file in Parts B and C, the running Python process loaded the workflow at startup and doesn't see your changes. We'll use this to create a "pre-patch" workflow, then restart the worker to pick up the patched code and watch a **single worker** handle both old and new executions correctly.

1. With the **old worker still running** (in the **Worker** tab), start a workflow in the **Terminal** tab:

```bash
make run-starter
```

   Note the workflow ID (e.g. `valet-CA-1ABC123`). This is your **pre-patch workflow**.

2. Immediately **stop the old worker** (Ctrl+C in the **Worker** tab) and restart it to pick up your patched code:

```bash
make run-worker
```

3. Start a **second** workflow (in the **Terminal** tab):

```bash
make run-starter
```
   Note the workflow ID (e.g. `valet-CA-1ABC123`). This is your **post-patch workflow**.

4. Open the **Temporal UI** tab. Find both workflow executions and open their detail pages side by side so you can compare their event histories. They should both complete within about 30 seconds.

5. Compare the two executions. The same worker handled both, but the histories differ:

   - **Pre-patch workflow:** Completes **without** `notify_owner`. When the new worker replayed this workflow's history, it found no patch marker, so `workflow.patched()` returned `False` and the notification block was skipped. You won't see a `notify_owner` activity in this history.
   - **Post-patch workflow:** Includes `notify_owner` right after `request_parking_space`. This was a fresh execution, so `workflow.patched()` returned `True`, wrote a marker into the history, and ran the notification activity. You'll see the extra `notify_owner` activity in this history.

   Notice how a single deploy of the same code produced two different execution paths. That's the power of `workflow.patched()` - it lets one worker safely handle both old and new workflows without breaking replay.

6. Stop the worker when you're satisfied (Ctrl+C).

> *__Looking ahead:__ The notification feature is shipped and working. Durable execution is humming along again. But notice the cost: you added a conditional branch to the workflow. Durability demands that your code stay compatible with open execution, so every future non-replay-safe change adds another branch. Over time, long-lived workflows accumulate layers of `if workflow.patched(...)` blocks. In Exercise 2, you'll see how Worker Versioning can eliminate patching entirely for most workflows.*

---

> **Congratulations!** You've completed the Workflow Patching track.
