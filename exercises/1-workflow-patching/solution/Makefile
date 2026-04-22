PYTHON ?= ../../../env/bin/python

.PHONY: run-worker run-load-simulator run-starter run-tests

run-worker:
	PYTHONPATH=. exec $(PYTHON) -m valet.worker

run-load-simulator:
	PYTHONPATH=. exec $(PYTHON) -m valet.load_simulator

run-starter:
	WORKFLOW_ID="$(WORKFLOW_ID)" PYTHONPATH=. exec $(PYTHON) -m valet.starter

run-tests:
	PYTHONPATH=. exec $(PYTHON) -m pytest tests/ -v
