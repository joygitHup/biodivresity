'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';

const severityDistribution = [
  { level: '严重', count: 8, color: 'oklch(0.56 0.17 32)' },
  { level: '较高', count: 12, color: 'oklch(0.72 0.15 68)' },
  { level: '中度', count: 15, color: 'oklch(0.66 0.11 105)' },
  { level: '轻度', count: 3, color: 'oklch(0.62 0.1 135)' },
  { level: '健康', count: 0, color: 'oklch(0.55 0.1 150)' },
];

const placeholderAreaRisk = [
  { area: '凤阳山北麓', disease: 2.6, pest: 3.1 },
  { area: '百山祖南坡', disease: 3.4, pest: 2.2 },
  { area: '瓯江源头', disease: 1.9, pest: 2.8 },
  { area: '庆元农田', disease: 4.2, pest: 3.6 },
  { area: '龙泉溪', disease: 2.4, pest: 1.8 },
  { area: '景宁畲族乡', disease: 3.1, pest: 2.5 },
];

const placeholderAppearanceRate = [
  { month: '1月', cornLeafBlight: 12, tomatoLateBlight: 8, tomatoSpiderMite: 5 },
  { month: '2月', cornLeafBlight: 15, tomatoLateBlight: 10, tomatoSpiderMite: 6 },
  { month: '3月', cornLeafBlight: 20, tomatoLateBlight: 14, tomatoSpiderMite: 9 },
  { month: '4月', cornLeafBlight: 26, tomatoLateBlight: 20, tomatoSpiderMite: 14 },
  { month: '5月', cornLeafBlight: 32, tomatoLateBlight: 28, tomatoSpiderMite: 22 },
  { month: '6月', cornLeafBlight: 38, tomatoLateBlight: 35, tomatoSpiderMite: 30 },
  { month: '7月', cornLeafBlight: 34, tomatoLateBlight: 40, tomatoSpiderMite: 36 },
  { month: '8月', cornLeafBlight: 28, tomatoLateBlight: 33, tomatoSpiderMite: 41 },
  { month: '9月', cornLeafBlight: 22, tomatoLateBlight: 25, tomatoSpiderMite: 34 },
  { month: '10月', cornLeafBlight: 16, tomatoLateBlight: 17, tomatoSpiderMite: 24 },
];

