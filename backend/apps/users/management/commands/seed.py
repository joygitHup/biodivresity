"""Seed command — populates DB with mock data matching frontend mock-data.ts."""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Seed database with mock data matching frontend mock-data.ts"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Seeding database..."))

        self._seed_users()
        self._seed_survey_areas()
        self._seed_devices()
        self._seed_species()
        self._seed_records()
        self._seed_alerts()
        self._seed_categories()
        self._seed_models()
        self._seed_recognize()

        self.stdout.write(self.style.SUCCESS("✓ All seed data loaded successfully!"))

    # ── Users ────────────────────────────────────────────────────
    def _seed_users(self):
        from apps.users.models import User
        users_data = [
            ("admin", "admin123", "admin@demo.com", User.Role.ADMIN, "13800000001"),
            ("staff", "staff123", "staff@demo.com", User.Role.STAFF, "13800000002"),
            ("user01", "user123456", "user01@demo.com", User.Role.USER, "13800000003"),
        ]
        for username, pwd, email, role, phone in users_data:
            u, created = User.objects.get_or_create(
                username=username,
                defaults={"email": email, "role": role, "phone": phone},
            )
            if created:
                u.set_password(pwd)
                u.save()
        self.stdout.write(f"  Users: {User.objects.count()}")

    # ── Survey Areas ─────────────────────────────────────────────
    def _seed_survey_areas(self):
        from apps.survey_areas.models import SurveyArea
        data = [
            ("凤阳山北麓样区", "forest", 15.6, "800-1400m", 27.9234, 119.2345, "常绿阔叶林", "active", 12, 86, "2026-10-15"),
            ("百山祖南坡样区", "forest", 18.2, "1200-1800m", 27.7512, 119.1023, "针阔混交林", "active", 15, 112, "2026-10-18"),
            ("瓯江源头湿地样区", "wetland", 12.4, "300-500m", 28.0156, 119.4567, "沼泽湿地", "active", 8, 64, "2026-10-20"),
            ("庆元农田生态样区", "farmland", 10.8, "400-600m", 27.6845, 118.9234, "农田生态系统", "active", 6, 42, "2026-10-12"),
            ("龙泉溪流域水域样区", "water", 14.5, "200-400m", 28.0789, 119.1567, "河流生态系统", "active", 10, 53, "2026-10-19"),
            ("景宁畲族乡样区", "forest", 16.3, "600-1000m", 27.8123, 119.6789, "落叶阔叶林", "inactive", 9, 71, "2026-09-28"),
        ]
        for row in data:
            SurveyArea.objects.get_or_create(
                name=row[0],
                defaults={
                    "type": row[1], "area": row[2], "elevation": row[3],
                    "lat": row[4], "lng": row[5], "vegetation": row[6],
                    "status": row[7], "device_count": row[8],
                    "species_count": row[9], "last_survey": row[10],
                },
            )
        self.stdout.write(f"  SurveyAreas: {SurveyArea.objects.count()}")

    # ── Devices ──────────────────────────────────────────────────
    def _seed_devices(self):
        from apps.devices.models import Device
        from apps.survey_areas.models import SurveyArea
        areas = {a.name: a for a in SurveyArea.objects.all()}
        data = [
            ("红外相机-A01", "infrared_camera", "凤阳山北麓-兽径1号", "凤阳山北麓样区", "online", 85, 62, 92, "2026-10-28 08:30", "2025-03-15"),
            ("红外相机-A02", "infrared_camera", "凤阳山北麓-水源点", "凤阳山北麓样区", "online", 72, 45, 88, "2026-10-28 07:15", "2025-03-15"),
            ("鸣声记录仪-B01", "audio_recorder", "凤阳山北麓-林冠层", "凤阳山北麓样区", "online", 90, 30, 95, "2026-10-28 09:00", "2025-04-20"),
            ("红外相机-C01", "infrared_camera", "百山祖南坡-山脊线", "百山祖南坡样区", "online", 65, 78, 76, "2026-10-28 06:45", "2025-05-10"),
            ("雷达相机-D01", "radar_camera", "百山祖南坡-溪流", "百山祖南坡样区", "warning", 25, 88, 65, "2026-10-27 22:30", "2025-06-01"),
            ("鸣声记录仪-E01", "audio_recorder", "瓯江源头-芦苇丛", "瓯江源头湿地样区", "online", 80, 55, 90, "2026-10-28 08:00", "2025-07-15"),
            ("eDNA采集器-F01", "edna", "瓯江源头-采样点A", "瓯江源头湿地样区", "online", 95, 20, 85, "2026-10-28 07:30", "2025-08-01"),
            ("蝴蝶监测仪-G01", "butterfly_trap", "庆元农田-花带区", "庆元农田生态样区", "offline", 0, 100, 0, "2026-10-25 14:00", "2025-09-10"),
            ("高清相机-H01", "hd_camera", "龙泉溪-观测塔", "龙泉溪流域水域样区", "online", 88, 42, 94, "2026-10-28 09:15", "2025-04-05"),
            ("红外相机-I01", "infrared_camera", "景宁-林缘带", "景宁畲族乡样区", "offline", 10, 95, 0, "2026-10-20 10:00", "2025-05-20"),
            ("红外相机-A03", "infrared_camera", "凤阳山北麓-兽径2号", "凤阳山北麓样区", "online", 78, 50, 91, "2026-10-28 08:45", "2025-06-15"),
            ("鸣声记录仪-C02", "audio_recorder", "百山祖南坡-山谷", "百山祖南坡样区", "online", 82, 38, 87, "2026-10-28 09:05", "2025-07-20"),
        ]
        for row in data:
            Device.objects.get_or_create(
                name=row[0],
                defaults={
                    "type": row[1], "location": row[2],
                    "survey_area": areas.get(row[3]), "status": row[4],
                    "battery": row[5], "storage": row[6], "signal": row[7],
                    "last_data_time": row[8], "install_date": row[9],
                },
            )
        self.stdout.write(f"  Devices: {Device.objects.count()}")

    # ── Species ─────────────────────────────────────────────────
    def _seed_species(self):
        from apps.species.models import Species
        data = [
            ("华南虎", "Panthera tigris amoyensis", "mammal", "national_1", "CR",
             "动物界", "脊索动物门", "哺乳纲", "食肉目", "猫科", "豹属",
             "中国特有虎亚种，极度濒危", "华南地区"),
            ("黑麂", "Muntiacus crinifrons", "mammal", "national_1", "EN",
             "动物界", "脊索动物门", "哺乳纲", "偶蹄目", "鹿科", "麂属",
             "中国特有珍稀鹿类", "浙江、安徽"),
            ("白颈长尾雉", "Syrmaticus ellioti", "bird", "national_1", "NT",
             "动物界", "脊索动物门", "鸟纲", "鸡形目", "雉科", "长尾雉属",
             "中国特有种，东南丘陵代表物种", "浙江、福建、江西"),
            ("黄腹角雉", "Tragopan caboti", "bird", "national_1", "VU",
             "动物界", "脊索动物门", "鸟纲", "鸡形目", "雉科", "角雉属",
             "中国特有鸟类", "浙江、福建"),
            ("猕猴", "Macaca mulatta", "mammal", "national_2", "LC",
             "动物界", "脊索动物门", "哺乳纲", "灵长目", "猴科", "猕猴属",
             "常见灵长类", "全国大部分山区"),
            ("穿山甲", "Manis pentadactyla", "mammal", "national_1", "CR",
             "动物界", "脊索动物门", "哺乳纲", "鳞甲目", "穿山甲科", "穿山甲属",
             "全球最受威胁的哺乳动物之一", "华南、西南"),
            ("大鲵", "Andrias davidianus", "amphibian", "national_2", "CR",
             "动物界", "脊索动物门", "两栖纲", "有尾目", "隐鳃鲵科", "大鲵属",
             "世界最大两栖动物", "华中、华南山区溪流"),
            ("鹰嘴龟", "Platysternon megacephalum", "reptile", "national_2", "EN",
             "动物界", "脊索动物门", "爬行纲", "龟鳖目", "平胸龟科", "平胸龟属",
             "头部巨大的原始龟类", "华东、华中山区"),
            ("银杏", "Ginkgo biloba", "plant", "national_1", "EN",
             "植物界", "银杏门", "银杏纲", "银杏目", "银杏科", "银杏属",
             "活化石植物", "全国广泛栽培"),
            ("南方红豆杉", "Taxus wallichiana var. mairei", "plant", "national_1", "VU",
             "植物界", "松柏门", "松柏纲", "松柏目", "红豆杉科", "红豆杉属",
             "珍稀裸子植物", "华东、华中"),
            ("白花兜兰", "Paphiopedilum emersonii", "plant", "national_1", "CR",
             "植物界", "被子植物门", "单子叶植物纲", "天门冬目", "兰科", "兜兰属",
             "极危兰花物种", "广西、云南"),
            ("金斑喙凤蝶", "Teinopalpus aureus", "insect", "national_1", "VU",
             "动物界", "节肢动物门", "昆虫纲", "鳞翅目", "凤蝶科", "喙凤蝶属",
             "中国最美丽的蝴蝶之一", "华南、华东山区"),
            ("加拿大一枝黄花", "Solidago canadensis", "plant", "invasive", "LC",
             "植物界", "被子植物门", "双子叶植物纲", "菊目", "菊科", "一枝黄花属",
             "外来入侵物种", "全国"),
            ("棘胸蛙", "Quasipaa spinosa", "amphibian", "provincial", "VU",
             "动物界", "脊索动物门", "两栖纲", "无尾目", "叉舌蛙科", "棘蛙属",
             "山区溪流常见蛙类", "华东、华中"),
            ("白鹇", "Lophura nycthemera", "bird", "national_2", "LC",
             "动物界", "脊索动物门", "鸟纲", "鸡形目", "雉科", "鹇属",
             "美丽的大型雉类", "华东、华中、华南"),
        ]
        for cn, latin, cat, prot, iucn, k, p, c, o, f, g, desc, dist in data:
            Species.objects.get_or_create(
                chinese_name=cn, latin_name=latin,
                defaults={
                    "category": cat, "protection_level": prot, "iucn_status": iucn,
                    "kingdom": k, "phylum": p, "class_name": c, "order": o,
                    "family": f, "genus": g, "description": desc,
                    "distribution": dist, "record_count": 0,
                },
            )
        self.stdout.write(f"  Species: {Species.objects.count()}")

    # ── Monitor Records ─────────────────────────────────────────
    def _seed_records(self):
        from apps.records.models import MonitorRecord
        from apps.devices.models import Device
        from apps.survey_areas.models import SurveyArea
        from apps.species.models import Species

        devices = {d.name: d for d in Device.objects.all()}
        areas = {a.name: a for a in SurveyArea.objects.all()}
        species = {s.chinese_name: s for s in Species.objects.all()}
        now = timezone.now()

        records_data = [
            ("红外相机-A01", "凤阳山北麓样区", "黑麂",
             now.replace(hour=6, minute=23), 27.9234, 119.2345, 1, "饮水", 0.94, "confirmed", "image"),
            ("红外相机-A02", "凤阳山北麓样区", "猕猴",
             now.replace(hour=5, minute=45), 27.9240, 119.2350, 5, "觅食", 0.97, "confirmed", "video"),
            ("鸣声记录仪-B01", "凤阳山北麓样区", "白颈长尾雉",
             now.replace(hour=5, minute=30), 27.9230, 119.2340, 1, "鸣叫", 0.88, "confirmed", "audio"),
            ("红外相机-C01", "百山祖南坡样区", "黄腹角雉",
             now.replace(hour=4, minute=12), 27.7512, 119.1023, 2, "漫步", 0.91, "pending", "image"),
            ("鸣声记录仪-E01", "瓯江源头湿地样区", "白鹇",
             now.replace(hour=6, minute=0), 28.0156, 119.4567, 1, "鸣叫", 0.82, "pending", "audio"),
            ("高清相机-H01", "龙泉溪流域水域样区", "大鲵",
             now.replace(hour=7, minute=30), 28.0789, 119.1567, 1, "栖息", 0.76, "pending", "image"),
            ("红外相机-A01", "凤阳山北麓样区", "穿山甲",
             now - timedelta(hours=10, minutes=15), 27.9234, 119.2345, 1, "活动", 0.58, "pending", "video"),
            ("红外相机-A03", "凤阳山北麓样区", "金斑喙凤蝶",
             now.replace(hour=3, minute=20), 27.9245, 119.2360, 1, "访花", 0.72, "pending", "image"),
            ("红外相机-A02", "凤阳山北麓样区", "加拿大一枝黄花",
             now - timedelta(hours=14, minutes=15), 27.9240, 119.2350, 1, "-", 0.89, "confirmed", "image"),
            ("鸣声记录仪-C02", "百山祖南坡样区", "棘胸蛙",
             now.replace(hour=5, minute=15), 27.7520, 119.1030, 3, "鸣叫", 0.93, "confirmed", "audio"),
        ]
        for dev_name, area_name, sp_name, ts, lat, lng, cnt, beh, conf, status, media_type in records_data:
            MonitorRecord.objects.get_or_create(
                device=devices.get(dev_name),
                survey_area=areas.get(area_name),
                species=species.get(sp_name),
                timestamp=ts,
                defaults={
                    "lat": lat, "lng": lng, "count": cnt, "behavior": beh,
                    "confidence": conf, "review_status": status,
                    "media_type": media_type,
                },
            )
        self.stdout.write(f"  Records: {MonitorRecord.objects.count()}")

    # ── Alerts ───────────────────────────────────────────────────
    def _seed_alerts(self):
        from apps.alerts.models import Alert
        from apps.survey_areas.models import SurveyArea
        areas = {a.name: a for a in SurveyArea.objects.all()}
        now = timezone.now()

        alerts_data = [
            ("device_offline", "warning", "设备离线告警",
             "蝴蝶监测仪-G01 已超过72小时无数据回传", "庆元农田生态样区", False, now),
            ("device_offline", "warning", "设备离线告警",
             "红外相机-I01 已超过192小时无数据回传", "景宁畲族乡样区", False, now - timedelta(hours=10)),
            ("invasive_species", "critical", "入侵物种发现",
             "在庆元农田生态样区发现加拿大一枝黄花，建议立即处置", "庆元农田生态样区", False, now - timedelta(hours=13)),
            ("protection_anomaly", "warning", "保护物种监测异常",
             "华南虎已连续45天未在凤阳山北麓样区监测到", "凤阳山北麓样区", True, now - timedelta(days=2)),
            ("data_anomaly", "info", "数据异常提示",
             "红外相机-A02 单日触发次数达到487次，接近阈值", "凤阳山北麓样区", True, now - timedelta(days=3)),
            ("diversity_decline", "warning", "多样性指数下降",
             "景宁畲族乡样区本月Shannon多样性指数环比下降23%", "景宁畲族乡样区", True, now - timedelta(days=3)),
            ("device_offline", "info", "设备低电量预警",
             "雷达相机-D01 电量低于25%，请及时更换", "百山祖南坡样区", False, now - timedelta(hours=3)),
        ]
        for atype, level, title, desc, area_name, is_read, ts in alerts_data:
            Alert.objects.get_or_create(
                title=title, description=desc,
                defaults={
                    "type": atype, "level": level,
                    "survey_area": areas.get(area_name),
                    "is_read": is_read, "created_at": ts,
                },
            )
        self.stdout.write(f"  Alerts: {Alert.objects.count()}")

    # ── Categories ──────────────────────────────────────────────
    def _seed_categories(self):
        from apps.categories.models import Category

        rice, _ = Category.objects.get_or_create(name="水稻", node_type="crop", defaults={"sort_order": 1})
        leaf, _ = Category.objects.get_or_create(name="叶片", node_type="part", parent=rice, defaults={"sort_order": 1})
        dmg, _ = Category.objects.get_or_create(name="病害", node_type="type", parent=leaf, defaults={"sort_order": 1})
        pest, _ = Category.objects.get_or_create(name="虫害", node_type="type", parent=leaf, defaults={"sort_order": 2})
        Category.objects.get_or_create(name="水稻稻瘟病", node_type="leaf", parent=dmg, defaults={"model_index": 0})
        Category.objects.get_or_create(name="水稻胡麻斑病", node_type="leaf", parent=dmg, defaults={"model_index": 1})
        Category.objects.get_or_create(name="蚜虫", node_type="leaf", parent=pest, defaults={"model_index": 2})

        wheat, _ = Category.objects.get_or_create(name="小麦", node_type="crop", defaults={"sort_order": 2})
        wl, _ = Category.objects.get_or_create(name="叶片", node_type="part", parent=wheat, defaults={"sort_order": 1})
        wd, _ = Category.objects.get_or_create(name="病害", node_type="type", parent=wl, defaults={"sort_order": 1})
        Category.objects.get_or_create(name="小麦锈病", node_type="leaf", parent=wd, defaults={"model_index": 10})

        tomato, _ = Category.objects.get_or_create(name="番茄", node_type="crop", defaults={"sort_order": 3})
        tl, _ = Category.objects.get_or_create(name="叶片", node_type="part", parent=tomato, defaults={"sort_order": 1})
        td, _ = Category.objects.get_or_create(name="病害", node_type="type", parent=tl, defaults={"sort_order": 1})
        Category.objects.get_or_create(name="番茄晚疫病", node_type="leaf", parent=td, defaults={"model_index": 20})

        corn, _ = Category.objects.get_or_create(name="玉米", node_type="crop", defaults={"sort_order": 4})
        cs, _ = Category.objects.get_or_create(name="茎秆", node_type="part", parent=corn, defaults={"sort_order": 1})
        cp, _ = Category.objects.get_or_create(name="虫害", node_type="type", parent=cs, defaults={"sort_order": 1})
        Category.objects.get_or_create(name="玉米螟", node_type="leaf", parent=cp, defaults={"model_index": 30})

        citrus, _ = Category.objects.get_or_create(name="柑橘", node_type="crop", defaults={"sort_order": 5})
        cl, _ = Category.objects.get_or_create(name="叶片", node_type="part", parent=citrus, defaults={"sort_order": 1})
        cp2, _ = Category.objects.get_or_create(name="虫害", node_type="type", parent=cl, defaults={"sort_order": 1})
        Category.objects.get_or_create(name="柑橘红蜘蛛", node_type="leaf", parent=cp2, defaults={"model_index": 40})

        Category.objects.get_or_create(name="健康植株", node_type="crop", defaults={"sort_order": 99})
        self.stdout.write(f"  Categories: {Category.objects.count()}")

    # ── Models ───────────────────────────────────────────────────
    def _seed_models(self):
        from apps.models_app.models import ModelVersion
        data = [
            ("v1.2.0", "PlantVillage-CNN", "224x224", 92.5, 98.3, "stable",
             "基于ResNet50的基线模型", 156000, 87.2, 6.5),
            ("v1.1.0", "PlantVillage-CNN", "224x224", 89.8, 96.7, "archived",
             "基线模型", 89000, 82.5, 11.2),
            ("v1.0.0", "PlantVillage-CNN", "224x224", 85.0, 94.2, "archived",
             "初始发布版本", 45000, 78.0, 15.8),
        ]
        for version, name, size, t1, t5, status, desc, inf, conf, reject in data:
            mv, created = ModelVersion.objects.get_or_create(
                version=version,
                defaults={
                    "name": name, "input_size": size,
                    "top1_accuracy": t1, "top5_accuracy": t5,
                    "status": status, "description": desc,
                    "inference_count": inf, "avg_confidence": conf,
                    "reject_rate": reject,
                },
            )
            if version == "v1.2.0":
                mv.is_active = True
                mv.status = ModelVersion.Status.ACTIVE
                mv.save()
        self.stdout.write(f"  Model versions: {ModelVersion.objects.count()}")

    # ── Recognize ────────────────────────────────────────────────
    def _seed_recognize(self):
        from apps.recognize.models import RecognizeRecord
        from apps.users.models import User

        user = User.objects.filter(username="user01").first()
        now = timezone.now()
        dummy_top5 = [
            {"category_id": "C0012", "name": "水稻稻瘟病", "path": "水稻/叶片/病害/稻瘟病", "confidence": 0.87},
            {"category_id": "C0015", "name": "水稻胡麻斑病", "path": "水稻/叶片/病害/胡麻斑病", "confidence": 0.08},
            {"category_id": "C0031", "name": "番茄晚疫病", "path": "番茄/叶片/病害/晚疫病", "confidence": 0.03},
            {"category_id": "C0060", "name": "蚜虫", "path": "多种/叶片/虫害/蚜虫", "confidence": 0.01},
            {"category_id": "C0067", "name": "健康植株", "path": "多种/整体/健康/健康", "confidence": 0.01},
        ]
        seeds = [
            (now - timedelta(hours=5), "水稻稻瘟病", 0.87, False),
            (now - timedelta(hours=2), "水稻胡麻斑病", 0.52, True),
            (now - timedelta(minutes=30), "小麦锈病", 0.78, False),
        ]
        for ts, name, conf, rejected in seeds:
            RecognizeRecord.objects.get_or_create(
                user=user, top_category_name=name, created_at=ts,
                defaults={
                    "top_category_id": "C0012", "top_confidence": conf,
                    "top5_result": dummy_top5, "rejected": rejected,
                    "model_version": "v1.2.0",
                    "request_id": f"req_seed_{ts.strftime('%Y%m%d%H%M')}",
                },
            )
        self.stdout.write(f"  Recognize records: {RecognizeRecord.objects.count()}")
