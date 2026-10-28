'use client';

import { useState } from 'react';
import {
  Map,
  Plus,
  Search,
  TreePine,
  Droplets,
  Wheat,
  Waves,
  Satellite,
  Leaf,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  surveyAreas,
  surveyAreaTypeLabels,
  remoteSensingData,
  type SurveyArea,
} from '@/lib/mock-data';
import {
  LineChart,
  Line,
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
  Legend,
} from 'recharts';

const typeIcons = {
  forest: TreePine,
  wetland: Droplets,
  farmland: Wheat,
  water: Waves,
};

const typeColors = {
  forest: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  wetland: 'bg-sky-50 text-sky-700 border-sky-200',
  farmland: 'bg-amber-50 text-amber-700 border-amber-200',
  water: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function SurveyAreasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<SurveyArea | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const filteredAreas = surveyAreas.filter((area) => {
    const matchSearch = area.name.includes(searchTerm) || area.vegetation.includes(searchTerm);
    const matchType = typeFilter === 'all' || area.type === typeFilter;
    const matchStatus = statusFilter === 'all' || area.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const getRemoteSensingData = (areaId: string) =>
    remoteSensingData.find((d) => d.surveyAreaId === areaId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">样区管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理标准化监测样区，覆盖森林、湿地、农田、水域等生态系统，含遥感监测数据
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新增样区
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>新增监测样区</DialogTitle>
              <DialogDescription>
                填写样区基本信息，创建新的标准化监测样区
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>样区名称</Label>
                  <Input placeholder="如：凤阳山北麓样区" />
                </div>
                <div className="space-y-2">
                  <Label>生态系统类型</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="forest">森林</SelectItem>
                      <SelectItem value="wetland">湿地</SelectItem>
                      <SelectItem value="farmland">农田</SelectItem>
                      <SelectItem value="water">水域</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>面积 (km2)</Label>
                  <Input type="number" placeholder="10-20" />
                </div>
                <div className="space-y-2">
                  <Label>海拔范围</Label>
                  <Input placeholder="如：800-1400m" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>纬度</Label>
                  <Input type="number" step="0.0001" placeholder="27.9234" />
                </div>
                <div className="space-y-2">
                  <Label>经度</Label>
                  <Input type="number" step="0.0001" placeholder="119.2345" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>主要植被类型</Label>
                <Input placeholder="如：常绿阔叶林" />
              </div>
              <div className="space-y-2">
                <Label>样区描述</Label>
                <Textarea placeholder="描述样区特征、保护对象等信息..." />
              </div>
              <Button className="w-full">确认创建</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索样区名称或植被类型..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="生态类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="forest">森林</SelectItem>
            <SelectItem value="wetland">湿地</SelectItem>
            <SelectItem value="farmland">农田</SelectItem>
            <SelectItem value="water">水域</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">活跃</SelectItem>
            <SelectItem value="inactive">停用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Survey Area Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAreas.map((area) => {
          const TypeIcon = typeIcons[area.type];
          const rsData = getRemoteSensingData(area.id);
          const latestCoverage = rsData?.vegetationCoverage[rsData.vegetationCoverage.length - 1];
          const latestLAI = rsData?.lai[rsData.lai.length - 1];
          return (
            <Card
              key={area.id}
              className="hover:shadow-md transition-all cursor-pointer group"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`rounded-lg p-2 border ${typeColors[area.type]}`}>
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                        {area.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {surveyAreaTypeLabels[area.type]} · {area.area} km2
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={area.status === 'active' ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {area.status === 'active' ? '活跃' : '停用'}
                  </Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>海拔范围</span>
                    <span className="font-medium text-foreground">{area.elevation}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>植被类型</span>
                    <span className="font-medium text-foreground">{area.vegetation}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>坐标</span>
                    <span className="font-medium text-foreground font-mono text-[11px]">
                      {area.coordinates.lat.toFixed(4)}, {area.coordinates.lng.toFixed(4)}
                    </span>
                  </div>
                </div>
                {/* 遥感指标速览 */}
                {rsData && (
                  <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">植被覆盖度</p>
                      <p className="text-sm font-semibold text-emerald-600">
                        {latestCoverage?.coverage}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">LAI</p>
                      <p className="text-sm font-semibold text-sky-600">
                        {latestLAI?.value}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">影像分辨率</p>
                      <p className="text-sm font-semibold text-amber-600">
                        {rsData.resolution}
                      </p>
                    </div>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Map className="h-3 w-3" />
                      {area.deviceCount} 台设备
                    </span>
                    <span className="flex items-center gap-1">
                      <TreePine className="h-3 w-3" />
                      {area.speciesCount} 物种
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedArea(area);
                      setDetailOpen(true);
                    }}
                  >
                    <Satellite className="h-3 w-3 mr-1" />
                    遥感详情
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredAreas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Map className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">未找到匹配的样区</p>
        </div>
      )}

      {/* Remote Sensing Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Satellite className="h-5 w-5" />
              <span>{selectedArea?.name} - 遥感监测数据</span>
            </DialogTitle>
            <DialogDescription>
              卫星遥感监测指标：植被覆盖度、叶面积指数(LAI)、总初级生产力(GPP)、植被类型分布
            </DialogDescription>
          </DialogHeader>
          {selectedArea && (() => {
            const rsData = getRemoteSensingData(selectedArea.id);
            if (!rsData) return <p className="text-sm text-muted-foreground">暂无遥感数据</p>;
            
            const latestCoverage = rsData.vegetationCoverage[rsData.vegetationCoverage.length - 1];
            const maxCoverage = Math.max(...rsData.vegetationCoverage.map(d => d.coverage));
            const latestLAI = rsData.lai[rsData.lai.length - 1];
            const maxLAI = Math.max(...rsData.lai.map(d => d.value));
            const latestGPP = rsData.gpp[rsData.gpp.length - 1];
            const totalGPP = rsData.gpp.reduce((sum, d) => sum + d.value, 0);

            return (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">最新植被覆盖度</p>
                      <p className="text-xl font-bold text-emerald-600">{latestCoverage?.coverage}%</p>
                      <p className="text-[10px] text-muted-foreground">峰值 {maxCoverage}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">最新LAI</p>
                      <p className="text-xl font-bold text-sky-600">{latestLAI?.value}</p>
                      <p className="text-[10px] text-muted-foreground">峰值 {maxLAI}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">本月GPP</p>
                      <p className="text-xl font-bold text-amber-600">{latestGPP?.value}</p>
                      <p className="text-[10px] text-muted-foreground">gC/m2/month</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">影像分辨率</p>
                      <p className="text-xl font-bold text-violet-600">{rsData.resolution}</p>
                      <p className="text-[10px] text-muted-foreground">更新于 {rsData.lastUpdate}</p>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="coverage" className="space-y-4">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="coverage" className="text-xs">植被覆盖度</TabsTrigger>
                    <TabsTrigger value="lai" className="text-xs">叶面积指数</TabsTrigger>
                    <TabsTrigger value="gpp" className="text-xs">总初级生产力</TabsTrigger>
                    <TabsTrigger value="types" className="text-xs">植被类型</TabsTrigger>
                  </TabsList>

                  {/* Vegetation Coverage */}
                  <TabsContent value="coverage">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Leaf className="h-4 w-4 text-emerald-600" />
                          植被覆盖度月度变化
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                          <AreaChart data={rsData.vegetationCoverage}>
                            <defs>
                              <linearGradient id="colorCoverage" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="oklch(0.7 0.17 145)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="oklch(0.7 0.17 145)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 155)" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="oklch(0.5 0.02 155)" />
                            <YAxis 
                              tick={{ fontSize: 11 }} 
                              stroke="oklch(0.5 0.02 155)" 
                              domain={[0, 100]}
                              unit="%"
                            />
                            <Tooltip 
                              formatter={(value: number) => [`${value}%`, '覆盖度']}
                              contentStyle={{ borderRadius: '8px', border: '1px solid oklch(0.92 0.01 155)' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="coverage"
                              stroke="oklch(0.7 0.17 145)"
                              strokeWidth={2}
                              fill="url(#colorCoverage)"
                              name="植被覆盖度"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 rounded bg-muted/50">
                            <p className="text-[10px] text-muted-foreground">年均覆盖度</p>
                            <p className="text-sm font-medium">
                              {(rsData.vegetationCoverage.reduce((s, d) => s + d.coverage, 0) / rsData.vegetationCoverage.length).toFixed(1)}%
                            </p>
                          </div>
                          <div className="p-2 rounded bg-muted/50">
                            <p className="text-[10px] text-muted-foreground">最大覆盖度</p>
                            <p className="text-sm font-medium text-emerald-600">{maxCoverage}%</p>
                          </div>
                          <div className="p-2 rounded bg-muted/50">
                            <p className="text-[10px] text-muted-foreground">最小覆盖度</p>
                            <p className="text-sm font-medium text-amber-600">
                              {Math.min(...rsData.vegetationCoverage.map(d => d.coverage))}%
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* LAI */}
                  <TabsContent value="lai">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Leaf className="h-4 w-4 text-sky-600" />
                          叶面积指数 (LAI) 月度变化
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={rsData.lai}>
                            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 155)" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="oklch(0.5 0.02 155)" />
                            <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.5 0.02 155)" />
                            <Tooltip 
                              formatter={(value: number) => [value, 'LAI']}
                              contentStyle={{ borderRadius: '8px', border: '1px solid oklch(0.92 0.01 155)' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="oklch(0.6 0.12 195)"
                              strokeWidth={2}
                              dot={{ r: 4, fill: 'oklch(0.6 0.12 195)' }}
                              name="LAI"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-3 p-3 rounded bg-sky-50 text-xs text-sky-800">
                          <p className="font-medium">LAI 说明</p>
                          <p className="mt-1 text-sky-700">
                            叶面积指数(Leaf Area Index)表示单位地面面积上的叶片总面积。
                            LAI越高，表明植被叶面积越大，光合作用能力越强。
                            森林生态系统LAI通常在3-6之间。
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* GPP */}
                  <TabsContent value="gpp">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-amber-600" />
                          总初级生产力 (GPP) 月度变化
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                          <AreaChart data={rsData.gpp}>
                            <defs>
                              <linearGradient id="colorGPP" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="oklch(0.75 0.16 65)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="oklch(0.75 0.16 65)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 155)" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="oklch(0.5 0.02 155)" />
                            <YAxis 
                              tick={{ fontSize: 11 }} 
                              stroke="oklch(0.5 0.02 155)"
                              label={{ value: 'gC/m\u00B2/month', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
                            />
                            <Tooltip 
                              formatter={(value: number) => [`${value} gC/m\u00B2/month`, 'GPP']}
                              contentStyle={{ borderRadius: '8px', border: '1px solid oklch(0.92 0.01 155)' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="oklch(0.75 0.16 65)"
                              strokeWidth={2}
                              fill="url(#colorGPP)"
                              name="GPP"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="p-2 rounded bg-amber-50 text-center">
                            <p className="text-[10px] text-amber-700">年度累计GPP</p>
                            <p className="text-sm font-bold text-amber-800">{totalGPP} gC/m2</p>
                          </div>
                          <div className="p-2 rounded bg-amber-50 text-center">
                            <p className="text-[10px] text-amber-700">月均GPP</p>
                            <p className="text-sm font-bold text-amber-800">
                              {(totalGPP / rsData.gpp.length).toFixed(1)} gC/m2/month
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 p-3 rounded bg-amber-50 text-xs text-amber-800">
                          <p className="font-medium">GPP 说明</p>
                          <p className="mt-1 text-amber-700">
                            总初级生产力(Gross Primary Productivity)表示单位时间单位面积内
                            植被通过光合作用固定的碳量。是衡量生态系统碳汇能力的关键指标。
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Vegetation Types */}
                  <TabsContent value="types">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-emerald-600" />
                          植被类型面积分布
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-6">
                          <ResponsiveContainer width="50%" height={260}>
                            <PieChart>
                              <Pie
                                data={rsData.vegetationTypes}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={90}
                                paddingAngle={2}
                                dataKey="area"
                                nameKey="type"
                              >
                                {rsData.vegetationTypes.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: number, name: string) => [`${value} km2`, name]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex-1 space-y-2">
                            {rsData.vegetationTypes.map((vt) => (
                              <div key={vt.type} className="flex items-center gap-2">
                                <div
                                  className="h-3 w-3 rounded-sm shrink-0"
                                  style={{ backgroundColor: vt.color }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm truncate">{vt.type}</span>
                                    <span className="text-sm font-medium ml-2">{vt.area} km2</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${vt.percentage}%`,
                                          backgroundColor: vt.color,
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground w-8 text-right">
                                      {vt.percentage}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>样区总面积</span>
                            <span className="font-medium text-foreground">{selectedArea.area} km2</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                            <span>卫星影像分辨率</span>
                            <span className="font-medium text-foreground">{rsData.resolution}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                            <span>数据更新时间</span>
                            <span className="font-medium text-foreground">{rsData.lastUpdate}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
