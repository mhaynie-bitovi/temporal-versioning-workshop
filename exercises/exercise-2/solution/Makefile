PYTHON ?= ../../../env/bin/python
DEPLOYMENT_NAME ?= valet
BUILD_ID ?= 1.0

.PHONY: start-worker start-load-simulator run-starter run-tests

start-worker:
	TEMPORAL_DEPLOYMENT_NAME=$(DEPLOYMENT_NAME) TEMPORAL_WORKER_BUILD_ID=$(BUILD_ID) PYTHONPATH=. exec $(PYTHON) -m valet.worker

start-load-simulator:
	PYTHONPATH=. exec $(PYTHON) -m valet.load_simulator

run-starter:
	PYTHONPATH=. exec $(PYTHON) -m valet.starter

run-tests:
	PYTHONPATH=. exec $(PYTHON) -m pytest tests/ -v
