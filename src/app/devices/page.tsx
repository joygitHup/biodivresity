'use client';

import { useState } from 'react';
import {
  Camera,
  Mic,
  Radio,
  Bug,
  FlaskConical,
  Video,
  Battery,
  HardDrive,
  Wifi,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import {
  devices,
  surveyAreas,
  deviceTypeLabels,
  type Device,
} from '@/lib/mock-data';

const deviceIcons: Record<Device['type'], typeof Camera> = {
  infrared_camera: Camera,
  audio_recorder: Mic,
  radar_camera: Radio,
  butterfly_trap: Bug,
  edna: FlaskConical,
  hd_camera: Video,
};

const statusConfig = {
  online: { label: '在线', variant: 'default' as const, color: 'text-emerald-500' },
  offline: { label: '离线', variant: 'secondary' as const, color: 'text-gray-400' },
  warning: { label: '告警', variant: 'destructive' as const, color: 'text-amber-500' },
};

export default function DevicesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');

  const filteredDevices = devices.filter((device) => {
    const matchSearch = device.name.includes(searchTerm) || device.location.includes(searchTerm);
    const matchType = typeFilter === 'all' || device.type === typeFilter;
    const matchStatus = statusFilter === 'all' || device.status === statusFilter;
    const matchArea = areaFilter === 'all' || device.surveyAreaId === areaFilter;
    return matchSearch && matchType && matchStatus && matchArea;
  });

  const getSurveyAreaName = (areaId: string) =>
    surveyAreas.find((a) => a.id === areaId)?.name ?? '未知样区';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">设备管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理红外相机、声学记录仪、eDNA采集装置等感知设备
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新状态
          </Button>
          <Button>
            <Camera className="h-4 w-4 mr-2" />
            添加设备
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2">
              <Wifi className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {devices.filter((d) => d.status === 'online').length}
              </p>
              <p className="text-xs text-muted-foreground">在线设备</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2">
              <Wifi className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {devices.filter((d) => d.status === 'offline').length}
              </p>
              <p className="text-xs text-muted-foreground">离线设备</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2">
              <Battery className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {devices.filter((d) => d.battery < 30).length}
              </p>
              <p className="text-xs text-muted-foreground">低电量</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-sky-50 p-2">
              <HardDrive className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {devices.filter((d) => d.storage > 80).length}
              </p>
              <p className="text-xs text-muted-foreground">存储告警</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索设备名称或位置..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="设备类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {Object.entries(deviceTypeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="online">在线</SelectItem>
            <SelectItem value="offline">离线</SelectItem>
            <SelectItem value="warning">告警</SelectItem>
          </SelectContent>
        </Select>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="所属样区" />
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
      </div>

      {/* Device List */}
      <div className="grid gap-3">
        {filteredDevices.map((device) => {
          const DeviceIcon = deviceIcons[device.type];
          const status = statusConfig[device.status];
          return (
            <Card key={device.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <DeviceIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{device.name}</h3>
                      <Badge variant={status.variant} className="text-[10px]">
                        {status.label}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {deviceTypeLabels[device.type]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {device.location} · {getSurveyAreaName(device.surveyAreaId)}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex items-center gap-2 w-28">
                      <Battery className={`h-3.5 w-3.5 ${device.battery < 30 ? 'text-red-500' : 'text-muted-foreground'}`} />
                      <div className="flex-1">
                        <Progress value={device.battery} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">{device.battery}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-28">
                      <HardDrive className={`h-3.5 w-3.5 ${device.storage > 80 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                      <div className="flex-1">
                        <Progress value={device.storage} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">{device.storage}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-20">
                      <Wifi className={`h-3.5 w-3.5 ${device.signal < 50 ? 'text-red-500' : 'text-muted-foreground'}`} />
                      <span className="text-xs font-medium">{device.signal}%</span>
                    </div>
                    <div className="text-right w-24">
                      <p className="text-[10px] text-muted-foreground">最后数据</p>
                      <p className="text-xs">
                        {new Date(device.lastDataTime).toLocaleDateString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                        })}{' '}
                        {new Date(device.lastDataTime).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredDevices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Camera className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">未找到匹配的设备</p>
        </div>
      )}
    </div>
  );
}
