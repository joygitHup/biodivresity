"""两级调度（边缘轻量模型 + 云端大模型）回归测试。"""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.devices.models import Device
from apps.records.models import MonitorRecord
from apps.species.models import Species
from apps.system_config.models import SystemConfig

from apps.inference.models import MediaAsset, PredictionTask
from apps.inference.providers.base import PredictionItem, PredictResult
from apps.inference.services import (
    cloud_budget_used,
    decide_edge,
    edge_settings,
    execute_task,
    report_edge_result,
    scheduling_stats,
)


class StaticProvider:
    name = "static"

    def __init__(self, result: PredictResult):
        self.result = result

    def predict_image(self, asset, context):
        return self.result

    def predict_audio(self, asset, context):
        return self.result

    def health(self):
        return {"status": "ok"}


def make_result(species: Species, confidence: float, second: float | None = None,
                quality_flag: str = "", provider: str = "static") -> PredictResult:
    items = [PredictionItem(species.id, species.chinese_name, species.latin_name,
                            confidence, protection_level=species.protection_level)]
    if second is not None:
        other = Species.objects.exclude(pk=species.pk).first()
        if other:
            items.append(PredictionItem(other.id, other.chinese_name, other.latin_name, second))
    return PredictResult(top_k=items, model_version=f"{provider}-v1", provider=provider,
                         latency_ms=20, quality_flag=quality_flag)


