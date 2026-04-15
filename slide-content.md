# Slide Content - Temporal Versioning Workshop

## Schedule

| Time | Block | Duration |
|---|---|---|
| 1:30 | Opening | 10 min |
| 1:40 | Exercise 1 Concepts | 20 min |
| 2:00 | Exercise 1 | 30 min |
| 2:30 | Exercise 2 Concepts | 30 min |
| 3:00 | Break | 30 min |
| 3:30 | Exercise 2 | 30 min |
| 4:00 | Exercise 3 Concepts | 15 min |
| 4:15 | Exercise 3 | 30 min |
| 4:45 | Wrap-up | 15 min |
| 5:00 | End | - |

---

## Sources to Reference
- [x] Exercises
- [ ] Temporalio docs
- [ ] Courses (LMS)
- [ ] MCP Server/Skill
- [ ] Youtube
- [ ] notion notes
- [ ] worker controller repository

---


## Opening (10 min)
- The problem with versioning durable execution
- The scenario (airport valet)
- High level versioning strategies (3 main ones)

## Exercise 1 Concepts (20 min)
- replay testing
- non-replay-safe changes
- replay
- event history
- patching
- TDD 


## Exercise 1 (30 min)

## Exercise 2 Concepts (30 min)
- comparing patching with worker versioning
- worker deployments UI vs cli
- how does worker versioning actually work
    - Worker versioning behavior (pinned, auto-upgrade)
    - Woker Deployments / Versions
    - Version statuses
    - Version Draining statuses
    - Current vs Target
- Emergency remediation actions
- Patching + Auto Upgrade
- Upgrade on Continue as New


## Break (30 min)

## Exercise 2 (30 min)

## Exercise 3 Concepts (15 min)
- brief intro to kubernetes?
    - pods
    - deployments
- how does the worker controller work
    - k8s elements
        - Temporal Worker Deployment CRD
        - Temporal Cluster Connection
    - Rollout strategies (manual, all at once, progressive)
    - ramping
    - gate workflows
    - sunsetting
    - pre deployment testing with synthetic traffic
- rolling vs blue-green vs rainbow deployment

## Exercise 3 (30 min)

## Wrap-up (15 min)
