// Mock data for the Biodiversity Monitoring Platform

export interface SurveyArea {
  id: string;
  name: string;
  type: 'forest' | 'wetland' | 'farmland' | 'water';
  area: number; // km²
  elevation: string;
  coordinates: { lat: number; lng: number };
  vegetation: string;
  status: 'active' | 'inactive';
  deviceCount: number;
  speciesCount: number;
  lastSurvey: string;
}

export interface Device {
  id: string;
  name: string;
  type: 'infrared_camera' | 'audio_recorder' | 'radar_camera' | 'butterfly_trap' | 'edna' | 'hd_camera';
  location: string;
  surveyAreaId: string;
  status: 'online' | 'offline' | 'warning';
  battery: number;
  storage: number;
  signal: number;
  lastDataTime: string;
  installDate: string;
}

export interface Species {
  id: string;
  chineseName: string;
  latinName: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  protectionLevel: 'national_1' | 'national_2' | 'provincial' | 'none' | 'invasive';
  iucnStatus: 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';
  category: 'mammal' | 'bird' | 'reptile' | 'amphibian' | 'fish' | 'insect' | 'plant' | 'fungi';
  description: string;
  distribution: string;
  imageUrl: string;
  recordCount: number;
}

export interface MonitorRecord {
  id: string;
  deviceId: string;
  deviceName: string;
  timestamp: string;
  location: { lat: number; lng: number };
  surveyAreaId: string;
  surveyAreaName: string;
  speciesId: string;
  speciesName: string;
  speciesLatinName: string;
  count: number;
  behavior: string;
  confidence: number;
  reviewStatus: 'pending' | 'confirmed' | 'rejected' | 'corrected';
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio';
}

export interface Alert {
  id: string;
  type: 'device_offline' | 'invasive_species' | 'protection_anomaly' | 'data_anomaly' | 'diversity_decline';
  level: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  surveyAreaId: string;
  surveyAreaName: string;
  createdAt: string;
  isRead: boolean;
}

export interface DashboardStats {
  totalSpecies: number;
  totalRecords: number;
  activeDevices: number;
  surveyAreas: number;
  pendingReviews: number;
  activeAlerts: number;
  todayRecords: number;
  weekRecords: number;
}

// Survey Areas
export const surveyAreas: SurveyArea[] = [
  {
    id: 'sa-001',
    name: '凤阳山北麓样区',
    type: 'forest',
    area: 15.6,
    elevation: '800-1400m',
    coordinates: { lat: 27.9234, lng: 119.2345 },
    vegetation: '常绿阔叶林',
    status: 'active',
    deviceCount: 12,
    speciesCount: 86,
    lastSurvey: '2026-10-15',
  },
  {
    id: 'sa-002',
    name: '百山祖南坡样区',
    type: 'forest',
    area: 18.2,
    elevation: '1200-1800m',
    coordinates: { lat: 27.7512, lng: 119.1023 },
    vegetation: '针阔混交林',
    status: 'active',
    deviceCount: 15,
    speciesCount: 112,
    lastSurvey: '2026-10-18',
  },
  {
    id: 'sa-003',
    name: '瓯江源头湿地样区',
    type: 'wetland',
    area: 12.4,
    elevation: '300-500m',
    coordinates: { lat: 28.0156, lng: 119.4567 },
    vegetation: '沼泽湿地',
    status: 'active',
    deviceCount: 8,
    speciesCount: 64,
    lastSurvey: '2026-10-20',
  },
  {
    id: 'sa-004',
    name: '庆元农田生态样区',
    type: 'farmland',
    area: 10.8,
    elevation: '400-600m',
    coordinates: { lat: 27.6845, lng: 118.9234 },
    vegetation: '农田生态系统',
    status: 'active',
    deviceCount: 6,
    speciesCount: 42,
    lastSurvey: '2026-10-12',
  },
  {
    id: 'sa-005',
    name: '龙泉溪流域水域样区',
    type: 'water',
    area: 14.5,
    elevation: '200-400m',
    coordinates: { lat: 28.0789, lng: 119.1567 },
    vegetation: '河流生态系统',
    status: 'active',
    deviceCount: 10,
    speciesCount: 53,
    lastSurvey: '2026-10-19',
  },
  {
    id: 'sa-006',
    name: '景宁畲族乡样区',
    type: 'forest',
    area: 16.3,
    elevation: '600-1000m',
    coordinates: { lat: 27.8123, lng: 119.6789 },
    vegetation: '落叶阔叶林',
    status: 'inactive',
    deviceCount: 9,
    speciesCount: 71,
    lastSurvey: '2026-09-28',
  },
];

