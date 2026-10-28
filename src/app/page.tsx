'use client';

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
  dashboardStats,
  monthlyRecordTrend,
  speciesCategoryData,
  raiData,
  activityRhythmData,
  alerts,
  monitorRecords,
  deviceTypeLabels,
  alertTypeLabels,
} from '@/lib/mock-data';
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
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import Link from 'next/link';

const statCards = [
  {
    title: '监测物种总数',
    value: dashboardStats.totalSpecies,
    icon: Leaf,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    change: '+12',
  },
  {
    title: '监测记录总数',
    value: dashboardStats.totalRecords.toLocaleString(),
    icon: ClipboardList,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    change: '+342 今日',
  },
  {
    title: '在线设备',
    value: dashboardStats.activeDevices,
    icon: Camera,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    change: '52/58',
  },
  {
    title: '监测样区',
    value: dashboardStats.surveyAreas,
    icon: Map,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    change: '5 活跃',
  },
];

export default function DashboardPage() {
  const recentAlerts = alerts.filter((a) => !a.isRead).slice(0, 4);
  const recentRecords = monitorRecords.slice(0, 5);

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
          <span>数据更新时间：2026-10-28 09:30</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                </div>
                <div className={`rounded-xl p-3 ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={monthlyRecordTrend}>
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
          </CardContent>
        </Card>

        {/* Species Category */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">物种分类分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie
                    data={speciesCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {speciesCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 grid grid-cols-2 gap-2">
                {speciesCategoryData.map((item) => (
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
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
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
              <BarChart data={activityRhythmData}>
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
              <Link
                href="/records"
                className="text-xs text-primary hover:underline"
              >
                查看全部
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentRecords.map((record) => (
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
                        {record.speciesName}
                      </span>
                      <span className="text-[10px] text-muted-foreground italic">
                        {record.speciesLatinName}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {record.deviceName} · {record.surveyAreaName} · {record.behavior}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      variant={
                        record.confidence >= 0.8
                          ? 'secondary'
                          : record.confidence >= 0.6
                            ? 'default'
                            : 'destructive'
                      }
                      className="text-[10px]"
                    >
                      {(record.confidence * 100).toFixed(0)}%
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(record.timestamp).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">最新预警</CardTitle>
              <Link
                href="/alerts"
                className="text-xs text-primary hover:underline"
              >
                查看全部
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
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
                      <span className="text-sm font-medium">{alert.title}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                      >
                        {alertTypeLabels[alert.type]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {alert.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {alert.surveyAreaName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
