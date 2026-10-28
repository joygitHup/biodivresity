'use client';

import { useState } from 'react';
import {
  Check,
  X,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Camera,
  Mic,
  Video,
  AlertTriangle,
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
import { monitorRecords } from '@/lib/mock-data';

const pendingRecords = monitorRecords.filter((r) => r.reviewStatus === 'pending');

export default function ReviewPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  const filteredRecords = pendingRecords.filter((r) => {
    if (confidenceFilter === 'all') return true;
    if (confidenceFilter === 'low') return r.confidence < 0.6;
    if (confidenceFilter === 'medium') return r.confidence >= 0.6 && r.confidence < 0.8;
    return true;
  });

  const currentRecord = filteredRecords[currentIndex];

  const handleConfirm = () => {
    if (currentRecord) {
      setReviewed((prev) => new Set(prev).add(currentRecord.id));
      if (currentIndex < filteredRecords.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  const handleReject = () => {
    if (currentRecord) {
      setReviewed((prev) => new Set(prev).add(currentRecord.id));
      if (currentIndex < filteredRecords.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI识别复核</h1>
          <p className="text-muted-foreground text-sm mt-1">
            对置信度低于0.8的AI识别结果进行人工复核确认
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            待复核: {filteredRecords.length - reviewed.size} 条
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="置信度筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部待复核</SelectItem>
            <SelectItem value="low">低置信度 (&lt;60%)</SelectItem>
            <SelectItem value="medium">中置信度 (60-80%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {currentRecord && !reviewed.has(currentRecord.id) ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Media Preview */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {currentRecord.mediaType === 'image' ? (
                  <Camera className="h-4 w-4" />
                ) : currentRecord.mediaType === 'video' ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                原始数据预览
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  {currentRecord.mediaType === 'image' && (
                    <Camera className="h-16 w-16 mx-auto mb-2 opacity-30" />
                  )}
                  {currentRecord.mediaType === 'video' && (
                    <Video className="h-16 w-16 mx-auto mb-2 opacity-30" />
                  )}
                  {currentRecord.mediaType === 'audio' && (
                    <Mic className="h-16 w-16 mx-auto mb-2 opacity-30" />
                  )}
                  <p className="text-sm">
                    {currentRecord.mediaType === 'image'
                      ? '红外相机照片'
                      : currentRecord.mediaType === 'video'
                        ? '视频片段'
                        : '音频录音'}
                  </p>
                  <p className="text-xs mt-1">
                    {currentRecord.deviceName} · {currentRecord.timestamp}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Result */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">AI识别结果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">识别物种</p>
                <p className="text-lg font-semibold">{currentRecord.speciesName}</p>
                <p className="text-sm text-muted-foreground italic">
                  {currentRecord.speciesLatinName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">置信度</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        currentRecord.confidence >= 0.8
                          ? 'bg-emerald-500'
                          : currentRecord.confidence >= 0.6
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${currentRecord.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {(currentRecord.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {currentRecord.confidence < 0.6 && (
                  <div className="flex items-center gap-1 mt-2 text-amber-600 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    低置信度，建议仔细核对
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">数量</p>
                  <p className="font-medium">{currentRecord.count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">行为</p>
                  <p className="font-medium">{currentRecord.behavior}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">样区</p>
                  <p className="font-medium">{currentRecord.surveyAreaName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">设备</p>
                  <p className="font-medium">{currentRecord.deviceName}</p>
                </div>
              </div>
              <div className="pt-3 border-t space-y-2">
                <Button className="w-full" onClick={handleConfirm}>
                  <Check className="h-4 w-4 mr-2" />
                  确认识别结果
                </Button>
                <Button variant="destructive" className="w-full" onClick={handleReject}>
                  <X className="h-4 w-4 mr-2" />
                  否定识别结果
                </Button>
                <Button variant="outline" className="w-full">
                  <Edit3 className="h-4 w-4 mr-2" />
                  修正物种信息
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Check className="h-16 w-16 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold">所有记录已复核完成</h3>
            <p className="text-sm text-muted-foreground mt-1">
              当前筛选条件下没有待复核的记录
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      {filteredRecords.length > 0 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            上一条
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {filteredRecords.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentIndex(Math.min(filteredRecords.length - 1, currentIndex + 1))
            }
            disabled={currentIndex >= filteredRecords.length - 1}
          >
            下一条
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Queue List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">复核队列</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredRecords.map((record, index) => (
              <div
                key={record.id}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  index === currentIndex && !reviewed.has(record.id)
                    ? 'bg-primary/5 border border-primary/20'
                    : reviewed.has(record.id)
                      ? 'opacity-50'
                      : 'hover:bg-muted/50'
                }`}
                onClick={() => {
                  setCurrentIndex(index);
                }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted shrink-0">
                  {record.mediaType === 'image' ? (
                    <Camera className="h-3.5 w-3.5" />
                  ) : record.mediaType === 'video' ? (
                    <Video className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{record.speciesName}</p>
                  <p className="text-xs text-muted-foreground">
                    {record.deviceName} · {record.surveyAreaName}
                  </p>
                </div>
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
                {reviewed.has(record.id) && (
                  <Badge variant="outline" className="text-[10px] text-emerald-600">
                    已复核
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
