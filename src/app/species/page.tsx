'use client';

import { useState } from 'react';
import { Search, Filter, Bug, Leaf, Bird, Fish, Flower, Shell } from 'lucide-react';
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
} from '@/components/ui/dialog';
import {
  species,
  protectionLevelLabels,
  iucnLabels,
  categoryLabels,
  type Species,
} from '@/lib/mock-data';

const categoryIcons: Record<Species['category'], typeof Bug> = {
  mammal: Bug,
  bird: Bird,
  reptile: Shell,
  amphibian: Shell,
  fish: Fish,
  insect: Bug,
  plant: Leaf,
  fungi: Flower,
};

const protectionColors: Record<Species['protectionLevel'], string> = {
  national_1: 'bg-red-50 text-red-700 border-red-200',
  national_2: 'bg-orange-50 text-orange-700 border-orange-200',
  provincial: 'bg-amber-50 text-amber-700 border-amber-200',
  none: 'bg-gray-50 text-gray-600 border-gray-200',
  invasive: 'bg-purple-50 text-purple-700 border-purple-200',
};

const iucnColors: Record<string, string> = {
  CR: 'bg-red-100 text-red-800',
  EN: 'bg-orange-100 text-orange-800',
  VU: 'bg-amber-100 text-amber-800',
  NT: 'bg-yellow-100 text-yellow-800',
  LC: 'bg-green-100 text-green-800',
};

export default function SpeciesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [protectionFilter, setProtectionFilter] = useState<string>('all');
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null);

  const filteredSpecies = species.filter((sp) => {
    const matchSearch =
      sp.chineseName.includes(searchTerm) ||
      sp.latinName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sp.family.includes(searchTerm) ||
      sp.genus.includes(searchTerm);
    const matchCategory = categoryFilter === 'all' || sp.category === categoryFilter;
    const matchProtection = protectionFilter === 'all' || sp.protectionLevel === protectionFilter;
    return matchSearch && matchCategory && matchProtection;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">物种档案</h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理监测区域内动植物物种信息，包含分类学信息与保护等级
          </p>
        </div>
        <Button>
          <Bug className="h-4 w-4 mr-2" />
          新增物种
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索中文名、拉丁名、科属..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="物种类别" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类别</SelectItem>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={protectionFilter} onValueChange={setProtectionFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="保护等级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部等级</SelectItem>
            {Object.entries(protectionLevelLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Species Grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredSpecies.map((sp) => {
          const CatIcon = categoryIcons[sp.category];
          return (
            <Card
              key={sp.id}
              className="hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedSpecies(sp)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                    <CatIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{sp.chineseName}</h3>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${protectionColors[sp.protectionLevel]}`}
                      >
                        {protectionLevelLabels[sp.protectionLevel]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground italic mt-0.5">
                      {sp.latinName}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {categoryLabels[sp.category]}
                      </Badge>
                      <Badge
                        className={`text-[10px] ${iucnColors[sp.iucnStatus] || 'bg-gray-100 text-gray-700'}`}
                      >
                        IUCN: {sp.iucnStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                      <span>{sp.family} · {sp.genus}</span>
                      <span>{sp.recordCount} 条记录</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredSpecies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Bug className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">未找到匹配的物种</p>
        </div>
      )}

      {/* Species Detail Dialog */}
      <Dialog open={!!selectedSpecies} onOpenChange={() => setSelectedSpecies(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedSpecies?.chineseName}</span>
              <span className="text-sm font-normal text-muted-foreground italic">
                {selectedSpecies?.latinName}
              </span>
            </DialogTitle>
          </DialogHeader>
          {selectedSpecies && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={protectionColors[selectedSpecies.protectionLevel]}
                >
                  {protectionLevelLabels[selectedSpecies.protectionLevel]}
                </Badge>
                <Badge className={iucnColors[selectedSpecies.iucnStatus] || ''}>
                  IUCN: {iucnLabels[selectedSpecies.iucnStatus]}
                </Badge>
                <Badge variant="secondary">{categoryLabels[selectedSpecies.category]}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">界</span>
                  <p className="font-medium">{selectedSpecies.kingdom}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">门</span>
                  <p className="font-medium">{selectedSpecies.phylum}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">纲</span>
                  <p className="font-medium">{selectedSpecies.class}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">目</span>
                  <p className="font-medium">{selectedSpecies.order}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">科</span>
                  <p className="font-medium">{selectedSpecies.family}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">属</span>
                  <p className="font-medium">{selectedSpecies.genus}</p>
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">描述</span>
                <p className="text-sm mt-1">{selectedSpecies.description}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">分布区域</span>
                <p className="text-sm mt-1">{selectedSpecies.distribution}</p>
              </div>
              <div className="pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  监测记录数: <strong className="text-foreground">{selectedSpecies.recordCount}</strong> 条
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
