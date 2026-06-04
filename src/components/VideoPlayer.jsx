import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useMotionDetect } from '../hooks';
import './VideoPlayer.css';

/**
 * VideoPlayer - 影像播放器元件，含 canvas 疊加層
 * 支援動態偵測方框繪製、FPS 顯示、全螢幕切換
 */
export default function VideoPlayer({
  stream = null,
  deviceInfo = {},
  isActive = false,
  onSelect,
  filters = {},
  showMotionOverlay = false,
  motionDetectionEnabled = false,
  motionSensitivity = 30,
  onMotionDetected,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());

  // 動態偵測 Hook
  const { motionRegions: localRegions, isMotionDetected } = useMotionDetect(videoRef, {
    sensitivity: motionSensitivity,
    enabled: !!stream && motionDetectionEnabled,
    interval: 200,
  });

  // 觸發動態警報（帶有防抖/節流，避免過於頻繁發送）
  const lastAlertTimeRef = useRef(0);
  useEffect(() => {
    if (isMotionDetected && onMotionDetected) {
      const now = Date.now();
      if (now - lastAlertTimeRef.current > 3000) { // 3 秒冷卻時間
        onMotionDetected(deviceInfo.id);
        lastAlertTimeRef.current = now;
      }
    }
  }, [isMotionDetected, deviceInfo.id, onMotionDetected]);

  // 將串流附加到 video 元素
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {
        // 自動播放受限時忽略
      });
    } else {
      video.srcObject = null;
    }

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  // Canvas 疊加層繪製迴圈
  useEffect(() => {
    if (!stream || !canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;

    const draw = (now) => {
      // 同步 canvas 尺寸
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // FPS 計算
      frameCountRef.current++;
      const elapsed = now - lastFpsTimeRef.current;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      // 繪製動態偵測方框
      if (showMotionOverlay && localRegions.length > 0) {
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 255, 136, 0.5)';
        ctx.shadowBlur = 6;

        localRegions.forEach((region) => {
          ctx.strokeRect(region.x, region.y, region.width, region.height);
        });

        ctx.shadowBlur = 0;
      }

      // 繪製 FPS 覆蓋文字（右上角）
      ctx.font = '14px monospace';
      ctx.fillStyle = fps > 50 ? '#00ff88' : fps > 30 ? '#ffaa00' : '#ff4444';
      ctx.textAlign = 'right';
      ctx.fillText(`${fps} FPS`, canvas.width - 12, 24);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [stream, localRegions, showMotionOverlay, fps]);

  // 套用影像濾鏡至 video 元素
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const filterParts = [];
    if (filters.brightness !== undefined && filters.brightness !== 0) {
      filterParts.push(`brightness(${1 + filters.brightness / 100})`);
    }
    if (filters.contrast !== undefined && filters.contrast !== 0) {
      filterParts.push(`contrast(${1 + filters.contrast / 100})`);
    }
    if (filters.saturation !== undefined && filters.saturation !== 0) {
      filterParts.push(`saturate(${1 + filters.saturation / 100})`);
    }

    video.style.filter = filterParts.length > 0 ? filterParts.join(' ') : 'none';
  }, [filters]);

  // 點擊選取
  const handleClick = useCallback(() => {
    if (onSelect) onSelect(deviceInfo.id);
  }, [onSelect, deviceInfo.id]);

  // 雙擊全螢幕
  const handleDoubleClick = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  // 無串流時的佔位畫面
  if (!stream) {
    return (
      <div
        ref={containerRef}
        className={`video-player video-player--placeholder ${isActive ? 'video-player--active' : ''}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`Select ${deviceInfo.name || 'camera'}`}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      >
        {/* 狀態指示燈 */}
        <span className="video-player__status video-player__status--offline" />
        <div className="video-player__placeholder-content">
          <span className="video-player__camera-icon">📷</span>
          <span className="video-player__device-name">
            {deviceInfo.name || 'Unknown Device'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`video-player ${isActive ? 'video-player--active' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      role="button"
      tabIndex={0}
      aria-label={`Video feed: ${deviceInfo.name || 'camera'}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick();
        if (e.key === 'f') handleDoubleClick();
      }}
    >
      {/* 狀態指示燈 - 線上 */}
      <span className="video-player__status video-player__status--online" />

      {/* 影像元素 */}
      <video
        ref={videoRef}
        className="video-player__video"
        autoPlay
        playsInline
        muted
      />

      {/* Canvas 疊加層 */}
      <canvas ref={canvasRef} className="video-player__overlay" />

      {/* 裝置名稱標籤 */}
      <div className="video-player__label">
        {deviceInfo.name || 'Camera'}
      </div>
    </div>
  );
}
