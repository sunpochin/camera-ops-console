# Camera Ops Console — 多攝影機即時監控操作台

這是一個專為 IPC / HMI 設備開發的**多攝影機即時監控操作台**展示專案，對標 Frontend Design Engineer 的職缺要求，實作低延遲串流、邊緣端運算與效能診斷面板。

---

## 📋 職缺技能對齊 (JD Skills Alignment)

* **React 19 & 工業風 HMI**：以 React 19 打造深色工業風面板，觸控按鈕 >= 44px 以適配觸控環境。
* **低延遲串流與控制**：實作 WebRTC P2P 行動端串流（iPhone 鏡頭），並以 WebSocket 進行即時雙向 PTZ 控制與 ACK 響應。
* **邊緣端運算與影像增強**：
  * **動態偵測**：Canvas 像素差分運算（支援 4 倍降採樣以降低 CPU 負載）。
  * **影像增強**：Gamma 校正（LUT 查表法優化）、拉普拉斯銳利度濾波二進制計算。
* **NVR 錄影與快照**：使用 `MediaRecorder` API 即時錄影並下載為 `.webm`，支援單鍵 `.jpg` 快照。
* **效能診斷 (Profiling)**：內建 Canvas FPS 折線圖，監控 JS Memory、DOM 節點數及 Long Tasks。
* **雙重註解設計**：關鍵程式碼導入「技術說明」與「生活比喻」雙註解，展現團隊溝通與技術同理心。

---

## 🚀 快速開始

### 1. 安裝依賴
```bash
npm install --cache /tmp/npm-cache
```

### 2. 啟動服務 (Vite + Node.js 雙服務)
```bash
npm run dev:all
```
* **控制台**: `http://localhost:5173`
* **後端 API / 信令**: `http://localhost:3005`
* **行動端串流頁**: `http://<IP>:3005/mobile` （iOS 需使用 HTTPS 穿透，如 ngrok）

---

## 🎥 Demo 步驟建議

1. **多分割畫面**：開啟主控台，展示 1x1 / 2x2 / 1+3 版面切換。
2. **WebRTC 行動端接入**：以 iPhone 掃描行動端頁面（需經 HTTPS 穿透），點擊「開始串流」即可在控制台看到 iPhone 即時畫面。
3. **PTZ 控制與鍵盤熱鍵**：點擊選取攝影機後，使用方向鍵、`+` / `-` 鍵控制變焦與平移。
4. **影像增強與預設模式**：調整亮度、對比度、Gamma 等滑桿，或點擊「夜間模式」展示 Canvas 即時圖像處理。
5. **動態偵測與警報廣播**：開啟「動態偵測」，在鏡頭前揮手，即可在畫面上看見綠色框線、觸發警報面板通知，並透過 WebSocket 即時同步廣播至所有分頁。
6. **NVR 錄影**：點擊「錄影 (Record)」，結束時自動下載 `.webm` 影片檔。
7. **效能診斷**：打開 Performance Monitor 觀察 FPS 歷史圖線與系統效能指標。
