from django.db import models


class SpeciesQuerySet(models.QuerySet):
    def by_protection(self, level):
        return self.filter(protection_level=level)


class Species(models.Model):
    class ProtectionLevel(models.TextChoices):
        NATIONAL_1 = "national_1", "国家一级"
        NATIONAL_2 = "national_2", "国家二级"
        PROVINCIAL = "provincial", "省级保护"
        NONE = "none", "无保护"
        INVASIVE = "invasive", "入侵物种"

    class IUCNStatus(models.TextChoices):
        LC = "LC", "无危"
        NT = "NT", "近危"
        VU = "VU", "易危"
        EN = "EN", "濒危"
        CR = "CR", "极危"
        EW = "EW", "野外灭绝"
        EX = "EX", "灭绝"

    class Category(models.TextChoices):
        MAMMAL = "mammal", "哺乳类"
        BIRD = "bird", "鸟类"
        REPTILE = "reptile", "爬行类"
        AMPHIBIAN = "amphibian", "两栖类"
        FISH = "fish", "鱼类"
        INSECT = "insect", "昆虫"
        PLANT = "plant", "植物"
        FUNGI = "fungi", "真菌"

    chinese_name = models.CharField(max_length=100, verbose_name="中文名")
    latin_name = models.CharField(max_length=200, verbose_name="拉丁名")
    kingdom = models.CharField(max_length=50, blank=True, verbose_name="界")
    phylum = models.CharField(max_length=50, blank=True, verbose_name="门")
    class_name = models.CharField(max_length=50, blank=True, verbose_name="纲")
    order = models.CharField(max_length=50, blank=True, verbose_name="目")
    family = models.CharField(max_length=50, blank=True, verbose_name="科")
    genus = models.CharField(max_length=50, blank=True, verbose_name="属")
    protection_level = models.CharField(max_length=20, choices=ProtectionLevel.choices, default=ProtectionLevel.NONE, verbose_name="保护级别")
    iucn_status = models.CharField(max_length=10, choices=IUCNStatus.choices, default=IUCNStatus.LC, verbose_name="IUCN状态")
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.MAMMAL, verbose_name="分类")
    description = models.TextField(blank=True, verbose_name="描述")
    distribution = models.CharField(max_length=200, blank=True, verbose_name="分布")
    image_url = models.URLField(blank=True, verbose_name="图片")
    record_count = models.IntegerField(default=0, verbose_name="监测记录数")
    review_threshold = models.FloatField(
        null=True, blank=True,
        verbose_name="复核阈值",
        help_text="留空则按保护等级取系统默认：保护物种0.8、常见物种0.6",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = SpeciesQuerySet.as_manager()

    class Meta:
        db_table = "species"
        verbose_name = "物种"
        verbose_name_plural = verbose_name
        ordering = ["-record_count"]
