'use client';

import { useState } from 'react';
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
import { Download, TrendingUp, BarChart3 } from 'lucide-react';
import {
  monthlyRecordTrend,
  speciesCategoryData,
  raiData,
  activityRhythmData,
  surveyAreas,
} from '@/lib/mock-data';

const protectionDistribution = [
  { level: '国家一级', count: 12, color: 'oklch(0.55 0.2 25)' },
  { level: '国家二级', count: 28, color: 'oklch(0.75 0.16 65)' },
  { level: '省级保护', count: 35, color: 'oklch(0.7 0.17 145)' },
  { level: '无保护', count: 380, color: 'oklch(0.6 0.12 195)' },
  { level: '入侵物种', count: 8, color: 'oklch(0.5 0.12 330)' },
];

const diversityIndex = [
  { area: '凤阳山北麓', shannon: 3.2, simpson: 0.89, richness: 86 },
  { area: '百山祖南坡', shannon: 3.8, simpson: 0.92, richness: 112 },
  { area: '瓯江源头', shannon: 2.6, simpson: 0.82, richness: 64 },
  { area: '庆元农田', shannon: 1.8, simpson: 0.72, richness: 42 },
  { area: '龙泉溪', shannon: 2.4, simpson: 0.78, richness: 53 },
  { area: '景宁畲族乡', shannon: 2.9, simpson: 0.85, richness: 71 },
];

const appearanceRate = [
  { month: '1月', rate_黑麂: 15, rate_白鹇: 32, rate_猕猴: 28 },
  { month: '2月', rate_黑麂: 12, rate_白鹇: 28, rate_猕猴: 25 },
  { month: '3月', rate_黑麂: 18, rate_白鹇: 35, rate_猕猴: 30 },
  { month: '4月', rate_黑麂: 22, rate_白鹇: 40, rate_猕猴: 35 },
  { month: '5月', rate_黑麂: 28, rate_白鹇: 45, rate_猕猴: 38 },
  { month: '6月', rate_黑麂: 30, rate_白鹇: 42, rate_猕猴: 40 },
  { month: '7月', rate_黑麂: 25, rate_白鹇: 38, rate_猕猴: 42 },
  { month: '8月', rate_黑麂: 20, rate_白鹇: 35, rate_猕猴: 38 },
  { month: '9月', rate_黑麂: 18, rate_白鹇: 30, rate_猕猴: 32 },
  { month: '10月', rate_黑麂: 15, rate_白鹇: 28, rate_猕猴: 28 },
];

export default function AnalyticsPage() {
  const [areaFilter, setAreaFilter] = useState<string>('all');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">统计分析</h1>
          <p className="text-muted-foreground text-sm mt-1">
            物种多样性分析、相对丰富度、活动节律与出现率统计
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="选择样区" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部样区</SelectItem>
              {surveyAreas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
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

      <Tabs defaultValue="diversity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="diversity">多样性分析</TabsTrigger>
          <TabsTrigger value="rai">相对丰富度</TabsTrigger>
          <TabsTrigger value="rhythm">活动节律</TabsTrigger>
          <TabsTrigger value="appearance">出现率分析</TabsTrigger>
          <TabsTrigger value="trend">趋势分析</TabsTrigger>
        </TabsList>

        {/* Diversity Analysis */}
        <TabsContent value="diversity" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">物种分类组成</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={250}>
                    <PieChart>
                      <Pie
                        data={speciesCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
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
                  <div className="flex-1 space-y-2">
                    {speciesCategoryData.map((item) => (
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">保护等级分布</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={protectionDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 155)" />
                    <XAxis dataKey="level" tick={{ fontSize: 11 }} stroke="oklch(0.5 0.02 155)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 155)" />
                    <Tooltip />
                    <Bar dataKey="count" name="物种数" radius={[4, 4, 0, 0]}>
                      {protectionDistribution.map((entry, index) => (
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
              <CardTitle className="text-base">各样区多样性指数对比</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={diversityIndex}>
                  <PolarGrid stroke="oklch(0.92 0.01 155)" />
                  <PolarAngleAxis dataKey="area" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} />
                  <Radar
                    name="Shannon指数"
                    dataKey="shannon"
                    stroke="oklch(0.35 0.1 155)"
                    fill="oklch(0.35 0.1 155)"
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
              <CardTitle className="text-base">物种相对丰富度 (RAI)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
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
                  <Tooltip />
                  <Bar dataKey="rai" fill="oklch(0.6 0.12 195)" radius={[0, 4, 4, 0]} name="RAI" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Rhythm */}
        <TabsContent value="rhythm">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">动物活动节律分析</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={activityRhythmData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 155)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 155)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 155)" />
                  <Tooltip />
                  <Bar dataKey="count" fill="oklch(0.55 0.08 70)" radius={[4, 4, 0, 0]} name="拍摄频次" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Rate */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">物种出现率月度变化</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={appearanceRate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 155)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 155)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 155)" unit="%" />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="rate_黑麂"
                    stroke="oklch(0.35 0.1 155)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="黑麂"
                  />
                  <Line
                    type="monotone"
                    dataKey="rate_白鹇"
                    stroke="oklch(0.6 0.12 195)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="白鹇"
                  />
                  <Line
                    type="monotone"
                    dataKey="rate_猕猴"
                    stroke="oklch(0.55 0.08 70)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="猕猴"
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
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={monthlyRecordTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 155)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 155)" />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 155)" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="oklch(0.5 0.02 155)" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="records"
                    stroke="oklch(0.35 0.1 155)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="监测记录数"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="species"
                    stroke="oklch(0.6 0.12 195)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="物种数"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
