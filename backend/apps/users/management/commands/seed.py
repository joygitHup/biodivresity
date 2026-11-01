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

    # ── 病虫害类别（PlantVillage 38 类）─────────────────────────
    def _seed_species(self):
        from apps.species.models import Species
        # (名称, 学名, 作物, 类型, 受害部位, 危害等级, 症状, 防治建议, 描述, 发生区域)
        data = [
            ("苹果黑星病", "Venturia inaequalis", "apple", "disease", "leaf", "high",
             "叶面出现橄榄绿至黑色绒状病斑，后期叶片扭曲早落", "清除病落叶、萌芽期喷施保护性杀菌剂", "世界性苹果病害，主要危害叶片与果实", "苹果主产区"),
            ("苹果黑腐病", "Botryosphaeria obtusa", "apple", "disease", "fruit", "high",
             "果实出现褐色轮纹状腐烂，表面生黑色小粒点", "修剪病枝、落果及时清理并喷施杀菌剂", "主要危害果实，贮藏期仍可继续扩展", "苹果主产区"),
            ("苹果锈病", "Gymnosporangium juniperi-virginianae", "apple", "disease", "leaf", "medium",
             "叶面产生橙黄色病斑，后期叶背长出锈孢子器", "清除转主寄主桧柏、发病初期喷施三唑类药剂", "需在桧柏与苹果间完成生活史", "苹果主产区"),
            ("苹果健康", "", "apple", "healthy", "whole", "none",
             "植株长势正常，叶片平整无病斑", "保持通风透光与合理水肥管理", "健康植株对照样本", "苹果主产区"),
            ("蓝莓健康", "", "blueberry", "healthy", "whole", "none",
             "植株长势正常，叶片平整无病斑", "保持土壤酸性与合理灌溉", "健康植株对照样本", "蓝莓主产区"),
            ("樱桃白粉病", "Podosphaera clandestina", "cherry", "disease", "leaf", "medium",
             "叶片表面覆盖白色粉状霉层，新梢受害易扭曲", "改善通风、发病期喷施硫制剂或三唑类药剂", "主要危害叶片与新梢", "樱桃主产区"),
            ("樱桃健康", "", "cherry", "healthy", "whole", "none",
             "植株长势正常，叶片平整无病斑", "保持通风透光与合理水肥管理", "健康植株对照样本", "樱桃主产区"),
            ("玉米灰斑病", "Cercospora zeae-maydis", "corn", "disease", "leaf", "medium",
             "叶片出现长条形灰色病斑，病斑边缘褐色", "轮作换茬、清除病残体并适时喷施杀菌剂", "高湿条件下扩展迅速，可造成显著减产", "玉米主产区"),
            ("玉米普通锈病", "Puccinia sorghi", "corn", "disease", "leaf", "medium",
             "叶片两面散生褐色夏孢子堆，破裂后散出锈色粉末", "选用抗病品种、发病初期喷施三唑类药剂", "气流传播的常见玉米叶部病害", "玉米主产区"),
            ("玉米北方叶枯病", "Exserohilum turcicum", "corn", "disease", "leaf", "critical",
             "叶片形成长梭形灰褐色大型病斑，可连片枯死", "清除病残体、轮作并及早喷施杀菌剂", "流行年份可造成大面积减产", "玉米主产区"),
            ("玉米健康", "", "corn", "healthy", "whole", "none",
             "植株长势正常，叶片平整无病斑", "保持合理密植与水肥管理", "健康植株对照样本", "玉米主产区"),
            ("葡萄黑腐病", "Guignardia bidwellii", "grape", "disease", "fruit", "high",
             "果实出现褐色凹陷病斑并迅速干缩为黑色僵果", "清除病果病叶、花后至封穗期喷施杀菌剂", "主要危害果实，亦可侵染叶片与新梢", "葡萄主产区"),
            ("葡萄轮斑病", "Phaeomoniella chlamydospora", "grape", "disease", "stem", "critical",
             "枝干木质部变褐坏死，叶片出现轮纹状黄化", "修剪病枝、避免机械伤口并涂保护剂", "属于葡萄枝干病害，严重影响树势", "葡萄主产区"),
            ("葡萄叶枯病", "Pseudocercospora vitis", "grape", "disease", "leaf", "medium",
             "叶片出现褐色多角形病斑，后期病叶枯黄早落", "清除病叶、雨季前后喷施保护性杀菌剂", "常见葡萄叶部病害", "葡萄主产区"),
            ("葡萄健康", "", "grape", "healthy", "whole", "none",
             "植株长势正常，叶片平整无病斑", "保持通风透光与合理水肥管理", "健康植株对照样本", "葡萄主产区"),
            ("柑橘黄龙病", "Candidatus Liberibacter asiaticus", "orange", "disease", "whole", "critical",
             "叶片斑驳黄化、梢部红化，果实小而畸形偏酸", "严格使用无病苗木、及时清除病株并防治木虱", "由柑橘木虱传播的毁灭性检疫性病害", "柑橘主产区"),
            ("桃细菌性穿孔病", "Xanthomonas arboricola pv. pruni", "peach", "disease", "leaf", "high",
             "叶片出现紫褐色病斑，后期病斑脱落形成穿孔", "清除病枝病叶、发病期喷施铜制剂", "细菌性病害，多雨年份易流行", "桃主产区"),
            ("桃健康", "", "peach", "healthy", "whole", "none",
             "植株长势正常，叶片平整无病斑", "保持通风透光与合理水肥管理", "健康植株对照样本", "桃主产区"),
            ("辣椒细菌性斑点病", "Xanthomonas campestris pv. vesicatoria", "pepper", "disease", "leaf", "medium",
             "叶片出现水渍状小斑，后期变为褐色并带黄晕", "轮作、避免大水漫灌并喷施铜制剂", "细菌性病害，借雨水与农事操作传播", "辣椒主产区"),
            ("辣椒健康", "", "pepper", "healthy", "whole", "none",
             "植株长势正常，叶片平整无病斑", "保持通风透光与合理水肥管理", "健康植株对照样本", "辣椒主产区"),
            ("马铃薯早疫病", "Alternaria solani", "potato", "disease", "leaf", "medium",
             "叶片出现同心轮纹状褐色病斑，由下部叶片向上扩展", "轮作、平衡施肥并发病初期喷施杀菌剂", "常见马铃薯叶部病害，可致提前枯秧", "马铃薯主产区"),
            ("马铃薯晚疫病", "Phytophthora infestans", "potato", "disease", "leaf", "critical",
             "叶缘出现水渍状暗绿斑，潮湿时叶背生白色霉层", "选用抗病品种、封行前后预防性喷药", "低温高湿下暴发迅速，可致毁灭性减产", "马铃薯主产区"),
            ("马铃薯健康", "", "potato", "healthy", "whole", "none",
             "植株长势正常，叶片平整无病斑", "保持合理密植与水肥管理", "健康植株对照样本", "马铃薯主产区"),
            ("树莓健康", "", "raspberry", "healthy", "whole", "none",
             "植株长势正常，叶片平整无病斑", "保持通风透光与合理水肥管理", "健康植株对照样本", "树莓主产区"),
            ("大豆健康", "", "soybean", "healthy", "whole", "none",
             "植株长势正常，叶片平整无病斑", "合理轮作与科学水肥管理", "健康植株对照样本", "大豆主产区"),
            ("南瓜白粉病", "Podosphaera xanthii", "squash", "disease", "leaf", "medium",
             "叶片表面覆盖白色粉状霉层，后期叶面枯黄", "改善通风、发病期喷施硫制剂或三唑类药剂", "常见瓜类叶部病害", "南瓜主产区"),
            ("草莓叶枯病", "Xanthomonas fragariae", "strawberry", "disease", "leaf", "high",
             "叶片出现水渍状角斑，后期变褐并沿叶脉扩展", "避免叶面长时间积水、清除病叶并喷施铜制剂", "细菌性病害，湿度大时扩展快", "草莓主产区"),
            ("草莓健康", "", "strawberry", "healthy", "whole", "none",
             "植株长势正常，叶片平整无病斑", "保持通风透光与合理水肥管理", "健康植株对照样本", "草莓主产区"),
            ("番茄细菌性斑点病", "Xanthomonas campestris pv. vesicatoria", "tomato", "disease", "leaf", "medium",
             "叶片出现深褐色小斑带黄晕，果实表面形成疮痂", "轮作、避免叶面淋水并喷施铜制剂", "细菌性病害，可侵染叶、茎与果实", "番茄主产区"),
            ("番茄早疫病", "Alternaria solani", "tomato", "disease", "leaf", "medium",
             "叶片出现同心轮纹状褐色病斑，由下向上扩展", "清除病残体、平衡施肥并定期喷施杀菌剂", "常见番茄叶部病害，保护地更易发生", "番茄主产区"),
            ("番茄晚疫病", "Phytophthora infestans", "tomato", "disease", "leaf", "critical",
             "叶尖叶缘出现水渍状暗绿斑，湿度大时生白色霉层", "控制棚内湿度、及早喷施预防性药剂", "低温高湿下流行极快，需重点防控", "番茄主产区"),
            ("番茄叶霉病", "Passalora fulva", "tomato", "disease", "leaf", "high",
             "叶背出现淡绿色至灰褐色绒状霉层，叶面黄化", "加强通风、降低湿度并喷施杀菌剂", "保护地番茄常见病害", "番茄主产区"),
            ("番茄斑枯病", "Septoria lycopersici", "tomato", "disease", "leaf", "high",
             "叶片出现圆形褐色病斑，中央灰白并生小黑点", "清除病叶、轮作并定期喷施杀菌剂", "主要危害叶片，可致下部叶片早枯", "番茄主产区"),
            ("番茄二点叶螨", "Tetranychus urticae", "tomato", "pest", "leaf", "high",
             "叶面出现密集黄白色小点，严重时结网并叶片枯焦", "释放捕食螨、必要时喷施杀螨剂", "世界性多食性害螨", "番茄主产区"),
            ("番茄靶斑病", "Corynespora cassiicola", "tomato", "disease", "leaf", "medium",
             "叶片出现同心轮纹状靶心斑，中央灰白色", "改善通风、清除病叶并喷施杀菌剂", "近年上升较快的番茄叶部病害", "番茄主产区"),
            ("番茄黄化曲叶病毒病", "Tomato yellow leaf curl virus", "tomato", "disease", "whole", "critical",
             "植株矮缩、新叶黄化卷曲，坐果明显减少", "防治烟粉虱、使用抗病品种与防虫网", "由烟粉虱传播的毁灭性病毒病", "番茄主产区"),
            ("番茄花叶病毒病", "Tomato mosaic virus", "tomato", "disease", "whole", "high",
             "叶片出现黄绿相间花叶，叶面凹凸不平", "种子消毒、避免机械传播并拔除病株", "接触传播为主，田间扩展较快", "番茄主产区"),
            ("番茄健康", "", "tomato", "healthy", "whole", "none",
             "植株长势正常，叶片平整无病斑", "保持通风透光与合理水肥管理", "健康植株对照样本", "番茄主产区"),
        ]
        for cn, latin, crop, damage, part, severity, symptoms, prevention, desc, dist in data:
            Species.objects.get_or_create(
                chinese_name=cn, latin_name=latin,
                defaults={
                    "crop": crop, "damage_type": damage, "part": part,
                    "severity": severity, "symptoms": symptoms,
                    "prevention": prevention, "description": desc,
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
            ("红外相机-A01", "凤阳山北麓样区", "玉米北方叶枯病",
             now.replace(hour=9, minute=23), 27.9234, 119.2345, 3, "叶片大型枯斑", 0.94, "confirmed", "image"),
            ("红外相机-A02", "凤阳山北麓样区", "番茄晚疫病",
             now.replace(hour=8, minute=45), 27.9240, 119.2350, 5, "叶缘水渍状病斑", 0.97, "confirmed", "video"),
            ("红外相机-A03", "凤阳山北麓样区", "苹果黑星病",
             now.replace(hour=10, minute=30), 27.9245, 119.2360, 2, "叶面黑色绒状病斑", 0.71, "pending", "image"),
            ("红外相机-C01", "百山祖南坡样区", "马铃薯晚疫病",
             now.replace(hour=11, minute=12), 27.7512, 119.1023, 4, "叶背白色霉层", 0.91, "pending", "image"),
            ("红外相机-C01", "百山祖南坡样区", "玉米普通锈病",
             now.replace(hour=7, minute=0), 27.7512, 119.1023, 2, "叶面褐色孢子堆", 0.83, "confirmed", "image"),
            ("高清相机-H01", "龙泉溪流域水域样区",
             "葡萄黑腐病", now.replace(hour=9, minute=30), 28.0789, 119.1567, 1, "果实褐色凹陷病斑", 0.76, "pending", "image"),
            ("高清相机-H01", "龙泉溪流域水域样区",
             "柑橘黄龙病", now - timedelta(hours=10, minutes=15), 28.0789, 119.1567, 6, "叶片斑驳黄化", 0.58, "pending", "video"),
            ("蝴蝶监测仪-G01", "庆元农田生态样区", "番茄二点叶螨",
             now.replace(hour=6, minute=20), 27.6845, 118.9234, 42, "叶面密集黄白小点", 0.89, "confirmed", "image"),
            ("红外相机-I01", "景宁畲族乡样区", "桃细菌性穿孔病",
             now - timedelta(hours=14, minutes=15), 27.8123, 119.6789, 3, "叶片穿孔", 0.62, "pending", "image"),
            ("红外相机-A02", "凤阳山北麓样区", "番茄健康",
             now.replace(hour=6, minute=0), 27.9240, 119.2350, 8, "植株长势正常", 0.96, "confirmed", "image"),
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
            ("invasive_species", "critical", "检疫性病害发现",
             "在庆元农田生态样区检出柑橘黄龙病疑似样本，建议立即隔离并送检", "庆元农田生态样区", False, now - timedelta(hours=13)),
            ("protection_anomaly", "warning", "病虫害异常预警",
             "番茄晚疫病在庆元农田生态样区连续3天检出，平均置信度高于0.9", "庆元农田生态样区", True, now - timedelta(days=2)),
            ("data_anomaly", "info", "数据异常提示",
             "红外相机-A02 单日触发次数达到487次，接近阈值", "凤阳山北麓样区", True, now - timedelta(days=3)),
            ("diversity_decline", "warning", "作物健康指数下降",
             "景宁畲族乡样区本月作物健康指数环比下降23%", "景宁畲族乡样区", True, now - timedelta(days=3)),
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
        from apps.recognize.services import _to_category
        from apps.species.models import Species
        from apps.users.models import User

        user = User.objects.filter(username="user01").first()
        now = timezone.now()
        seeds = [
            (now - timedelta(hours=5), "番茄晚疫病", 0.91, False),
            (now - timedelta(hours=2), "玉米北方叶枯病", 0.52, True),
            (now - timedelta(minutes=30), "柑橘黄龙病", 0.78, False),
        ]
        for ts, name, conf, rejected in seeds:
            top = Species.objects.filter(chinese_name=name).first()
            if not top:
                continue
            others = list(Species.objects.exclude(id=top.id)[:4])
            top5 = [{**_to_category(top), "confidence": conf}] + [
                {**_to_category(other), "confidence": round((1 - conf) * weight, 3)}
                for other, weight in zip(others, (0.5, 0.25, 0.15, 0.1))
            ]
            RecognizeRecord.objects.get_or_create(
                user=user, top_category_name=name, created_at=ts,
                defaults={
                    "top_category_id": str(top.id), "top_confidence": conf,
                    "top5_result": top5, "rejected": rejected,
                    "model_version": "plantvillage-r38",
                    "request_id": f"req_seed_{ts.strftime('%Y%m%d%H%M')}",
                },
            )
        self.stdout.write(f"  Recognize records: {RecognizeRecord.objects.count()}")
