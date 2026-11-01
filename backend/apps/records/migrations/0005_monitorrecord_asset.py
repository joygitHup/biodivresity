"""监测记录直接关联原始媒体资产，并回填历史数据。"""
from django.db import migrations, models
import django.db.models.deletion


def backfill_asset(apps, schema_editor):
    """通过识别任务把已存在记录的媒体资产补齐。"""
    MonitorRecord = apps.get_model("records", "MonitorRecord")
    PredictionTask = apps.get_model("inference", "PredictionTask")

    mapping = (
        PredictionTask.objects
        .filter(record_id__isnull=False, asset_id__isnull=False)
        .values_list("record_id", "asset_id")
    )
    updates = []
    seen = set()
    for record_id, asset_id in mapping.iterator():
        if record_id in seen:
            continue
        seen.add(record_id)
        updates.append(MonitorRecord(id=record_id, asset_id=asset_id))
    if updates:
        MonitorRecord.objects.bulk_update(updates, ["asset"], batch_size=500)


def noop(apps, schema_editor):
    """回滚时无需处理，外键删除即丢弃关联。"""


class Migration(migrations.Migration):

    dependencies = [
        ("records", "0004_alter_monitorrecord_quality_flag"),
        ("inference", "0004_add_segmentation_result"),
    ]

    operations = [
        migrations.AddField(
            model_name="monitorrecord",
            name="asset",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="records", to="inference.mediaasset", verbose_name="媒体资产",
            ),
        ),
        migrations.RunPython(backfill_asset, noop),
    ]
