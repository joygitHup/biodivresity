'use client';

import { useState } from 'react';
import { Map, Plus, Search, TreePine, Droplets, Wheat, Waves } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  surveyAreas,
  surveyAreaTypeLabels,
  type SurveyArea,
} from '@/lib/mock-data';

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

  const filteredAreas = surveyAreas.filter((area) => {
    const matchSearch = area.name.includes(searchTerm) || area.vegetation.includes(searchTerm);
    const matchType = typeFilter === 'all' || area.type === typeFilter;
    const matchStatus = statusFilter === 'all' || area.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">样区管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理标准化监测样区，覆盖森林、湿地、农田、水域等生态系统
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
          return (
            <Card
              key={area.id}
              className="hover:shadow-md transition-all cursor-pointer group"
              onClick={() => setSelectedArea(selectedArea?.id === area.id ? null : area)}
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
                  <span className="text-[10px] text-muted-foreground">
                    最近调查: {area.lastSurvey}
                  </span>
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
    </div>
  );
}
