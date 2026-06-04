import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './AlertPanel.css';

/**
 * AlertPanel - 警報歷史與通知面板
 * 支援音效提示、單一/全部清除、不同等級邊框與圖示
 */
export default function AlertPanel({
  alerts = [],
  onDismiss,
  onDismissAll,
}) {
  const { t } = useTranslation();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef(null);

  // 警報等級對應的樣式與圖示
  const getLevelConfig = (level) => {
    switch (level) {
      case 'critical':
        return { icon: '🔴', className: 'alert-item--critical', label: t('alert.critical') };
      case 'warning':
        return { icon: '🟡', className: 'alert-item--warning', label: t('alert.warning') };
      case 'info':
      default:
        return { icon: '🔵', className: 'alert-item--info', label: t('alert.info') };
    }
  };

  // 播放警報音效
  const playAlertSound = (level) => {
    if (!soundEnabled) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // 根據等級調整音頻與長度
      if (level === 'critical') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (level === 'warning') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch (err) {
      console.warn('播放警報音效失敗:', err);
    }
  };

  // 當有新警報進入時播放音效
  const prevAlertsLength = useRef(alerts.length);
  useEffect(() => {
    if (alerts.length > prevAlertsLength.current) {
      // 取得最新的一筆警報
      const latestAlert = alerts[0];
      if (latestAlert) {
        playAlertSound(latestAlert.level);
      }
    }
    prevAlertsLength.current = alerts.length;
  }, [alerts]);

  // 格式化相對時間或絕對時間
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    
    // 60秒內顯示「幾秒前」
    if (diff < 60000) {
      const secs = Math.max(1, Math.floor(diff / 1000));
      return `${secs}s ${t('alert.ago')}`;
    }
    
    // 顯示時分秒
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="alert-panel glass-panel">
      <div className="alert-panel__header">
        <h3 className="alert-panel__title">
          {t('alert.title')} ({alerts.length})
        </h3>
        <div className="alert-panel__actions">
          {/* 音效控制開關 */}
          <button
            className={`alert-panel__sound-btn ${soundEnabled ? 'alert-panel__sound-btn--active' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={t('alert.sound')}
            title={t('alert.sound')}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          
          {/* 清除全部按鈕 */}
          <button
            className="alert-panel__clear-btn"
            onClick={onDismissAll}
            disabled={alerts.length === 0}
          >
            {t('alert.dismissAll')}
          </button>
        </div>
      </div>

      <div className="alert-panel__list">
        {alerts.length === 0 ? (
          <div className="alert-panel__empty">
            <span className="alert-panel__empty-icon">✅</span>
            <span>{t('alert.noAlerts')}</span>
          </div>
        ) : (
          alerts.map((alert) => {
            const { icon, className, label } = getLevelConfig(alert.level);
            return (
              <div key={alert.id} className={`alert-item ${className}`}>
                <span className="alert-item__icon" title={label}>
                  {icon}
                </span>
                <div className="alert-item__content">
                  <div className="alert-item__message">{alert.message}</div>
                  <div className="alert-item__meta">
                    {alert.deviceId && <span className="alert-item__device">{alert.deviceId}</span>}
                    <span className="alert-item__time">{formatTime(alert.timestamp)}</span>
                  </div>
                </div>
                <button
                  className="alert-item__close"
                  onClick={() => onDismiss(alert.id)}
                  aria-label="Dismiss alert"
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
