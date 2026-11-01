'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  AlertTriangle,
  Wifi,
  Bug,
  TrendingDown,
  Database,
  Check,
  Settings,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { SimplePagination } from '@/components/simple-pagination';
import { toastSuccess, toastError } from '@/lib/toast';
import { api } from '@/lib/api';

const PAGE_SIZE = 10;

const alertTypeLabels: Record<string, string> = {
  device_offline: '设备离线',
  invasive_species: '外来有害生物',
  protection_anomaly: '病虫害异常',
  data_anomaly: '数据异常',
  diversity_decline: '作物健康下降',
};

const alertLevelLabels: Record<string, string> = {
  info: '提示',
  warning: '警告',
  critical: '严重',
};

const alertIcons: Record<string, typeof Bell> = {
  device_offline: Wifi,
  invasive_species: Bug,
  protection_anomaly: AlertTriangle,
  data_anomaly: Database,
  diversity_decline: TrendingDown,
};

const levelStyles: Record<string, { bg: string; icon: string; badge: string }> = {
  critical: {
    bg: 'bg-red-50',
    icon: 'text-red-500',
    badge: 'bg-red-100 text-red-800',
  },
  warning: {
    bg: 'bg-amber-50',
    icon: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-800',
  },
  info: {
    bg: 'bg-sky-50',
    icon: 'text-sky-500',
    badge: 'bg-sky-100 text-sky-800',
  },
};

export default function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');
  const [configOpen, setConfigOpen] = useState(false);
  const [page, setPage] = useState(1);

  // 筛选变化时回到第一页
  useEffect(() => {
    setPage(1);
  }, [levelFilter, typeFilter, readFilter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, pageSize: PAGE_SIZE };
      if (levelFilter !== 'all') params.level = levelFilter;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (readFilter !== 'all') params.is_read = readFilter === 'read';
      const [res, stats] = await Promise.all([
        api.alerts.list(params),
        api.alerts.stats().catch(() => null),
      ]);
      setAlerts(res?.list || []);
      setTotal(res?.total || 0);
      if (stats) setUnreadCount(stats.unreadCount ?? 0);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page, levelFilter, typeFilter, readFilter]);

  async function handleMarkRead(id: number | string) {
    try {
      await api.alerts.markRead(Number(id) as number);
      setAlerts((prev) =>
        prev.map((a) => (String(a.id) === String(id) ? { ...a, isRead: true, is_read: true } : a))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      toastSuccess('已标记为已读');
    } catch (e) {
      toastError('标记失败');
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.alerts.markAllRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true, is_read: true })));
      setUnreadCount(0);
      toastSuccess('全部已标记为已读');
    } catch (e) {
      toastError('操作失败');
    }
  }

  const pagedAlerts = alerts;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">预警通知</h1>
          <p className="text-muted-foreground text-sm mt-1">
            设备离线、病虫害异常、作物健康下降等预警信息管理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {loading ? '...' : unreadCount} 条未读
          </Badge>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <Check className="h-4 w-4 mr-2" />
              全部已读
            </Button>
          )}
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                通知配置
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>通知配置</DialogTitle>
                <DialogDescription>
                  配置不同预警级别的通知渠道和接收人
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">通知渠道</h4>
                  <div className="flex items-center justify-between">
                    <Label>站内消息</Label>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>短信通知</Label>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>邮件通知</Label>
                    <Switch />
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">预警级别策略</h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-800 text-[10px]">严重</Badge>
                      <span className="text-sm">全部渠道</span>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-800 text-[10px]">警告</Badge>
                      <span className="text-sm">站内+短信</span>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">提示</Badge>
                      <span className="text-sm">仅站内</span>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">设备离线阈值</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">离线超过</span>
                    <Select defaultValue="24">
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12小时</SelectItem>
                        <SelectItem value="24">24小时</SelectItem>
                        <SelectItem value="48">48小时</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">触发告警</span>
                  </div>
                </div>
                <Button className="w-full">保存配置</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            加载失败：{error}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="预警级别" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部级别</SelectItem>
            <SelectItem value="critical">严重</SelectItem>
            <SelectItem value="warning">警告</SelectItem>
            <SelectItem value="info">提示</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="预警类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {Object.entries(alertTypeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={readFilter} onValueChange={setReadFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="阅读状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="unread">未读</SelectItem>
            <SelectItem value="read">已读</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Bell className="h-12 w-12 mb-3 opacity-50 animate-pulse" />
          <p className="text-sm">加载中...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pagedAlerts.map((alert) => {
            const AlertIcon = alertIcons[alert.type] || Bell;
            const styles = levelStyles[alert.level] || levelStyles.info;
            const isRead = alert.isRead ?? alert.is_read ?? false;
            return (
              <Card
                key={alert.id}
                className={`border-l-4 ${
                  alert.level === 'critical'
                    ? 'border-l-red-500'
                    : alert.level === 'warning'
                      ? 'border-l-amber-500'
                      : 'border-l-sky-500'
                } ${!isRead ? 'bg-background' : 'bg-muted/30'}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 ${styles.bg} shrink-0`}>
                      <AlertIcon className={`h-4 w-4 ${styles.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm">
                          {alert.title || alert.message || '-'}
                        </h3>
                        <Badge className={`text-[10px] ${styles.badge}`}>
                          {alertLevelLabels[alert.level] || alert.level}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {alertTypeLabels[alert.type] || alert.type}
                        </Badge>
                        {!isRead && (
                          <Badge className="text-[10px] bg-primary text-primary-foreground">
                            未读
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {alert.description || alert.message}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>
                          样区: {alert.surveyAreaName || alert.survey_area_name || alert.survey_area || '-'}
                        </span>
                        <span>
                          {new Date(alert.createdAt || alert.created_at).toLocaleDateString('zh-CN')}{' '}
                          {new Date(alert.createdAt || alert.created_at).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {!isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleMarkRead(alert.id)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          标记已读
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && pagedAlerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Bell className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">暂无预警信息</p>
        </div>
      )}

      {/* 分页 */}
      <SimplePagination
        total={total}
        pageSize={PAGE_SIZE}
        page={page}
        onPageChange={setPage}
      />
    </div>
  );
}
