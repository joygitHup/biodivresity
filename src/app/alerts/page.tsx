'use client';

import { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  Wifi,
  Bug,
  TrendingDown,
  Database,
  Check,
  Filter,
  Settings,
} from 'lucide-react';
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
import {
  alerts,
  alertTypeLabels,
  alertLevelLabels,
  type Alert,
} from '@/lib/mock-data';

const alertIcons: Record<Alert['type'], typeof Bell> = {
  device_offline: Wifi,
  invasive_species: Bug,
  protection_anomaly: AlertTriangle,
  data_anomaly: Database,
  diversity_decline: TrendingDown,
};

const levelStyles = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-500',
    badge: 'bg-red-100 text-red-800',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-800',
  },
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: 'text-sky-500',
    badge: 'bg-sky-100 text-sky-800',
  },
};

export default function AlertsPage() {
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');
  const [configOpen, setConfigOpen] = useState(false);

  const filteredAlerts = alerts.filter((alert) => {
    const matchLevel = levelFilter === 'all' || alert.level === levelFilter;
    const matchType = typeFilter === 'all' || alert.type === typeFilter;
    const matchRead =
      readFilter === 'all' ||
      (readFilter === 'unread' && !alert.isRead) ||
      (readFilter === 'read' && alert.isRead);
    return matchLevel && matchType && matchRead;
  });

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">预警通知</h1>
          <p className="text-muted-foreground text-sm mt-1">
            设备离线、入侵物种、保护物种异常等预警信息管理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {unreadCount} 条未读
          </Badge>
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
      <div className="space-y-3">
        {filteredAlerts.map((alert) => {
          const AlertIcon = alertIcons[alert.type];
          const styles = levelStyles[alert.level];
          return (
            <Card
              key={alert.id}
              className={`border-l-4 ${
                alert.level === 'critical'
                  ? 'border-l-red-500'
                  : alert.level === 'warning'
                    ? 'border-l-amber-500'
                    : 'border-l-sky-500'
              } ${!alert.isRead ? 'bg-background' : 'bg-muted/30'}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${styles.bg} shrink-0`}>
                    <AlertIcon className={`h-4 w-4 ${styles.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm">{alert.title}</h3>
                      <Badge className={`text-[10px] ${styles.badge}`}>
                        {alertLevelLabels[alert.level]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {alertTypeLabels[alert.type]}
                      </Badge>
                      {!alert.isRead && (
                        <Badge className="text-[10px] bg-primary text-primary-foreground">
                          未读
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>样区: {alert.surveyAreaName}</span>
                      <span>
                        {new Date(alert.createdAt).toLocaleDateString('zh-CN')}{' '}
                        {new Date(alert.createdAt).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {!alert.isRead && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
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

      {filteredAlerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Bell className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">暂无预警信息</p>
        </div>
      )}
    </div>
  );
}
