import React from 'react';
import { useTranslation } from 'react-i18next';
import './LayoutSwitcher.css';

/**
 * LayoutSwitcher - 畫面佈局切換按鈕組
 * 支援 1x1 單分割、2x2 四分割、1+3 焦點分割模式
 */
export default function LayoutSwitcher({ layout = '2x2', onLayoutChange }) {
  const { t } = useTranslation();

  const layouts = [
    {
      id: '1x1',
      name: t('layout.1x1'),
      iconClass: 'layout-icon--1x1',
    },
    {
      id: '2x2',
      name: t('layout.2x2'),
      iconClass: 'layout-icon--2x2',
    },
    {
      id: '1+3',
      name: t('layout.1+3'),
      iconClass: 'layout-icon--1-3',
    },
  ];

  return (
    <div className="layout-switcher glass-panel" role="toolbar" aria-label="Layout mode selection">
      {layouts.map((l) => (
        <button
          key={l.id}
          className={`layout-switcher__btn ${layout === l.id ? 'layout-switcher__btn--active' : ''}`}
          onClick={() => onLayoutChange && onLayoutChange(l.id)}
          aria-label={`Switch to ${l.name}`}
          title={l.name}
        >
          {/* CSS 畫成的格狀佈局小圖標 */}
          <div className={`layout-icon ${l.iconClass}`}>
            <span className="layout-icon__grid-cell" />
            <span className="layout-icon__grid-cell" />
            <span className="layout-icon__grid-cell" />
            <span className="layout-icon__grid-cell" />
          </div>
          <span className="layout-switcher__label">{l.name}</span>
        </button>
      ))}
    </div>
  );
}
