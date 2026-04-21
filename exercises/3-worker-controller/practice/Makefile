PYTHON ?= ../../../env/bin/python
tag ?= latest
IMAGE_NAME = valet-worker
WORKER_CONTROLLER_NAMESPACE = temporal-worker-controller
WORKER_CONTROLLER_VERSION ?= 0.24.0

.PHONY: setup build deploy get-status get-logs run-load-simulator run-synthetic run-worker run-tests clean

## setup - start minikube, install Worker Controller (assumes Temporal dev server already running)
setup:
	@echo "==> Starting minikube..."
	minikube start --driver=docker --cpus=2 --memory=2048 --force
	@echo "==> Installing Worker Controller CRDs..."
	kubectl create namespace $(WORKER_CONTROLLER_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	helm upgrade --install temporal-worker-controller-crds \
		oci://docker.io/temporalio/temporal-worker-controller-crds \
		--version $(WORKER_CONTROLLER_VERSION) \
		--namespace $(WORKER_CONTROLLER_NAMESPACE)
	@echo "==> Installing cert-manager..."
	helm repo add jetstack https://charts.jetstack.io --force-update
	helm upgrade --install cert-manager jetstack/cert-manager \
		--namespace cert-manager \
		--create-namespace \
		--set crds.enabled=true \
		--wait --timeout 5m
	@echo "==> Installing Worker Controller..."
	helm upgrade --install temporal-worker-controller \
		oci://docker.io/temporalio/temporal-worker-controller \
		--version $(WORKER_CONTROLLER_VERSION) \
		--namespace $(WORKER_CONTROLLER_NAMESPACE) \
		--set replicas=1 \
		--wait --timeout 5m
	@echo "==> Applying TemporalConnection..."
	kubectl apply -f k8s/temporal-connection.yaml
	@echo "==> Setup complete. Verifying pods..."
	kubectl get pods -n $(WORKER_CONTROLLER_NAMESPACE)
	kubectl get crd | grep temporal

## build - build Docker image inside minikube's Docker daemon
build:
	@echo "==> Building image $(IMAGE_NAME):$(tag) in minikube..."
	eval $$(minikube docker-env) && docker build -t $(IMAGE_NAME):$(tag) .

## deploy - apply TemporalConnection + TemporalWorkerDeployment
deploy:
	@echo "==> Deploying valet worker..."
	kubectl apply -f k8s/temporal-connection.yaml
	kubectl apply -f k8s/valet-worker.yaml
	@echo "==> Deployed. Run 'make get-status' to check."

## get-status - show TemporalWorkerDeployment and Deployments
get-status:
	@echo "==> TemporalWorkerDeployments:"
	kubectl get twd
	@echo ""
	@echo "==> Deployments:"
	kubectl get deployments
	@echo ""
	@echo "==> Pods:"
	kubectl get pods

## get-logs - show Worker Controller logs
get-logs:
	kubectl logs -n $(WORKER_CONTROLLER_NAMESPACE) -l app.kubernetes.io/name=temporal-worker-controller --tail=100 -f

## run-worker - run the worker locally
run-worker:
	PYTHONPATH=. exec $(PYTHON) -m valet.worker

## run-load-simulator - run the load simulator locally (Temporal dev server must be running)
run-load-simulator:
	PYTHONPATH=. exec $(PYTHON) -m valet.load_simulator

## run-synthetic - send synthetic traffic pinned to a specific version
## Usage: make run-synthetic BUILD_ID=3.0-9bd4
run-synthetic:
	TEMPORAL_WORKER_BUILD_ID=$(BUILD_ID) PYTHONPATH=. exec $(PYTHON) valet/test_version.py

## run-tests - run tests
run-tests:
	PYTHONPATH=. exec $(PYTHON) -m pytest tests/ -v

## clean - tear down everything
clean:
	@echo "==> Deleting worker deployment..."
	-kubectl delete -f k8s/valet-worker.yaml
	-kubectl delete -f k8s/temporal-connection.yaml
	@echo "==> Uninstalling Worker Controller..."
	-helm uninstall temporal-worker-controller -n $(WORKER_CONTROLLER_NAMESPACE)
	-helm uninstall temporal-worker-controller-crds -n $(WORKER_CONTROLLER_NAMESPACE)
	-helm uninstall cert-manager -n cert-manager
