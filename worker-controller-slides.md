# Worker Controller Slides

---

## Slide 1: What Is the Worker Controller?

**Bullets**
Kubernetes operator for managing versioned worker deployments
Watches `TemporalWorkerDeployment` CRDs - you describe, it acts
Automates rollouts, traffic ramping, draining, and sunsetting
Replaces manual CLI steps with a declarative manifest

**Speaker notes**
The Worker Controller is a Kubernetes operator.
It watches for `TemporalWorkerDeployment` custom resources and acts on them.

In Exercise 2 you ran CLI commands to start workers, set versions, ramp traffic, and stop old workers.
The controller does all of that for you.

You update a manifest, apply it, and the controller handles the rest.
It spins up versioned deployments, registers build IDs, ramps traffic, and drains old versions.

---

## Slide 2: How Does the Worker Controller Work?

**Bullets**
Developer applies a `TemporalWorkerDeployment` manifest
Controller creates a versioned Kubernetes Deployment
Controller registers the version with Temporal
Old version drains - controller polls and deletes when clear

**Speaker notes**
The flow is: you apply a manifest, the controller reconciles it.

On first deploy, the controller creates a versioned Deployment (e.g., `valet-v1`).
Worker pods start, poll Temporal, and the controller registers that build ID as Current.

When you update the image tag, the controller creates a new versioned Deployment alongside the old one.
It registers it with Temporal and begins routing per your rollout strategy.

Once all pinned workflows on the old version finish, the controller deletes the old Deployment.
You never touch a CLI command.

---

## Diagram Slide: Deployment Flow

*(Use the deployment flow sequence diagram here)*

**Speaker notes**
Walk through the numbered steps.

Steps 1-4: developer applies the CRD, the controller notifies Temporal, creates `valet-v1`.
The controller registers it as Current.

Steps 5-8: developer updates the CRD to v2.
Controller creates `valet-v2` and registers it as the new Current.

Steps 9-10: the controller polls Temporal until `valet-v1` is drained.
Then it deletes the `valet-v1` Deployment.
The developer never ran a single CLI command after `kubectl apply`.

---

## Diagram Slide: Resource Topology

*(Use the resource topology diagram here)*

**Speaker notes**
This is what the cluster looks like mid-rollout.

One `TemporalWorkerDeployment` named "valet" at the top.
Under it, two standard Kubernetes Deployments - one per active version.

Each Deployment manages its own ReplicaSet and Pods.
Those pods are ordinary workers - they just poll with different build IDs.

Each version polls Temporal with its own deployment version identifier.
Temporal uses that to route workflow tasks to the right pods.

---

## Slide 3: Rollout Strategies

**Bullets**
`AllAtOnce`: all replicas cut over immediately
`Progressive`: ramp steps with configurable pauses between each
`Manual`: version stays Inactive - you promote when ready
Progressive is the safe default for non-replay-safe changes

**Speaker notes**
`AllAtOnce` is fine for first deploys or replay-safe changes - simple, no overlap.

`Progressive` is the one you want for code changes.
You specify ramp steps with percentages and pause durations.
The controller moves through them automatically, ramping 25% to 75% to 100%.
Old pinned workflows drain on the side the whole time.

`Manual` stops the controller from promoting at all.
The new version registers with Temporal but takes zero production traffic.
Useful for pre-deployment testing - which we'll get to in a moment.

---

## Slide 4: TemporalWorkerDeployment CRD

**Bullets**
Temporal ships the CRD - you install it once via Helm
One CR per worker deployment, lives in your repo
`kubectl apply` is how you make changes
Controller reconciles the cluster to match

**Speaker notes**
Temporal provides the `TemporalWorkerDeployment` Custom Resource Definition.
You install it once when you set up the Worker Controller via Helm.

After that, you define one CR per worker deployment and commit it to your repo.
That file is your deployment's source of truth.

To make any change - new image, new strategy, new gate - you edit the manifest and apply it.
The controller sees the diff and reconciles the cluster to match.

No imperative CLI steps, no scripts to maintain.
The manifest is the deploy.

---

## Slide 4b: The Manifest

**Bullets**
`kind: TemporalWorkerDeployment` - handled by the controller
`connectionRef` - points to your `TemporalClusterConnection`
`image` - the only field that changes most deploys
`rollout.strategy` - swap to `Progressive` for code changes
`sunset` - without it, drained versions pile up forever

**Speaker notes**
`connectionRef` points to a `TemporalClusterConnection` you set up once.
All your worker manifests share it.

`image` is the only field that changes on most deploys.
Update it, apply, done.

`rollout.strategy` defaults to `AllAtOnce`.
For non-replay-safe changes, switch to `Progressive` and add ramp steps.

`sunset` is easy to forget but important.
Without it, drained versioned Deployments accumulate in your cluster indefinitely.

```yaml
apiVersion: temporal.io/v1alpha1
kind: TemporalWorkerDeployment
metadata:
  name: valet-worker
  namespace: default
spec:
  workerOptions:
    connectionRef:
      name: cluster-default
    temporalNamespace: default
  rollout:
    strategy: AllAtOnce
  sunset:
    scaledownDelay: 30s
    deleteDelay: 2m
  replicas: 1
  template:
    spec:
      containers:
        - name: valet-worker
          image: valet-worker:1.0
          imagePullPolicy: IfNotPresent
```

---

## Slide 5: Sunsetting

**Bullets**
`scaledownDelay` - wait after draining before scaling to zero
`deleteDelay` - wait before deleting the versioned Deployment
Without sunset config, old versions hang around indefinitely
Controller polls Temporal for drainage status automatically

**Speaker notes**
Sunsetting is the cleanup phase.
Once a version stops being Current or Ramping, its pinned workflows finish and it enters Draining.

The controller polls Temporal until the version reports as Drained.

`scaledownDelay` gives you a grace period before scaling pods to zero.
Useful if you serve queries on closed workflows.

`deleteDelay` adds another buffer before the Deployment is deleted entirely.

Without these configured, old versioned Deployments pile up in your cluster indefinitely.

---

## Slide 6: Gate Workflows

**Bullets**
Runs on the new version's workers before any traffic routes to it
Gate passes: rollout proceeds
Gate fails: version stays Inactive, production unaffected
Catches bad deploys before customers see them

**Speaker notes**
A gate workflow is a pre-flight check that runs on your new worker code.
No production workflow touches the new version until the gate passes.

You specify a workflow type in `spec.rollout.gate`.
The controller starts it on the new version and waits for it to complete.
Only then does ramping begin.

Common gate checks: service connectivity, credential validation, schema compatibility.

If the gate fails, the new version never takes traffic.
Production stays on the current version.
Fix the problem, ship a new image, and the gate runs again.

---

## Slide 7: Pre-Deployment Testing with Synthetic Traffic

**Bullets**
`Manual` strategy: version registers but stays Inactive
`VersioningOverride` pins a workflow to a specific version
Run a test workflow against the Inactive version
Promote only after the test passes

**Speaker notes**
The `Manual` strategy combined with `VersioningOverride` gives you a sandbox on real infrastructure.

The new version registers with Temporal and its pods are running.
But Temporal won't route any production tasks to it.

You start a test workflow pinned to that build ID via `VersioningOverride`.
It runs the full code path on the real server, real task queue, real downstream services.

When it completes successfully, update the manifest to `Progressive` and apply.
The controller promotes it.

This catches what unit tests and replay tests can't: secret misconfigs, dependency issues,
infrastructure problems - all before production traffic is affected.