// Devices
export const devices: Device[] = [
  { id: 'dev-001', name: '红外相机-A01', type: 'infrared_camera', location: '凤阳山北麓-兽径1号', surveyAreaId: 'sa-001', status: 'online', battery: 85, storage: 62, signal: 92, lastDataTime: '2026-10-28T08:30:00', installDate: '2025-03-15' },
  { id: 'dev-002', name: '红外相机-A02', type: 'infrared_camera', location: '凤阳山北麓-水源点', surveyAreaId: 'sa-001', status: 'online', battery: 72, storage: 45, signal: 88, lastDataTime: '2026-10-28T07:15:00', installDate: '2025-03-15' },
  { id: 'dev-003', name: '鸣声记录仪-B01', type: 'audio_recorder', location: '凤阳山北麓-林冠层', surveyAreaId: 'sa-001', status: 'online', battery: 90, storage: 30, signal: 95, lastDataTime: '2026-10-28T09:00:00', installDate: '2025-04-20' },
  { id: 'dev-004', name: '红外相机-C01', type: 'infrared_camera', location: '百山祖南坡-山脊线', surveyAreaId: 'sa-002', status: 'online', battery: 65, storage: 78, signal: 76, lastDataTime: '2026-10-28T06:45:00', installDate: '2025-05-10' },
  { id: 'dev-005', name: '雷达相机-D01', type: 'radar_camera', location: '百山祖南坡-溪流', surveyAreaId: 'sa-002', status: 'warning', battery: 25, storage: 88, signal: 65, lastDataTime: '2026-10-27T22:30:00', installDate: '2025-06-01' },
  { id: 'dev-006', name: '鸣声记录仪-E01', type: 'audio_recorder', location: '瓯江源头-芦苇丛', surveyAreaId: 'sa-003', status: 'online', battery: 80, storage: 55, signal: 90, lastDataTime: '2026-10-28T08:00:00', installDate: '2025-07-15' },
  { id: 'dev-007', name: 'eDNA采集器-F01', type: 'edna', location: '瓯江源头-采样点A', surveyAreaId: 'sa-003', status: 'online', battery: 95, storage: 20, signal: 85, lastDataTime: '2026-10-28T07:30:00', installDate: '2025-08-01' },
  { id: 'dev-008', name: '蝴蝶监测仪-G01', type: 'butterfly_trap', location: '庆元农田-花带区', surveyAreaId: 'sa-004', status: 'offline', battery: 0, storage: 100, signal: 0, lastDataTime: '2026-10-25T14:00:00', installDate: '2025-09-10' },
  { id: 'dev-009', name: '高清相机-H01', type: 'hd_camera', location: '龙泉溪-观测塔', surveyAreaId: 'sa-005', status: 'online', battery: 88, storage: 42, signal: 94, lastDataTime: '2026-10-28T09:15:00', installDate: '2025-04-05' },
  { id: 'dev-010', name: '红外相机-I01', type: 'infrared_camera', location: '景宁-林缘带', surveyAreaId: 'sa-006', status: 'offline', battery: 10, storage: 95, signal: 0, lastDataTime: '2026-10-20T10:00:00', installDate: '2025-05-20' },
  { id: 'dev-011', name: '红外相机-A03', type: 'infrared_camera', location: '凤阳山北麓-兽径2号', surveyAreaId: 'sa-001', status: 'online', battery: 78, storage: 50, signal: 91, lastDataTime: '2026-10-28T08:45:00', installDate: '2025-06-15' },
  { id: 'dev-012', name: '鸣声记录仪-C02', type: 'audio_recorder', location: '百山祖南坡-山谷', surveyAreaId: 'sa-002', status: 'online', battery: 82, storage: 38, signal: 87, lastDataTime: '2026-10-28T09:05:00', installDate: '2025-07-20' },
];

