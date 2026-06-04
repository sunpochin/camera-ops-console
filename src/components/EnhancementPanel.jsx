import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './EnhancementPanel.css';

// 預設濾鏡值
const DEFAULT_FILTERS = {
  brightness: 0,
  contrast: 0,
  gamma: 1.0,
  saturation: 0,
  sharpness: 0,
};

// 預設模式定義
const PRESETS = {
  day: { brightness: 0, contrast: 0, gamma: 1.0, saturation: 0, sharpness: 0 },
  night: { brightness: 20, contrast: 30, gamma: 1.5, saturation: 0, sharpness: 0 },
  highContrast: { brightness: 0, contrast: 60, gamma: 1.0, saturation: 0, sharpness: 50 },
};

// 滑桿設定
const SLIDER_CONFIG = [
  { key: 'brightness', labelKey: 'enhancement.brightness', min: -100, max: 100, step: 1 },
  { key: 'contrast', labelKey: 'enhancement.contrast', min: -100, max: 100, step: 1 },
  { key: 'gamma', labelKey: 'enhancement.gamma', min: 0.1, max: 3.0, step: 0.1 },
  { key: 'saturation', labelKey: 'enhancement.saturation', min: -100, max: 100, step: 1 },
  { key: 'sharpness', labelKey: 'enhancement.sharpness', min: 0, max: 100, step: 1 },
];

/**
 * EnhancementPanel - 影像增強控制面板
 * 亮度、對比度、Gamma、飽和度、銳利度滑桿，及預設模式
 */
export default function EnhancementPanel({ filters = DEFAULT_FILTERS, onFilterChange }) {
  const { t } = useTranslation();

  // 更新單一濾鏡值
  const handleChange = useCallback(
    (key, value) => {
      if (onFilterChange) {
        onFilterChange({ ...filters, [key]: Number(value) });
      }
    },
    [filters, onFilterChange]
  );

  // 重設單一濾鏡
  const handleReset = useCallback(
    (key) => {
      if (onFilterChange) {
        onFilterChange({ ...filters, [key]: DEFAULT_FILTERS[key] });
      }
    },
    [filters, onFilterChange]
  );

  // 套用預設模式
  const applyPreset = useCallback(
    (presetName) => {
      if (onFilterChange) {
        onFilterChange({ ...PRESETS[presetName] });
      }
    },
    [onFilterChange]
  );

  // 全部重設
  const handleResetAll = useCallback(() => {
    if (onFilterChange) {
      onFilterChange({ ...DEFAULT_FILTERS });
    }
  }, [onFilterChange]);

  // 格式化顯示值
  const formatValue = (key, value) => {
    if (key === 'gamma') return value.toFixed(1);
    return Math.round(value);
  };

  return (
    <div className="enhancement-panel glass-panel">
      <h3 className="enhancement-panel__title">{t('enhancement.title')}</h3>

      {/* 滑桿控制群組 */}
      <div className="enhancement-panel__sliders">
        {SLIDER_CONFIG.map(({ key, labelKey, min, max, step }) => (
          <div key={key} className="enhancement-panel__slider-row">
            <div className="enhancement-panel__slider-header">
              <label className="enhancement-panel__label" htmlFor={`filter-${key}`}>
                {t(labelKey)}
              </label>
              <span className="enhancement-panel__value">
                {formatValue(key, filters[key] ?? DEFAULT_FILTERS[key])}
              </span>
              <button
                className="enhancement-panel__reset-btn"
                onClick={() => handleReset(key)}
                aria-label={`${t('enhancement.reset')} ${t(labelKey)}`}
                title={t('enhancement.reset')}
              >
                ↺
              </button>
            </div>
            <input
              id={`filter-${key}`}
              type="range"
              className="enhancement-panel__slider"
              min={min}
              max={max}
              step={step}
              value={filters[key] ?? DEFAULT_FILTERS[key]}
              onChange={(e) => handleChange(key, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* 預設模式按鈕 */}
      <div className="enhancement-panel__presets">
        <button
          className="enhancement-panel__preset-btn"
          onClick={() => applyPreset('day')}
        >
          ☀️ {t('enhancement.dayMode')}
        </button>
        <button
          className="enhancement-panel__preset-btn"
          onClick={() => applyPreset('night')}
        >
          🌙 {t('enhancement.nightMode')}
        </button>
        <button
          className="enhancement-panel__preset-btn"
          onClick={() => applyPreset('highContrast')}
        >
          🔲 {t('enhancement.highContrast')}
        </button>
      </div>

      {/* 全部重設 */}
      <button
        className="enhancement-panel__reset-all"
        onClick={handleResetAll}
      >
        {t('enhancement.resetAll')}
      </button>
    </div>
  );
}
