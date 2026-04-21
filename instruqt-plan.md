# Instruqt Track Plan

Convert the 3 workshop exercises into 3 Instruqt tracks, authored as code in this repo. Your contact pushes to Instruqt via CLI (or, ideally, GitHub Actions). You get full version control and iteration without needing Instruqt CLI access.

---

## Architecture Decisions

### 3 Separate Tracks, 1 Challenge Each

Each exercise maps to one Instruqt track with a **single challenge** containing the full exercise content (all Parts A-D). This avoids two problems with multi-challenge tracks:

1. **Lifecycle scripts per challenge:** The exercises were designed with whole-exercise solutions, not per-part solutions. Splitting into per-part challenges would require writing granular setup/check/solve scripts for each part, which the exercises don't support.
2. **Persistent terminals across challenges:** The exercises require long-running processes (workers, load simulators) that span multiple parts. Instruqt doesn't cleanly support persistent terminal sessions across challenge boundaries.

A single challenge per track keeps the exercise content in its natural form and avoids these issues.

### Sandbox Types

- **Tracks 1 & 2 (Workflow Patching, Worker Versioning):** Ubuntu container - lightweight, fast to provision. Python 3, pip, Temporal CLI, git, and make pre-installed via track setup script. `temporal server start-dev` started as a background process.
- **Track 3 (Worker Controller):** GCP VM (`n1-standard-4`, 4 vCPU / 15 GB RAM) with nested virtualization enabled. Same Python/Temporal setup plus Docker, minikube, kubectl, and Helm. Heavier setup time - strong candidate for a custom VM image or hot start pool for the live event.

### Code Delivery

- Track setup script clones this repo into the sandbox
- Track setup script configures the working directory and Python venv activation in `.bashrc`
- The single challenge's assignment.md contains the full exercise README content

### Assignment Content

- Each track's single challenge `assignment.md` contains the full exercise README content, lightly adapted for the Instruqt environment (references to tabs instead of "new terminal", removal of "navigate to folder" and "start dev server" steps that are handled by track setup)
- The exercise README.md files are the source of truth - the assignment.md files are derived from them
- Each challenge gets tabs: 2-4 Terminals, 1 Code Editor (pointing at `practice/`), 1 Service tab (Temporal Web UI on port 8233)

---

## Directory Structure

```
instruqt/
├── track-1-workflow-patching/
│   ├── track.yml
│   ├── config.yml
│   ├── track_scripts/
│   │   ├── setup-workstation
│   │   └── cleanup-workstation
│   └── 01-workflow-patching/
│       ├── assignment.md           # Full exercise content (Parts A-D)
│       ├── setup-workstation       # Placeholder (exit 0)
│       ├── check-workstation       # Placeholder (exit 0)
│       └── solve-workstation       # Placeholder (exit 0)
├── track-2-worker-versioning/
│   ├── track.yml
│   ├── config.yml
│   ├── track_scripts/
│   │   ├── setup-workstation
│   │   └── cleanup-workstation
│   └── 01-worker-versioning/
│       ├── assignment.md           # Full exercise content (Parts A-D)
│       ├── setup-workstation
│       ├── check-workstation
│       └── solve-workstation
└── track-3-worker-controller/
    ├── track.yml
    ├── config.yml
    ├── track_scripts/
    │   ├── setup-workstation
    │   └── cleanup-workstation
    └── 01-worker-controller/
        ├── assignment.md           # Full exercise content (Parts A-D)
        ├── setup-workstation
        ├── check-workstation
        └── solve-workstation
```

---

## Implementation Status

### Done

1. **Scaffolding:** `instruqt/` directory with 3 track subdirectories, `track.yml`, and `config.yml` for each track.
2. **Track setup scripts:** `track_scripts/setup-workstation` and `cleanup-workstation` for all 3 tracks. These install dependencies, clone the repo, start the Temporal dev server, and configure the shell environment.
3. **Challenge content:** Single `assignment.md` per track containing the full exercise README, adapted for Instruqt (tab references, pre-configured environment notes).
4. **Lifecycle scripts:** Placeholder `exit 0` scripts for each challenge's setup, check, and solve. These can be revisited later if automated checking is desired.

### Remaining

5. **Handoff & iteration:** Push tracks to Instruqt via CLI, test, and iterate (see Development Loop below).
6. **Lifecycle script implementation (optional):** Write real check/solve scripts if automated validation or skip-ahead is desired.

---

## Development Loop

Since you can't push to Instruqt directly, here are the options for closing the loop:

### Option A: File Handoff via Git (recommended to start)

1. You author all Instruqt files in `instruqt/` in this repo
2. You commit and push to GitHub
3. Contact pulls the repo and runs `instruqt track push` from each track directory (this handles both creation and updates - when the `id` field in `track.yml` is empty, the first push creates the track and populates the `id` automatically)
4. **Contact commits the updated `track.yml` files back to the repo** (they now contain the assigned IDs - without this, the next push creates duplicate tracks instead of updating)
5. Contact shares the track play URL back to you for testing
6. Iterate

**Pros:** Simple, no setup needed. **Cons:** Manual, requires contact for every iteration.

### Option B: GitHub Actions CI/CD (recommended long-term)

1. Set up the [Instruqt skeleton](https://github.com/instruqt/skeleton) GitHub Actions in this repo (or a dedicated repo)
2. Contact provides the Instruqt API token as a GitHub Actions secret (`INSTRUQT_TOKEN`) - one-time setup
3. On merge to main, tracks are auto-pushed and tested against Instruqt
4. You get full CI/CD without needing CLI access yourself

**Pros:** Fully automated, self-service after initial setup. **Cons:** Requires one-time secret setup by contact.

### Option C: Web UI Authoring (not recommended)

1. Contact creates track shells via Web UI
2. You describe changes, contact applies them
3. Even with single-challenge tracks, managing scripts and content via the Web UI is impractical

**Recommendation:** Start with Option A for rapid iteration during development. Move to Option B before the workshop goes live so future updates are automated.

---

## Verification Checklist

1. **Structural validation**: Contact runs `instruqt track validate` on each track
2. **Automated test**: Contact runs `instruqt track test` on each track (exercises solve scripts, then check scripts to verify they pass)
3. **Manual playtest**: Play each track end-to-end as a learner, verify instructions are clear and checks work
4. **Hot start test**: For the live event, create a scheduled hot start pool and verify sandboxes provision correctly within acceptable time

---

## Further Considerations

### Repo Visibility

The track setup script clones this repo. If the repo is private, options include:
- Add a GitHub personal access token as an Instruqt sandbox secret
- Make the repo public (even temporarily for the event)
- Create a release tarball that gets downloaded instead

### Track 3 Setup Time

minikube + Helm + Worker Controller could take 3-5 minutes. For the live event:
- **Custom VM image** with these pre-baked would reduce startup to under a minute
- **Hot start pool** (scheduled for the event window) pre-provisions sandboxes so learners don't wait
- This is an optimization to do after the initial track works

### Temporal Cloud vs. Dev Server

If the organization hosting Instruqt also has Temporal Cloud, sandboxes could point at a shared Cloud namespace instead of each running their own dev server. This would:
- Simplify setup scripts
- Reduce per-sandbox resource usage
- Give learners a more realistic production-like experience

Worth checking with the contact.

### Hot Start Pools for the Live Event

For a scheduled workshop, create a **scheduled hot start pool** starting ~1 hour before the session:
- Track 1-2: 1-2 hot instances per track (containers provision fast)
- Track 3: 3-5 hot instances (VMs with minikube take longer)
- Terminate the pool 15-30 min after the session starts to save costs