// Species
export const species: Species[] = [
  { id: 'sp-001', chineseName: '华南虎', latinName: 'Panthera tigris amoyensis', kingdom: '动物界', phylum: '脊索动物门', class: '哺乳纲', order: '食肉目', family: '猫科', genus: '豹属', protectionLevel: 'national_1', iucnStatus: 'CR', category: 'mammal', description: '中国特有虎亚种，极度濒危', distribution: '华南地区', imageUrl: '', recordCount: 3 },
  { id: 'sp-002', chineseName: '黑麂', latinName: 'Muntiacus crinifrons', kingdom: '动物界', phylum: '脊索动物门', class: '哺乳纲', order: '偶蹄目', family: '鹿科', genus: '麂属', protectionLevel: 'national_1', iucnStatus: 'EN', category: 'mammal', description: '中国特有珍稀鹿类', distribution: '浙江、安徽', imageUrl: '', recordCount: 28 },
  { id: 'sp-003', chineseName: '白颈长尾雉', latinName: 'Syrmaticus ellioti', kingdom: '动物界', phylum: '脊索动物门', class: '鸟纲', order: '鸡形目', family: '雉科', genus: '长尾雉属', protectionLevel: 'national_1', iucnStatus: 'NT', category: 'bird', description: '中国特有种，东南丘陵代表物种', distribution: '浙江、福建、江西', imageUrl: '', recordCount: 45 },
  { id: 'sp-004', chineseName: '黄腹角雉', latinName: 'Tragopan caboti', kingdom: '动物界', phylum: '脊索动物门', class: '鸟纲', order: '鸡形目', family: '雉科', genus: '角雉属', protectionLevel: 'national_1', iucnStatus: 'VU', category: 'bird', description: '中国特有鸟类', distribution: '浙江、福建', imageUrl: '', recordCount: 32 },
  { id: 'sp-005', chineseName: '猕猴', latinName: 'Macaca mulatta', kingdom: '动物界', phylum: '脊索动物门', class: '哺乳纲', order: '灵长目', family: '猴科', genus: '猕猴属', protectionLevel: 'national_2', iucnStatus: 'LC', category: 'mammal', description: '常见灵长类', distribution: '全国大部分山区', imageUrl: '', recordCount: 156 },
  { id: 'sp-006', chineseName: '穿山甲', latinName: 'Manis pentadactyla', kingdom: '动物界', phylum: '脊索动物门', class: '哺乳纲', order: '鳞甲目', family: '穿山甲科', genus: '穿山甲属', protectionLevel: 'national_1', iucnStatus: 'CR', category: 'mammal', description: '全球最受威胁的哺乳动物之一', distribution: '华南、西南', imageUrl: '', recordCount: 5 },
  { id: 'sp-007', chineseName: '大鲵', latinName: 'Andrias davidianus', kingdom: '动物界', phylum: '脊索动物门', class: '两栖纲', order: '有尾目', family: '隐鳃鲵科', genus: '大鲵属', protectionLevel: 'national_2', iucnStatus: 'CR', category: 'amphibian', description: '世界最大两栖动物', distribution: '华中、华南山区溪流', imageUrl: '', recordCount: 12 },
  { id: 'sp-008', chineseName: '鹰嘴龟', latinName: 'Platysternon megacephalum', kingdom: '动物界', phylum: '脊索动物门', class: '爬行纲', order: '龟鳖目', family: '平胸龟科', genus: '平胸龟属', protectionLevel: 'national_2', iucnStatus: 'EN', category: 'reptile', description: '头部巨大的原始龟类', distribution: '华东、华中山区', imageUrl: '', recordCount: 8 },
  { id: 'sp-009', chineseName: '银杏', latinName: 'Ginkgo biloba', kingdom: '植物界', phylum: '银杏门', class: '银杏纲', order: '银杏目', family: '银杏科', genus: '银杏属', protectionLevel: 'national_1', iucnStatus: 'EN', category: 'plant', description: '活化石植物', distribution: '全国广泛栽培', imageUrl: '', recordCount: 67 },
  { id: 'sp-010', chineseName: '南方红豆杉', latinName: 'Taxus wallichiana var. mairei', kingdom: '植物界', phylum: '松柏门', class: '松柏纲', order: '松柏目', family: '红豆杉科', genus: '红豆杉属', protectionLevel: 'national_1', iucnStatus: 'VU', category: 'plant', description: '珍稀裸子植物', distribution: '华东、华中', imageUrl: '', recordCount: 89 },
  { id: 'sp-011', chineseName: '白花兜兰', latinName: 'Paphiopedilum emersonii', kingdom: '植物界', phylum: '被子植物门', class: '单子叶植物纲', order: '天门冬目', family: '兰科', genus: '兜兰属', protectionLevel: 'national_1', iucnStatus: 'CR', category: 'plant', description: '极危兰花物种', distribution: '广西、云南', imageUrl: '', recordCount: 4 },
  { id: 'sp-012', chineseName: '金斑喙凤蝶', latinName: 'Teinopalpus aureus', kingdom: '动物界', phylum: '节肢动物门', class: '昆虫纲', order: '鳞翅目', family: '凤蝶科', genus: '喙凤蝶属', protectionLevel: 'national_1', iucnStatus: 'VU', category: 'insect', description: '中国最美丽的蝴蝶之一', distribution: '华南、华东山区', imageUrl: '', recordCount: 15 },
  { id: 'sp-013', chineseName: '加拿大一枝黄花', latinName: 'Solidago canadensis', kingdom: '植物界', phylum: '被子植物门', class: '双子叶植物纲', order: '菊目', family: '菊科', genus: '一枝黄花属', protectionLevel: 'invasive', iucnStatus: 'LC', category: 'plant', description: '外来入侵物种', distribution: '全国', imageUrl: '', recordCount: 234 },
  { id: 'sp-014', chineseName: '棘胸蛙', latinName: 'Quasipaa spinosa', kingdom: '动物界', phylum: '脊索动物门', class: '两栖纲', order: '无尾目', family: '叉舌蛙科', genus: '棘蛙属', protectionLevel: 'provincial', iucnStatus: 'VU', category: 'amphibian', description: '山区溪流常见蛙类', distribution: '华东、华中', imageUrl: '', recordCount: 78 },
  { id: 'sp-015', chineseName: '白鹇', latinName: 'Lophura nycthemera', kingdom: '动物界', phylum: '脊索动物门', class: '鸟纲', order: '鸡形目', family: '雉科', genus: '鹇属', protectionLevel: 'national_2', iucnStatus: 'LC', category: 'bird', description: '美丽的大型雉类', distribution: '华东、华中、华南', imageUrl: '', recordCount: 198 },
];

