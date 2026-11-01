'use client';

import { useCallback, useEffect, useState } from 'react';
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
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Key,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { SimplePagination } from '@/components/simple-pagination';
import { toastSuccess, toastError } from '@/lib/toast';
import { api, ApiError } from '@/lib/api';

const deviceIcons: Record<string, typeof Camera> = {
  infrared_camera: Camera,
  audio_recorder: Mic,
  radar_camera: Radio,
  butterfly_trap: Bug,
  edna: FlaskConical,
  hd_camera: Video,
};

const deviceTypeLabels: Record<string, string> = {
  infrared_camera: '红外相机',
  audio_recorder: '鸣声记录仪',
  radar_camera: '雷达相机',
  butterfly_trap: '蝴蝶监测仪',
  edna: 'eDNA采集装置',
  hd_camera: '高清相机',
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; color: string }> = {
  online: { label: '在线', variant: 'default', color: 'text-emerald-500' },
  offline: { label: '离线', variant: 'secondary', color: 'text-gray-400' },
  warning: { label: '告警', variant: 'destructive', color: 'text-amber-500' },
};

interface DeviceForm {
  name: string;
  type: string;
  location: string;
  lat: string;
  lng: string;
  survey_area: string;
  status: string;
  battery: string;
  storage: string;
  signal: string;
  edge_enabled: boolean;
  edge_model: string;
  edge_framework: string;
  edge_capability: string;
  install_date: string;
}

const emptyForm: DeviceForm = {
  name: '',
  type: 'infrared_camera',
  location: '',
  lat: '',
  lng: '',
  survey_area: 'none',
  status: 'online',
  battery: '100',
  storage: '0',
  signal: '100',
  edge_enabled: false,
  edge_model: '',
  edge_framework: '',
  edge_capability: '',
  install_date: '',
};

const PAGE_SIZE = 10;

