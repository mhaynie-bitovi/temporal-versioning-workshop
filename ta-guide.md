# TA Guide - Temporal Versioning Workshop

This is a reference for teaching assistants (TAs) helping with the Temporal Versioning Workshop at Replay 2026.

## Your Role

- You are here to **unblock attendees** and **answer questions about the workshop material**.
- For deep architectural questions, SDK internals, or questions beyond the scope of this workshop, **redirect attendees to the Ask-an-Expert booth**.

## Before the Workshop

- [ ] **Complete all three Instruqt tracks (~1.5 hr total)** 
    - You can do this on your own, or during one of the scheduled dry-runs (see below).
    - You need first-hand experience with every exercise so you can help attendees when they get stuck.
    - [Instruqt Course Invite Link](https://play.instruqt.com/temporal/invite/xzsynkjh2ecy)
- [ ] **Review this cheat sheet** so you're comfortable with the Temporal concepts covered.
- [ ] (Optionally) Review the presentation slides (COMMING SOON), and give any feedback.
- [ ] (Optionally) Attend one of the 2 dry-runs:
    - Tuesday, April 28th (9:30 - 12:30 CDT)
    - Thursday, April 30th (2:00 - 5:00 CDT)

## During the Workshop

Be ready to answer questions and help attendees with any issues they face while working through the exercises. Circulate the room, look for raised hands or confused faces, and proactively check in with people who seem stuck. If multiple attendees hit the same issue, flag it to the instructor so they can address it for the whole room.

## Temporal Concepts Cheat Sheet

These are the key Temporal concepts covered in the workshop. Follow the links for more detail.

- **Durable execution and replay** - Workflows survive crashes by replaying code from the beginning, comparing Commands against stored Events. Mismatches cause Non-Determinism Errors (NDEs). ([Deterministic constraints](https://docs.temporal.io/workflow-definition#deterministic-constraints))
- **Non-replay-safe changes** - Adding/removing/reordering activities, timers, or child workflows changes the Command sequence and breaks replay for in-flight workflows. Changing activity implementations, timeouts, or arguments is safe. ([Code changes and non-determinism](https://docs.temporal.io/workflow-definition#code-changes-can-cause-non-deterministic-behavior))
- **Workflow patching** (`workflow.patched()`) - Branches execution so old workflows skip new code and new workflows run it. One worker handles both. ([Python patching docs](https://docs.temporal.io/develop/python/workflows/versioning#patching))
- **Worker Versioning** - Declare `PINNED` or `AUTO_UPGRADE` behavior per workflow type. Temporal routes tasks to the correct worker version. ([Worker Versioning concepts](https://docs.temporal.io/worker-versioning))
- **PINNED vs AUTO_UPGRADE** - PINNED workflows stay on their original version (no patching needed). AUTO_UPGRADE workflows move to the latest version on their next task (still requires patching for non-replay-safe changes). ([Versioning behaviors](https://docs.temporal.io/worker-versioning#versioning-behaviors))
- **Version lifecycle** - Versions progress through Inactive, Active, Draining, and Drained statuses. ([Versioning statuses](https://docs.temporal.io/worker-versioning#versioning-statuses))
- **Rainbow deployments** - Multiple worker versions coexist simultaneously; old versions drain as pinned workflows complete. ([Worker Versioning in production](https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning))
- **Emergency remediation** - Instant rollback via `set-current-version`, bulk evacuation of stuck workflows via `update-options`, then fix-forward with a new version. ([CLI: update-options](https://docs.temporal.io/cli/workflow#update-options))
- **Worker Controller** - A Kubernetes operator that automates versioned deployments via a `TemporalWorkerDeployment` CRD, supporting `AllAtOnce`, `Progressive`, and `Manual` rollout strategies, gate workflows, and `VersioningOverride` for synthetic testing. ([Worker Controller repo](https://github.com/temporalio/temporal-worker-controller))

## Common Instruqt Platform Issues

| Issue | What to Do |
|---|---|
| Instruqt environment won't load | The first 2 tracks can take a couple minutes to load. The 3rd on can take up to 5 minutes. Try refreshing. If still broken, escalate to the on-site Instruqt support resource |
| Temporal UI tab shows a blank page | Click the refresh button at the TOP of the Temporal UI tab (not the browser refresh). The browser refresh can break the Instruqt session |
| **Avoid refreshing the host browser tab** | This can interrupt ongoing terminal commands. Use the refresh buttons inside the Instruqt env, or inside the Temporal Web UI instead. |

## Escalation Paths

- **Instruqt platform issues** (environment won't load, tabs broken, timeouts): Escalate to the on-site Instruqt support resource.
- **Deep Temporal questions** (SDK internals, production architecture, advanced patterns): Redirect to the Ask-an-Expert booth.
- **Workshop content bugs** (typos, incorrect instructions, broken code): Note them down and report to the workshop lead after the session.
