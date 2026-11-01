from django.db import models


class SurveyAreaQuerySet(models.QuerySet):
    def active(self):
        return self.filter(status="active")


class SurveyArea(models.Model):
    class Type(models.TextChoices):
        FOREST = "forest", "森林"
        WETLAND = "wetland", "湿地"
        FARMLAND = "farmland", "农田"
        WATER = "water", "水域"

    class Status(models.TextChoices):
        ACTIVE = "active", "活跃"
        INACTIVE = "inactive", "停用"

    name = models.CharField(max_length=100, verbose_name="样区名称")
    type = models.CharField(max_length=20, choices=Type.choices, verbose_name="类型")
    area = models.FloatField(verbose_name="面积(km²)")
    elevation = models.CharField(max_length=50, verbose_name="海拔范围")
    lat = models.FloatField(verbose_name="纬度")
    lng = models.FloatField(verbose_name="经度")
    vegetation = models.CharField(max_length=100, blank=True, verbose_name="植被类型")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, verbose_name="状态")
    device_count = models.IntegerField(default=0, verbose_name="设备数量")
    species_count = models.IntegerField(default=0, verbose_name="物种数量")
    last_survey = models.DateField(null=True, blank=True, verbose_name="最后监测日期")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = SurveyAreaQuerySet.as_manager()

    class Meta:
        db_table = "survey_area"
        verbose_name = "监测样区"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