// Monitor Records
export const monitorRecords: MonitorRecord[] = [
  { id: 'rec-001', deviceId: 'dev-001', deviceName: '红外相机-A01', timestamp: '2026-10-28T06:23:15', location: { lat: 27.9234, lng: 119.2345 }, surveyAreaId: 'sa-001', surveyAreaName: '凤阳山北麓样区', speciesId: 'sp-002', speciesName: '黑麂', speciesLatinName: 'Muntiacus crinifrons', count: 1, behavior: '饮水', confidence: 0.94, reviewStatus: 'confirmed', mediaUrl: '', mediaType: 'image' },
  { id: 'rec-002', deviceId: 'dev-002', deviceName: '红外相机-A02', timestamp: '2026-10-28T05:45:30', location: { lat: 27.9240, lng: 119.2350 }, surveyAreaId: 'sa-001', surveyAreaName: '凤阳山北麓样区', speciesId: 'sp-005', speciesName: '猕猴', speciesLatinName: 'Macaca mulatta', count: 5, behavior: '觅食', confidence: 0.97, reviewStatus: 'confirmed', mediaUrl: '', mediaType: 'video' },
  { id: 'rec-003', deviceId: 'dev-003', deviceName: '鸣声记录仪-B01', timestamp: '2026-10-28T05:30:00', location: { lat: 27.9230, lng: 119.2340 }, surveyAreaId: 'sa-001', surveyAreaName: '凤阳山北麓样区', speciesId: 'sp-003', speciesName: '白颈长尾雉', speciesLatinName: 'Syrmaticus ellioti', count: 1, behavior: '鸣叫', confidence: 0.88, reviewStatus: 'confirmed', mediaUrl: '', mediaType: 'audio' },
  { id: 'rec-004', deviceId: 'dev-004', deviceName: '红外相机-C01', timestamp: '2026-10-28T04:12:45', location: { lat: 27.7512, lng: 119.1023 }, surveyAreaId: 'sa-002', surveyAreaName: '百山祖南坡样区', speciesId: 'sp-004', speciesName: '黄腹角雉', speciesLatinName: 'Tragopan caboti', count: 2, behavior: '漫步', confidence: 0.91, reviewStatus: 'pending', mediaUrl: '', mediaType: 'image' },
  { id: 'rec-005', deviceId: 'dev-006', deviceName: '鸣声记录仪-E01', timestamp: '2026-10-28T06:00:00', location: { lat: 28.0156, lng: 119.4567 }, surveyAreaId: 'sa-003', surveyAreaName: '瓯江源头湿地样区', speciesId: 'sp-015', speciesName: '白鹇', speciesLatinName: 'Lophura nycthemera', count: 1, behavior: '鸣叫', confidence: 0.82, reviewStatus: 'pending', mediaUrl: '', mediaType: 'audio' },
  { id: 'rec-006', deviceId: 'dev-009', deviceName: '高清相机-H01', timestamp: '2026-10-28T07:30:00', location: { lat: 28.0789, lng: 119.1567 }, surveyAreaId: 'sa-005', surveyAreaName: '龙泉溪流域水域样区', speciesId: 'sp-007', speciesName: '大鲵', speciesLatinName: 'Andrias davidianus', count: 1, behavior: '栖息', confidence: 0.76, reviewStatus: 'pending', mediaUrl: '', mediaType: 'image' },
  { id: 'rec-007', deviceId: 'dev-001', deviceName: '红外相机-A01', timestamp: '2026-10-27T22:15:30', location: { lat: 27.9234, lng: 119.2345 }, surveyAreaId: 'sa-001', surveyAreaName: '凤阳山北麓样区', speciesId: 'sp-006', speciesName: '穿山甲', speciesLatinName: 'Manis pentadactyla', count: 1, behavior: '活动', confidence: 0.58, reviewStatus: 'pending', mediaUrl: '', mediaType: 'video' },
  { id: 'rec-008', deviceId: 'dev-011', deviceName: '红外相机-A03', timestamp: '2026-10-28T03:20:00', location: { lat: 27.9245, lng: 119.2360 }, surveyAreaId: 'sa-001', surveyAreaName: '凤阳山北麓样区', speciesId: 'sp-012', speciesName: '金斑喙凤蝶', speciesLatinName: 'Teinopalpus aureus', count: 1, behavior: '访花', confidence: 0.72, reviewStatus: 'pending', mediaUrl: '', mediaType: 'image' },
  { id: 'rec-009', deviceId: 'dev-002', deviceName: '红外相机-A02', timestamp: '2026-10-27T19:45:00', location: { lat: 27.9240, lng: 119.2350 }, surveyAreaId: 'sa-001', surveyAreaName: '凤阳山北麓样区', speciesId: 'sp-013', speciesName: '加拿大一枝黄花', speciesLatinName: 'Solidago canadensis', count: 1, behavior: '-', confidence: 0.89, reviewStatus: 'confirmed', mediaUrl: '', mediaType: 'image' },
  { id: 'rec-010', deviceId: 'dev-012', deviceName: '鸣声记录仪-C02', timestamp: '2026-10-28T05:15:00', location: { lat: 27.7520, lng: 119.1030 }, surveyAreaId: 'sa-002', surveyAreaName: '百山祖南坡样区', speciesId: 'sp-014', speciesName: '棘胸蛙', speciesLatinName: 'Quasipaa spinosa', count: 3, behavior: '鸣叫', confidence: 0.93, reviewStatus: 'confirmed', mediaUrl: '', mediaType: 'audio' },
];

