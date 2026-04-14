"""Send synthetic traffic to a specific worker version for pre-deployment testing.

Usage:
    TEMPORAL_WORKER_BUILD_ID=3.0-9bd4 PYTHONPATH=. python valet/test_version.py

Reads TEMPORAL_DEPLOYMENT_NAME and TEMPORAL_WORKER_BUILD_ID from the
environment. The build ID must match exactly what Temporal registered
(the Worker Controller appends a hash suffix to the image tag, e.g.
"3.0-9bd4"). Use `temporal worker deployment describe` to find it.

The workflow runs end-to-end on the target version's workers: it parks a car,
waits briefly, retrieves it, and bills the customer.  You can inspect the
completed workflow in the Temporal UI to verify it behaved correctly.
"""

import asyncio
import os
import sys

from temporalio.client import Client
from temporalio.common import PinnedVersioningOverride, WorkerDeploymentVersion

from valet.models import Location, LocationKind, ValetParkingInput
from valet.valet_parking_workflow import ValetParkingWorkflow


async def main() -> None:
    temporal_address = os.environ.get("TEMPORAL_ADDRESS", "localhost:7233")
    temporal_namespace = os.environ.get("TEMPORAL_NAMESPACE", "default")
    deployment_name = os.environ.get("TEMPORAL_DEPLOYMENT_NAME", "default/valet-worker")
    build_id = os.environ.get("TEMPORAL_WORKER_BUILD_ID", "")

    if not build_id:
        print("Error: BUILD_ID is required. Example: make run-synthetic BUILD_ID=3.0-9bd4")
        print("Run 'temporal worker deployment describe --name \"default/valet-worker\"' to find the build ID.")
        sys.exit(1)

    client = await Client.connect(temporal_address, namespace=temporal_namespace)

    workflow_id = f"test-{build_id}"
    print(f"Sending synthetic traffic to {deployment_name}.{build_id} ...")

    result = await client.execute_workflow(
        ValetParkingWorkflow.run,
        ValetParkingInput(
            license_plate="TEST",
            trip_duration_seconds=5,
            valet_zone_location=Location(kind=LocationKind.VALET_ZONE, id="1"),
        ),
        id=workflow_id,
        task_queue="valet",
        versioning_override=PinnedVersioningOverride(
            WorkerDeploymentVersion(deployment_name, build_id),
        ),
    )

    print(f"Test workflow completed: {result}")


if __name__ == "__main__":
    asyncio.run(main())
