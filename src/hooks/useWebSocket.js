import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * WebSocket 連線狀態列舉
 */
const ConnectionState = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
};

/**
 * WebSocket 連線 Hook
 * 支援自動重連（指數退避）、心跳、訊息佇列
 *
 * @param {string} url - WebSocket 伺服器位址
 * @returns {{ isConnected, sendMessage, lastMessage, connectionState, ws }}
 */
export function useWebSocket(url) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionState, setConnectionState] = useState(
    ConnectionState.DISCONNECTED
  );

  // 內部參考
  const wsRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  // 離線訊息佇列
  const messageQueueRef = useRef([]);
  // 控制是否應繼續重連
  const shouldReconnectRef = useRef(true);
  // 避免重複建立連線
  const urlRef = useRef(url);
  urlRef.current = url;

  // 重連參數
  const BASE_DELAY = 1000;       // 初始延遲 1 秒
  const MAX_DELAY = 30000;       // 最大延遲 30 秒
  const HEARTBEAT_INTERVAL = 10000; // 心跳間隔 10 秒

  /**
   * 計算指數退避延遲
   */
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      BASE_DELAY * Math.pow(2, reconnectAttemptRef.current),
      MAX_DELAY
    );
    return delay;
  }, []);

  /**
   * 清除心跳計時器
   */
  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  /**
   * 啟動心跳 ping
   */
  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // 傳送心跳訊息
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }, [clearHeartbeat]);

  /**
   * 清除佇列中的訊息（連線成功後發送）
   */
  const flushMessageQueue = useCallback(() => {
    while (messageQueueRef.current.length > 0) {
      const msg = messageQueueRef.current.shift();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(msg);
      }
    }
  }, []);

  /**
   * 建立 WebSocket 連線
   */
  const connect = useCallback(() => {
    // 若已連線或不應重連則跳過
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!urlRef.current) return;

    setConnectionState(
      reconnectAttemptRef.current > 0
        ? ConnectionState.RECONNECTING
        : ConnectionState.CONNECTING
    );

    try {
      const ws = new WebSocket(urlRef.current);
      wsRef.current = ws;

      // 連線成功
      ws.onopen = () => {
        setIsConnected(true);
        setConnectionState(ConnectionState.CONNECTED);
        reconnectAttemptRef.current = 0;
        startHeartbeat();
        flushMessageQueue();
      };

      // 接收訊息
      ws.onmessage = (event) => {
        try {
          // 自動解析 JSON 訊息
          const parsed = JSON.parse(event.data);
          setLastMessage(parsed);
        } catch {
          // 非 JSON 格式，直接儲存原始資料
          setLastMessage(event.data);
        }
      };

      // 連線關閉
      ws.onclose = (event) => {
        setIsConnected(false);
        setConnectionState(ConnectionState.DISCONNECTED);
        clearHeartbeat();
        wsRef.current = null;

        // 非正常關閉且應重連
        if (shouldReconnectRef.current && !event.wasClean) {
          const delay = getReconnectDelay();
          reconnectAttemptRef.current += 1;
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      // 連線錯誤
      ws.onerror = (event) => {
        console.error('WebSocket 錯誤:', event);
        // onclose 會隨後觸發，由其處理重連
      };
    } catch (err) {
      console.error('WebSocket 建立失敗:', err);
      // 排程重連
      if (shouldReconnectRef.current) {
        const delay = getReconnectDelay();
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    }
  }, [startHeartbeat, clearHeartbeat, flushMessageQueue, getReconnectDelay]);

  /**
   * 傳送訊息（離線時加入佇列）
   * @param {object|string} message - 要傳送的資料
   */
  const sendMessage = useCallback((message) => {
    const data =
      typeof message === 'string' ? message : JSON.stringify(message);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      // 加入離線佇列，連線後自動送出
      messageQueueRef.current.push(data);
    }
  }, []);

  // 建立連線並在 unmount 時清除
  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;

      // 清除重連計時器
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      // 清除心跳
      clearHeartbeat();

      // 關閉連線
      if (wsRef.current) {
        wsRef.current.close(1000, '元件卸載');
        wsRef.current = null;
      }
    };
  }, [url]); // URL 改變時重新連線 // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isConnected,
    sendMessage,
    lastMessage,
    connectionState,
    ws: wsRef,
  };
}

export { ConnectionState };
export default useWebSocket;
