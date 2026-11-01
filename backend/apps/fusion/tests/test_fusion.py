"""跨模态证据融合回归测试：融合权重、时间衰减、eDNA 语义与冲突检测。"""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.devices.models import Device
from apps.records.models import MonitorRecord
from apps.species.models import Species
from apps.survey_areas.models import SurveyArea
from apps.system_config.models import SystemConfig
from apps.alerts.models import Alert

from apps.fusion.models import ClusterEvidence, EdnaEvidence, EvidenceCluster, FusionReviewLog
from apps.fusion.services import (
    distribution_stats,
    maybe_rebuild_recent,
    rebuild_window,
    record_review,
    window_bounds,
)


class FusionTestCase(TestCase):
    def setUp(self):
        self.area = SurveyArea.objects.create(
            name="测试样区", type=SurveyArea.Type.FOREST, area=10.0,
            elevation="500-800", lat=27.9, lng=119.2,
        )
        self.species = Species.objects.create(
            chinese_name="番茄晚疫病", latin_name="Phytophthora infestans",
            severity=Species.Severity.CRITICAL,
        )
        self.other = Species.objects.create(
            chinese_name="番茄早疫病", latin_name="Alternaria solani",
            severity=Species.Severity.MEDIUM,
        )
        self.device = Device.objects.create(
            name="红外相机-T01", type=Device.Type.INFRARED_CAMERA,
            survey_area=self.area,
        )
        self.now = timezone.now().replace(minute=0, second=0, microsecond=0)
        self.start, self.end = window_bounds(self.now, 24)

    def tearDown(self):
        SystemConfig.objects.all().delete()

    def _record(self, species=None, media_type="image", confidence=0.7,
                timestamp=None, audio_reliability=None, quality_flag=""):
        return MonitorRecord.objects.create(
            device=self.device,
            survey_area=self.area,
            species=species or self.species,
            timestamp=timestamp or self.now,
            confidence=confidence,
            media_type=media_type,
            audio_reliability=audio_reliability,
            quality_flag=quality_flag,
        )

    def _rebuild(self):
        return rebuild_window(self.start, self.end)

    def test_multimodal_fusion_raises_confidence_and_grade(self):
        self._record(media_type="image", confidence=0.78)
        self._record(media_type="audio", confidence=0.9, audio_reliability=0.9)
        self._rebuild()

        cluster = EvidenceCluster.objects.get()
        self.assertEqual(cluster.modality_count, 2)
        self.assertGreater(cluster.fused_confidence, 0.8)
        self.assertEqual(cluster.fused_grade, EvidenceCluster.Grade.STRONG)
        self.assertEqual(cluster.evidences.count(), 2)

    def test_single_modality_is_insufficient(self):
        self._record(media_type="image", confidence=0.95)
        self._rebuild()

        cluster = EvidenceCluster.objects.get()
        self.assertEqual(cluster.modality_count, 1)
        self.assertEqual(cluster.fused_grade, EvidenceCluster.Grade.INSUFFICIENT)

    def test_time_decay_downweights_far_evidence(self):
        SystemConfig.objects.create(key="fusion_time_decay_half_life_hours", value="1")
        center = self.start + (self.end - self.start) / 2
        self._record(media_type="audio", confidence=0.8, audio_reliability=0.8,
                     timestamp=center)
        self._record(media_type="audio", confidence=0.8, audio_reliability=0.8,
                     timestamp=center + timedelta(hours=6))
        self._rebuild()

        weights = list(
            ClusterEvidence.objects.order_by("observed_at").values_list("weight", flat=True)
        )
        self.assertGreater(weights[0], weights[1])

    def test_time_decay_can_be_disabled(self):
        SystemConfig.objects.create(key="fusion_time_decay_enabled", value="false")
        center = self.start + (self.end - self.start) / 2
        self._record(media_type="audio", confidence=0.8, audio_reliability=0.8,
                     timestamp=center)
        self._record(media_type="audio", confidence=0.8, audio_reliability=0.8,
                     timestamp=center + timedelta(hours=6))
        self._rebuild()

        weights = list(ClusterEvidence.objects.values_list("weight", flat=True))
        self.assertAlmostEqual(weights[0], weights[1], places=4)

    def test_low_reliability_audio_is_filtered(self):
        SystemConfig.objects.create(key="fusion_min_evidence_reliability", value="0.6")
        self._record(media_type="audio", confidence=0.9, audio_reliability=0.3,
                     quality_flag="audio_unreliable")
        self._rebuild()
        self.assertEqual(EvidenceCluster.objects.count(), 0)

    def test_edna_positive_adds_modality(self):
        self._record(media_type="image", confidence=0.78)
        EdnaEvidence.objects.create(
            species=self.species, survey_area=self.area, sampled_at=self.now,
            result=EdnaEvidence.Result.POSITIVE, detection_confidence=0.9,
        )
        self._rebuild()

        cluster = EvidenceCluster.objects.get()
        self.assertTrue(cluster.has_edna)
        self.assertEqual(cluster.modality_count, 2)
        self.assertGreaterEqual(cluster.fused_confidence, 0.84)

    def test_edna_negative_reduces_confidence(self):
        self._record(media_type="image", confidence=0.85)
        EdnaEvidence.objects.create(
            species=self.species, survey_area=self.area, sampled_at=self.now,
            result=EdnaEvidence.Result.NEGATIVE, detection_confidence=0.95,
        )
        self._rebuild()

        cluster = EvidenceCluster.objects.get()
        self.assertTrue(cluster.conflict_flag)
        self.assertLess(cluster.fused_confidence, 0.85)
        self.assertEqual(cluster.fused_grade, EvidenceCluster.Grade.CONFLICT)

    def test_edna_negative_can_be_disabled(self):
        SystemConfig.objects.create(key="fusion_edna_negative_enabled", value="false")
        self._record(media_type="image", confidence=0.85)
        EdnaEvidence.objects.create(
            species=self.species, survey_area=self.area, sampled_at=self.now,
            result=EdnaEvidence.Result.NEGATIVE, detection_confidence=0.95,
        )
        self._rebuild()

        cluster = EvidenceCluster.objects.get()
        self.assertFalse(cluster.has_edna)
        self.assertFalse(cluster.conflict_flag)

    def test_rebuild_is_idempotent(self):
        self._record(media_type="image", confidence=0.8)
        self._record(media_type="audio", confidence=0.85, audio_reliability=0.8)
        self._rebuild()
        self._rebuild()

        self.assertEqual(EvidenceCluster.objects.count(), 1)
        self.assertEqual(ClusterEvidence.objects.count(), 2)

    def test_cross_species_conflict_marks_weaker_cluster(self):
        SystemConfig.objects.create(key="fusion_conflict_margin", value="0.1")
        self._record(species=self.species, media_type="image", confidence=0.85)
        self._record(species=self.species, media_type="audio", confidence=0.85,
                     audio_reliability=0.9)
        self._record(species=self.other, media_type="image", confidence=0.98)
        self._record(species=self.other, media_type="audio", confidence=0.98,
                     audio_reliability=0.95)
        self._rebuild()

        weaker = EvidenceCluster.objects.get(species=self.species)
        stronger = EvidenceCluster.objects.get(species=self.other)
        self.assertTrue(weaker.conflict_flag)
        self.assertIn(stronger.species.chinese_name, weaker.conflict_note)
        self.assertFalse(stronger.conflict_flag)

    def test_video_has_independent_weight(self):
        SystemConfig.objects.create(key="fusion_weight_image", value="0.8")
        SystemConfig.objects.create(key="fusion_weight_video", value="1.2")
        self._record(media_type="image", confidence=0.8)
        self._record(media_type="video", confidence=0.8)
        self._rebuild()

        weights = {
            ev.monitor_record.media_type: ev.weight
            for ev in ClusterEvidence.objects.select_related("monitor_record")
        }
        self.assertGreater(weights["video"], weights["image"])

    def test_device_coordinates_affect_spatial_weight(self):
        far_device = Device.objects.create(
            name="远端相机", type=Device.Type.INFRARED_CAMERA, survey_area=self.area,
            lat=self.area.lat + 0.3, lng=self.area.lng + 0.3,
        )
        self._record(media_type="image", confidence=0.8)
        MonitorRecord.objects.create(
            device=far_device, survey_area=self.area, species=self.species,
            timestamp=self.now, confidence=0.8, media_type="image",
        )
        self._rebuild()

        weights = list(
            ClusterEvidence.objects.select_related("monitor_record__device")
            .order_by("id").values_list("weight", flat=True)
        )
        self.assertGreater(weights[0], weights[1])

    def test_strong_protected_evidence_creates_deduplicated_alert(self):
        self._record(media_type="image", confidence=0.9)
        self._record(media_type="audio", confidence=0.9, audio_reliability=0.9)
        self._rebuild()
        self._rebuild()

        alerts = Alert.objects.filter(source=Alert.Source.FUSION)
        self.assertEqual(alerts.count(), 1)
        self.assertEqual(alerts.first().level, Alert.Level.CRITICAL)
        self.assertIn(self.species.chinese_name, alerts.first().title)

    def test_auto_alert_can_be_disabled(self):
        SystemConfig.objects.create(key="fusion_auto_alert_enabled", value="false")
        self._record(media_type="image", confidence=0.9)
        self._record(media_type="audio", confidence=0.9, audio_reliability=0.9)
        self._rebuild()
        self.assertEqual(Alert.objects.filter(source=Alert.Source.FUSION).count(), 0)

    def test_interval_gate_skips_recent_rebuild(self):
        SystemConfig.objects.create(key="fusion_rebuild_interval_minutes", value="5")
        self._record(media_type="image", confidence=0.9)
        self._record(media_type="audio", confidence=0.9, audio_reliability=0.9)
        from apps.fusion.services import mark_rebuild_done
        mark_rebuild_done()

        summary = maybe_rebuild_recent()
        self.assertTrue(summary["skipped"])

    def test_distribution_uses_strong_and_confirmed_clusters(self):
        self._record(media_type="image", confidence=0.9)
        self._record(media_type="audio", confidence=0.9, audio_reliability=0.9)
        self._rebuild()

        rows = distribution_stats(days=30)
        self.assertTrue(rows)
        self.assertEqual(rows[0]["speciesName"], self.species.chinese_name)
        self.assertEqual(rows[0]["clusterCount"], 1)

    def test_review_writes_audit_log(self):
        self._record(media_type="image", confidence=0.9)
        self._rebuild()
        cluster = EvidenceCluster.objects.get()

        user = self._create_user()
        record_review(cluster, EvidenceCluster.Status.CONFIRMED, user, "人工核对一致")

        cluster.refresh_from_db()
        self.assertEqual(cluster.status, EvidenceCluster.Status.CONFIRMED)
        self.assertEqual(cluster.reviewer, user)
        log = FusionReviewLog.objects.get(cluster=cluster)
        self.assertEqual(log.action, EvidenceCluster.Status.CONFIRMED)
        self.assertEqual(log.remark, "人工核对一致")

    def _create_user(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        return User.objects.create_user(username="fusion_reviewer", password="123456",
                                        role="staff")
