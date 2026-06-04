import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * ICE/STUN 伺服器設定
 */
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

/**
 * 統計資料輪詢間隔（毫秒）
 */
const STATS_INTERVAL = 2000;

/**
 * WebRTC 接收端 Hook
 * 透過信令 WebSocket 加入房間，接收遠端視訊串流
 *
 * @param {React.RefObject} signalingWs - WebSocket 實例的 ref
 * @param {string} roomId - 房間 ID
 * @returns {{ remoteStream, connectionState, stats, error }}
 */
export function useWebRTC(signalingWs, roomId) {
  // 遠端媒體串流
  const [remoteStream, setRemoteStream] = useState(null);
  // RTCPeerConnection 連線狀態
  const [connectionState, setConnectionState] = useState('new');
  // 即時統計資料
  const [stats, setStats] = useState({
    bitrate: 0,
    fps: 0,
    resolution: { width: 0, height: 0 },
    packetsLost: 0,
    jitter: 0,
  });
  // 錯誤訊息
  const [error, setError] = useState(null);

  // 內部參考
  const pcRef = useRef(null);
  const statsTimerRef = useRef(null);
  // 追蹤前次位元組數以計算位元率
  const prevBytesRef = useRef(0);
  const prevTimestampRef = useRef(0);
  // 追蹤是否已掛載
  const mountedRef = useRef(true);

  /**
   * 透過信令發送訊息
   */
  const sendSignaling = useCallback(
    (message) => {
      const ws = signalingWs?.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            ...message,
            roomId,
          })
        );
      }
    },
    [signalingWs, roomId]
  );

  /**
   * 輪詢取得連線統計資料
   */
  const pollStats = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || pc.connectionState === 'closed') return;

    try {
      const report = await pc.getStats();
      report.forEach((stat) => {
        // 取得 inbound-rtp 視訊統計
        if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
          const now = stat.timestamp;
          const bytes = stat.bytesReceived || 0;

          // 計算位元率（bps）
          if (prevTimestampRef.current > 0) {
            const timeDiff = (now - prevTimestampRef.current) / 1000;
            const bytesDiff = bytes - prevBytesRef.current;
            const bitrate =
              timeDiff > 0
                ? Math.round((bytesDiff * 8) / timeDiff / 1000) // kbps
                : 0;

            if (mountedRef.current) {
              setStats((prev) => ({
                ...prev,
                bitrate,
                fps: stat.framesPerSecond || prev.fps,
                packetsLost: stat.packetsLost || 0,
                jitter: stat.jitter || 0,
              }));
            }
          }

          prevBytesRef.current = bytes;
          prevTimestampRef.current = now;
        }

        // 取得 track 解析度
        if (stat.type === 'track' && stat.kind === 'video') {
          if (mountedRef.current) {
            setStats((prev) => ({
              ...prev,
              resolution: {
                width: stat.frameWidth || prev.resolution.width,
                height: stat.frameHeight || prev.resolution.height,
              },
            }));
          }
        }
      });
    } catch (err) {
      console.warn('取得 WebRTC 統計失敗:', err);
    }
  }, []);

  /**
   * 啟動統計輪詢
   */
  const startStatsPolling = useCallback(() => {
    // 清除舊的計時器
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
    }
    statsTimerRef.current = setInterval(pollStats, STATS_INTERVAL);
  }, [pollStats]);

  /**
   * 建立 RTCPeerConnection 並設定事件處理
   */
  const createPeerConnection = useCallback(() => {
    // 清除先前的連線
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    // 監聽連線狀態變更
    pc.onconnectionstatechange = () => {
      if (mountedRef.current) {
        setConnectionState(pc.connectionState);
      }

      if (pc.connectionState === 'connected') {
        startStatsPolling();
      }

      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected'
      ) {
        if (mountedRef.current) {
          setError(`連線狀態: ${pc.connectionState}`);
        }
      }
    };

    // ICE 候選事件 — 傳送至遠端
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignaling({
          type: 'ice_candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // ICE 連線狀態
    pc.oniceconnectionstatechange = () => {
      if (mountedRef.current) {
        setConnectionState(pc.iceConnectionState);
      }
    };

    // 接收遠端媒體軌道
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream && mountedRef.current) {
        setRemoteStream(stream);
      }
    };

    return pc;
  }, [sendSignaling, startStatsPolling]);

  /**
   * 處理收到的 offer，建立 answer
   */
  const handleOffer = useCallback(
    async (offer) => {
      try {
        const pc = createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // 建立 answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // 透過信令傳送 answer
        sendSignaling({
          type: 'answer',
          sdp: answer,
        });
      } catch (err) {
        console.error('處理 offer 失敗:', err);
        if (mountedRef.current) {
          setError(`處理 offer 失敗: ${err.message}`);
        }
      }
    },
    [createPeerConnection, sendSignaling]
  );

  /**
   * 處理收到的 ICE 候選
   */
  const handleIceCandidate = useCallback(async (candidate) => {
    try {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.warn('加入 ICE 候選失敗:', err);
    }
  }, []);

  // 監聽信令訊息
  useEffect(() => {
    const ws = signalingWs?.current;
    if (!ws || !roomId) return;

    /**
     * 處理信令訊息
     */
    const handleMessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // 過濾非本房間訊息
        if (message.roomId && message.roomId !== roomId) return;

        switch (message.type) {
          case 'offer':
            handleOffer(message.sdp);
            break;
          case 'ice_candidate':
            handleIceCandidate(message.candidate);
            break;
          case 'peer_joined':
            // 新對等端加入，可能需要重新協商
            break;
          case 'peer_left':
            // 對等端離開
            if (mountedRef.current) {
              setRemoteStream(null);
              setConnectionState('disconnected');
            }
            break;
          default:
            break;
        }
      } catch (err) {
        // 忽略非 JSON 訊息
      }
    };

    ws.addEventListener('message', handleMessage);

    // 加入房間
    sendSignaling({ type: 'join_room' });

    return () => {
      ws.removeEventListener('message', handleMessage);
      // 離開房間
      sendSignaling({ type: 'leave_room' });
    };
  }, [signalingWs, roomId, handleOffer, handleIceCandidate, sendSignaling]);

  // 清除資源
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      // 停止統計輪詢
      if (statsTimerRef.current) {
        clearInterval(statsTimerRef.current);
        statsTimerRef.current = null;
      }

      // 關閉 PeerConnection
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, []);

  return {
    remoteStream,
    connectionState,
    stats,
    error,
  };
}

export default useWebRTC;
