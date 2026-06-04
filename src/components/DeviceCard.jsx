import React from 'react';
import { useTranslation } from 'react-i18next';
import './DeviceCard.css';

/**
 * DeviceCard - 攝影機裝置資訊與控制按鈕卡片
 * 顯示裝置型號、型態、解析度、FPS、連線狀態，及快照/錄影等控制
 */
export default function DeviceCard({
  device = {},
  isSelected = false,
  isRecording = false,
  onSelect,
  onSnapshot,
  onRecord,
}) {
  const { t } = useTranslation();

  const {
    id,
    name = 'Unknown Camera',
    model = 'Unknown Model',
    type = 'USB',
    status = 'offline',
    resolution = '—',
    fps = 0,
  } = device;

  const isOnline = status === 'online';

  // 處理點擊選取
  const handleCardClick = () => {
    if (onSelect) {
      onSelect(id);
    }
  };

  // 處理快照點擊
  const handleSnapshotClick = (e) => {
    e.stopPropagation(); // 避免點擊按鈕觸發卡片選取
    if (onSnapshot) {
      onSnapshot(id);
    }
  };

  // 處理錄製點擊
  const handleRecordClick = (e) => {
    e.stopPropagation(); // 避免點擊按鈕觸發卡片選取
    if (onRecord) {
      onRecord(id);
    }
  };

  return (
    <div
      className={`device-card glass-panel ${isSelected ? 'device-card--selected' : ''} ${isOnline ? 'device-card--online' : 'device-card--offline'}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`Select device ${name}`}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
    >
      {/* 頂部資訊列 */}
      <div className="device-card__header">
        <div className="device-card__title-group">
          <span className={`device-card__status-dot ${isOnline ? 'device-card__status-dot--online' : 'device-card__status-dot--offline'}`} />
          <h4 className="device-card__name">{name}</h4>
        </div>
        <span className={`device-card__badge device-card__badge--${type.toLowerCase()}`}>
          {type === 'usb' || type === 'USB' ? t('device.usb') : t('device.webrtc')}
        </span>
      </div>

      {/* 詳細規格 */}
      <div className="device-card__details">
        <div className="device-card__detail-row">
          <span className="device-card__detail-label">{t('device.model')}:</span>
          <span className="device-card__detail-value device-card__detail-value--model" title={model}>
            {model}
          </span>
        </div>
        <div className="device-card__detail-row">
          <span className="device-card__detail-label">{t('device.resolution')}:</span>
          <span className="device-card__detail-value">{isOnline ? resolution : '—'}</span>
        </div>
        <div className="device-card__detail-row">
          <span className="device-card__detail-label">{t('device.fps')}:</span>
          <span className="device-card__detail-value">{isOnline ? `${fps} FPS` : '—'}</span>
        </div>
      </div>

      {/* 控制按鈕列 */}
      <div className="device-card__actions">
        {/* 快照按鈕 */}
        <button
          className="device-card__btn"
          onClick={handleSnapshotClick}
          disabled={!isOnline}
          title={t('device.snapshot')}
        >
          📷 {t('device.snapshot')}
        </button>

        {/* 錄製按鈕 */}
        <button
          className={`device-card__btn ${isRecording ? 'device-card__btn--recording' : ''}`}
          onClick={handleRecordClick}
          disabled={!isOnline}
          title={t('device.record')}
        >
          {isRecording ? '⏹️' : '⏺️'} {isRecording ? t('dashboard.recording') : t('device.record')}
        </button>
      </div>
    </div>
  );
}
