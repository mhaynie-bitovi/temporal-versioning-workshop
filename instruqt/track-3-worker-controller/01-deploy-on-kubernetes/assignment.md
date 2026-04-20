---
slug: deploy-on-kubernetes
id: ""
type: challenge
title: "Deploy on Kubernetes"
teaser: "Deploy your first versioned worker via a TemporalWorkerDeployment CRD"
tabs:
- type: terminal
  title: Terminal 1
  hostname: workstation
- type: terminal
  title: Terminal 2
  hostname: workstation
- type: terminal
  title: Load Simulator
  hostname: workstation
- type: code
  title: Code Editor
  hostname: workstation
  path: /root/temporal-versioning-workshop/exercises/3-worker-controller/practice
- type: service
  title: Temporal UI
  hostname: workstation
  port: 8233
difficulty: basic
timelimit: 1500
---

# Part A - Deploy on Kubernetes

Your valet parking system is moving to Kubernetes. Instead of starting workers by hand like you did in Exercises 1 and 2, you'll declare the desired state in a `TemporalWorkerDeployment` manifest and let the Worker Controller handle the rest - creating versioned Deployments, registering build IDs with Temporal, and managing pod lifecycles.

> **Note:** The Temporal dev server is already running, and `make setup` has been run (minikube, Worker Controller, and the `TemporalClusterConnection` resource are all configured). Your terminals start in the exercise's `practice/` directory with the Python virtual environment activated.

1. Briefly examine the k8s manifests in the **Code Editor**:
   - `k8s/temporal-connection.yaml` - points to the host Temporal server. We will not modify this manifest during this exercise.
   - `k8s/valet-worker.yaml` - This is the main manifest we'll modify throughout this exercise - updating it and re-applying is how we'll interact with the Kubernetes cluster.

> *The initial manifest uses `AllAtOnce` - every replica cuts over immediately. This is fine for the first deploy, but for non-replay-safe changes you'll want a `Progressive` strategy so old and new versions coexist safely. We'll switch to that in Part B.*

2. Build and deploy 1.0 (in the **Terminal 1** tab):

```bash
make build tag=1.0
kubectl apply -f k8s/valet-worker.yaml
```

3. Verify the TemporalWorkerDeployment exists, the controller created a versioned Deployment, and worker pods are Running:

```bash
kubectl get twd
kubectl get deployments
kubectl get pods
```

   You should see the `valet-worker` TWD, a Deployment named something like `valet-worker-<build-id>-<hash>`, and pods in `Running` status with `1/1` ready.

4. Start the load simulator (in the **Load Simulator** tab):

```bash
make run-load-simulator
```

> *Keep this running for the rest of the exercise.*

5. Check the **Temporal UI** tab - workflows are flowing.
