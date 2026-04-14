from datetime import timedelta

from temporalio import workflow
from temporalio.common import VersioningBehavior

with workflow.unsafe.imports_passed_through():
    from valet.activities import check_billing_service, check_notification_service


@workflow.defn(versioning_behavior=VersioningBehavior.PINNED)
class ValetGateWorkflow:
    """Pre-deployment gate: verifies downstream services are reachable.

    The controller runs this workflow on the new version's workers while they
    are still Inactive. If any check fails, the rollout is blocked and
    production traffic is unaffected.
    """

    @workflow.run
    async def run(self) -> str:
        await workflow.execute_activity(
            check_notification_service,
            start_to_close_timeout=timedelta(seconds=10),
        )

        await workflow.execute_activity(
            check_billing_service,
            start_to_close_timeout=timedelta(seconds=10),
        )

        return "ok"
