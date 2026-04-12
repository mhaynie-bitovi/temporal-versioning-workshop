# Project Instructions

This file provides guidance to GitHub Copilot when working with code in this repository.

## Project Overview

This is a **Temporal workflow workshop** using a valet parking example as the learning vehicle. The workshop teaches worker versioning, workflow patching, and Kubernetes deployment strategies through three progressive exercises. Each exercise has a `practice/` directory (where users make changes) and a `solution/` reference.

## Setup

```sh
python3 -m venv env
env/bin/pip install -r requirements.txt
```

## Commands

All commands are run from within an exercise's `practice/` directory (e.g., `exercises/exercise-1/practice/`).

```sh
make start-worker        # Start the Temporal worker
make start-load-simulator # Run the load simulator (generates workflows continuously)
make run-starter         # Start a single workflow execution (fire-and-forget, does not wait for completion)
make run-tests           # Run pytest (PYTHONPATH=. python -m pytest tests/ -v)
```

**Exercise 2 only (pass BUILD_ID):**
```sh
make start-worker BUILD_ID=1.0  # Start worker with versioning env vars
```

**Exercise 3 only:**
```sh
make setup               # Setup minikube, Worker Controller, and CRDs
make build               # Build Docker image inside minikube
make clean               # Tear down K8s resources
```

## Architecture

### Core Domain (`valet/` module in each exercise)

- **`workflows.py`** — Two workflows:
  - `ValetParkingWorkflow`: Handles a single parking transaction (request space → move car → wait for trip → return car → release space). Uses `workflow.patched()` for non-deterministic evolution.
  - `ParkingLotWorkflow`: Long-lived workflow managing 30 parking spaces via workflow updates/queries. Uses `continue-as-new` for history management.

- **`activities.py`** — Side-effect implementations: `move_car`, `request_parking_space`, `release_parking_space`, `notify_owner`. Activities interact with `ParkingLotWorkflow` via Temporal updates.

- **`models.py`** — Dataclasses for workflow/activity inputs and outputs.

- **`worker.py`** — Registers both workflows and all activities on the `"valet"` task queue.

- **`starter.py`** — Starts a single `ValetParkingWorkflow` execution (fire-and-forget). Does not wait for the workflow to complete.

- **`load_simulator.py`** — Continuously starts `ValetParkingWorkflow` instances with random license plates and trip durations (5–30s).

### Testing Patterns

Tests use **replay tests** that load captured history JSON files (from `history/`) and verify the current code doesn't introduce non-determinism.

The `pyproject.toml` sets `asyncio_mode = "auto"` so all async test functions work without explicit decorators.

### Exercise Progression

Exercises build upon one another sequentially:

- Each exercise's `practice/` directory starts with the code the user should have at the end of the previous exercise. (Exercise 2 practice ≈ exercise 1 solution, etc.)
- Each exercise's `solution/` directory should match the *next* exercise's `practice/` directory, **except** that `practice/` includes `TODO` comments guiding the user and `solution/` has those TODOs replaced with the actual code changes.
- The goal is minimal typing: model types, activity definitions, boilerplate, etc. should already be in place in the `practice/` directory. The user only makes small, focused changes to illustrate the exercise's concepts.

### README Style Guidelines

- **Never combine `make start-worker &` and `make start-load-simulator` (or similar) in the same code block.** Each long-running process should be shown as a separate step, instructing the user to open a separate terminal. Backgrounding a process with `&` in a workshop README obscures what's happening and doesn't serve the educational purpose. Show each command in its own block with clear instructions (e.g., "In a new terminal, start the load simulator").

- **Do not wrap Temporal CLI or kubectl commands in Makefile targets.** Exercise steps that have the user interact with the Temporal cluster (via `temporal` CLI) or Kubernetes (via `kubectl`) should show the raw commands directly so users see the granular steps and build familiarity with the tools. The exception is setup/teardown scaffolding (e.g., `make setup`, `make clean`) that installs the Worker Controller, CRDs, and other boilerplate — those are fine to condense into Makefile helpers.

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal server address |
| `TEMPORAL_NAMESPACE` | `default` | Temporal namespace |
| `TEMPORAL_DEPLOYMENT_NAME` | — | Worker versioning deployment name (exercise 2+) |
| `TEMPORAL_WORKER_BUILD_ID` | — | Worker build ID for versioning (exercise 2+) |

## Key Reference

- [README.md](../README.md) — Top-level project README
- [exercises/exercise-1/README.md](../exercises/exercise-1/README.md) — Exercise 1: Workflow Patching
- [exercises/exercise-2/README.md](../exercises/exercise-2/README.md) — Exercise 2: Worker Versioning
- [exercises/exercise-3/README.md](../exercises/exercise-3/README.md) — Exercise 3: Kubernetes Deployment
