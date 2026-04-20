# Instruqt Track Plan

Convert the 3 workshop exercises into 3 Instruqt tracks, authored as code in this repo. Your contact pushes to Instruqt via CLI (or, ideally, GitHub Actions). You get full version control and iteration without needing Instruqt CLI access.

---

## Architecture Decisions

### 3 Separate Tracks (not 1 mega-track)

- Each exercise has different infra needs (Exercise 3 needs minikube/nested virtualization)
- Students can restart individual exercises independently
- Instructor can assign tracks at the right workshop timeslot
- Hot start pools can be managed per-track for the live event

### Sandbox Types

- **Tracks 1 & 2 (Workflow Patching, Worker Versioning):** Ubuntu container - lightweight, fast to provision. Python 3, pip, Temporal CLI, git, and make pre-installed via track setup script. `temporal server start-dev` started as a background process.
- **Track 3 (Worker Controller):** GCP VM (`n1-standard-4`, 4 vCPU / 15 GB RAM) with nested virtualization enabled. Same Python/Temporal setup plus Docker, minikube, kubectl, and Helm. Heavier setup time - strong candidate for a custom VM image or hot start pool for the live event.

### Code Delivery

- Track setup script clones this repo into the sandbox
- Each challenge's setup script navigates to the correct `practice/` directory
- Solve scripts apply solution code to enable skip-ahead

### Assignment Content

- Existing exercise README.md files split by Part into per-challenge `assignment.md` files
- Pre-setup steps become the first challenge or are handled by track setup scripts
- Each challenge gets tabs: 2-3 Terminals, 1 Code Editor (pointing at `practice/`), 1 Service tab (Temporal Web UI on port 8233)

---

## Directory Structure

```
instruqt/
├── track-1-workflow-patching/
│   ├── track.yml
│   ├── config.yml
│   ├── assets/                              # Optional images/diagrams
│   ├── track_scripts/
│   │   ├── setup-workstation
│   │   └── cleanup-workstation
│   ├── 01-export-history-and-replay-tests/
│   │   ├── assignment.md
│   │   ├── setup-workstation
│   │   ├── check-workstation
│   │   └── solve-workstation
│   ├── 02-break-replay-safety/
│   │   ├── assignment.md
│   │   ├── setup-workstation
│   │   ├── check-workstation
│   │   └── solve-workstation
│   ├── 03-patch-for-safety/
│   │   ├── assignment.md
│   │   ├── setup-workstation
│   │   ├── check-workstation
│   │   └── solve-workstation
│   └── 04-deploy-and-observe/
│       ├── assignment.md
│       ├── setup-workstation
│       ├── check-workstation
│       └── solve-workstation
├── track-2-worker-versioning/
│   ├── track.yml
│   ├── config.yml
│   ├── track_scripts/
│   │   ├── setup-workstation
│   │   └── cleanup-workstation
│   ├── 01-configure-versioning/
│   ├── 02-rainbow-deploy/
│   ├── 03-incident-response/
│   └── 04-auto-upgrade-gotcha/
└── track-3-worker-controller/
    ├── track.yml
    ├── config.yml
    ├── track_scripts/
    │   ├── setup-workstation
    │   └── cleanup-workstation
    ├── 01-deploy-on-kubernetes/
    ├── 02-progressive-rollout/
    ├── 03-gate-workflow/
    └── 04-manual-pre-testing/
```

Each challenge directory under tracks 2 and 3 follows the same pattern as track 1 (assignment.md + setup/check/solve scripts).

---

## Implementation Phases

### Phase 1: Scaffolding

1. Create the `instruqt/` directory with the 3 track subdirectories
2. Write `track.yml` for each track (title, teaser, description, owner, `maintenance: true` until ready)
3. Write `config.yml` for each track:
   - Tracks 1-2: single container host named `workstation` (Ubuntu image, bash shell)
   - Track 3: single VM host named `workstation` (Ubuntu 20.04+, `n1-standard-4`, `nested_virtualization: true`, bash shell)

### Phase 2: Track Setup Scripts

4. Write `track_scripts/setup-workstation` for **tracks 1-2**:
   - Wait for Instruqt bootstrap (`/opt/instruqt/bootstrap/host-bootstrap-completed`)
   - Install Python 3, pip, git, make
   - Install Temporal CLI
   - Clone this repo
   - Create Python venv and install requirements
   - Start `temporal server start-dev` as a background process
   - Health-check: wait for Temporal to respond on port 7233

5. Write `track_scripts/setup-workstation` for **track 3**:
   - Same as above, plus install Docker, minikube, kubectl, Helm
   - Run `make setup` (minikube start + Worker Controller install)
   - Health-check: verify minikube and Temporal are running

### Phase 3: Challenge Content

6. Split each exercise README.md by Part into per-challenge `assignment.md` files:
   - YAML frontmatter: slug, type (`challenge`), title, tabs config, difficulty, timelimit
   - Tabs: 2-3 Terminal tabs (`workstation`), 1 Code Editor tab (path: `/root/workshop/exercises/N/practice`), 1 Service tab (Temporal Web UI, port 8233)
   - Markdown body: instructions from the corresponding Part of the README

### Phase 4: Lifecycle Scripts (deferred)

Create placeholder scripts (no-op `exit 0`) for each challenge's setup, check, and solve scripts. Revisit once exercise solutions are finalized and the specific checks/solves are clear.

### Phase 5: Handoff & Workflow

7. Document the handoff process in `instruqt/README.md`

---

## Development Loop

Since you can't push to Instruqt directly, here are the options for closing the loop:

### Option A: File Handoff via Git (recommended to start)

1. You author all Instruqt files in `instruqt/` in this repo
2. You commit and push to GitHub
3. Contact pulls the repo and runs `instruqt track push` from each track directory
4. Contact shares the track play URL back to you for testing
5. Iterate

`instruqt track push` handles both creation and updates. When the `id` field in `track.yml` is empty (`""`), the first push creates the track on Instruqt and populates the `id` field automatically. The contact should commit the updated `track.yml` (with the assigned ID) back to the repo so subsequent pushes update the same track rather than creating duplicates.

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
3. 12+ challenges with scripts makes this impractical

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
