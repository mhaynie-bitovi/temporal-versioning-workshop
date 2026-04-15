# Project Instructions

This file provides guidance to GitHub Copilot when working with code in this repository.

## Temporal Docs MCP Server

**Always use the `mcp_temporal-docs_search_temporal_knowledge_sources` tool aggressively.** This is a semantic search tool over Temporal's official documentation and knowledge sources. Use it:

- **Before writing or modifying any Temporal-related code** (workflows, activities, workers, signals, queries, updates, continue-as-new, patching, versioning, etc.). Search for the relevant API or concept first to ensure correctness.
- **Before answering any question about Temporal** concepts, best practices, SDK behavior, or configuration. Do not rely on training data alone; always verify against the docs.
- **When debugging Temporal issues** (non-determinism errors, replay failures, worker behavior, etc.). Search for the error or concept to get up-to-date guidance.
- **When writing or reviewing README/workshop content** that explains Temporal concepts. Search to ensure explanations are accurate and use current terminology.
- **When unsure about any Temporal API**, parameter, or behavior. Search first, then act.

Make multiple queries if needed to cover different aspects of a task. For example, when working on workflow patching, search for both "workflow.patched Python SDK" and "workflow versioning determinism" to get comprehensive context. Prefer specific, targeted queries over broad ones.

## Temporal Developer Skill

**Always load and use the `temporal-developer` skill** when working on any Temporal-related code or content in this repository. This skill contains structured references for determinism, versioning, patterns, gotchas, troubleshooting, and SDK-specific guidance. Use it:

- **Before writing or modifying workflow/activity code.** Read the relevant `references/python/` and `references/core/` files from the skill for correct patterns.
- **When debugging non-determinism errors or replay failures.** Consult `references/core/determinism.md` and `references/core/troubleshooting.md` from the skill.
- **When working on versioning or patching.** Read `references/core/versioning.md` and `references/python/versioning.md` from the skill for up-to-date strategies.
- **When writing workshop content** that explains Temporal concepts. Cross-reference both the skill references and the MCP docs server to ensure accuracy.

Use **both** the Temporal Docs MCP server and the temporal-developer skill together. The MCP server provides live docs search; the skill provides structured, curated reference material. They complement each other.

## Project Overview

This is a **Temporal workflow workshop** using a valet parking example as the learning vehicle. The workshop teaches worker versioning, workflow patching, and Kubernetes deployment strategies through three progressive exercises. Each exercise has a `practice/` directory (where users make changes) and a `solution/` reference.

## Setup

```sh
python3 -m venv env
env/bin/pip install -r requirements.txt
```

## Commands

All commands are run from within an exercise's `practice/` directory (e.g., `exercises/1-workflow-patching/practice/`).

```sh
make run-worker        # Start the Temporal worker
make run-load-simulator # Run the load simulator (generates workflows continuously)
make run-starter         # Start a single workflow execution (fire-and-forget, does not wait for completion)
make run-tests           # Run pytest (PYTHONPATH=. python -m pytest tests/ -v)
```

**Exercise 2 only (pass BUILD_ID):**
```sh
make run-worker BUILD_ID=1.0  # Start worker with versioning env vars
```

**Exercise 3 only:**
```sh
make setup               # Setup minikube, Worker Controller, and CRDs
make build               # Build Docker image inside minikube
make clean               # Tear down K8s resources
```

## Architecture

### Core Domain (`valet/` module in each exercise)

- **`workflows.py`** - Two workflows:
  - `ValetParkingWorkflow`: Handles a single parking transaction (request space → move car → wait for trip → return car → release space). Uses `workflow.patched()` for non-deterministic evolution.
  - `ParkingLotWorkflow`: Long-lived workflow managing 30 parking spaces via workflow updates/queries. Uses `continue-as-new` for history management.

- **`activities.py`** - Side-effect implementations: `move_car`, `request_parking_space`, `release_parking_space`, `notify_owner`. Activities interact with `ParkingLotWorkflow` via Temporal updates.

- **`models.py`** - Dataclasses for workflow/activity inputs and outputs.

- **`worker.py`** - Registers both workflows and all activities on the `"valet"` task queue.

- **`starter.py`** - Starts a single `ValetParkingWorkflow` execution (fire-and-forget). Does not wait for the workflow to complete.

- **`load_simulator.py`** - Continuously starts `ValetParkingWorkflow` instances with random license plates and trip durations (5–30s).

### Testing Patterns

Tests use **replay tests** that load captured history JSON files (from `history/`) and verify the current code doesn't introduce non-determinism.

The `pyproject.toml` sets `asyncio_mode = "auto"` so all async test functions work without explicit decorators.

### Exercise Progression

Exercises build upon one another sequentially:

- Each exercise's `practice/` directory starts with the code the user should have at the end of the previous exercise. (Exercise 2 practice ≈ exercise 1 solution, etc.)
- Each exercise's `solution/` directory should match the *next* exercise's `practice/` directory, **except** that `practice/` includes `TODO` comments guiding the user and `solution/` has those TODOs replaced with the actual code changes.
- The goal is minimal typing: model types, activity definitions, boilerplate, etc. should already be in place in the `practice/` directory. The user only makes small, focused changes to illustrate the exercise's concepts.

### README Style Guidelines

- **Never combine `make run-worker &` and `make run-load-simulator` (or similar) in the same code block.** Each long-running process should be shown as a separate step, instructing the user to open a separate terminal. Backgrounding a process with `&` in a workshop README obscures what's happening and doesn't serve the educational purpose. Show each command in its own block with clear instructions (e.g., "In a new terminal, start the load simulator").

- **Do not wrap Temporal CLI or kubectl commands in Makefile targets.** Exercise steps that have the user interact with the Temporal cluster (via `temporal` CLI) or Kubernetes (via `kubectl`) should show the raw commands directly so users see the granular steps and build familiarity with the tools. The exception is setup/teardown scaffolding (e.g., `make setup`, `make clean`) that installs the Worker Controller, CRDs, and other boilerplate - those are fine to condense into Makefile helpers.

- Never use em dashes (-). Use regular hyphens (single, not double), commas, or parentheses instead. Make sure not to confuse these with cli args/params/flags.

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal server address |
| `TEMPORAL_NAMESPACE` | `default` | Temporal namespace |
| `TEMPORAL_DEPLOYMENT_NAME` | - | Worker versioning deployment name (exercise 2+) |
| `TEMPORAL_WORKER_BUILD_ID` | - | Worker build ID for versioning (exercise 2+) |

## Key Reference

- [README.md](../README.md) - Top-level project README
- [exercises/1-workflow-patching/README.md](../exercises/1-workflow-patching/README.md) - Exercise 1: Workflow Patching
- [exercises/2-worker-versioning/README.md](../exercises/2-worker-versioning/README.md) - Exercise 2: Worker Versioning
- [exercises/3-worker-controller/README.md](../exercises/3-worker-controller/README.md) - Exercise 3: Worker Controller
