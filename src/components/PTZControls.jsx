import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './PTZControls.css';

/**
 * PTZControls - 虛擬 PTZ 控制面板
 * D-pad 方向控制、變焦滑桿、速度調整、預設位置
 */
export default function PTZControls({ onPtzCommand, disabled = false }) {
  const { t } = useTranslation();
  const speedRef = useRef(5);

  // 發送 PTZ 指令
  const sendCommand = useCallback(
    (action, value) => {
      if (!disabled && onPtzCommand) {
        onPtzCommand({ action, value, speed: speedRef.current });
      }
    },
    [disabled, onPtzCommand]
  );

  // 鍵盤快捷鍵：方向鍵控制 Pan/Tilt，+/- 控制 Zoom
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (disabled) return;
      // 避免在輸入框中觸發
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          sendCommand('tilt', 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          sendCommand('tilt', -1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          sendCommand('pan', -1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          sendCommand('pan', 1);
          break;
        case '+':
        case '=':
          sendCommand('zoom', 1);
          break;
        case '-':
          sendCommand('zoom', -1);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, sendCommand]);

  // 速度變更
  const handleSpeedChange = useCallback((e) => {
    speedRef.current = Number(e.target.value);
  }, []);

  return (
    <div className={`ptz-controls glass-panel ${disabled ? 'ptz-controls--disabled' : ''}`}>
      <h3 className="ptz-controls__title">{t('ptz.title')}</h3>

      {/* D-pad 方向控制 */}
      <div className="ptz-controls__dpad">
        <button
          className="ptz-controls__btn ptz-controls__btn--up"
          onClick={() => sendCommand('tilt', 1)}
          disabled={disabled}
          aria-label={t('ptz.up')}
          title={t('ptz.up')}
        >
          ▲
        </button>
        <button
          className="ptz-controls__btn ptz-controls__btn--left"
          onClick={() => sendCommand('pan', -1)}
          disabled={disabled}
          aria-label={t('ptz.left')}
          title={t('ptz.left')}
        >
          ◀
        </button>
        <button
          className="ptz-controls__btn ptz-controls__btn--center"
          onClick={() => sendCommand('home', 0)}
          disabled={disabled}
          aria-label={t('ptz.home')}
          title={t('ptz.home')}
        >
          ⌂
        </button>
        <button
          className="ptz-controls__btn ptz-controls__btn--right"
          onClick={() => sendCommand('pan', 1)}
          disabled={disabled}
          aria-label={t('ptz.right')}
          title={t('ptz.right')}
        >
          ▶
        </button>
        <button
          className="ptz-controls__btn ptz-controls__btn--down"
          onClick={() => sendCommand('tilt', -1)}
          disabled={disabled}
          aria-label={t('ptz.down')}
          title={t('ptz.down')}
        >
          ▼
        </button>
      </div>

      {/* 變焦控制 */}
      <div className="ptz-controls__zoom">
        <label className="ptz-controls__label">{t('ptz.zoom')}</label>
        <div className="ptz-controls__zoom-track">
          <span className="ptz-controls__zoom-label">＋</span>
          <input
            type="range"
            className="ptz-controls__zoom-slider"
            min="-10"
            max="10"
            defaultValue="0"
            orient="vertical"
            disabled={disabled}
            onChange={(e) => sendCommand('zoom', Number(e.target.value))}
            aria-label={t('ptz.zoom')}
          />
          <span className="ptz-controls__zoom-label">＿</span>
        </div>
      </div>

      {/* 速度控制 */}
      <div className="ptz-controls__speed">
        <label className="ptz-controls__label">
          {t('ptz.speed')}
          <span className="ptz-controls__speed-value">{speedRef.current}</span>
        </label>
        <input
          type="range"
          className="ptz-controls__speed-slider"
          min="1"
          max="10"
          defaultValue="5"
          disabled={disabled}
          onChange={handleSpeedChange}
          aria-label={t('ptz.speed')}
        />
      </div>

      {/* 預設位置按鈕 */}
      <div className="ptz-controls__presets">
        {[1, 2, 3, 4].map((num) => (
          <button
            key={num}
            className="ptz-controls__preset-btn"
            onClick={() => sendCommand('preset', num)}
            disabled={disabled}
            aria-label={`${t('ptz.preset')} ${num}`}
          >
            P{num}
          </button>
        ))}
      </div>
    </div>
  );
}
