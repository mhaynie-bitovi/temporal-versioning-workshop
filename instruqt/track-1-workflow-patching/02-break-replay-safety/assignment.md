---
slug: break-replay-safety
id: ""
type: challenge
title: "Add a New Activity and Break Replay"
teaser: "See what happens when a non-replay-safe change hits the replay test"
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

# Part B - Add a new activity and break replay

Now we need to ship the feature. A `notify_owner` activity is already defined. Your job is to call it from the workflow - and see what happens when the replay test catches the incompatibility.

1. In the **Code Editor**, open `valet/valet_parking_workflow.py`. Find the `TODO (Part B)` comment and **uncomment** the `notify_owner` activity call below it. The result should look like this:

```python
# Notify the owner their car is being parked
await workflow.execute_activity(
    notify_owner,
    NotifyOwnerInput(
        license_plate=input.license_plate,
        message="Your car is being parked!",
    ),
    start_to_close_timeout=timedelta(seconds=10),
)
```

> *__Think:__ You just added a new activity call after `request_parking_space`. The captured history doesn't have that command. What will the replayer do when the new code produces a command the history doesn't expect?*

2. Run the replay test - **it fails** with a non-determinism error (in the **Terminal** tab):

```bash
make run-tests
```

   **That error is exactly what would happen in production.** If you deployed this change, every in-flight workflow that replayed against the new code would fail with this same error. Not just one - every workflow that started before your deploy. The replay test caught it before it got that far.