// 颜色映射（中文作物名 → 颜色）
const categoryColorMap: Record<string, string> = {
  '番茄': 'oklch(0.56 0.17 32)',
  '玉米': 'oklch(0.78 0.13 85)',
  '苹果': 'oklch(0.38 0.08 130)',
  '葡萄': 'oklch(0.45 0.11 300)',
  '马铃薯': 'oklch(0.55 0.08 70)',
  '柑橘': 'oklch(0.72 0.14 65)',
  '桃': 'oklch(0.72 0.11 35)',
  '辣椒': 'oklch(0.5 0.15 28)',
  '樱桃': 'oklch(0.45 0.13 10)',
  '草莓': 'oklch(0.6 0.14 5)',
  '大豆': 'oklch(0.62 0.1 100)',
  '南瓜': 'oklch(0.7 0.14 70)',
  '蓝莓': 'oklch(0.48 0.1 270)',
  '树莓': 'oklch(0.56 0.15 350)',
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [speciesCategory, setSpeciesCategory] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [schedulingStats, setSchedulingStats] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [m, s, a, sch] = await Promise.all([
          api.analytics.monthlyTrend(),
          api.analytics.speciesCategory(),
          api.surveyAreas.all().catch(() => []),
          api.inference.schedulingStats(30).catch(() => null),
        ]);
        if (!cancelled) {
          setMonthlyTrend(m || []);
          setSpeciesCategory(s || []);
          setAreas(a || []);
          setSchedulingStats(sch);
        }
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

  const categoryWithColor = speciesCategory.map((item: any) => ({
    ...item,
    color: item.color || categoryColorMap[item.name] || 'oklch(0.5 0.07 130)',
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">统计分析</h1>
          <p className="text-muted-foreground text-sm mt-1">
            作物病虫害统计分析、危害等级分布、发生频度与调度趋势
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="选择样区" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部样区</SelectItem>
              {areas.map((area) => (
                <SelectItem key={area.id} value={String(area.id)}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            导出报表
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            加载失败：{error}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="diversity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="diversity">类别分析</TabsTrigger>
          <TabsTrigger value="rai">发生频度</TabsTrigger>
          <TabsTrigger value="rhythm">发生节律</TabsTrigger>
          <TabsTrigger value="appearance">发生率分析</TabsTrigger>
          <TabsTrigger value="trend">趋势分析</TabsTrigger>
          <TabsTrigger value="scheduling">识别调度</TabsTrigger>
        </TabsList>

        {/* Diversity Analysis */}
        <TabsContent value="diversity" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">作物类别组成</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                    加载中...
                  </div>
                ) : categoryWithColor.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                    暂无数据
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={250}>
                      <PieChart>
                        <Pie
                          data={categoryWithColor}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
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
                    <div className="flex-1 space-y-2">
                      {categoryWithColor.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-sm"
                              style={{ backgroundColor: item.color }}
                            />
                            <span>{item.name}</span>
                          </div>
                          <span className="font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">危害等级分布</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={severityDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.018 95)" />
                    <XAxis dataKey="level" tick={{ fontSize: 11 }} stroke="oklch(0.5 0.02 100)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 100)" />
                    <Tooltip />
                    <Bar dataKey="count" name="类别数" radius={[4, 4, 0, 0]}>
                      {severityDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">各样区病虫害发生强度对比</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={placeholderAreaRisk}>
                  <PolarGrid stroke="oklch(0.91 0.018 95)" />
                  <PolarAngleAxis dataKey="area" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} />
                  <Radar
                    name="病害强度"
                    dataKey="disease"
                    stroke="oklch(0.38 0.08 130)"
                    fill="oklch(0.38 0.08 130)"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name="虫害强度"
                    dataKey="pest"
                    stroke="oklch(0.72 0.15 68)"
                    fill="oklch(0.72 0.15 68)"
                    fillOpacity={0.3}
                  />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RAI */}
        <TabsContent value="rai">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">病虫害相对发生频度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground text-sm">
                该图表暂未接入 API，敬请期待
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Rhythm */}
        <TabsContent value="rhythm">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">病虫害发生节律分析</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground text-sm">
                该图表暂未接入 API，敬请期待
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Rate */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">病虫害发生率月度变化</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={placeholderAppearanceRate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.018 95)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 100)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 100)" unit="%" />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cornLeafBlight"
                    stroke="oklch(0.38 0.08 130)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="玉米北方叶枯病"
                  />
                  <Line
                    type="monotone"
                    dataKey="tomatoLateBlight"
                    stroke="oklch(0.72 0.14 75)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="番茄晚疫病"
                  />
                  <Line
                    type="monotone"
                    dataKey="tomatoSpiderMite"
                    stroke="oklch(0.6 0.09 70)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="番茄二点叶螨"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trend */}
        <TabsContent value="trend">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">监测记录月度趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground text-sm">
                  加载中...
                </div>
              ) : monthlyTrend.length === 0 ? (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground text-sm">
                  暂无数据
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.018 95)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 100)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 100)" />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="records"
                      stroke="oklch(0.38 0.08 130)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="监测记录数"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduling Analysis */}
        <TabsContent value="scheduling" className="space-y-4">
          {/* 调度概览卡片 */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">边缘直判率</p>
                <p className="text-2xl font-bold mt-1">{schedulingStats?.acceptRate ?? 0}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  直判 {schedulingStats?.edgeAccepted ?? 0} / 边缘任务 {schedulingStats?.edgeTasks ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">上云率</p>
                <p className="text-2xl font-bold mt-1 text-amber-600">{schedulingStats?.escalationRate ?? 0}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  上云 {schedulingStats?.escalated ?? 0} 次
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">节省云端调用</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{schedulingStats?.cloudCallsSaved ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">次</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">边缘-云端一致率</p>
                <p className="text-2xl font-bold mt-1">{schedulingStats?.agreementRate ?? '—'}{schedulingStats?.agreementRate != null ? '%' : ''}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  对比 {schedulingStats?.comparedTasks ?? 0} 条上云样本
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 每日趋势折线图 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">每日调度趋势（边缘直判 / 上云 / 云端调用）</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[380px] flex items-center justify-center text-muted-foreground text-sm">加载中...</div>
              ) : !schedulingStats?.dailyTrend?.length ? (
                <div className="h-[380px] flex items-center justify-center text-muted-foreground text-sm">暂无调度数据</div>
              ) : (
                <ResponsiveContainer width="100%" height={380}>
                  <LineChart data={schedulingStats.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.018 95)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="oklch(0.5 0.02 100)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 100)" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="edgeAccepted" stroke="oklch(0.38 0.08 130)" strokeWidth={2} dot={{ r: 2 }} name="边缘直判" />
                    <Line type="monotone" dataKey="escalated" stroke="oklch(0.72 0.15 68)" strokeWidth={2} dot={{ r: 2 }} name="上云" />
                    <Line type="monotone" dataKey="cloudCalls" stroke="oklch(0.56 0.17 32)" strokeWidth={2} dot={{ r: 2 }} name="云端调用" />
                    <Line type="monotone" dataKey="saved" stroke="oklch(0.62 0.11 148)" strokeWidth={2} dot={{ r: 2 }} name="节省调用" strokeDasharray="5 3" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* 上云原因分布 + 预算 */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">上云原因分布</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">加载中...</div>
                ) : !schedulingStats?.escalationReasons?.length ? (
                  <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">暂无上云记录</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={schedulingStats.escalationReasons}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                      >
                        {schedulingStats.escalationReasons.map((_: any, idx: number) => (
                          <Cell key={idx} fill={[
                            'oklch(0.72 0.15 68)', 'oklch(0.56 0.17 32)', 'oklch(0.72 0.14 75)',
                            'oklch(0.45 0.11 300)', 'oklch(0.62 0.11 148)', 'oklch(0.5 0.15 28)',
                          ][idx % 6]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">云端预算与延迟</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">今日云端调用 / 上限</span>
                    <span>{schedulingStats?.cloudBudgetUsedToday ?? 0} / {schedulingStats?.cloudBudget === 0 ? '不限' : schedulingStats?.cloudBudget}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: schedulingStats?.cloudBudget > 0
                          ? `${Math.min(100, (schedulingStats.cloudBudgetUsedToday / schedulingStats.cloudBudget) * 100)}%`
                          : '0%',
                        backgroundColor: 'oklch(0.38 0.08 130)',
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">边缘平均耗时</p>
                    <p className="text-lg font-bold mt-1">{schedulingStats?.avgEdgeLatencyMs ?? 0} ms</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">云端平均耗时</p>
                    <p className="text-lg font-bold mt-1">{schedulingStats?.avgCloudLatencyMs ?? 0} ms</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">置信度差(云-边)</p>
                    <p className="text-lg font-bold mt-1">{schedulingStats?.avgConfidenceDelta ?? '—'}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">今日直判</p>
                    <p className="text-lg font-bold mt-1 text-emerald-600">{schedulingStats?.todayEdgeAccepted ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
