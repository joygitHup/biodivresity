from django.db import models


class CategoryQuerySet(models.QuerySet):
    def roots(self):
        return self.filter(parent__isnull=True)


class Category(models.Model):
    """层级类别体系: 作物 → 部位 → 病害/虫害 → 具体类别."""

    class NodeType(models.TextChoices):
        CROP = "crop", "作物"
        PART = "part", "部位"
        TYPE = "type", "病害/虫害"
        LEAF = "leaf", "具体类别"

    parent = models.ForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="children")
    name = models.CharField(max_length=100, verbose_name="类别名称")
    node_type = models.CharField(max_length=20, choices=NodeType.choices, default=NodeType.LEAF, verbose_name="节点类型")
    model_index = models.IntegerField(null=True, blank=True, verbose_name="模型输出索引")
    description = models.TextField(blank=True, verbose_name="描述")
    sort_order = models.IntegerField(default=0, verbose_name="排序")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = CategoryQuerySet.as_manager()

    class Meta:
        db_table = "category"
        verbose_name = "类别"
        verbose_name_plural = verbose_name
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.name
