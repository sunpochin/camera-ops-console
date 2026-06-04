import { useState, useEffect, useRef } from 'react';

/**
 * 網格大小設定
 * 【技術說明】：將影像切割為 16x12 的網格區域，用於空間局部動態判定，降低雜訊影響。
 * 【生活比喻】：把畫面上畫成 16x12 的小格子棋盤，這樣我們就能知道是哪一個格子裡的小怪獸在動！
 */
const GRID_COLS = 16;
const GRID_ROWS = 12;

/**
 * useMotionDetect - 畫格差分動態偵測 Hook
 * 比較連續影格間的像素差異來偵測動態
 *
 * @param {React.RefObject} videoRef - 指向 <video> 元素的 React Ref
 * @param {object} options - 偵測設定
 * @param {number} options.sensitivity - 靈敏度 (10 到 90)
 * @param {boolean} options.enabled - 是否啟用偵測
 * @param {number} options.interval - 偵測間隔毫秒數
 * @returns {{ motionRegions, isMotionDetected }}
 */
export function useMotionDetect(videoRef, options = {}) {
  const { sensitivity = 30, enabled = false, interval = 200 } = options;
  const [motionRegions, setMotionRegions] = useState([]);
  const [isMotionDetected, setIsMotionDetected] = useState(false);
  const prevFrameRef = useRef(null);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // 【技術說明】：若未啟用或視訊尚未就緒，清空狀態以釋放資源。
    // 【生活比喻】：如果小眼睛關閉了，或者攝影機還沒開好，我們就先休息，把紅綠燈熄滅。
    if (!enabled || !videoRef?.current) {
      setMotionRegions([]);
      setIsMotionDetected(false);
      return;
    }

    // 【技術說明】：建立離屏 Canvas，並將 willReadFrequently 設為 true 優化像素頻繁讀取的效能。
    // 【生活比喻】：在幕後準備一塊隱形畫板，這樣我們就可以在後台悄悄對比照片，不會打擾到前面的觀眾。
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvasRef.current = canvas;

    const detectMotion = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return; // readyState < 2 代表視訊資料尚未就緒

      // 【技術說明】：進行 4 倍降採樣 (Downsampling)，減少像素計算量以提升幀率，防止網頁卡頓。
      // 【生活比喻】：把大照片縮小成迷你小卡片，這樣小眼睛看一眼的速度就會變快，電腦就不會累壞了！
      canvas.width = video.videoWidth / 4;
      canvas.height = video.videoHeight / 4;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const prevFrame = prevFrameRef.current;

      if (prevFrame) {
        const regions = [];
        const blockSize = 8; // 比對的區塊大小
        // 【技術說明】：將靈敏度反轉並對應到 RGB 差值門檻值 (最高 255)。
        // 【生活比喻】：調大靈敏度就是戴上放大鏡，就算是小螞蟻爬過去我們也能發現！
        const threshold = (100 - sensitivity) * 2.55; 

        // 【技術說明】：空間局部劃分，以 blockSize 為單位進行區塊差值運算，過濾單一像素熱雜訊。
        // 【生活比喻】：我們把小卡片分成一小塊一小塊的積木區，一塊一塊來比對有沒有變色。
        for (let y = 0; y < canvas.height; y += blockSize) {
          for (let x = 0; x < canvas.width; x += blockSize) {
            let diff = 0;
            let count = 0;

            for (let by = 0; by < blockSize && y + by < canvas.height; by++) {
              for (let bx = 0; bx < blockSize && x + bx < canvas.width; bx++) {
                const idx = ((y + by) * canvas.width + (x + bx)) * 4;
                // 【技術說明】：計算相鄰影格在 RGB 三通道的絕對差值之和。
                // 【生活比喻】：把前後兩張卡片同一個位置的紅、綠、藍顏色數值相減，看看顏色變了多少。
                diff += Math.abs(currentFrame.data[idx] - prevFrame.data[idx]);
                diff += Math.abs(currentFrame.data[idx + 1] - prevFrame.data[idx + 1]);
                diff += Math.abs(currentFrame.data[idx + 2] - prevFrame.data[idx + 2]);
                count++;
              }
            }

            const avgDiff = diff / (count * 3);
            if (avgDiff > threshold) {
              // 【技術說明】：當區塊變異大於閾值時，將座標重映射 (Remap) 回原始視訊解析度。
              // 【生活比喻】：如果這塊積木的顏色改變超出了限制，我們就用粉筆把這個變動的大格子標記起來！
              regions.push({
                x: (x / canvas.width) * video.videoWidth,
                y: (y / canvas.height) * video.videoHeight,
                width: (blockSize / canvas.width) * video.videoWidth,
                height: (blockSize / canvas.height) * video.videoHeight,
              });
            }
          }
        }

        setMotionRegions(regions);
        setIsMotionDetected(regions.length > 0);
      }

      // 【技術說明】：更新暫存影格，供下一次輪詢比較。
      // 【生活比喻】：把這張照片收進抽屜裡，當作「前一張照片」，等下一秒有新照片來時再拿出來比。
      prevFrameRef.current = currentFrame;
    };

    // 【技術說明】：設定週期性計時器，控制影格採樣頻率，平衡 CPU 負載。
    // 【生活比喻】：設定一個小鬧鐘，每隔 0.2 秒敲一下，叫小眼睛起來比對一次，不用一直拼命看。
    timerRef.current = setInterval(detectMotion, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      prevFrameRef.current = null;
    };
  }, [enabled, sensitivity, interval, videoRef]);

  return { motionRegions, isMotionDetected };
}

export default useMotionDetect;