export default function DevicesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [areas, setAreas] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    online: number;
    offline: number;
    lowBattery: number;
    storageAlert: number;
  }>({ online: 0, offline: 0, lowBattery: 0, storageAlert: 0 });

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');

  // 新建/编辑对话框
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [form, setForm] = useState<DeviceForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // 删除确认
  const [deletingDevice, setDeletingDevice] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 边缘设备 Token 管理
  const [tokenDevice, setTokenDevice] = useState<any | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [currentToken, setCurrentToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, pageSize: PAGE_SIZE };
      if (search) params.search = search;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (areaFilter !== 'all') params.survey_area = areaFilter;
      const data = await api.devices.list(params);
      setDevices(data.list || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter, areaFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // 样区选项 + 全局统计（一次性加载）
  useEffect(() => {
    api.surveyAreas.all().then((res) => setAreas(res || [])).catch(() => {});
    api.devices
      .stats()
      .then((s) =>
        setStats({
          online: s?.online ?? 0,
          offline: s?.offline ?? 0,
          lowBattery: s?.lowBattery ?? 0,
          storageAlert: s?.storageAlert ?? 0,
        })
      )
      .catch(() => {});
  }, []);

  function refreshAll() {
    load();
    api.devices
      .stats()
      .then((s) =>
        setStats({
          online: s?.online ?? 0,
          offline: s?.offline ?? 0,
          lowBattery: s?.lowBattery ?? 0,
          storageAlert: s?.storageAlert ?? 0,
        })
      )
      .catch(() => {});
  }

  function openCreate() {
    setEditingDevice(null);
    setForm(emptyForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(device: any) {
    setEditingDevice(device);
    setForm({
      name: device.name ?? '',
      type: device.type ?? 'infrared_camera',
      location: device.location ?? '',
      lat: device.lat != null ? String(device.lat) : '',
      lng: device.lng != null ? String(device.lng) : '',
      survey_area: device.surveyAreaId ? String(device.surveyAreaId) : 'none',
      status: device.status ?? 'online',
      battery: device.battery != null ? String(device.battery) : '100',
      storage: device.storage != null ? String(device.storage) : '0',
      signal: device.signal != null ? String(device.signal) : '100',
      edge_enabled: Boolean(device.edge_enabled),
      edge_model: device.edge_model ?? '',
      edge_framework: device.edge_framework ?? '',
      edge_capability: device.edge_capability ?? '',
      install_date: device.install_date ?? '',
    });
    setFormError('');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFormError('请输入设备名称');
      return;
    }
    if (!form.location.trim()) {
      setFormError('请输入安装位置');
      return;
    }
    const battery = Number(form.battery);
    const storage = Number(form.storage);
    const signal = Number(form.signal);
    for (const [label, v] of [['电量', battery], ['存储', storage], ['信号', signal]] as const) {
      if (isNaN(v) || v < 0 || v > 100) {
        setFormError(`${label}必须是 0-100 的数值`);
        return;
      }
    }
    let lat: number | null = null;
    let lng: number | null = null;
    if (form.lat.trim()) {
      lat = Number(form.lat);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        setFormError('纬度必须是 -90 ~ 90 的数值');
        return;
      }
    }
    if (form.lng.trim()) {
      lng = Number(form.lng);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        setFormError('经度必须是 -180 ~ 180 的数值');
        return;
      }
    }
    setSaving(true);
    setFormError('');
    const payload: Record<string, any> = {
      name: form.name.trim(),
      type: form.type,
      location: form.location.trim(),
      lat,
      lng,
      survey_area: form.survey_area === 'none' ? null : Number(form.survey_area),
      status: form.status,
      battery,
      storage,
      signal,
      edge_enabled: form.edge_enabled,
      edge_model: form.edge_model.trim(),
      edge_framework: form.edge_framework.trim(),
      edge_capability: form.edge_capability.trim(),
    };
    if (form.install_date) payload.install_date = form.install_date;
    try {
      if (editingDevice) {
        await api.devices.update(editingDevice.id, payload);
        toastSuccess('设备已更新', editingDevice.name);
      } else {
        await api.devices.create(payload);
        toastSuccess('设备添加成功', payload.name);
      }
      setDialogOpen(false);
      refreshAll();
    } catch (e: any) {
      const msg =
        e instanceof ApiError && e.errors
          ? Object.values(e.errors).flat().join('；')
          : e?.message || '保存失败';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingDevice) return;
    setDeleting(true);
    try {
      await api.devices.delete(deletingDevice.id);
      toastSuccess('设备已删除', deletingDevice.name);
      setDeletingDevice(null);
      if (devices.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        refreshAll();
      }
    } catch (e: any) {
      toastError('删除失败', e?.message);
      setDeletingDevice(null);
    } finally {
      setDeleting(false);
    }
  }

  // ── 边缘设备 Token 管理 ────────────────────────────────────
  function openTokenDialog(device: any) {
    setTokenDevice(device);
    setCurrentToken('');
    setTokenDialogOpen(true);
  }

  async function handleGenerateToken() {
    if (!tokenDevice) return;
    setTokenLoading(true);
    try {
      const res = await api.devices.generateEdgeToken(tokenDevice.id);
      setCurrentToken(res.token || '');
      refreshAll();
    } catch (e: any) {
      setError(e?.message || '生成Token失败');
    } finally {
      setTokenLoading(false);
    }
  }

  async function handleRevokeToken() {
    if (!tokenDevice) return;
    setTokenLoading(true);
    try {
      await api.devices.revokeEdgeToken(tokenDevice.id);
      setCurrentToken('');
      refreshAll();
    } catch (e: any) {
      setError(e?.message || '吊销Token失败');
    } finally {
      setTokenLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const onlineCount = stats.online;
  const offlineCount = stats.offline;
  const lowBatteryCount = stats.lowBattery;
  const storageAlertCount = stats.storageAlert;

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
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新状态
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            添加设备
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2">
              <Wifi className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{onlineCount}</p>
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
              <p className="text-2xl font-bold">{offlineCount}</p>
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
              <p className="text-2xl font-bold">{lowBatteryCount}</p>
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
              <p className="text-2xl font-bold">{storageAlertCount}</p>
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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
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
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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
        <Select value={areaFilter} onValueChange={(v) => { setAreaFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="所属样区" />
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
      </div>

      {/* Device List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 mb-3 animate-spin opacity-50" />
          <p className="text-sm">加载中...</p>
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Camera className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">未找到匹配的设备</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {devices.map((device) => {
            const DeviceIcon = deviceIcons[device.type] || Camera;
            const status = statusConfig[device.status] || statusConfig.online;
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
                          {deviceTypeLabels[device.type] || device.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {device.location} · {device.surveyAreaName || '未绑定样区'}
                        {device.lat != null && device.lng != null
                          ? ` · ${Number(device.lat).toFixed(4)}, ${Number(device.lng).toFixed(4)}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="flex items-center gap-2 w-28">
                        <Battery
                          className={`h-3.5 w-3.5 ${
                            (device.battery ?? 100) < 30 ? 'text-red-500' : 'text-muted-foreground'
                          }`}
                        />
                        <div className="flex-1">
                          <Progress value={device.battery ?? 100} className="h-1.5" />
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {device.battery ?? 0}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-28">
                        <HardDrive
                          className={`h-3.5 w-3.5 ${
                            (device.storage ?? 0) > 80 ? 'text-amber-500' : 'text-muted-foreground'
                          }`}
                        />
                        <div className="flex-1">
                          <Progress value={device.storage ?? 0} className="h-1.5" />
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {device.storage ?? 0}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-20">
                        <Wifi
                          className={`h-3.5 w-3.5 ${
                            (device.signal ?? 0) < 50 ? 'text-red-500' : 'text-muted-foreground'
                          }`}
                        />
                        <span className="text-xs font-medium">{device.signal ?? 0}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {device.edge_enabled && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="边缘设备Token"
                            onClick={() => openTokenDialog(device)}
                          >
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(device)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeletingDevice(device)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <SimplePagination
        total={total}
        pageSize={PAGE_SIZE}
        page={page}
        onPageChange={setPage}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDevice ? '编辑设备' : '添加设备'}</DialogTitle>
            <DialogDescription>
              {editingDevice ? '修改设备信息与运行状态' : '登记新的监测感知设备'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {formError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>设备名称 *</Label>
                <Input
                  placeholder="如：红外相机-A001"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>设备类型</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(deviceTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>安装位置 *</Label>
                <Input
                  placeholder="如：北坡样点-03"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>所属样区</Label>
                <Select
                  value={form.survey_area}
                  onValueChange={(v) => setForm({ ...form, survey_area: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择样区" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未绑定</SelectItem>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={String(area.id)}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>纬度</Label>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="如：27.912345"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>经度</Label>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="如：119.201234"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>状态</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">在线</SelectItem>
                    <SelectItem value="offline">离线</SelectItem>
                    <SelectItem value="warning">告警</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>安装日期</Label>
                <Input
                  type="date"
                  value={form.install_date}
                  onChange={(e) => setForm({ ...form, install_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>电量 (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.battery}
                  onChange={(e) => setForm({ ...form, battery: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>存储 (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.storage}
                  onChange={(e) => setForm({ ...form, storage: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>信号 (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.signal}
                  onChange={(e) => setForm({ ...form, signal: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label className="text-sm">边缘推理能力</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  开启后该设备数据先由边缘轻量模型判定，疑难样本自动上云
                </p>
              </div>
              <Switch
                checked={form.edge_enabled}
                onCheckedChange={(checked) => setForm({ ...form, edge_enabled: checked })}
              />
            </div>

            {form.edge_enabled && (
              <div className="space-y-3 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground">边缘模型配置</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">边缘模型版本号</Label>
                    <Input
                      placeholder="如 edge-yolov8n-v1.2"
                      value={form.edge_model}
                      onChange={(e) => setForm({ ...form, edge_model: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">推理框架</Label>
                    <Select
                      value={form.edge_framework || 'none'}
                      onValueChange={(v) => setForm({ ...form, edge_framework: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择框架" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未指定</SelectItem>
                        <SelectItem value="onnxruntime">ONNX Runtime</SelectItem>
                        <SelectItem value="tflite">TensorFlow Lite</SelectItem>
                        <SelectItem value="ncnn">NCNN</SelectItem>
                        <SelectItem value="tensorrt">TensorRT</SelectItem>
                        <SelectItem value="openvino">OpenVINO</SelectItem>
                        <SelectItem value="other">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">边缘算力描述</Label>
                  <Input
                    placeholder="如：4 TOPS NPU / CPU四核 / RK3588"
                    value={form.edge_capability}
                    onChange={(e) => setForm({ ...form, edge_capability: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingDevice ? '保存修改' : '确认添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingDevice} onOpenChange={(open) => !open && setDeletingDevice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除设备？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除「{deletingDevice?.name}」，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edge Device Token Dialog */}
      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>边缘设备 Token - {tokenDevice?.name}</DialogTitle>
            <DialogDescription>
              Token 用于边缘网关上报识别结果时的鉴权，通过 <code className="bg-muted px-1 rounded">X-Device-Token</code> 请求头携带。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">设备ID</span>
                <span className="font-mono">{tokenDevice?.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">边缘模型</span>
                <span>{tokenDevice?.edge_model || '未配置'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Token 状态</span>
                <span>
                  {tokenDevice?.has_edge_token ? (
                    <Badge variant="default" className="bg-emerald-500">已配置</Badge>
                  ) : (
                    <Badge variant="secondary">未配置</Badge>
                  )}
                </span>
              </div>
              {tokenDevice?.edge_token_created_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">创建时间</span>
                  <span>{tokenDevice.edge_token_created_at}</span>
                </div>
              )}
            </div>

            {currentToken && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-700 mb-1 font-medium">
                  ⚠️ Token 仅本次展示，请立即复制保存，关闭后无法再次查看
                </p>
                <code className="block text-xs break-all bg-white p-2 rounded border">
                  {currentToken}
                </code>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleGenerateToken} disabled={tokenLoading} className="flex-1">
                {tokenLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tokenDevice?.has_edge_token ? '重置 Token' : '生成 Token'}
              </Button>
              {tokenDevice?.has_edge_token && (
                <Button
                  variant="outline"
                  onClick={handleRevokeToken}
                  disabled={tokenLoading}
                  className="text-destructive border-destructive"
                >
                  吊销
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
