# Workshop Plan

## Format Plan (3.5 hrs)

* 3 30-minute exercises (via instruqt)
* 1 30-minute break (3:00 - 3:30)
* Content/slides between

## Content Plan

* Modeled on the learning objectives of the Workflow/Worker Versioning Courses (LMS)
* Targeting intermediate/expert temporal devs
* Focus mostly on worker-versioning, but cover/review patching - it's still a critical skill with auto-upgrade behavior
* Called out areas of interest:
    * workflow replay testing
    * patching workflows with auto-upgrade behavior
    * pinned workflows (vs auto-upgrade)
    * Upgrade-on-Continue-as-New strategy ("trampolining")
    * emergency remediation techniques
    * worker controller

## Exercise Plan (via Instruqt)

Three exercises, each broken into multiple parts.

1. patching an NDE + doing a replay test
2. deploying changes with worker versioning
3. deploying on k8s with the worker controller

### Other Exercise Goals
- Continuity, changes should build on one another and keep example easy to grok and remember.
- It might be nice to sprinkle the different emergency remidiation techniques through all the exercises as a recurring topic.
- Each exercise should stand alone in it's own folder in the code repository.
- Each exercise should have a `practice` and `solution` folder. the practice one will be where they user makes their changes during the exercises. the solution is there to reference in case they want a hint. the solution is also the starting point for the subsequent exercise.

### Ideas For Changes to Make During Exercises
  - sending a notification to the customer when retrieving car
  - billing the customer at the end based on the length of their trip

## Learning Objectives

### From replay workshop description
  - deployment practices
  - worker routing
  - emergency remediation techniques

### From lms courses

#### Workflow Versioning
- Apply an appropriate Versioning strategy to modify your Workflows
  - Understand which types of changes can safely be deployed without versioning
  - Explain how to define and use versioning to support incompatible changes to a Workflow
  - Distinguish between the supported Versioning implementations
  - Implement a Versioned Workflow
- Understand how Temporal Event and Command Mapping applies to Workflow Versioning
  - Search for Workflow Versions and verify the correct Queues are being polled
  - Modify a Workflow using Patch Versioning
  - Verify correct implementations of Versioning strategies
- Download a Workflow Execution History in JSON format for use in compatibility tests
  - Demonstrate how to restart Workers and migrate Workflow Versions
  - Make changes in production and gracefully update your Executions
  - Test compatibility with past Executions and previous Versions using Workflow Replay

#### Worker Versioning
- Understand Worker Versioning Architecture and Deployment Strategies
  - Distinguish between Worker Deployments and Worker Deployment Versions in your application architecture
  - Explain the differences between rainbow, blue-green, and rolling deployment strategies and justify why Worker Versioning uses the rainbow approach for Temporal applications
  - Configure Worker Versioning parameters including enabling versioning, defining deployment names and Build IDs, and setting default versioning behaviors for your Workers
  - Configure Traffic Routing and Rollout Management
- Configure routing strategies using Current Version and Ramping Version to control how new and existing Workflows are distributed across different Worker Deployment Versions
  - Execute deployment Workflows using CLI commands to inspect current state, activate deployment versions, and monitor rollout progress through the complete Worker Versioning lifecycle
  - Handle Emergency Situations and Production Testing
- Execute emergency rollbacks by quickly removing Ramping Versions during incidents or moving your Workflow from problematic versions to safer ones
  - Execute emergency remediation procedures using the update-options CLI command to move Workflows between versions during critical incidents involving bugs, security vulnerabilities, or urgent fixes
  - Evaluate safe sunsetting procedures that account for active Workflows, query requirements, and proper timing to avoid data loss or service disruption during version retirement
  - Implement pre-deployment testing strategies using versioningOverride to pin test Workflows to pending versions while production traffic continues normally on current versions

---

## Topic Coverage Audit

> **This section needs frequent updates.** It will get out of date as exercises, slides, and READMEs evolve. Re-audit whenever significant content changes are made.

