'use client';

import { useEffect, useState } from 'react';
import {
  Leaf,
  Camera,
  Map,
  ClipboardList,
  Bell,
  TrendingUp,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import Link from 'next/link';
import { api } from '@/lib/api';

// 颜色映射（中文分类名 → 颜色）
const categoryColorMap: Record<string, string> = {
  '哺乳类': 'oklch(0.35 0.1 155)',
  '鸟类': 'oklch(0.6 0.12 195)',
  '爬行类': 'oklch(0.55 0.08 70)',
  '两栖类': 'oklch(0.7 0.17 145)',
  '鱼类': 'oklch(0.65 0.15 230)',
  '昆虫': 'oklch(0.75 0.16 65)',
  '植物': 'oklch(0.5 0.12 330)',
  '真菌': 'oklch(0.6 0.1 30)',
};

// 静态 label 映射
const alertTypeLabels: Record<string, string> = {
  device_offline: '设备离线',
  invasive_species: '入侵物种',
  protection_anomaly: '保护物种异常',
  data_anomaly: '数据异常',
  diversity_decline: '多样性下降',
};

// RAI / 活动节律数据（后端真实接口 /api/v1/analytics/rai/ /rhythm/，无数据时用占位）
const fallbackRai = [
  { species: '暂无数据', rai: 0 },
];
const fallbackRhythm = [
  { hour: '0时', count: 0 },
  { hour: '6时', count: 0 },
  { hour: '12时', count: 0 },
  { hour: '18时', count: 0 },
  { hour: '22时', count: 0 },
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [speciesCategory, setSpeciesCategory] = useState<any[]>([]);
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [raiData, setRaiData] = useState<any[]>(fallbackRai);
  const [rhythmData, setRhythmData] = useState<any[]>(fallbackRhythm);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [d, m, s, r, a, rai, rhythm] = await Promise.all([
          api.analytics.dashboard(),
          api.analytics.monthlyTrend(),
          api.analytics.speciesCategory(),
          api.analytics.recentRecords(5),
          api.analytics.recentAlerts(4),
          api.analytics.rai(7, 6).catch(() => fallbackRai),
          api.analytics.rhythm(7).catch(() => fallbackRhythm),
        ]);
        if (cancelled) return;
        setDashboard(d);
        setMonthlyTrend(m || []);
        setSpeciesCategory(s || []);
        setRecentRecords(r || []);
        setRecentAlerts(a || []);
        setRaiData(rai || fallbackRai);
        setRhythmData(rhythm || fallbackRhythm);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // 对 speciesCategory 数据补上 color
  const categoryWithColor = speciesCategory.map((item: any) => ({
    ...item,
    color: item.color || categoryColorMap[item.name] || 'oklch(0.5 0.1 155)',
  }));

  const statCards = dashboard
    ? [
        {
          title: '监测物种总数',
          value: dashboard.totalSpecies,
          icon: Leaf,
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
          change: `+${dashboard.pendingReviews || 0} 待复核`,
        },
        {
          title: '监测记录总数',
          value: (dashboard.totalRecords ?? 0).toLocaleString(),
          icon: ClipboardList,
          color: 'text-sky-600',
          bgColor: 'bg-sky-50',
          change: `+${dashboard.todayRecords || 0} 今日`,
        },
        {
          title: '在线设备',
          value: dashboard.activeDevices,
          icon: Camera,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50',
          change: `${dashboard.activeDevices || 0} 活跃`,
        },
        {
          title: '监测样区',
          value: dashboard.surveyAreas,
          icon: Map,
          color: 'text-violet-600',
          bgColor: 'bg-violet-50',
          change: `${dashboard.weekRecords || 0} 本周记录`,
        },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">监测看板</h1>
          <p className="text-muted-foreground text-sm mt-1">
            天空地一体化生物多样性监测概览
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          <span>
            {loading ? '加载中...' : error ? '加载失败' : `数据更新时间：${new Date().toLocaleString('zh-CN')}`}
          </span>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            加载失败：{error}
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">
                    {loading ? '...' : stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                </div>
                <div className={`rounded-xl p-3 ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && !dashboard && !error && (
          <Card className="lg:col-span-4">
            <CardContent className="p-8 text-center text-muted-foreground">
              暂无数据
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Monthly Trend */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">监测记录趋势</CardTitle>
              <Badge variant="secondary" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                月度
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                加载中...
              </div>
            ) : monthlyTrend.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                暂无数据
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="colorRecords" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.35 0.1 155)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="oklch(0.35 0.1 155)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 155)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 155)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 155)" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid oklch(0.92 0.01 155)',
                      boxShadow: '0 4px 12px oklch(0 0 0 / 0.05)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="records"
                    stroke="oklch(0.35 0.1 155)"
                    strokeWidth={2}
                    fill="url(#colorRecords)"
                    name="监测记录"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Species Category */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">物种分类分布</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                加载中...
              </div>
            ) : categoryWithColor.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                暂无数据
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={220}>
                  <PieChart>
                    <Pie
                      data={categoryWithColor}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryWithColor.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  {categoryWithColor.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-xs">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground truncate">{item.name}</span>
                      <span className="font-medium ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 — RAI & 活动节律 (暂时使用占位数据) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {/* RAI */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">物种相对丰富度 (RAI)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={raiData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 155)" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 155)" />
                <YAxis
                  type="category"
                  dataKey="species"
                  tick={{ fontSize: 12 }}
                  width={80}
                  stroke="oklch(0.5 0.02 155)"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid oklch(0.92 0.01 155)',
                  }}
                />
                <Bar
                  dataKey="rai"
                  fill="oklch(0.6 0.12 195)"
                  radius={[0, 4, 4, 0]}
                  name="RAI"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activity Rhythm */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">动物活动节律</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={rhythmData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 155)" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="oklch(0.5 0.02 155)" />
                <YAxis tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 155)" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid oklch(0.92 0.01 155)',
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="oklch(0.55 0.08 70)"
                  radius={[4, 4, 0, 0]}
                  name="拍摄频次"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {/* Recent Records */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">最新监测记录</CardTitle>
              <Link href="/records" className="text-xs text-primary hover:underline">
                查看全部
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">加载中...</div>
            ) : recentRecords.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">暂无记录</div>
            ) : (
              <div className="space-y-3">
                {recentRecords.map((record: any) => (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5">
                      <Camera className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {record.speciesName || record.species_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground italic">
                          {record.speciesLatinName || record.species_latin_name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {record.deviceName || record.device_name} ·{' '}
                        {record.surveyAreaName || record.survey_area_name} ·{' '}
                        {record.behavior || '-'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        variant={
                          (record.confidence ?? 0) >= 0.8
                            ? 'secondary'
                            : (record.confidence ?? 0) >= 0.6
                              ? 'default'
                              : 'destructive'
                        }
                        className="text-[10px]"
                      >
                        {((record.confidence ?? 0) * 100).toFixed(0)}%
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(record.timestamp || record.created_at).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">最新预警</CardTitle>
              <Link href="/alerts" className="text-xs text-primary hover:underline">
                查看全部
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">加载中...</div>
            ) : recentAlerts.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">暂无预警</div>
            ) : (
              <div className="space-y-3">
                {recentAlerts.map((alert: any) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                        alert.level === 'critical'
                          ? 'bg-red-50'
                          : alert.level === 'warning'
                            ? 'bg-amber-50'
                            : 'bg-sky-50'
                      }`}
                    >
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          alert.level === 'critical'
                            ? 'text-red-500'
                            : alert.level === 'warning'
                              ? 'text-amber-500'
                              : 'text-sky-500'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {alert.title || alert.message}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {alertTypeLabels[alert.type] || alert.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {alert.description || alert.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {alert.surveyAreaName || alert.survey_area_name || alert.survey_area}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
