from django.db import models


class SpeciesQuerySet(models.QuerySet):
    def by_severity(self, level):
        return self.filter(severity=level)


class Species(models.Model):
    """病虫害类别档案（原物种档案，已按作物-病虫害语义重构）。

    一行代表「某作物的某种病虫害或健康状态」，例如「番茄叶片晚疫病」。
    """

    class Severity(models.TextChoices):
        LOW = "low", "轻度"
        MEDIUM = "medium", "中度"
        HIGH = "high", "较高"
        CRITICAL = "critical", "严重"
        NONE = "none", "无（健康）"

    class DamageType(models.TextChoices):
        DISEASE = "disease", "病害"
        PEST = "pest", "虫害"
        HEALTHY = "healthy", "健康"

    class Crop(models.TextChoices):
        APPLE = "apple", "苹果"
        BLUEBERRY = "blueberry", "蓝莓"
        CHERRY = "cherry", "樱桃"
        CORN = "corn", "玉米"
        GRAPE = "grape", "葡萄"
        ORANGE = "orange", "柑橘"
        PEACH = "peach", "桃"
        PEPPER = "pepper", "辣椒"
        POTATO = "potato", "马铃薯"
        RASPBERRY = "raspberry", "树莓"
        SOYBEAN = "soybean", "大豆"
        SQUASH = "squash", "南瓜"
        STRAWBERRY = "strawberry", "草莓"
        TOMATO = "tomato", "番茄"

    class Part(models.TextChoices):
        LEAF = "leaf", "叶片"
        FRUIT = "fruit", "果实"
        STEM = "stem", "茎秆"
        ROOT = "root", "根茎"
        WHOLE = "whole", "整株"

    chinese_name = models.CharField(max_length=100, verbose_name="病虫害名称")
    latin_name = models.CharField(max_length=200, blank=True, verbose_name="学名/拉丁名")
    crop = models.CharField(max_length=20, choices=Crop.choices, default=Crop.TOMATO, verbose_name="作物")
    damage_type = models.CharField(
        max_length=20, choices=DamageType.choices, default=DamageType.DISEASE, verbose_name="病虫害类型",
    )
    part = models.CharField(max_length=20, choices=Part.choices, default=Part.LEAF, verbose_name="受害部位")
    severity = models.CharField(
        max_length=20, choices=Severity.choices, default=Severity.NONE, verbose_name="危害等级",
    )
    symptoms = models.TextField(blank=True, verbose_name="症状特征")
    prevention = models.TextField(blank=True, verbose_name="防治建议")
    description = models.TextField(blank=True, verbose_name="描述")
    distribution = models.CharField(max_length=200, blank=True, verbose_name="发生区域")
    image_url = models.URLField(blank=True, verbose_name="图片")
    record_count = models.IntegerField(default=0, verbose_name="监测记录数")
    review_threshold = models.FloatField(
        null=True, blank=True,
        verbose_name="复核阈值",
        help_text="留空则按危害等级取系统默认：高风险0.8、其余0.6",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = SpeciesQuerySet.as_manager()

    class Meta:
        db_table = "species"
        verbose_name = "病虫害类别"
        verbose_name_plural = verbose_name
        ordering = ["-record_count"]
