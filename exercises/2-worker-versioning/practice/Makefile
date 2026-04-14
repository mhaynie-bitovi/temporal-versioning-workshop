PYTHON ?= ../../../env/bin/python
DEPLOYMENT_NAME ?= valet
BUILD_ID ?= 1.0

.PHONY: run-worker run-load-simulator run-starter run-tests

run-worker:
	TEMPORAL_DEPLOYMENT_NAME=$(DEPLOYMENT_NAME) TEMPORAL_WORKER_BUILD_ID=$(BUILD_ID) PYTHONPATH=. exec $(PYTHON) -m valet.worker

run-load-simulator:
	PYTHONPATH=. exec $(PYTHON) -m valet.load_simulator

run-starter:
	PYTHONPATH=. exec $(PYTHON) -m valet.starter

run-tests:
	PYTHONPATH=. exec $(PYTHON) -m pytest tests/ -v
