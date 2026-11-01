/**
 * COCO RLE → 二值 mask (Uint8Array) → Canvas 半透明绘制.
 * 服务端用 pycocotools mask_utils.encode 生成 RLE（JSON 兼容的 str counts）。
 * 这里实现纯前端解码，零依赖。
 */

export interface RLE {
  size: [number, number]; // [H, W]
  counts: string;          // COCO RLE bytes 解码后的字符串（base64 编码）
}

/** 基础 RLE 解码（COCO 规范，从 https://github.com/leocordova/leocordova.github.io 摘录并简化）。 */
export function decodeRLE(rle: RLE): Uint8Array {
  const [h, w] = rle.size;
  if (!rle.counts || rle.counts === "" || h === 0 || w === 0) {
    return new Uint8Array(h * w);
  }
  // COCO RLE 的 counts 是 LEB128 压缩的整数序列，Python pycocotools 输出的是 bytes 再转的 str
  // 纯前端解码：把 counts 字符串当 base64 → bytes → LEB128
  let bytes: Uint8Array;
  try {
    // 可能是 base64 编码
    bytes = Uint8Array.from(atob(rle.counts), (c) => c.charCodeAt(0));
  } catch {
    // 也可能是原始字节直接用 btoa 之前的，纯前端直接按 uint8 读
    bytes = Uint8Array.from(rle.counts, (c: string) => c.charCodeAt(0));
  }

  // LEB128 解码
  const arr: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = bytes[i++];
      result |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80 && i < bytes.length);
    arr.push(result);
  }

  const total = h * w;
  const mask = new Uint8Array(total);
  let offset = 0;
  let val = 0;
  for (const run of arr) {
    if (offset + run > total) break;
    mask.fill(val, offset, offset + run);
    offset += run;
    val = 1 - val;
  }
  return mask;
}

/** 在 Canvas 上用半透明颜色渲染一个 mask（可叠加）. */
export function drawMaskOnCanvas(
  ctx: CanvasRenderingContext2D,
  mask: Uint8Array,
  canvasW: number,
  canvasH: number,
  color: string,
  alpha = 0.45,
  outline = true,
) {
  // 找到 mask 的边界框（只画 bbox 内的像素提升性能）
  const H = canvasH;
  const W = canvasW;
  let minY = H, maxY = -1, minX = W, maxX = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x]) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (maxY < 0 || maxX < 0) return;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const imgData = ctx.getImageData(minX, minY, bw, bh);
  const d = imgData.data;

  // 把 hex 颜色转 RGB
  const rgb = hexToRgb(color);
  const a = Math.round(alpha * 255);

  for (let dy = 0; dy < bh; dy++) {
    for (let dx = 0; dx < bw; dx++) {
      if (mask[(minY + dy) * W + (minX + dx)]) {
        const idx = (dy * bw + dx) * 4;
        d[idx] = rgb.r;
        d[idx + 1] = rgb.g;
        d[idx + 2] = rgb.b;
        d[idx + 3] = a;
      }
    }
  }
  ctx.putImageData(imgData, minX, minY);

  // 叠加轮廓线
  if (outline) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    // 在 bbox 内找边界像素画 polyline
    const edgePixels: [number, number][] = [];
    for (let y = minY + 1; y < maxY; y++) {
      for (let x = minX + 1; x < maxX; x++) {
        if (!mask[y * W + x]) continue;
        // 边界：8 邻域有一个为 0
        if (
          !mask[y * W + (x - 1)] || !mask[y * W + (x + 1)] ||
          !mask[(y - 1) * W + x] || !mask[(y + 1) * W + x]
        ) {
          edgePixels.push([x, y]);
        }
      }
    }
    if (edgePixels.length > 0) {
      ctx.beginPath();
      ctx.moveTo(edgePixels[0][0], edgePixels[0][1]);
      for (let i = 1; i < Math.min(edgePixels.length, 2000); i++) {
        ctx.lineTo(edgePixels[i][0], edgePixels[i][1]);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}
