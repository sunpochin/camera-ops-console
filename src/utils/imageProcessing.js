/**
 * 影像處理工具函式庫
 * 提供基於 Canvas ImageData 的即時濾鏡處理
 */

/**
 * 調整亮度
 * 【技術說明】：對每個像素的紅 (R)、綠 (G)、藍 (B) 三通道值進行線性平移運算，並使用 Math.clamp 確保數值在 [0, 255] 區間內。
 * 【生活比喻】：這就像是把手電筒的光直接照在相片上！往右滑手電筒變亮，所有顏色都加上一道光；往左滑就是把燈關掉，大家都一起變暗！
 */
export function applyBrightness(imageData, value) {
  if (value === 0) return imageData;
  const d = imageData.data;
  // 計算增量，將其轉為 -255 到 255 的整數值
  const offset = Math.round(value * 2.55);

  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, Math.max(0, d[i] + offset));     // 紅
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + offset)); // 綠
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + offset)); // 藍
  }
  return imageData;
}

/**
 * 調整對比度
 * 【技術說明】：利用對比係數 factor = (259 * (value + 255)) / (255 * (259 - value))，以 128 (灰階中位數) 為錨點，對像素色彩進行拉伸或收縮。
 * 【生活比喻】：這就像是把衣服上的深顏色和淺顏色用力拉開！黑的變得更黑，白的變得更白，讓畫面裡的角色線條看得更清楚！
 */
export function applyContrast(imageData, value) {
  if (value === 0) return imageData;
  const d = imageData.data;
  // 對比度係數公式
  const factor = (259 * (value + 255)) / (255 * (259 - value));

  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, Math.max(0, factor * (d[i] - 128) + 128));     // 紅
    d[i + 1] = Math.min(255, Math.max(0, factor * (d[i + 1] - 128) + 128)); // 綠
    d[i + 2] = Math.min(255, Math.max(0, factor * (d[i + 2] - 128) + 128)); // 藍
  }
  return imageData;
}

/**
 * Gamma 校正
 * 【技術說明】：非線性亮度調整。使用冪函數 V_out = V_in ^ (1/gamma) 進行灰階映射，並利用查表法 (LUT) 減少重複的浮點數冪運算。
 * 【生活比喻】：這像是在調整神奇魔法相機的鏡頭！不是所有地方都一起變亮，而是專門把躲在陰暗角落的小貓咪照亮，但本來就很亮的地方不會刺眼！
 */
export function applyGamma(imageData, value) {
  if (value === 1.0) return imageData;
  const d = imageData.data;
  const gammaCorrection = 1.0 / value;

  // 建立 0-255 的查表
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.min(255, Math.max(0, Math.pow(i / 255, gammaCorrection) * 255));
  }

  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]];         // 紅
    d[i + 1] = lut[d[i + 1]];     // 綠
    d[i + 2] = lut[d[i + 2]];     // 藍
  }
  return imageData;
}

/**
 * 調整飽和度
 * 【技術說明】：計算像素的明度值 (Luminance) 作為灰度基準，並在原始 RGB 色彩向量與灰度向量之間進行線性插值，調整色彩純度。
 * 【生活比喻】：這就像是在彩色鉛筆和黑白鉛筆之間做選擇！滑桿往右是拼命塗上鮮艷的水彩，往左則是把顏色全部擦掉，變成懷舊的黑白照片！
 */
export function applySaturation(imageData, value) {
  if (value === 0) return imageData;
  const d = imageData.data;
  // 轉換為 -1 到 1 的比例
  const factor = value / 100;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    // 使用常見權重計算灰階值（亮度）
    const gray = 0.2989 * r + 0.587 * g + 0.114 * b;

    // 線性插值公式調整飽和度
    d[i] = Math.min(255, Math.max(0, gray + (r - gray) * (1 + factor)));     // 紅
    d[i + 1] = Math.min(255, Math.max(0, gray + (g - gray) * (1 + factor))); // 綠
    d[i + 2] = Math.min(255, Math.max(0, gray + (b - gray) * (1 + factor))); // 藍
  }
  return imageData;
}

/**
 * 銳利度處理
 * 【技術說明】：使用 3x3 拉普拉斯高通卷積核 (Convolution Kernel) 進行空域濾波，強化像素與鄰域的灰度突變部分，以突顯圖像邊緣。
 * 【生活比喻】：這就像是拿著一隻細細的黑色簽字筆，沿著畫面中物體的邊緣描一圈，讓所有的界線看起來都非常乾淨清楚！
 */
export function applySharpen(imageData, width, height, value) {
  if (value <= 0) return imageData;
  
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);
  
  // 卷積核權重計算，以中央點為主
  const amount = value / 100;
  const weights = [
     0, -amount,  0,
    -amount, 1 + 4 * amount, -amount,
     0, -amount,  0
  ];

  // 卷積處理，邊緣像素不處理直接複製
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // 複製 Alpha 通道並作為邊緣預設值
      dst[idx + 3] = src[idx + 3];
      
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        dst[idx] = src[idx];
        dst[idx + 1] = src[idx + 1];
        dst[idx + 2] = src[idx + 2];
        continue;
      }

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;

      // 3x3 卷積計算
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const sIdx = ((y + ky) * width + (x + kx)) * 4;
          const w = weights[(ky + 1) * 3 + (kx + 1)];
          rSum += src[sIdx] * w;
          gSum += src[sIdx + 1] * w;
          bSum += src[sIdx + 2] * w;
        }
      }

      dst[idx] = Math.min(255, Math.max(0, rSum));
      dst[idx + 1] = Math.min(255, Math.max(0, gSum));
      dst[idx + 2] = Math.min(255, Math.max(0, bSum));
    }
  }

  // 將處理結果寫回原始 imageData
  for (let i = 0; i < src.length; i++) {
    src[i] = dst[i];
  }
  
  return imageData;
}

/**
 * 循序套用所有啟用的影像濾鏡
 * 【技術說明】：管線式 (Pipeline) 色彩濾鏡整合。將各個影像處理函式以鏈式順序作用於同一個快取記憶體 (TypedArray)，防止多次拷貝造成的記憶體碎片。
 * 【生活比喻】：這就像是把照片放上傳送帶，第一關照光、第二關調對比、最後描邊線，一關一關做完，照片就變得漂漂亮亮！
 */
export function applyAllFilters(imageData, width, height, filters) {
  let output = imageData;
  
  if (filters.brightness !== undefined && filters.brightness !== 0) {
    output = applyBrightness(output, filters.brightness);
  }
  
  if (filters.contrast !== undefined && filters.contrast !== 0) {
    output = applyContrast(output, filters.contrast);
  }
  
  if (filters.gamma !== undefined && filters.gamma !== 1.0) {
    output = applyGamma(output, filters.gamma);
  }
  
  if (filters.saturation !== undefined && filters.saturation !== 0) {
    output = applySaturation(output, filters.saturation);
  }
  
  if (filters.sharpness !== undefined && filters.sharpness > 0) {
    output = applySharpen(output, width, height, filters.sharpness);
  }
  
  return output;
}
