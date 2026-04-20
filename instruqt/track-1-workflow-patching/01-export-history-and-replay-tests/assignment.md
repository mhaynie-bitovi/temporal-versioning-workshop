---
slug: export-history-and-replay-tests
id: ""
type: challenge
title: "Export History and Write Replay Tests"
teaser: "Establish a replay-test safety net for the current v1.0 workflow"
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

# Part A - Export workflow history, and write a replay test

Before making any changes, you'll establish a safety net. Run the current v1.0 workflow, capture a completed workflow's history, and set up a replay test that verifies the code is compatible with that history.

> **Note:** The Temporal dev server is already running in the background. Your terminals start in the exercise's `practice/` directory with the Python virtual environment activated.

1. Examine `valet/valet_parking_workflow.py` in the **Code Editor** tab. Note the command sequence:
   - `request_parking_space` → `move_car` (to parking space) → `sleep` → `move_car` (back) → `release_parking_space`
   - The `sleep` simulates the owner's trip - workflows will be "in flight" during this window.

2. Start the worker (in the **Worker** tab):

```bash
make run-worker
```

> *Keep this worker running - you'll be instructed when to restart it later.*

3. Start a single workflow (in the **Terminal** tab):

```bash
make run-starter
```

   Note the workflow ID in the output (e.g. `valet-CA-1ABC123`). Wait for it to complete (about 30 seconds). You can check its status in the **Temporal UI** tab.

4. Export the completed workflow's history:

```bash
temporal workflow show --workflow-id <WORKFLOW ID HERE> --output json > history/valet_v1_history.json
```

5. Briefly open `history/valet_v1_history.json` in the **Code Editor** and skim the exported history. Each entry in the `events` array represents something the workflow did - starting activities, recording results, firing timers, etc. This is the sequence of commands the replayer will compare against your code.

6. Briefly open `tests/test_replay.py` and review the replay test. It loads the history you just captured and replays it against the current workflow code. If the code produces a different command sequence than the history, the test fails with a non-determinism error (NDE).

7. Run the test - it should **pass**, confirming the replay infrastructure works:

```bash
make run-tests
```
