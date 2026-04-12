PYTHON ?= ../../../env/bin/python

.PHONY: start-worker start-load-simulator run-starter run-tests

start-worker:
	PYTHONPATH=. exec $(PYTHON) -m valet.worker

start-load-simulator:
	PYTHONPATH=. exec $(PYTHON) -m valet.load_simulator

run-starter:
	PYTHONPATH=. exec $(PYTHON) -m valet.starter

run-tests:
	PYTHONPATH=. exec $(PYTHON) -m pytest tests/ -v
