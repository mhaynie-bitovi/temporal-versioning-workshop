# Temporal Versioning Workshop

A hands-on workshop for [Replay 2026](https://replay.temporal.io/) teaching Temporal's versioning strategies (workflow patching and worker versioning) and automated deployment with the Worker Controller, through a valet parking example.

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

The three exercises tell a single story: you're evolving a production valet parking system, and the stakes rise as you go. You'll start with workflow patching - the foundational versioning technique every Temporal developer needs to know - then move to Worker Versioning, where Temporal's infrastructure handles routing between multiple simultaneously deployed worker versions (eliminating most patching). Finally, you'll automate the Worker Versioning deployment lifecycle with the Worker Controller on Kubernetes.

> **The versioning strategies.** There are two first-class ways to handle non-replay-safe changes in Temporal:
> 1. **Workflow Patching** - use the patching API to branch execution based on markers in the event history
> 2. **Worker Versioning** - deploy multiple worker versions simultaneously and let Temporal route workflow tasks accordingly.
> 
> A third approach, sometimes called **Workflow Type Versioning** (creating a new workflow type for each incompatible version), is more of a workaround than a built-in strategy. It sidesteps the problem rather than solving it. This workshop focuses on Patching (Exercise 1) and Worker Versioning (Exercises 2-3). The Worker Controller in Exercise 3 is not a separate versioning strategy - it's automation tooling that manages the Worker Versioning deployment lifecycle on Kubernetes.

### [Exercise 1: Workflow Patching](exercises/1-workflow-patching/README.md)

Your first feature request arrives: notify car owners when their car is being parked. Adding a `notify_owner` activity call is a non-replay-safe change - you'll learn to catch it with replay testing and fix it with `workflow.patched()`.

- **Part A:** Establish a replay-test safety net for the current v1.0 workflow.
- **Part B:** Make a non-replay-safe change and see the replay test catch it.
- **Part C:** Fix the change with `workflow.patched()` so replay stays safe.
- **Part D:** Deploy the patched code and observe how in-flight vs. new workflows behave differently.

### [Exercise 2: Worker Versioning](exercises/2-worker-versioning/README.md)

Feature requests keep coming, and patching is starting to accumulate. You switch to Worker Versioning, where Temporal's infrastructure handles routing instead of conditional code paths. Then a bad deploy hits production.

- **Part A:** Configure versioning infrastructure (`PINNED`, `AUTO_UPGRADE`, `WorkerDeploymentConfig`) and deploy v1.0.
- **Part B:** Ship a non-replay-safe feature (billing) as v2.0 using PINNED versioning.
- **Part C:** Respond to a bad deploy: rollback, evacuate stuck workflows, and fix-forward.
- **Part D (Optional):** Discover why `AUTO_UPGRADE` workflows still need patching.

### [Exercise 3: Worker Controller](exercises/3-worker-controller/README.md)

You've been managing versioned deployments by hand. The Worker Controller automates all of that - progressive rollouts, draining, and pre-deployment checks - so you can ship with confidence and less manual coordination.

- **Part A:** Deploy v1.0 via a `TemporalWorkerDeployment` CRD with an `AllAtOnce` strategy.
- **Part B:** Ship a non-replay-safe change using a `Progressive` rollout (ramped traffic + automatic draining).
- **Part C:** Add a gate workflow that blocks bad deploys before they take traffic.
- **Part D (Optional):** Use a `Manual` strategy to pre-test a version with synthetic traffic before promotion.