# Temporal Versioning Workshop

A hands-on workshop for [Replay 2026](https://replay.temporal.io/) teaching workflow patching, worker versioning, and Kubernetes deployment strategies through a valet parking example.

## Prerequisites

> **Note:** These setup instructions are temporary for development of the workshop material. When actually delivering the workshop, this material will be adapted to run inside a VM on the [Instruqt](https://instruqt.com/) platform. For development, feedback, and dry runs before that, it's useful to have the requirements and setup instructions available.

### All exercises

| Requirement | Notes |
|---|---|
| **Python 3** | `python3 --version` |
| **pip** | Comes with Python; used inside the venv |
| **Temporal CLI** | `brew install temporal` or [docs](https://docs.temporal.io/cli#install) |
| **make** | Pre-installed on macOS (`xcode-select --install` if missing) |

### Exercise 3 (Kubernetes) - additional requirements

| Requirement | Notes |
|---|---|
| **Docker** | Needed by minikube for building images |
| **minikube** | `brew install minikube` |
| **kubectl** | `brew install kubectl` |
| **Helm** | `brew install helm` - used to install the Worker Controller |

## Setup

Create a Python virtual environment:

```sh
python3 -m venv env
```

Activate it:

```sh
source env/bin/activate
```

Install dependencies:

```sh
pip install -r requirements.txt
```

You can deactivate the virtual environment now:

```sh
deactivate
```

> **Note:** For the rest of the workshop you won't need an activated venv. We'll be using many terminals side by side, and the Makefiles reference the venv's Python binary directly via a relative path - no need to activate it in each terminal or configure your IDE.

## The Scenario: Airport Valet Parking

All exercises build on an airport valet parking scenario with two Temporal workflows:

- **`ValetParkingWorkflow`** - Handles a single parking transaction. It requests a space, moves the car to it, waits for the owner's trip (simulated via a sleep), moves the car back, and releases the space. Each exercise evolves this workflow with new features.

- **`ParkingLotWorkflow`** - A long-running workflow that manages 30 parking spaces. Activities interact with it via updates to request and release spaces. It uses `continue_as_new` to keep its history bounded.

Activities like `move_car`, `request_parking_space`, and `release_parking_space` perform the side effects and bridge the two workflows. A load simulator continuously starts `ValetParkingWorkflow` instances with random license plates and trip durations, giving you a stream of in-flight workflows to test against.

## Exercises

The three exercises tell a single story: you're evolving a production valet parking system, and each exercise introduces a better way to ship changes safely. You'll start with patching - the foundational technique every Temporal developer needs to know - then move to Worker Versioning, which replaces most patching with infrastructure-managed routing, and finally automate the whole deployment lifecycle with the Worker Controller on Kubernetes.

### [Exercise 1: Workflow Patching](exercises/exercise-1/README.md)

Your first feature request arrives: notify car owners when their car is being parked. Adding a `notify_owner` activity call is a non-replay-safe change - you'll learn to catch it with replay testing and fix it with `workflow.patched()`.

- **Part A:** Run v1.0, export a workflow history, run a replay test.
- **Part B:** Add the activity call. Replay test fails with a non-determinism error.
- **Part C:** Wrap it in `workflow.patched()`. Replay test passes.
- **Part D:** Restart the worker. Old in-flight workflows skip the notification; new ones include it.

### [Exercise 2: Worker Versioning](exercises/exercise-2/README.md)

Feature requests keep coming, and patching is starting to accumulate. You switch to Worker Versioning, where Temporal's infrastructure handles routing instead of conditional code paths. Then a bad deploy hits production.

- **Part A:** Enable versioning (`PINNED`, `AUTO_UPGRADE`, `WorkerDeploymentConfig`). Deploy v1.0.
- **Part B:** Add `bill_customer` (non-replay-safe). Deploy v2.0 alongside v1.0 - no patching needed.
- **Part C:** Introduce a bug in v3.0 → rollback with `set-current-version` → evacuate stuck workflows with `update-options` → fix-forward with v3.1.
- **Part D (Optional):** Make a non-replay-safe change to the AUTO_UPGRADE workflow. Discover that AUTO_UPGRADE still requires patching. Teaser: trampolining.

### [Exercise 3: Worker Controller](exercises/exercise-3/README.md)

You've been managing versioned deployments by hand. The Worker Controller automates all of that - progressive rollouts, draining, and pre-deployment checks - so you can ship with confidence and less manual coordination.

- **Part A:** Build and deploy v1.0 via a `TemporalWorkerDeployment` CRD (AllAtOnce strategy). Start load.
- **Part B:** Add `notify_owner` to the workflow (non-replay-safe). Switch the CRD to a Progressive rollout strategy. Deploy v2.0 - watch the controller ramp traffic 25% → 75% → 100% while v1.0 workers drain.
- **Part C:** Configure a gate workflow that checks downstream credentials. Deploy v3.0 with a bad billing API key - watch the gate block the rollout. Fix the credential, redeploy v3.1, and watch it pass.
- **Part D (Optional):** Deploy v4.0 with a Manual strategy so it stays Inactive. Send synthetic traffic pinned to v4.0, verify the workflow completes.