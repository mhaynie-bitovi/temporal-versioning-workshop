---
slug: patch-for-safety
id: ""
type: challenge
title: "Patch the Workflow"
teaser: "Fix the non-replay-safe change with workflow.patched()"
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

# Part C - Patch the workflow

The replay test caught the problem before it reached production. Now we'll fix it using `workflow.patched()`. This tells Temporal: "this code is newer." In-flight workflows will skip it, while workflows started after the deploy will run it.

1. In the **Code Editor**, open `valet/valet_parking_workflow.py`. Wrap the new activity call with `workflow.patched()`:

```python
if workflow.patched("add-notify-owner"):
    await workflow.execute_activity(
        notify_owner,
        NotifyOwnerInput(
            license_plate=input.license_plate,
            message="Your car is being parked!",
        ),
        start_to_close_timeout=timedelta(seconds=10),
    )
```

2. Run the replay test - **it passes** (in the **Terminal** tab):

```bash
make run-tests
```
