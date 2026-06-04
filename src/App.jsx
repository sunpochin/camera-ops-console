import React from 'react';
import { DeviceProvider } from './contexts/DeviceContext';
import Dashboard from './pages/Dashboard';
import './i18n'; // 初始化 i18n
import './App.css';
import './index.css';

/**
 * App - 根元件
 * 提供全域 DeviceProvider 共享裝置與警報狀態
 */
function App() {
  return (
    <DeviceProvider>
      <div className="app-container">
        <Dashboard />
      </div>
    </DeviceProvider>
  );
}

export default App;
