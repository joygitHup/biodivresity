"""声学质量评估回归测试：使用合成音频，不依赖外部样本。"""
import os
import shutil
import subprocess
import tempfile
import unittest
import wave

import numpy as np
from django.test import TestCase

from apps.inference.audio_quality import (
    FLAG_AUDIO_DEGRADED,
    GRADE_DEGRADED,
    GRADE_RELIABLE,
    GRADE_UNRELIABLE,
    analyze_audio_file,
    merge_provider_metrics,
)
from apps.system_config.models import SystemConfig

SR = 16000


def write_wav(path: str, samples: np.ndarray, sample_rate: int = SR) -> None:
    data = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as fh:
        fh.setnchannels(1)
        fh.setsampwidth(2)
        fh.setframerate(sample_rate)
        fh.writeframes(data.tobytes())


def chirp_signal(seconds: float = 5.0, noise: float = 0.02, amplitude: float = 0.6) -> np.ndarray:
    t = np.arange(int(seconds * SR)) / SR
    gate = ((t % 1.0) < 0.4).astype(float)
    rng = np.random.default_rng(42)
    return amplitude * np.sin(2 * np.pi * 2000 * t) * gate + noise * rng.standard_normal(t.size)


class AudioQualityTestCase(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="aq_test_")
        self.clean = os.path.join(self.tmpdir, "clean.wav")
        self.noisy = os.path.join(self.tmpdir, "noisy.wav")
        self.silent = os.path.join(self.tmpdir, "silent.wav")
        write_wav(self.clean, chirp_signal())
        write_wav(self.noisy, chirp_signal(noise=0.3, amplitude=0.05))
        write_wav(self.silent, 0.001 * np.random.default_rng(1).standard_normal(5 * SR))

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)
        SystemConfig.objects.all().delete()

    def test_clean_audio_is_reliable(self):
        result = analyze_audio_file(self.clean)
        self.assertTrue(result["available"])
        self.assertEqual(result["grade"], GRADE_RELIABLE)
        self.assertGreater(result["reliability_score"], 0.75)

    def test_noisy_audio_is_unreliable(self):
        result = analyze_audio_file(self.noisy)
        self.assertEqual(result["grade"], GRADE_UNRELIABLE)
        self.assertIn("high_noise", result["flags"])

    def test_silent_audio_is_unreliable(self):
        result = analyze_audio_file(self.silent)
        self.assertEqual(result["grade"], GRADE_UNRELIABLE)
        self.assertIn("low_vad", result["flags"])

    def test_provider_quality_affects_score(self):
        base = analyze_audio_file(self.clean)
        merged = merge_provider_metrics(base, separation_quality=0.9, noise_ratio=0.1)
        self.assertIsNotNone(merged["separation_quality"])
        self.assertAlmostEqual(merged["separation_quality"], 0.81, places=2)

    def test_low_separation_downgrades_grade(self):
        base = analyze_audio_file(self.clean)
        merged = merge_provider_metrics(base, separation_quality=0.2, noise_ratio=None)
        self.assertEqual(merged["grade"], GRADE_DEGRADED)
        self.assertIn("unreliable_separation", merged["flags"])
        self.assertEqual(merged["flag"], FLAG_AUDIO_DEGRADED)

    def test_threshold_is_configurable(self):
        SystemConfig.objects.create(key="audio_degraded_threshold", value="0.99")
        result = analyze_audio_file(self.clean)
        self.assertEqual(result["grade"], GRADE_DEGRADED)
        self.assertEqual(result["flag"], FLAG_AUDIO_DEGRADED)

    def test_mp3_and_m4a_decode(self):
        if not shutil.which("ffmpeg"):
            raise unittest.SkipTest("ffmpeg 不可用")
        for suffix in (".mp3", ".m4a"):
            out = os.path.join(self.tmpdir, f"clean{suffix}")
            proc = subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-i", self.clean, "-ac", "1", "-ar", "16000", out],
                capture_output=True, timeout=60,
            )
            if proc.returncode != 0:
                raise unittest.SkipTest(f"ffmpeg 无法编码 {suffix}")
            result = analyze_audio_file(out)
            self.assertTrue(result["available"], result.get("reason"))
            self.assertIn(result["grade"], (GRADE_RELIABLE, GRADE_DEGRADED))
