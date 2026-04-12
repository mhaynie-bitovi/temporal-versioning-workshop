# Temporal Worker Versioning Workshop

A hands-on workshop teaching workflow patching, worker versioning, and Kubernetes deployment strategies through a valet parking domain. Three progressive exercises, ~3.5 hours total (with breaks and slides between).

## Prerequisites

> **Note:** These setup instructions are temporary for development of the workshop material. When actually delivering the workshop, this material will be adapted to run inside a VM on the [Instruqt](https://instruqt.com/) platform. For development, feedback, and dry runs before that, it's useful to have the requirements and setup instructions available.

### All exercises

| Requirement | Notes |
|---|---|
| **Python 3** | `python3 --version` |
| **pip** | Comes with Python; used inside the venv |
| **Temporal CLI** | `brew install temporal` or [docs](https://docs.temporal.io/cli#install) |
| **make** | Pre-installed on macOS (`xcode-select --install` if missing) |

### Exercise 3 (Kubernetes) — additional requirements

| Requirement | Notes |
|---|---|
| **Docker** | Needed by minikube for building images |
| **minikube** | `brew install minikube` |
| **kubectl** | `brew install kubectl` |
| **Helm** | `brew install helm` — used to install the Worker Controller |

## Setup

```sh
python3 -m venv env
env/bin/pip install -r requirements.txt
```

## Exercises

### [Exercise 1: Patching + Replay Testing](exercises/exercise-1/README.md) (~30 min)

Add a `notify_owner` activity call to the workflow — a non-replay-safe change — and learn to catch and fix it.

- **Part A:** Run V1, export a workflow history, run a replay test.
- **Part B:** Add the activity call. Replay test fails with a non-determinism error.
- **Part C:** Wrap it in `workflow.patched()`. Replay test passes.
- **Part D:** Restart the worker. Old in-flight workflows skip the notification; new ones include it.
- **Part E:** Discussion — patching, auto-upgrade, and why there's a cleaner approach.

### [Exercise 2: Worker Versioning](exercises/exercise-2/README.md) (~45 min)

Deploy changes using Worker Versioning — Temporal's infrastructure handles routing instead of conditional code paths.

- **Part A:** Enable versioning (`PINNED`, `AUTO_UPGRADE`, `WorkerDeploymentConfig`). Deploy v1.0.
- **Part B:** Add `bill_customer` (non-replay-safe). Deploy v2.0 alongside v1.0 — no patching needed.
- **Part C:** Introduce a bug in v3.0 → rollback with `set-current-version` → evacuate stuck workflows with `update-options` → fix-forward with v3.1.

### [Exercise 3: K8s with the Worker Controller](exercises/exercise-3/README.md) (~35 min)

The Worker Controller automates versioned deployments on Kubernetes.

- **Part A:** Deploy v1.0 via a `TemporalWorkerDeployment` CRD (AllAtOnce strategy).
- **Part B:** Deploy v2.0 with a Progressive rollout — watch traffic ramp 25% → 75% → 100% while v1.0 drains.
- **Part C:** Rollback via image tag. Deploy a broken image — crash-looping pods never become current; production stays healthy.