// Alerts
export const alerts: Alert[] = [
  { id: 'alt-001', type: 'device_offline', level: 'warning', title: '设备离线告警', description: '蝴蝶监测仪-G01 已超过72小时无数据回传', surveyAreaId: 'sa-004', surveyAreaName: '庆元农田生态样区', createdAt: '2026-10-28T08:00:00', isRead: false },
  { id: 'alt-002', type: 'device_offline', level: 'warning', title: '设备离线告警', description: '红外相机-I01 已超过192小时无数据回传', surveyAreaId: 'sa-006', surveyAreaName: '景宁畲族乡样区', createdAt: '2026-10-27T22:00:00', isRead: false },
  { id: 'alt-003', type: 'invasive_species', level: 'critical', title: '入侵物种发现', description: '在庆元农田生态样区发现加拿大一枝黄花，建议立即处置', surveyAreaId: 'sa-004', surveyAreaName: '庆元农田生态样区', createdAt: '2026-10-27T19:45:00', isRead: false },
  { id: 'alt-004', type: 'protection_anomaly', level: 'warning', title: '保护物种监测异常', description: '华南虎已连续45天未在凤阳山北麓样区监测到', surveyAreaId: 'sa-001', surveyAreaName: '凤阳山北麓样区', createdAt: '2026-10-26T10:00:00', isRead: true },
  { id: 'alt-005', type: 'data_anomaly', level: 'info', title: '数据异常提示', description: '红外相机-A02 单日触发次数达到487次，接近阈值', surveyAreaId: 'sa-001', surveyAreaName: '凤阳山北麓样区', createdAt: '2026-10-25T23:59:00', isRead: true },
  { id: 'alt-006', type: 'diversity_decline', level: 'warning', title: '多样性指数下降', description: '景宁畲族乡样区本月Shannon多样性指数环比下降23%', surveyAreaId: 'sa-006', surveyAreaName: '景宁畲族乡样区', createdAt: '2026-10-25T09:00:00', isRead: true },
  { id: 'alt-007', type: 'device_offline', level: 'info', title: '设备低电量预警', description: '雷达相机-D01 电量低于25%，请及时更换', surveyAreaId: 'sa-002', surveyAreaName: '百山祖南坡样区', createdAt: '2026-10-28T06:00:00', isRead: false },
];

// Dashboard Stats
export const dashboardStats: DashboardStats = {
  totalSpecies: 498,
  totalRecords: 28654,
  activeDevices: 52,
  surveyAreas: 6,
  pendingReviews: 127,
  activeAlerts: 7,
  todayRecords: 342,
  weekRecords: 2156,
};

// Chart data
export const monthlyRecordTrend = [
  { month: '1月', records: 1820, species: 45 },
  { month: '2月', records: 1650, species: 38 },
  { month: '3月', records: 2100, species: 52 },
  { month: '4月', records: 2850, species: 68 },
  { month: '5月', records: 3200, species: 75 },
  { month: '6月', records: 3500, species: 82 },
  { month: '7月', records: 3100, species: 78 },
  { month: '8月', records: 2900, species: 72 },
  { month: '9月', records: 2600, species: 65 },
  { month: '10月', records: 2156, species: 58 },
];

export const speciesCategoryData = [
  { name: '哺乳类', value: 68, color: 'oklch(0.35 0.1 155)' },
  { name: '鸟类', value: 156, color: 'oklch(0.6 0.12 195)' },
  { name: '爬行类', value: 32, color: 'oklch(0.55 0.08 70)' },
  { name: '两栖类', value: 28, color: 'oklch(0.7 0.17 145)' },
  { name: '鱼类', value: 45, color: 'oklch(0.65 0.15 230)' },
  { name: '昆虫', value: 124, color: 'oklch(0.75 0.16 65)' },
  { name: '植物', value: 40, color: 'oklch(0.5 0.12 330)' },
  { name: '真菌', value: 5, color: 'oklch(0.6 0.1 30)' },
];

export const raiData = [
  { species: '白鹇', rai: 12.5 },
  { species: '猕猴', rai: 8.3 },
  { species: '黑麂', rai: 3.2 },
  { species: '黄腹角雉', rai: 2.8 },
  { species: '白颈长尾雉', rai: 2.1 },
  { species: '穿山甲', rai: 0.5 },
  { species: '棘胸蛙', rai: 4.6 },
  { species: '大鲵', rai: 0.8 },
];

export const activityRhythmData = [
  { hour: '0时', count: 45 },
  { hour: '2时', count: 38 },
  { hour: '4时', count: 52 },
  { hour: '6时', count: 89 },
  { hour: '8时', count: 67 },
  { hour: '10时', count: 43 },
  { hour: '12时', count: 28 },
  { hour: '14时', count: 35 },
  { hour: '16时', count: 56 },
  { hour: '18时', count: 78 },
  { hour: '20时', count: 92 },
  { hour: '22时', count: 65 },
];

