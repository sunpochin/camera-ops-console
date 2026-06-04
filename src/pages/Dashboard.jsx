import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeviceContext } from '../contexts/DeviceContext';
import {
  useCamera,
  useWebRTC,
  usePerformance,
} from '../hooks';
import VideoPlayer from '../components/VideoPlayer';
import PTZControls from '../components/PTZControls';
import EnhancementPanel from '../components/EnhancementPanel';
import AlertPanel from '../components/AlertPanel';
import DeviceCard from '../components/DeviceCard';
import PerformanceMonitor from '../components/PerformanceMonitor';
import LayoutSwitcher from '../components/LayoutSwitcher';
import './Dashboard.css';

/**
 * Dashboard - 多攝影機主控台頁面
 * 整合所有攝影機畫面、PTZ 控制、即時影像濾鏡、動態偵測與效能監控
 */
export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const {
    devices,
    alerts,
    selectedDeviceId,
    wsConnected,
    ws,
    selectDevice,
    sendPtzCommand,
    triggerAlert,
    triggerSnapshot,
    dismissAlert,
    dismissAllAlerts,
  } = useDeviceContext();

  // ── 全域/介面狀態 ───────────────────────────────────
  const [layout, setLayout] = useState('2x2'); // 1x1, 2x2, 1+3
  const [clock, setClock] = useState(new Date());
  
  // 動態偵測全域狀態
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [motionSensitivity, setMotionSensitivity] = useState(30);
  const [showMotionOverlay, setShowMotionOverlay] = useState(true);

  // 影像處理濾鏡狀態（依 deviceId 區分儲存）
  const [filtersMap, setFiltersMap] = useState({
    'usb-cam-1': { brightness: 0, contrast: 0, gamma: 1.0, saturation: 0, sharpness: 0 },
    'iphone-cam-1': { brightness: 0, contrast: 0, gamma: 1.0, saturation: 0, sharpness: 0 },
  });

  // 錄影功能狀態（NVR 模擬）
  const [recordingStates, setRecordingStates] = useState({});
  const recordersRef = useRef({});

  // ── 串流取得 ────────────────────────────────────────

  // 1. 本地 USB 攝影機 (Logitech VID:1133 PID:2075)
  // 【技術說明】：利用 useCamera 取得本機所有相機裝置，並自動過濾出實體 USB 鏡頭以避免 macOS 接續互通相機 (Continuity Camera) 搶佔預設鏡頭。
  // 【生活比喻】：跟電腦要一張相機名單，然後專門挑出寫著 Logitech 或 USB 的相機，不要讓手機相機搗亂！
  const { stream: usbStream, devices: localCameraDevices, switchCamera: switchLocalCamera } = useCamera();

  // 自動過濾並選取 Logitech/USB 鏡頭
  useEffect(() => {
    if (localCameraDevices && localCameraDevices.length > 0) {
      const targetDev = localCameraDevices.find((d) => {
        const label = d.label.toLowerCase();
        return label.includes('logitech') || label.includes('usb') || label.includes('uvc');
      });
      if (targetDev) {
        switchLocalCamera(targetDev.deviceId);
      }
    }
  }, [localCameraDevices, switchLocalCamera]);

  // 2. 遠端 iPhone 攝影機 (WebRTC)
  // 信令伺服器位址
  const rtcSignalingUrl = useMemo(() => `ws://${window.location.hostname}:3001`, []);
  const { stream: rtcStream, stats: rtcStats } = useWebRTC(ws, 'camera-stream');

  // 3. 系統效能診斷
  const { fps, avgFps, fpsHistory, memoryUsage, domNodes, longTasks } = usePerformance();

  // 更新時鐘
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 語言切換
  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(nextLang);
  };

  // 取得目前被選取的裝置資訊
  const activeDevice = useMemo(() => {
    return devices.find((d) => d.id === selectedDeviceId) || devices[0];
  }, [devices, selectedDeviceId]);

  // 取得裝置對應的影音串流
  const getStreamForDevice = (deviceId) => {
    if (deviceId === 'usb-cam-1') return usbStream;
    if (deviceId === 'iphone-cam-1') return rtcStream;
    return null;
  };

  // ── PTZ 指令傳送 ──────────────────────────────────
  const handlePtzCommand = (command) => {
    if (!activeDevice || activeDevice.status !== 'online') return;
    sendPtzCommand(activeDevice.id, command);
  };

  // ── 濾鏡值變更 ──────────────────────────────────────
  const handleFilterChange = (newFilters) => {
    if (!activeDevice) return;
    setFiltersMap((prev) => ({
      ...prev,
      [activeDevice.id]: newFilters,
    }));
  };

  // ── 動態偵測觸發 ────────────────────────────────────
  const handleMotionDetected = (deviceId) => {
    const device = devices.find((d) => d.id === deviceId);
    const deviceName = device ? device.name : deviceId;
    // 發送警報到後端，後端再轉發廣播給所有連線端
    triggerAlert(deviceId, 'warning', `${deviceName} — 偵測到畫面異動`);
  };

  // ── NVR 錄影控制 ────────────────────────────────────
  const toggleRecording = (deviceId) => {
    const isRecording = !!recordingStates[deviceId];

    if (isRecording) {
      // 停止錄影
      const recorder = recordersRef.current[deviceId];
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
    } else {
      // 開始錄影
      const stream = getStreamForDevice(deviceId);
      if (!stream) return;

      try {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8',
        });
        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `recording_${deviceId}_${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
          
          triggerAlert(deviceId, 'info', `錄製完成，檔案已儲存`);
          
          setRecordingStates((prev) => ({
            ...prev,
            [deviceId]: false,
          }));
        };

        mediaRecorder.start();
        recordersRef.current[deviceId] = mediaRecorder;
        
        triggerAlert(deviceId, 'info', `啟動排程錄影 (NVR 模組)`);
        
        setRecordingStates((prev) => ({
          ...prev,
          [deviceId]: true,
        }));
      } catch (err) {
        console.error('啟動錄影失敗:', err);
        triggerAlert(deviceId, 'critical', `啟動錄影失敗: ${err.message}`);
      }
    }
  };

  // ── 快照功能 ────────────────────────────────────────
  const handleSnapshot = async (deviceId) => {
    const snapshotInfo = await triggerSnapshot(deviceId);
    if (snapshotInfo) {
      // 模擬下載快照
      const stream = getStreamForDevice(deviceId);
      if (stream) {
        // 利用離屏 Canvas 擷取目前影格
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 下載圖片
        const url = canvas.toDataURL('image/jpeg');
        const a = document.createElement('a');
        a.href = url;
        a.download = snapshotInfo.filename;
        a.click();
        
        // 停止暫時建立的 video
        video.srcObject = null;
      }
    }
  };

  // ── 畫面分割排列樣式 ────────────────────────────────
  const renderVideoGrid = () => {
    // 依據 Layout 篩選與排列顯示
    // 限制在 Dashboard 中最多顯示 4 個分割
    const displayDevices = devices.slice(0, 4);

    if (layout === '1x1') {
      const dev = devices.find((d) => d.id === selectedDeviceId) || devices[0];
      if (!dev) return null;
      return (
        <div className="dashboard__grid dashboard__grid--1x1">
          <VideoPlayer
            stream={getStreamForDevice(dev.id)}
            deviceInfo={dev}
            isActive={true}
            onSelect={selectDevice}
            filters={filtersMap[dev.id]}
            showMotionOverlay={showMotionOverlay}
            motionDetectionEnabled={motionEnabled}
            motionSensitivity={motionSensitivity}
            onMotionDetected={handleMotionDetected}
          />
        </div>
      );
    }

    if (layout === '1+3') {
      const activeDev = devices.find((d) => d.id === selectedDeviceId) || devices[0];
      const otherDevs = devices.filter((d) => d.id !== activeDev?.id).slice(0, 3);
      return (
        <div className="dashboard__grid dashboard__grid--1-3">
          {/* 主畫面 */}
          <div className="grid-main-slot">
            {activeDev && (
              <VideoPlayer
                stream={getStreamForDevice(activeDev.id)}
                deviceInfo={activeDev}
                isActive={true}
                onSelect={selectDevice}
                filters={filtersMap[activeDev.id]}
                showMotionOverlay={showMotionOverlay}
                motionDetectionEnabled={motionEnabled}
                motionSensitivity={motionSensitivity}
                onMotionDetected={handleMotionDetected}
              />
            )}
          </div>
          {/* 三個側邊副畫面 */}
          <div className="grid-side-slots">
            {otherDevs.map((dev) => (
              <VideoPlayer
                key={dev.id}
                stream={getStreamForDevice(dev.id)}
                deviceInfo={dev}
                isActive={false}
                onSelect={selectDevice}
                filters={filtersMap[dev.id]}
                showMotionOverlay={showMotionOverlay}
                motionDetectionEnabled={motionEnabled}
                motionSensitivity={motionSensitivity}
                onMotionDetected={handleMotionDetected}
              />
            ))}
          </div>
        </div>
      );
    }

    // 預設 2x2 四分割
    return (
      <div className="dashboard__grid dashboard__grid--2x2">
        {displayDevices.map((dev) => (
          <VideoPlayer
            key={dev.id}
            stream={getStreamForDevice(dev.id)}
            deviceInfo={dev}
            isActive={dev.id === selectedDeviceId}
            onSelect={selectDevice}
            filters={filtersMap[dev.id]}
            showMotionOverlay={showMotionOverlay}
            motionDetectionEnabled={motionEnabled}
            motionSensitivity={motionSensitivity}
            onMotionDetected={handleMotionDetected}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="dashboard">
      {/* 頂部導覽列 */}
      <header className="dashboard__header">
        <div className="dashboard__logo-group">
          <span className="dashboard__status-indicator" title={wsConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}>
            <span className={`dashboard__status-ping ${wsConnected ? 'dashboard__status-ping--connected' : 'dashboard__status-ping--disconnected'}`} />
          </span>
          <h1 className="dashboard__title">{t('app.title')}</h1>
          <span className="dashboard__subtitle">Multi-Camera Ops</span>
        </div>

        {/* 系統時間與語言切換 */}
        <div className="dashboard__header-widgets">
          <div className="dashboard__clock">
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <button className="dashboard__lang-btn" onClick={toggleLanguage}>
            🌐 {i18n.language === 'en' ? '中文' : 'EN'}
          </button>
        </div>
      </header>

      {/* 主體區塊：監視螢幕 + 右側控制側欄 */}
      <main className="dashboard__main">
        {/* 影像監視螢幕區域 */}
        <section className="dashboard__view-area">
          {renderVideoGrid()}
        </section>

        {/* 右側控制面板 */}
        <aside className="dashboard__sidebar">
          {activeDevice && (
            <DeviceCard
              device={activeDevice}
              isSelected={true}
              isRecording={!!recordingStates[activeDevice.id]}
              onSelect={selectDevice}
              onSnapshot={handleSnapshot}
              onRecord={toggleRecording}
            />
          )}

          {/* PTZ 方向控制 */}
          <PTZControls
            onPtzCommand={handlePtzCommand}
            disabled={!activeDevice || activeDevice.status !== 'online'}
          />

          {/* 影像濾鏡滑桿 */}
          <EnhancementPanel
            filters={filtersMap[selectedDeviceId] || { brightness: 0, contrast: 0, gamma: 1.0, saturation: 0, sharpness: 0 }}
            onFilterChange={handleFilterChange}
          />
        </aside>
      </main>

      {/* 底部控制欄與警報面板 */}
      <footer className="dashboard__footer">
        <div className="dashboard__footer-controls">
          {/* 佈局切換 */}
          <LayoutSwitcher layout={layout} onLayoutChange={setLayout} />

          {/* 全域動態偵測控制項 */}
          <div className="dashboard__global-motion glass-panel">
            <div className="motion-control-group">
              <label className="motion-toggle-label">
                <input
                  type="checkbox"
                  checked={motionEnabled}
                  onChange={(e) => setMotionEnabled(e.target.checked)}
                />
                <span className="checkbox-custom" />
                {t('dashboard.motionDetection')}
              </label>
            </div>
            
            {motionEnabled && (
              <>
                <div className="motion-slider-group">
                  <label htmlFor="sensitivity-slider" className="motion-slider-label">
                    {t('dashboard.sensitivity')}: {motionSensitivity}
                  </label>
                  <input
                    id="sensitivity-slider"
                    type="range"
                    min="10"
                    max="90"
                    value={motionSensitivity}
                    onChange={(e) => setMotionSensitivity(Number(e.target.value))}
                    className="motion-slider"
                  />
                </div>

                <div className="motion-checkbox-group">
                  <label className="motion-toggle-label">
                    <input
                      type="checkbox"
                      checked={showMotionOverlay}
                      onChange={(e) => setShowMotionOverlay(e.target.checked)}
                    />
                    <span className="checkbox-custom" />
                    Overlay
                  </label>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 警報與效能雙面板排版 */}
        <div className="dashboard__bottom-panels">
          <div className="dashboard__alert-container">
            <AlertPanel
              alerts={alerts}
              onDismiss={dismissAlert}
              onDismissAll={dismissAllAlerts}
            />
          </div>

          <div className="dashboard__performance-container">
            <PerformanceMonitor
              fps={fps}
              avgFps={avgFps}
              fpsHistory={fpsHistory}
              memoryUsage={memoryUsage}
              domNodes={domNodes}
              longTasks={longTasks}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