class TwoTierSchedulingTestCase(TestCase):
    def setUp(self):
        self.common = Species.objects.create(
            chinese_name="黄腹角雉", latin_name="Tragopan caboti",
            protection_level=Species.ProtectionLevel.NONE,
        )
        self.protected = Species.objects.create(
            chinese_name="黑麂", latin_name="Muntiacus crinifrons",
            protection_level=Species.ProtectionLevel.NATIONAL_1,
        )
        self.device = Device.objects.create(
            name="边缘网关-A", type="infrared_camera", location="百山祖",
            edge_enabled=True,
        )
        self.asset = MediaAsset.objects.create(
            file="media_assets/test.jpg", source_type=MediaAsset.SourceType.IMAGE,
            sha256="a" * 64, device=self.device,
        )

    def tearDown(self):
        SystemConfig.objects.all().delete()

    def _task(self, tier=PredictionTask.Tier.EDGE) -> PredictionTask:
        return PredictionTask.objects.create(
            request_id=f"req_test_{PredictionTask.objects.count()}",
            asset=self.asset, task_type=PredictionTask.TaskType.IMAGE, tier=tier,
        )

    def test_edge_high_confidence_accepted_without_cloud(self):
        task = self._task()
        edge = make_result(self.common, 0.95, second=0.2, provider="edge")
        with patch("apps.inference.services.get_edge_provider",
                   return_value=StaticProvider(edge)), \
             patch("apps.inference.services.get_provider") as cloud:
            outcome = execute_task(task.id)

        cloud.assert_not_called()
        task.refresh_from_db()
        self.assertEqual(task.status, PredictionTask.Status.SUCCEEDED)
        self.assertEqual(task.decided_by, PredictionTask.DecidedBy.EDGE)
        self.assertEqual(task.tier, PredictionTask.Tier.EDGE)
        self.assertFalse(task.escalated)
        self.assertIsNotNone(task.edge_confidence)
        self.assertEqual(outcome["record_id"], task.record_id)
        self.assertTrue(MonitorRecord.objects.filter(pk=task.record_id).exists())

    def test_low_confidence_escalates_to_cloud(self):
        task = self._task()
        edge = make_result(self.common, 0.58, second=0.3, provider="edge")
        cloud = make_result(self.common, 0.92, provider="cloud")
        with patch("apps.inference.services.get_edge_provider",
                   return_value=StaticProvider(edge)), \
             patch("apps.inference.services.get_provider",
                   return_value=StaticProvider(cloud)):
            execute_task(task.id)

        task.refresh_from_db()
        self.assertTrue(task.escalated)
        self.assertEqual(task.escalation_reason, PredictionTask.EscalationReason.LOW_CONFIDENCE)
        self.assertEqual(task.decided_by, PredictionTask.DecidedBy.CLOUD)
        self.assertEqual(task.tier, PredictionTask.Tier.CLOUD)
        self.assertEqual(task.cloud_confidence, 0.92)
        self.assertEqual(task.edge_confidence, 0.58)

    def test_protected_species_forces_cloud(self):
        task = self._task()
        edge = make_result(self.protected, 0.98, second=0.1, provider="edge")
        cloud = make_result(self.protected, 0.99, provider="cloud")
        with patch("apps.inference.services.get_edge_provider",
                   return_value=StaticProvider(edge)), \
             patch("apps.inference.services.get_provider",
                   return_value=StaticProvider(cloud)):
            execute_task(task.id)

        task.refresh_from_db()
        self.assertTrue(task.escalated)
        self.assertEqual(task.escalation_reason,
                         PredictionTask.EscalationReason.PROTECTED_SPECIES)

    def test_ambiguous_candidates_escalate(self):
        task = self._task()
        edge = make_result(self.common, 0.9, second=0.88, provider="edge")
        cloud = make_result(self.common, 0.93, provider="cloud")
        with patch("apps.inference.services.get_edge_provider",
                   return_value=StaticProvider(edge)), \
             patch("apps.inference.services.get_provider",
                   return_value=StaticProvider(cloud)):
            execute_task(task.id)

        task.refresh_from_db()
        self.assertEqual(task.escalation_reason, PredictionTask.EscalationReason.AMBIGUOUS)

    def test_edge_error_falls_back_to_cloud(self):
        task = self._task()
        cloud = make_result(self.common, 0.9, provider="cloud")
        with patch("apps.inference.services.get_edge_provider",
                   side_effect=RuntimeError("edge down")), \
             patch("apps.inference.services.get_provider",
                   return_value=StaticProvider(cloud)):
            execute_task(task.id)

        task.refresh_from_db()
        self.assertEqual(task.status, PredictionTask.Status.SUCCEEDED)
        self.assertTrue(task.escalated)
        self.assertEqual(task.escalation_reason, PredictionTask.EscalationReason.EDGE_ERROR)
        self.assertEqual(task.decided_by, PredictionTask.DecidedBy.CLOUD)

    def test_edge_disabled_runs_cloud_only(self):
        SystemConfig.objects.create(key="edge_enabled", value="false")
        task = self._task(tier=PredictionTask.Tier.CLOUD)
        cloud = make_result(self.common, 0.9, provider="cloud")
        with patch("apps.inference.services.get_provider",
                   return_value=StaticProvider(cloud)):
            execute_task(task.id)

        task.refresh_from_db()
        self.assertEqual(task.decided_by, PredictionTask.DecidedBy.CLOUD)
        self.assertIsNone(task.edge_confidence)
        self.assertFalse(task.escalated)

    def test_budget_exhausted_accepts_edge_with_degraded_flag(self):
        SystemConfig.objects.create(key="edge_cloud_daily_budget", value="1")
        PredictionTask.objects.create(
            request_id="req_budget_prior", asset=self.asset,
            task_type=PredictionTask.TaskType.IMAGE,
            tier=PredictionTask.Tier.CLOUD, started_at=timezone.now(),
        )
        self.assertEqual(cloud_budget_used(), 1)

        task = self._task()
        edge = make_result(self.common, 0.7, second=0.2, provider="edge")
        with patch("apps.inference.services.get_edge_provider",
                   return_value=StaticProvider(edge)), \
             patch("apps.inference.services.get_provider") as cloud:
            execute_task(task.id)

        cloud.assert_not_called()
        task.refresh_from_db()
        self.assertEqual(task.status, PredictionTask.Status.SUCCEEDED)
        self.assertEqual(task.decided_by, PredictionTask.DecidedBy.EDGE)
        self.assertEqual(task.escalation_reason,
                         PredictionTask.EscalationReason.BUDGET_EXHAUSTED)
        record = MonitorRecord.objects.get(pk=task.record_id)
        self.assertEqual(record.quality_flag, "edge_budget_degraded")

    def test_budget_exhausted_and_low_confidence_defers_task(self):
        SystemConfig.objects.create(key="edge_cloud_daily_budget", value="1")
        PredictionTask.objects.create(
            request_id="req_budget_prior2", asset=self.asset,
            task_type=PredictionTask.TaskType.IMAGE,
            tier=PredictionTask.Tier.CLOUD, started_at=timezone.now(),
        )
        task = self._task()
        edge = make_result(self.common, 0.45, second=0.2, provider="edge")
        with patch("apps.inference.services.get_edge_provider",
                   return_value=StaticProvider(edge)):
            execute_task(task.id)

        task.refresh_from_db()
        self.assertEqual(task.status, PredictionTask.Status.PENDING)
        self.assertEqual(task.error_code, "cloud_budget_exhausted")
        self.assertIsNotNone(task.next_retry_at)

    def test_edge_settings_runtime_update(self):
        SystemConfig.objects.create(key="edge_accept_threshold", value="0.7")
        self.assertEqual(edge_settings()["accept_threshold"], 0.7)
        result = make_result(self.common, 0.72, second=0.2)
        accept, reason = decide_edge(result, edge_settings())
        self.assertTrue(accept)
        self.assertEqual(reason, "")

    def test_report_edge_result_accept_and_escalate(self):
        task = self._task()
        verdict = report_edge_result(
            self.asset, {"top_k": [{"species_id": self.common.id, "confidence": 0.95},
                                   {"species_id": self.protected.id, "confidence": 0.2}]},
            provider="edge-gw", latency_ms=12,
        )
        self.assertEqual(verdict["decision"], "accepted")
        task.refresh_from_db()
        self.assertEqual(task.status, PredictionTask.Status.SUCCEEDED)
        self.assertEqual(task.edge_provider, "edge-gw")

        asset2 = MediaAsset.objects.create(
            file="media_assets/test2.jpg", source_type=MediaAsset.SourceType.IMAGE,
            sha256="b" * 64, device=self.device,
        )
        verdict = report_edge_result(
            asset2, {"top_k": [{"species_id": self.common.id, "confidence": 0.6},
                               {"species_id": self.protected.id, "confidence": 0.55}]},
        )
        self.assertEqual(verdict["decision"], "escalated")
        self.assertEqual(verdict["reason"], PredictionTask.EscalationReason.AMBIGUOUS)

    def test_scheduling_stats(self):
        task = self._task()
        edge = make_result(self.common, 0.95, second=0.2, provider="edge")
        with patch("apps.inference.services.get_edge_provider",
                   return_value=StaticProvider(edge)), \
             patch("apps.inference.services.get_provider") as cloud:
            execute_task(task.id)
            cloud.assert_not_called()

        stats = scheduling_stats(days=7)
        self.assertEqual(stats["edgeTasks"], 1)
        self.assertEqual(stats["edgeAccepted"], 1)
        self.assertEqual(stats["cloudCallsSaved"], 1)
        self.assertEqual(stats["escalated"], 0)
        self.assertEqual(stats["acceptRate"], 100.0)
        self.assertIn("policy", stats)

    def test_edge_report_api(self):
        user = get_user_model().objects.create_user(username="edgegw", password="x")
        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.post("/api/v1/inference/edge/report/", {
            "asset_id": self.asset.id,
            "top_k": [{"species_id": self.common.id, "confidence": 0.96}],
            "model_version": "edge-v0.4.0",
            "latency_ms": 12,
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["data"]["decision"], "accepted")
        self.assertEqual(PredictionTask.objects.filter(asset=self.asset).count(), 1)