Topics are ranked by priority (P1 = must-cover, P2 = should-cover, P3 = nice-to-have). Coverage is rated as: **Full** (hands-on exercise + explanation), **Partial** (mentioned/explained but not exercised, or exercised but not explained), **Slides Only** (planned for slides/lecture, not in exercises), **Not Covered**.

### P1 - Core Workshop Topics

| # | Topic | Coverage | Where | Notes |
|---|---|---|---|---|
| 1 | **workflow.patched() for non-replay-safe changes** | Full | Ex1 Parts B-D | Users add an activity, see the NDE, wrap in patched(), observe old vs new behavior on the same worker. |
| 2 | **Replay testing with exported history** | Full | Ex1 Parts A-C | Export history JSON, write/run replay test, see it fail/pass. |
| 3 | **What constitutes a non-deterministic (non-replay-safe) change** | Partial | Ex1 Part B, Ex2 Part B | Demonstrated by example (adding an activity) but not explicitly taught as a category of changes. Could use slides covering the full list (adding/removing/reordering activities, changing timers, etc.). |
| 4 | **PINNED versioning behavior** | Full | Ex2 Part A, Ex3 all | Configured in code, explained in callout boxes, demonstrated with in-flight isolation. |
| 5 | **AUTO_UPGRADE versioning behavior** | Full | Ex2 Part A, Ex2 Part D | Configured on ParkingLotWorkflow with a "why" callout. Part D demonstrates that AUTO_UPGRADE still requires patching by breaking and fixing ParkingLotWorkflow. |
| 6 | **WorkerDeploymentConfig setup (deployment name, build ID, use_worker_versioning)** | Full | Ex2 Part A | Users wire up env vars and config in worker.py. |
| 7 | **Deploying a new version alongside an old one (rainbow deployment)** | Full | Ex2 Part B, Ex3 Part B | Both manual (Ex2) and controller-automated (Ex3) rainbow deployments. |
| 8 | **set-current-version CLI command** | Full | Ex2 Parts A-C | Used repeatedly to promote and rollback versions. |
| 9 | **Emergency rollback (set-current-version to revert)** | Full | Ex2 Part C step 5 | Instant rollback by setting previous version as current. |
| 10 | **update-options CLI for evacuating stuck workflows** | Full | Ex2 Part C steps 6-7 | Bulk query + reassign of v3.0 workflows to v2.0. |
| 11 | **Worker Controller + TemporalWorkerDeployment CRD** | Full | Ex3 Parts A-D | CRD creation, updates, observation of controller behavior. |
| 12 | **Progressive rollout strategy (ramping)** | Full | Ex3 Part B | 25% -> 75% -> 100% ramp with pause durations, observed via `kubectl get twd -w`. |
| 13 | **Gate workflow for pre-deployment checks** | Full | Ex3 Part C | Gate blocks bad deploy, passes after fix. Full exercise with failure and success paths. |

### P2 - Important Supporting Topics

| # | Topic | Coverage | Where | Notes |
|---|---|---|---|---|
| 14 | **Rainbow vs blue-green vs rolling deployment strategies** | Slides Only | Planned for slides | Not in exercises. Needs a slide explaining why Temporal uses rainbow (multiple coexisting versions). |
| 15 | **Worker Deployments vs Worker Deployment Versions (concepts)** | Partial | Ex2 Part A (`describe` command) | Users see the output but distinction isn't explicitly taught. Needs a slide or callout. |
| 16 | **Current Version vs Ramping Version routing concepts** | Partial | Ex2 Part B, Ex3 Part B | Current Version is exercised heavily. Ramping Version is implicitly used in Ex3 Progressive rollout but not called out by name or explained as a distinct routing concept. |
| 17 | **WorkerDeploymentVersion search attribute for querying** | Full | Ex2 Part C step 6 | Used to find stuck v3.0 workflows. |
| 18 | **Sunsetting old versions / draining** | Partial | Ex2 Parts B-C | Instructions say "wait until drained, then stop the worker," but safe sunsetting procedures aren't explicitly taught (timing, query requirements, etc.). Noted in things-to-fix for the controller case. |
| 19 | **Pre-deployment testing with versioningOverride (synthetic traffic)** | Full | Ex3 Part D | Manual strategy + pinned synthetic workflow. Optional but fully fleshed out. |
| 20 | **continue_as_new for long-running workflows** | Partial | ParkingLotWorkflow code | Present in the example code but not a focus of any exercise step. Could use a brief callout. |
| 21 | **AllAtOnce rollout strategy** | Partial | Ex3 Part A | Used for initial deploy, briefly noted, but not contrasted with Progressive in the exercise itself. |
| 22 | **Manual rollout strategy** | Full | Ex3 Part D | Deployed, observed Inactive state, then tested with synthetic traffic. |
| 23 | **Types of changes safe to deploy without versioning** | Not Covered | - | The LMS objective mentions this. Could be a quick slide (e.g., adding a log line, changing activity internals, adding a new query handler). |
| 24 | **Temporal Web UI for deployment/version inspection** | Partial | Ex2-3 (observation steps) | Users are told to look at the UI but specific column configuration and deployment views aren't walked through. Noted in things-to-fix. |