export const deviceTypeLabels: Record<Device['type'], string> = {
  infrared_camera: '红外相机',
  audio_recorder: '鸣声记录仪',
  radar_camera: '雷达相机',
  butterfly_trap: '蝴蝶监测仪',
  edna: 'eDNA采集装置',
  hd_camera: '高清相机',
};

export const protectionLevelLabels: Record<Species['protectionLevel'], string> = {
  national_1: '国家一级',
  national_2: '国家二级',
  provincial: '省级保护',
  none: '无保护',
  invasive: '入侵物种',
};

export const iucnLabels: Record<Species['iucnStatus'], string> = {
  LC: '无危',
  NT: '近危',
  VU: '易危',
  EN: '濒危',
  CR: '极危',
  EW: '野外灭绝',
  EX: '灭绝',
};

export const categoryLabels: Record<Species['category'], string> = {
  mammal: '哺乳类',
  bird: '鸟类',
  reptile: '爬行类',
  amphibian: '两栖类',
  fish: '鱼类',
  insect: '昆虫',
  plant: '植物',
  fungi: '真菌',
};

export const surveyAreaTypeLabels: Record<SurveyArea['type'], string> = {
  forest: '森林',
  wetland: '湿地',
  farmland: '农田',
  water: '水域',
};

export const alertTypeLabels: Record<Alert['type'], string> = {
  device_offline: '设备离线',
  invasive_species: '入侵物种',
  protection_anomaly: '保护物种异常',
  data_anomaly: '数据异常',
  diversity_decline: '多样性下降',
};

export const alertLevelLabels: Record<Alert['level'], string> = {
  info: '提示',
  warning: '警告',
  critical: '严重',
};

// 遥感监测数据类型
export interface RemoteSensingData {
  surveyAreaId: string;
  // 植被覆盖度月度数据 (%)
  vegetationCoverage: { month: string; coverage: number }[];
  // 叶面积指数 LAI 月度数据
  lai: { month: string; value: number }[];
  // 总初级生产力 GPP 月度数据 (gC/m²/month)
  gpp: { month: string; value: number }[];
  // 植被类型面积分布 (km²)
  vegetationTypes: { type: string; area: number; percentage: number; color: string }[];
  // 最新数据时间
  lastUpdate: string;
  // 影像分辨率
  resolution: string;
}

