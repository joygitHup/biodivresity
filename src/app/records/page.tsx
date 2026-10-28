'use client';

import { useState } from 'react';
import {
  Search,
  Camera,
  Mic,
  Video,
  Image,
  Download,
  Filter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  monitorRecords,
  surveyAreas,
  species,
} from '@/lib/mock-data';

const mediaTypeIcons = {
  image: Image,
  video: Video,
  audio: Mic,
};

const reviewStatusConfig = {
  pending: { label: '待复核', variant: 'secondary' as const },
  confirmed: { label: '已确认', variant: 'default' as const },
  rejected: { label: '已否定', variant: 'destructive' as const },
  corrected: { label: '已修正', variant: 'outline' as const },
};

export default function RecordsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [reviewFilter, setReviewFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');

  const filteredRecords = monitorRecords.filter((record) => {
    const matchSearch =
      record.speciesName.includes(searchTerm) ||
      record.speciesLatinName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.deviceName.includes(searchTerm);
    const matchArea = areaFilter === 'all' || record.surveyAreaId === areaFilter;
    const matchReview = reviewFilter === 'all' || record.reviewStatus === reviewFilter;
    const matchConfidence =
      confidenceFilter === 'all' ||
      (confidenceFilter === 'high' && record.confidence >= 0.8) ||
      (confidenceFilter === 'medium' && record.confidence >= 0.6 && record.confidence < 0.8) ||
      (confidenceFilter === 'low' && record.confidence < 0.6);
    return matchSearch && matchArea && matchReview && matchConfidence;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">监测记录</h1>
          <p className="text-muted-foreground text-sm mt-1">
            查看和管理所有监测设备采集的物种识别记录
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          导出数据
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索物种名、设备名..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="样区" />
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
        <Select value={reviewFilter} onValueChange={setReviewFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="复核状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待复核</SelectItem>
            <SelectItem value="confirmed">已确认</SelectItem>
            <SelectItem value="rejected">已否定</SelectItem>
            <SelectItem value="corrected">已修正</SelectItem>
          </SelectContent>
        </Select>
        <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="置信度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="high">高 (≥80%)</SelectItem>
            <SelectItem value="medium">中 (60-80%)</SelectItem>
            <SelectItem value="low">低 (&lt;60%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Records Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>物种</TableHead>
                <TableHead>设备</TableHead>
                <TableHead>样区</TableHead>
                <TableHead>行为</TableHead>
                <TableHead>数量</TableHead>
                <TableHead>置信度</TableHead>
                <TableHead>复核状态</TableHead>
                <TableHead>类型</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => {
                const MediaIcon = mediaTypeIcons[record.mediaType];
                const review = reviewStatusConfig[record.reviewStatus];
                return (
                  <TableRow key={record.id}>
                    <TableCell className="text-xs">
                      {new Date(record.timestamp).toLocaleDateString('zh-CN')}
                      <br />
                      <span className="text-muted-foreground">
                        {new Date(record.timestamp).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{record.speciesName}</p>
                        <p className="text-[11px] text-muted-foreground italic">
                          {record.speciesLatinName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{record.deviceName}</TableCell>
                    <TableCell className="text-xs">{record.surveyAreaName}</TableCell>
                    <TableCell className="text-xs">{record.behavior}</TableCell>
                    <TableCell className="text-center text-sm">{record.count}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record.confidence >= 0.8
                            ? 'default'
                            : record.confidence >= 0.6
                              ? 'secondary'
                              : 'destructive'
                        }
                        className="text-[10px]"
                      >
                        {(record.confidence * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={review.variant} className="text-[10px]">
                        {review.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <MediaIcon className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredRecords.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Camera className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">未找到匹配的监测记录</p>
        </div>
      )}
    </div>
  );
}
