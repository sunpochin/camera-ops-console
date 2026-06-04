import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './PerformanceMonitor.css';

/**
 * PerformanceMonitor - HMI 效能診斷面板
 * 以 Canvas 即時繪製 FPS 歷史折線圖，並監控記憶體、DOM 節點與 CPU 長任務數
 */
export default function PerformanceMonitor({
  fps = 0,
  avgFps = 0,
  fpsHistory = [],
  memoryUsage = null,
  domNodes = 0,
  longTasks = 0,
}) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 用 Canvas 繪製折線圖
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isCollapsed) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 清除舊畫面
    ctx.clearRect(0, 0, width, height);

    if (fpsHistory.length === 0) return;

    // 繪製背景網格線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 計算各點的坐標位置
    const points = [];
    const maxVal = 65; // 最多顯示至 65 FPS
    const minVal = 0;
    const stepX = width / (fpsHistory.length - 1 || 1);

    fpsHistory.forEach((val, idx) => {
      const x = idx * stepX;
      // 計算高度比例，並保留上下邊距 5px
      const clampedVal = Math.min(maxVal, Math.max(minVal, val));
      const y = height - 5 - ((clampedVal - minVal) / (maxVal - minVal)) * (height - 10);
      points.push({ x, y, val });
    });

    // 建立漸層填充
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    // 依據平均值決定線條顏色
    let lineColor = '#00ff88'; // 綠色 (>50)
    let fillStart = 'rgba(0, 255, 136, 0.2)';
    let fillEnd = 'rgba(0, 255, 136, 0)';

    if (avgFps < 30) {
      lineColor = '#ff4444'; // 紅色 (<30)
      fillStart = 'rgba(255, 68, 68, 0.2)';
    } else if (avgFps < 50) {
      lineColor = '#ffaa00'; // 黃色 (30-50)
      fillStart = 'rgba(255, 170, 0, 0.2)';
    }

    gradient.addColorStop(0, fillStart);
    gradient.addColorStop(1, fillEnd);

    // 1. 先繪製填滿區域
    ctx.beginPath();
    ctx.moveTo(0, height);
    points.forEach((p, idx) => {
      if (idx === 0) ctx.lineTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 2. 再繪製折線外框
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

  }, [fpsHistory, avgFps, isCollapsed]);

  return (
    <div className={`performance-monitor glass-panel ${isCollapsed ? 'performance-monitor--collapsed' : ''}`}>
      {/* 標題欄 */}
      <div
        className="performance-monitor__header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        onKeyDown={(e) => e.key === 'Enter' && setIsCollapsed(!isCollapsed)}
      >
        <div className="performance-monitor__title-group">
          <span className="performance-monitor__pulse-dot" />
          <h3 className="performance-monitor__title">{t('performance.title')}</h3>
        </div>
        <span className="performance-monitor__toggle-icon">
          {isCollapsed ? '▲' : '▼'}
        </span>
      </div>

      {/* 內容區 */}
      {!isCollapsed && (
        <div className="performance-monitor__body">
          {/* 折線圖區 */}
          <div className="performance-monitor__chart-container">
            <canvas
              ref={canvasRef}
              className="performance-monitor__canvas"
              width={220}
              height={60}
            />
            {/* FPS 限度標記 */}
            <span className="performance-monitor__chart-limit performance-monitor__chart-limit--top">60</span>
            <span className="performance-monitor__chart-limit performance-monitor__chart-limit--bottom">0</span>
          </div>

          {/* 指標列表 */}
          <div className="performance-monitor__stats">
            <div className="performance-monitor__stat-row">
              <span className="performance-monitor__stat-label">{t('performance.currentFps')}:</span>
              <span className={`performance-monitor__stat-value ${fps > 50 ? 'fps-good' : fps > 30 ? 'fps-warning' : 'fps-bad'}`}>
                {fps}
              </span>
            </div>
            
            <div className="performance-monitor__stat-row">
              <span className="performance-monitor__stat-label">{t('performance.avgFps')}:</span>
              <span className="performance-monitor__stat-value">{avgFps}</span>
            </div>

            <div className="performance-monitor__stat-row">
              <span className="performance-monitor__stat-label">{t('performance.memory')}:</span>
              <span className="performance-monitor__stat-value">
                {memoryUsage ? `${memoryUsage} MB` : 'N/A'}
              </span>
            </div>

            <div className="performance-monitor__stat-row">
              <span className="performance-monitor__stat-label">{t('performance.domNodes')}:</span>
              <span className="performance-monitor__stat-value">{domNodes}</span>
            </div>

            <div className="performance-monitor__stat-row">
              <span className="performance-monitor__stat-label">{t('performance.longTasks')}:</span>
              <span className={`performance-monitor__stat-value ${longTasks > 0 ? 'long-tasks-warn' : ''}`}>
                {longTasks}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