### P3 - Nice-to-Have / Advanced

| # | Topic | Coverage | Where | Notes |
|---|---|---|---|---|
| 25 | **Upgrade-on-Continue-as-New strategy ("trampolining")** | Partial | Ex2 Part D (teaser), slides | Explained conceptually in Ex2 Part D closing callout and in slides. Not exercised hands-on. |
| 26 | **Patching with auto-upgrade behavior** | Full | Ex2 Part D | Part D demonstrates the NDE when making a non-replay-safe change to an AUTO_UPGRADE workflow, fixes it with patching, and teases trampolining as the long-term alternative. |
| 27 | **Event and Command Mapping (how replay works internally)** | Not Covered | - | LMS objective. Would be a conceptual slide. Not practical to exercise hands-on. |
| 28 | **Verifying correct Queues are polled / searching for workflow versions** | Partial | Ex2 Part C step 6 | The search attribute query partially covers this. Could be expanded with slides on how to use the UI/CLI to audit which versions are active. |
| 29 | **Emergency remediation as a recurring theme across exercises** | Not Covered | Ex2 Part C only | The exercise plan notes it would be nice to sprinkle remediation across all exercises. Currently only in Ex2 Part C. Ex1 and Ex3 don't have explicit remediation scenarios. |
| 30 | **Promoting from Manual strategy** | Partial | Ex3 Part D (footnote) | Explained in a "How would you promote?" callout but not exercised. Intentional - exercise is already long. |
| 31 | **Worker Controller ownership model** | Partial | Ex3 Part D (footnote) | Mentioned briefly. Advanced topic, probably fine as a footnote. |
| 32 | **Controller-managed sunsetting / cleanup of drained versions** | Not Covered | - | Noted in things-to-fix. Drained versions just hang around in Ex3. |

### Coverage Summary

| Rating | Count | Topics |
|---|---|---|
| **Full** | 16 | #1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17, 19, 22, 26 |
| **Partial** | 10 | #3, 15, 16, 18, 20, 21, 24, 25, 28, 30, 31 |
| **Slides Only** | 1 | #14 |
| **Not Covered** | 4 | #23, 27, 29, 32 |

### Key Gaps to Address

1. **Slides needed:** Rainbow vs blue-green vs rolling (#14), what changes are safe without versioning (#23), event/command mapping conceptual overview (#27).
2. **Trampolining (#25):** Teased in Ex2 Part D closing callout and covered in slides. Not exercised hands-on - decide if that's sufficient or if a dedicated mini-example is worth the time.
3. **Emergency remediation breadth (#29):** Currently concentrated in Ex2 Part C. The original plan wanted it sprinkled across all exercises. Consider whether Ex1 or Ex3 could include a remediation moment.
4. **Sunsetting (#18, #32):** Mentioned but not deeply taught. The controller case (#32) is a known gap in things-to-fix.
5. **AUTO_UPGRADE observation (#5):** Now fully covered in Ex2 Part D with a break-then-fix loop.
