import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import useWebSocket from '../hooks/useWebSocket';

// 建立裝置與警報的 React Context
const DeviceContext = createContext(null);

// 後端伺服器位址動態偵測 (配合 Mac Mini 區域網路部署)
const BACKEND_PORT = process.env.BACKEND_PORT || 3001;
const BACKEND_HOST = `${window.location.hostname}:${BACKEND_PORT}`;
const API_URL = `http://${BACKEND_HOST}/api`;
const WS_URL = `ws://${BACKEND_HOST}`;

// 初始狀態
const initialState = {
  devices: [], // 由 API 載入，並藉由 WS 同步
  alerts: [],
  selectedDeviceId: 'usb-cam-1', // 預設選取 Logitech
};

// Reducer 處理狀態變更
function deviceReducer(state, action) {
  switch (action.type) {
    case 'SET_DEVICES':
      return {
        ...state,
        devices: action.payload,
      };
    case 'UPDATE_DEVICE_STATUS':
      return {
        ...state,
        devices: state.devices.map((d) =>
          d.id === action.payload.id ? { ...d, status: action.payload.status } : d
        ),
      };
    case 'SET_SELECTED_DEVICE':
      return {
        ...state,
        selectedDeviceId: action.payload,
      };
    case 'SET_ALERTS':
      return {
        ...state,
        alerts: action.payload,
      };
    case 'ADD_ALERT': {
      // 避免重複加入相同 ID 的警報
      if (state.alerts.some((a) => a.id === action.payload.id)) {
        return state;
      }
      return {
        ...state,
        alerts: [action.payload, ...state.alerts].slice(0, 50), // 最多保留 50 筆
      };
    }
    case 'DISMISS_ALERT':
      return {
        ...state,
        alerts: state.alerts.filter((a) => a.id !== action.payload),
      };
    case 'DISMISS_ALL':
      return {
        ...state,
        alerts: [],
      };
    default:
      return state;
  }
}

// Provider 元件
export function DeviceProvider({ children }) {
  const [state, dispatch] = useReducer(deviceReducer, initialState);

  // 初始化 WebSocket 連線
  const { isConnected: wsConnected, sendMessage, lastMessage, ws } = useWebSocket(WS_URL);

  // 1. 從 REST API 載入初始資料
  const fetchInitialData = useCallback(async () => {
    try {
      // 載入裝置清單
      const devRes = await fetch(`${API_URL}/devices`);
      const devJson = await devRes.json();
      if (devJson.success) {
        dispatch({ type: 'SET_DEVICES', payload: devJson.data });
      }

      // 載入警報歷史
      const alertRes = await fetch(`${API_URL}/alerts?limit=50`);
      const alertJson = await alertRes.json();
      if (alertJson.success) {
        dispatch({ type: 'SET_ALERTS', payload: alertJson.data });
      }
    } catch (err) {
      console.error('載入初始資料失敗:', err);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // 2. 處理 WebSocket 接收到的訊息
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'device_status':
        dispatch({ type: 'SET_DEVICES', payload: lastMessage.data });
        break;
      case 'alert':
        dispatch({ type: 'ADD_ALERT', payload: lastMessage.data });
        break;
      case 'ptz_ack':
        console.log('[PTZ] 收到確認:', lastMessage.data);
        break;
      default:
        break;
    }
  }, [lastMessage]);

  // 選取特定攝影機
  const selectDevice = useCallback((deviceId) => {
    dispatch({ type: 'SET_SELECTED_DEVICE', payload: deviceId });
  }, []);

  // 傳送 PTZ 指令到後端
  const sendPtzCommand = useCallback(
    (deviceId, command) => {
      if (wsConnected) {
        sendMessage({
          type: 'ptz_command',
          data: {
            deviceId,
            action: command.action,
            value: command.value,
            speed: command.speed || 5,
          },
        });
      }
    },
    [wsConnected, sendMessage]
  );

  // 發送新警報到後端（REST API 觸發廣播）
  const triggerAlert = useCallback(async (deviceId, level, message) => {
    try {
      await fetch(`${API_URL}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, level, message }),
      });
    } catch (err) {
      console.error('發送警報失敗:', err);
    }
  }, []);

  // 觸發遠端快照
  const triggerSnapshot = useCallback(async (deviceId) => {
    try {
      const res = await fetch(`${API_URL}/devices/${deviceId}/snapshot`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        // 在本地加入一則資訊警報，提示快照成功
        dispatch({
          type: 'ADD_ALERT',
          payload: {
            id: `snap-${Date.now()}`,
            level: 'info',
            message: `擷取快照成功: ${json.data.filename}`,
            deviceId,
            timestamp: new Date().toISOString(),
          },
        });
        return json.data;
      } else {
        throw new Error(json.error);
      }
    } catch (err) {
      console.error('擷取快照失敗:', err);
      dispatch({
        type: 'ADD_ALERT',
        payload: {
          id: `snap-err-${Date.now()}`,
          level: 'warning',
          message: `快照擷取失敗: ${err.message}`,
          deviceId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }, []);

  // 關閉單一警報
  const dismissAlert = useCallback((id) => {
    dispatch({ type: 'DISMISS_ALERT', payload: id });
  }, []);

  // 清除所有警報
  const dismissAllAlerts = useCallback(() => {
    dispatch({ type: 'DISMISS_ALL' });
  }, []);

  const value = {
    devices: state.devices,
    alerts: state.alerts,
    selectedDeviceId: state.selectedDeviceId,
    wsConnected,
    ws,
    selectDevice,
    sendPtzCommand,
    triggerAlert,
    triggerSnapshot,
    dismissAlert,
    dismissAllAlerts,
  };

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}

// 快速存取 Context 的 Custom Hook
export function useDeviceContext() {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDeviceContext 必須在 DeviceProvider 內使用');
  }
  return context;
}

export default DeviceContext;