// 遥感监测Mock数据
export const remoteSensingData: RemoteSensingData[] = [
  {
    surveyAreaId: 'sa-001',
    vegetationCoverage: [
      { month: '1月', coverage: 72 },
      { month: '2月', coverage: 71 },
      { month: '3月', coverage: 75 },
      { month: '4月', coverage: 82 },
      { month: '5月', coverage: 88 },
      { month: '6月', coverage: 92 },
      { month: '7月', coverage: 94 },
      { month: '8月', coverage: 93 },
      { month: '9月', coverage: 89 },
      { month: '10月', coverage: 85 },
    ],
    lai: [
      { month: '1月', value: 2.1 },
      { month: '2月', value: 2.0 },
      { month: '3月', value: 2.8 },
      { month: '4月', value: 3.5 },
      { month: '5月', value: 4.2 },
      { month: '6月', value: 4.8 },
      { month: '7月', value: 5.1 },
      { month: '8月', value: 5.0 },
      { month: '9月', value: 4.5 },
      { month: '10月', value: 3.8 },
    ],
    gpp: [
      { month: '1月', value: 45 },
      { month: '2月', value: 52 },
      { month: '3月', value: 98 },
      { month: '4月', value: 156 },
      { month: '5月', value: 210 },
      { month: '6月', value: 245 },
      { month: '7月', value: 258 },
      { month: '8月', value: 242 },
      { month: '9月', value: 185 },
      { month: '10月', value: 125 },
    ],
    vegetationTypes: [
      { type: '常绿阔叶林', area: 8.5, percentage: 54.5, color: 'oklch(0.35 0.1 155)' },
      { type: '针阔混交林', area: 3.2, percentage: 20.5, color: 'oklch(0.45 0.08 155)' },
      { type: '灌丛', area: 2.1, percentage: 13.5, color: 'oklch(0.55 0.12 145)' },
      { type: '草地', area: 1.2, percentage: 7.7, color: 'oklch(0.65 0.15 135)' },
      { type: '裸地/其他', area: 0.6, percentage: 3.8, color: 'oklch(0.7 0.05 80)' },
    ],
    lastUpdate: '2026-10-25',
    resolution: '1.5m',
  },
  {
    surveyAreaId: 'sa-002',
    vegetationCoverage: [
      { month: '1月', coverage: 68 },
      { month: '2月', coverage: 67 },
      { month: '3月', coverage: 72 },
      { month: '4月', coverage: 80 },
      { month: '5月', coverage: 86 },
      { month: '6月', coverage: 90 },
      { month: '7月', coverage: 92 },
      { month: '8月', coverage: 91 },
      { month: '9月', coverage: 87 },
      { month: '10月', coverage: 82 },
    ],
    lai: [
      { month: '1月', value: 1.8 },
      { month: '2月', value: 1.7 },
      { month: '3月', value: 2.5 },
      { month: '4月', value: 3.2 },
      { month: '5月', value: 4.0 },
      { month: '6月', value: 4.6 },
      { month: '7月', value: 4.9 },
      { month: '8月', value: 4.8 },
      { month: '9月', value: 4.2 },
      { month: '10月', value: 3.5 },
    ],
    gpp: [
      { month: '1月', value: 38 },
      { month: '2月', value: 45 },
      { month: '3月', value: 85 },
      { month: '4月', value: 142 },
      { month: '5月', value: 195 },
      { month: '6月', value: 228 },
      { month: '7月', value: 240 },
      { month: '8月', value: 225 },
      { month: '9月', value: 168 },
      { month: '10月', value: 112 },
    ],
    vegetationTypes: [
      { type: '针阔混交林', area: 9.8, percentage: 53.8, color: 'oklch(0.4 0.09 155)' },
      { type: '常绿阔叶林', area: 4.5, percentage: 24.7, color: 'oklch(0.35 0.1 155)' },
      { type: '亚高山草甸', area: 2.2, percentage: 12.1, color: 'oklch(0.6 0.14 140)' },
      { type: '灌丛', area: 1.2, percentage: 6.6, color: 'oklch(0.55 0.12 145)' },
      { type: '裸岩/其他', area: 0.5, percentage: 2.8, color: 'oklch(0.7 0.05 80)' },
    ],
    lastUpdate: '2026-10-25',
    resolution: '1.2m',
  },
  {
    surveyAreaId: 'sa-003',
    vegetationCoverage: [
      { month: '1月', coverage: 45 },
      { month: '2月', coverage: 44 },
      { month: '3月', coverage: 52 },
      { month: '4月', coverage: 65 },
      { month: '5月', coverage: 78 },
      { month: '6月', coverage: 85 },
      { month: '7月', coverage: 88 },
      { month: '8月', coverage: 87 },
      { month: '9月', coverage: 80 },
      { month: '10月', coverage: 68 },
    ],
    lai: [
      { month: '1月', value: 1.2 },
      { month: '2月', value: 1.1 },
      { month: '3月', value: 1.8 },
      { month: '4月', value: 2.5 },
      { month: '5月', value: 3.2 },
      { month: '6月', value: 3.8 },
      { month: '7月', value: 4.0 },
      { month: '8月', value: 3.9 },
      { month: '9月', value: 3.3 },
      { month: '10月', value: 2.5 },
    ],
    gpp: [
      { month: '1月', value: 28 },
      { month: '2月', value: 32 },
      { month: '3月', value: 65 },
      { month: '4月', value: 118 },
      { month: '5月', value: 168 },
      { month: '6月', value: 198 },
      { month: '7月', value: 210 },
      { month: '8月', value: 195 },
      { month: '9月', value: 145 },
      { month: '10月', value: 88 },
    ],
    vegetationTypes: [
      { type: '沼泽湿地植被', area: 4.8, percentage: 38.7, color: 'oklch(0.45 0.1 180)' },
      { type: '芦苇群落', area: 3.2, percentage: 25.8, color: 'oklch(0.55 0.12 150)' },
      { type: '水生植物', area: 2.5, percentage: 20.2, color: 'oklch(0.5 0.14 195)' },
      { type: '滩涂', area: 1.2, percentage: 9.7, color: 'oklch(0.65 0.08 90)' },
      { type: '开阔水域', area: 0.7, percentage: 5.6, color: 'oklch(0.6 0.1 220)' },
    ],
    lastUpdate: '2026-10-25',
    resolution: '1.5m',
  },
  {
    surveyAreaId: 'sa-004',
    vegetationCoverage: [
      { month: '1月', coverage: 25 },
      { month: '2月', coverage: 24 },
      { month: '3月', coverage: 35 },
      { month: '4月', coverage: 55 },
      { month: '5月', coverage: 72 },
      { month: '6月', coverage: 82 },
      { month: '7月', coverage: 85 },
      { month: '8月', coverage: 83 },
      { month: '9月', coverage: 70 },
      { month: '10月', coverage: 48 },
    ],
    lai: [
      { month: '1月', value: 0.5 },
      { month: '2月', value: 0.4 },
      { month: '3月', value: 1.2 },
      { month: '4月', value: 2.2 },
      { month: '5月', value: 3.0 },
      { month: '6月', value: 3.5 },
      { month: '7月', value: 3.6 },
      { month: '8月', value: 3.4 },
      { month: '9月', value: 2.6 },
      { month: '10月', value: 1.5 },
    ],
    gpp: [
      { month: '1月', value: 15 },
      { month: '2月', value: 18 },
      { month: '3月', value: 45 },
      { month: '4月', value: 95 },
      { month: '5月', value: 145 },
      { month: '6月', value: 175 },
      { month: '7月', value: 182 },
      { month: '8月', value: 168 },
      { month: '9月', value: 115 },
      { month: '10月', value: 58 },
    ],
    vegetationTypes: [
      { type: '水稻田', area: 5.2, percentage: 48.1, color: 'oklch(0.55 0.12 140)' },
      { type: '旱地作物', area: 2.8, percentage: 25.9, color: 'oklch(0.6 0.1 120)' },
      { type: '田埂植被', area: 1.5, percentage: 13.9, color: 'oklch(0.5 0.14 145)' },
      { type: '沟渠水生植物', area: 0.8, percentage: 7.4, color: 'oklch(0.5 0.14 195)' },
      { type: '建设用地', area: 0.5, percentage: 4.7, color: 'oklch(0.65 0.03 60)' },
    ],
    lastUpdate: '2026-10-25',
    resolution: '1.0m',
  },
  {
    surveyAreaId: 'sa-005',
    vegetationCoverage: [
      { month: '1月', coverage: 52 },
      { month: '2月', coverage: 51 },
      { month: '3月', coverage: 58 },
      { month: '4月', coverage: 68 },
      { month: '5月', coverage: 78 },
      { month: '6月', coverage: 85 },
      { month: '7月', coverage: 88 },
      { month: '8月', coverage: 86 },
      { month: '9月', coverage: 78 },
      { month: '10月', coverage: 65 },
    ],
    lai: [
      { month: '1月', value: 1.5 },
      { month: '2月', value: 1.4 },
      { month: '3月', value: 2.0 },
      { month: '4月', value: 2.8 },
      { month: '5月', value: 3.5 },
      { month: '6月', value: 4.0 },
      { month: '7月', value: 4.2 },
      { month: '8月', value: 4.1 },
      { month: '9月', value: 3.5 },
      { month: '10月', value: 2.8 },
    ],
    gpp: [
      { month: '1月', value: 32 },
      { month: '2月', value: 38 },
      { month: '3月', value: 72 },
      { month: '4月', value: 128 },
      { month: '5月', value: 178 },
      { month: '6月', value: 208 },
      { month: '7月', value: 218 },
      { month: '8月', value: 202 },
      { month: '9月', value: 152 },
      { month: '10月', value: 95 },
    ],
    vegetationTypes: [
      { type: '河岸林', area: 5.5, percentage: 37.9, color: 'oklch(0.4 0.1 155)' },
      { type: '水生植被', area: 3.8, percentage: 26.2, color: 'oklch(0.5 0.14 195)' },
      { type: '湿地灌丛', area: 2.5, percentage: 17.2, color: 'oklch(0.55 0.12 150)' },
      { type: '河滩草地', area: 1.8, percentage: 12.4, color: 'oklch(0.6 0.14 135)' },
      { type: '开阔水面', area: 0.9, percentage: 6.3, color: 'oklch(0.6 0.1 220)' },
    ],
    lastUpdate: '2026-10-25',
    resolution: '1.5m',
  },
  {
    surveyAreaId: 'sa-006',
    vegetationCoverage: [
      { month: '1月', coverage: 58 },
      { month: '2月', coverage: 57 },
      { month: '3月', coverage: 62 },
      { month: '4月', coverage: 72 },
      { month: '5月', coverage: 80 },
      { month: '6月', coverage: 85 },
      { month: '7月', coverage: 87 },
      { month: '8月', coverage: 86 },
      { month: '9月', coverage: 78 },
      { month: '10月', coverage: 68 },
    ],
    lai: [
      { month: '1月', value: 1.6 },
      { month: '2月', value: 1.5 },
      { month: '3月', value: 2.2 },
      { month: '4月', value: 3.0 },
      { month: '5月', value: 3.6 },
      { month: '6月', value: 4.1 },
      { month: '7月', value: 4.3 },
      { month: '8月', value: 4.2 },
      { month: '9月', value: 3.6 },
      { month: '10月', value: 2.9 },
    ],
    gpp: [
      { month: '1月', value: 35 },
      { month: '2月', value: 42 },
      { month: '3月', value: 78 },
      { month: '4月', value: 135 },
      { month: '5月', value: 185 },
      { month: '6月', value: 215 },
      { month: '7月', value: 225 },
      { month: '8月', value: 210 },
      { month: '9月', value: 158 },
      { month: '10月', value: 98 },
    ],
    vegetationTypes: [
      { type: '落叶阔叶林', area: 8.2, percentage: 50.3, color: 'oklch(0.5 0.1 90)' },
      { type: '针叶林', area: 3.5, percentage: 21.5, color: 'oklch(0.35 0.08 165)' },
      { type: '灌丛', area: 2.8, percentage: 17.2, color: 'oklch(0.55 0.12 145)' },
      { type: '草地', area: 1.2, percentage: 7.4, color: 'oklch(0.65 0.15 135)' },
      { type: '其他', area: 0.6, percentage: 3.6, color: 'oklch(0.7 0.05 80)' },
    ],
    lastUpdate: '2026-10-25',
    resolution: '1.8m',
  },
];
