"use client";

import { useEffect, useRef, useState } from "react";
import { decodeRLE, drawMaskOnCanvas, RLE } from "@/lib/rle";

export interface SegmentationItem {
  class_id?: number;
  chinese_name?: string;
  confidence?: number;
  bbox?: number[];
  mask_rle: RLE;
  area_pixels?: number;
}

interface MaskCanvasProps {
  /** 原图 URL（可选） */
  imageUrl?: string;
  /** 分割列表 */
  segmentations: SegmentationItem[];
  /** 画布 CSS 宽高 */
  width?: number;
  height?: number;
  /** 颜色池（按 index 循环） */
  palette?: string[];
}

const DEFAULT_PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899", "#3b82f6"];

export function MaskCanvas({ imageUrl, segmentations, width = 480, height = 360, palette = DEFAULT_PALETTE }: MaskCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    let imgEl: HTMLImageElement | null = null;

    function redraw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 画背景图
      if (imgEl && imgLoaded) {
        // cover 模式
        const iw = imgEl.naturalWidth;
        const ih = imgEl.naturalHeight;
        const cw = canvas.width;
        const ch = canvas.height;
        const scale = Math.max(cw / iw, ch / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;
        ctx.drawImage(imgEl, dx, dy, dw, dh);
      } else {
        // 灰色占位
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 画 mask（自动适配 RLE 原始 size → canvas size）
      segmentations.forEach((seg, idx) => {
        const rle = seg.mask_rle;
        if (!rle || !rle.size) return;
        const mask = decodeRLE(rle);
        const [rh, rw] = rle.size;
        const color = palette[idx % palette.length];

        // 如果 RLE size ≠ canvas size，先缩放 mask
        if (rw !== canvas.width || rh !== canvas.height) {
          const scaled = scaleMask(mask, rw, rh, canvas.width, canvas.height);
          drawMaskOnCanvas(ctx, scaled, canvas.width, canvas.height, color, 0.45);
        } else {
          drawMaskOnCanvas(ctx, mask, canvas.width, canvas.height, color, 0.45);
        }
      });
    }

    // 异步加载图片
    if (imageUrl && !imgError) {
      imgEl = new Image();
      imgEl.crossOrigin = "anonymous";
      imgEl.onload = () => { setImgLoaded(true); redraw(); };
      imgEl.onerror = () => { setImgError(true); redraw(); };
      imgEl.src = imageUrl;
    } else {
      redraw();
    }

    redraw(); // 无图时也要重绘 mask 层
  }, [imageUrl, imgError, segmentations, palette]);

  const segCount = segmentations.length;
  const totalArea = segmentations.reduce((s, x) => s + (x.area_pixels || 0), 0);

  return (
    <div className="w-full">
      <div
        className="relative rounded-lg border bg-muted/20 overflow-hidden"
        style={{ width: "100%", maxWidth: width, aspectRatio: `${width}/${height}` }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-full"
        />
        {segCount > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 text-white text-[11px] px-2 py-1 rounded">
            <span>{segCount} 个实例</span>
            <span className="opacity-70">· {totalArea.toLocaleString()}px²</span>
          </div>
        )}
        {!imgLoaded && !imgError && imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs bg-black/30">
            加载图像中...
          </div>
        )}
        {imgError && (
          <div className="absolute bottom-2 left-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
            原图加载失败，仅显示分割层
          </div>
        )}
      </div>

      {segCount > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {segmentations.map((seg, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block w-3 h-3 rounded-sm border border-white/40"
                style={{ backgroundColor: palette[idx % palette.length] }}
              />
              <span className="text-muted-foreground">
                {seg.chinese_name || `类#${seg.class_id}`}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {(seg.confidence! * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 把 mask 从 (srcW×srcH) 缩放到 (dstW×dstH) — 简单最近邻放大/缩小. */
function scaleMask(src: Uint8Array, srcW: number, srcH: number, dstW: number, dstH: number): Uint8Array {
  if (srcW === dstW && srcH === dstH) return src;
  const dst = new Uint8Array(dstW * dstH);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor(x * xRatio));
      const sy = Math.min(srcH - 1, Math.floor(y * yRatio));
      dst[y * dstW + x] = src[sy * srcW + sx] ? 1 : 0;
    }
  }
  return dst;
}
