# Camera Ops Console — 多攝影機即時監控操作台

這是一個專為 specialized 設備開發的**多攝影機即時監控操作台 (Dashboard / HMI)** Demo 專案，結合了 React、WebSocket、WebRTC P2P 串流、Canvas 影像增強、動態偵測以及 NVR 錄影等模組，完美對標前端設計工程師的職缺技能要求。

---

## 🛠 核心技術與功能亮點

1. **React 前端框架 (Vite)**：使用 React 19 與純 JavaScript 打造的高效能單頁應用 (SPA)。
2. **多畫面分割 (Layout Switcher)**：支援 **單分割 (1x1)**、**四分割 (2x2)** 與 **1+3 焦點分割** 佈局，利用 CSS Grid 進行流暢排版。
3. **即時視訊串流 (Streaming)**：
   - **本地 USB 攝影機**：使用 `navigator.mediaDevices.getUserMedia` 讀取 Logitech USB 攝影機 (VID:1133 PID:2075)。
   - **行動裝置 WebRTC P2P 串流**：iPhone (iPhone18,5) 開啟行動端頁面後，透過 Node.js 信令伺服器與主控台建立 WebRTC P2P 視訊傳輸，即時呈現在四分割畫面中。
4. **即時影像處理 (Canvas Enhancement)**：
   - 使用 Web CSS 濾鏡調整影像的**亮度**、**對比度**與**飽和度**。
   - 支援日夜間預設模式（日間模式、夜間增強模式、高對比模式）。
5. **邊緣端動態偵測 (Motion Detection)**：
   - 使用 Canvas 像素差分演算法 (Frame Differencing) 進行即時動態追蹤。
   - 可在畫面上疊加動態追蹤綠色框線，並支援調整偵測靈敏度 (Sensitivity)。
6. **即時警報與事件推播 (Alert Engine)**：
   - 動態偵測觸發時，前端會即時發送警報至後端，並透過 WebSocket 廣播給所有連線客戶端，同時在警報面板 (Alert Panel) 顯示，並伴隨防抖的音效警示。
7. **NVR 即時錄影與快照 (NVR Recording & Snapshot)**：
   - 使用 `MediaRecorder` API 直接錄製攝影機視訊軌道，並自動打包下載為標準 `.webm` 影片。
   - 支援單鍵擷取快照並下載 `.jpg` 檔。
8. **效能診斷面板 (Performance Profiler)**：
   - 用 Canvas 繪製即時 FPS 歷史折線圖，並即時監控系統記憶體用量、DOM 節點數、CPU 長任務 (Long Tasks) 數量。
9. **雙語國際化 (i18n)**：使用 `react-i18next` 提供繁體中文與英文即時切換。
10. **響應式與觸控優化**：所有操控元件均大於 44px 的最小觸控目標，支援平板及行動裝置操作。

---

## 🏗 系統架構圖

```
┌─────────────────────────────────────────────────────┐
│                  React Frontend (Vite)               │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────┐ │
│  │ VideoGrid│ │PTZ Panel │ │Enhancement│ │ Alerts │ │
│  │  Player  │ │ Controls │ │  Sliders  │ │ Panel  │ │
│  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └───┬────┘ │
│       │             │             │            │      │
│  ┌────┴─────────────┴─────────────┴────────────┴───┐ │
│  │          WebSocket Client + REST Client          │ │
│  └──────────────────────┬──────────────────────────┘ │
└─────────────────────────┼───────────────────────────┘
                           │
               ┌───────────┴───────────┐
               │   Node.js Backend     │
               │  Express + WS Server  │
               │  ┌─────────────────┐  │
               │  │ Device Manager  │  │
               │  │ Alert Engine    │  │
               │  │ Signaling (RTC) │  │
               │  └─────────────────┘  │
               └───────────┬───────────┘
                           │
               ┌───────────┼───────────┐
               │                       │
         ┌─────┴─────┐          ┌──────┴──────┐
         │ Logitech  │          │   iPhone    │
         │ USB Cam   │          │  (WebRTC)   │
         │getUserMedia│         │  Signaling  │
         └───────────┘          └─────────────┘
```

---

## 🚀 快速開始與部署說明

此專案已配置好 Express 後端與 Vite 前端，可在 Mac Mini 上一鍵啟動：

### 1. 安裝依賴套件
```bash
# 避免 root 快取權限問題，請加上 --cache 參數
npm install --cache /tmp/npm-cache
```

### 2. 同時啟動前端與後端
```bash
npm run dev:all
```
啟動後會自動開啟瀏覽器並輸出以下位址：
- **前端控制台**: `http://localhost:5173`
- **後端 API 伺服器**: `http://localhost:3005`
- **iPhone 串流傳送頁面**: `http://<mac-mini-ip>:3005/mobile`

---

## 🎥 面試實機 Demo 步驟建議

為了展現對嵌入式與實時監控系統前端開發的完整理解，建議按照以下流程向面試官進行展示：

1. **基礎展示 (Dashboard Grid)**：
   - 開啟控制台 (`http://localhost:5173`)，展示四分割畫面（四個監控畫面）。
   - Logitech USB 攝影機應直接顯示線上畫面，另外兩個 Mock 設備顯示離線佔位畫面。
2. **iPhone 畫面串流接入 (WebRTC P2P)**：
   - 將 iPhone 連接至與 Mac Mini 相同的區域網路 (Wi-Fi)。
   - 使用 iPhone 瀏覽器開啟 `http://<mac-mini-ip>:3005/mobile`。
   - 點擊「**開始串流**」，此時主控台的 **iPhone Camera** 將自動由「離線 (offline)」更新為「線上 (online)」，並即時播放 iPhone 鏡頭傳來的畫面。
3. **PTZ 控制與鍵盤快捷鍵**：
   - 在控制台點選 active 攝影機，操作右側的 D-pad 方向鍵，觀察 PTZ ack 記錄。
   - 使用鍵盤方向鍵 (↑、↓、←、→) 控制平移與傾斜，`+` / `-` 鍵進行 Zoom 縮放。
4. **Canvas 影像增強處理**：
   - 在右側調整亮度、對比度、Gamma 與飽和度滑桿，展示 Canvas 二進制圖像處理的效能。
   - 點擊「**夜間模式**」，展示一鍵增強暗處畫面細節。
5. **邊緣端動態偵測與事件廣播**：
   - 勾選底部的「**動態偵測**」，並在鏡頭前揮手。
   - 畫面會顯示動態區域的綠色追蹤方框。
   - 觸發時底部 **Alert Panel** 會跳出通知（如：`Logitech USB Camera — 偵測到畫面異動`），並伴隨嗶聲警示音。
   - 開啟另一個瀏覽器分頁，驗證 WebSocket 將警報即時同步推播至所有分頁。
6. **NVR 即時錄影與快照**：
   - 點擊 DeviceCard 上的「**錄影 (Record)**」，展示利用 `MediaRecorder` 直接從 Canvas/MediaStream 擷取影音訊號。
   - 再次點擊停止錄影，瀏覽器會自動彈出 `.webm` 影片下載視窗。
   - 點選「**快照 (Snapshot)**」，即可下載當前影格的 `.jpg` 快照。
7. **效能診斷與 i18n 展示**：
   - 展開右下角的 **Performance Monitor** 面板，揮手或切換版面，展示 FPS 線性圖與記憶體用量的變化。
   - 切換右上角語言按鈕，展示完整繁體中文/英文介面，展現模組化 i18n 設計。
