import asyncio
import logging
import os

from temporalio import activity, workflow
from temporalio.client import Client
from temporalio.worker import Worker
from temporalio.worker.workflow_sandbox import SandboxedWorkflowRunner, SandboxRestrictions

from temporalio.common import WorkerDeploymentVersion
from temporalio.worker import WorkerDeploymentConfig

from valet.activities import (
    bill_customer,
    move_car,
    notify_owner,
    release_parking_space,
    request_parking_space,
)
from valet.parking_lot_workflow import ParkingLotWorkflow
from valet.valet_parking_workflow import ValetParkingWorkflow


async def main():
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    # Simplify log output: don't append Temporal context dicts to messages
    workflow.logger.workflow_info_on_message = False
    activity.logger.activity_info_on_message = False

    temporal_address = os.environ.get("TEMPORAL_ADDRESS", "localhost:7233")
    temporal_namespace = os.environ.get("TEMPORAL_NAMESPACE", "default")

    client = await Client.connect(temporal_address, namespace=temporal_namespace)

    worker = Worker(
        client,
        task_queue="valet",
        workflows=[ValetParkingWorkflow, ParkingLotWorkflow],
        activities=[move_car, request_parking_space, release_parking_space, notify_owner, bill_customer],
        # TODO (Part A.3): Add deployment_config here
        # deployment_config=WorkerDeploymentConfig(
        #     version=WorkerDeploymentVersion(
        #         deployment_name=os.environ["TEMPORAL_DEPLOYMENT_NAME"],
        #         build_id=os.environ["TEMPORAL_WORKER_BUILD_ID"],
        #     ),
        #     use_worker_versioning=True,
        # ),
        workflow_runner=SandboxedWorkflowRunner(
            # Prevent the sandbox from re-reading workflow code from disk on each run.
            # Without this, a running worker would pick up file edits without a restart.
            restrictions=SandboxRestrictions.default.with_passthrough_modules("valet")
        ),
    )

    print("Worker running ...")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
