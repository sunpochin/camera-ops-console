import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 攝影機存取 Hook
 * 管理 getUserMedia、裝置列舉、攝影機切換與串流控制
 *
 * @returns {{ stream, devices, activeDevice, switchCamera, startCamera, stopCamera, error, isLoading }}
 */
export function useCamera() {
  const [stream, setStream] = useState(null);
  // 可用的視訊輸入裝置清單
  const [devices, setDevices] = useState([]);
  // 目前使用的裝置 ID
  const [activeDevice, setActiveDevice] = useState(null);
  // 錯誤訊息
  const [error, setError] = useState(null);
  // 載入狀態
  const [isLoading, setIsLoading] = useState(false);
  
  // 追蹤目前的媒體串流以便清理
  const streamRef = useRef(null);

  /**
   * 列舉所有視訊輸入裝置
   */
  const enumerateVideoDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      // 僅過濾視訊輸入裝置
      const videoDevices = allDevices.filter(
        (device) => device.kind === 'videoinput'
      );
      setDevices(videoDevices);
      return videoDevices;
    } catch (err) {
      console.error('列舉裝置失敗:', err);
      setError('無法列舉裝置');
      return [];
    }
  }, []);

  /**
   * 啟動指定裝置的視訊串流
   * @param {string|null} deviceId - 指定裝置 ID，null 為預設
   */
  const startCamera = useCallback(async (deviceId = null) => {
    setIsLoading(true);
    setError(null);

    // 停止先前的串流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      // 建立媒體約束條件
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: 'environment' }, // 預設使用後鏡頭
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);

      // 取得實際使用的裝置 ID
      const videoTrack = mediaStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      setActiveDevice(settings.deviceId || deviceId);

      // 取得權限後重新列舉（可獲得裝置標籤）
      await enumerateVideoDevices();
    } catch (err) {
      const errorMessages = {
        NotAllowedError: '攝影機存取被拒絕，請授予權限',
        NotFoundError: '找不到攝影機裝置',
        NotReadableError: '攝影機正被其他應用程式使用',
        OverconstrainedError: '無法滿足指定的攝影機條件',
        AbortError: '攝影機存取被中止',
        SecurityError: '安全性限制，需使用 HTTPS',
      };
      const message = errorMessages[err.name] || `攝影機錯誤: ${err.message}`;
      setError(message);
      console.error('攝影機存取錯誤:', err);
    } finally {
      setIsLoading(false);
    }
  }, [enumerateVideoDevices]);

  /**
   * 停止攝影機
   */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  /**
   * 切換到指定裝置
   * @param {string} deviceId - 目標裝置 ID
   */
  const switchCamera = useCallback(
    async (deviceId) => {
      if (deviceId === activeDevice) return;
      await startCamera(deviceId);
    },
    [activeDevice, startCamera]
  );

  // 初始化：列舉裝置並啟動預設串流
  useEffect(() => {
    startCamera();

    // 監聽裝置變更（插拔攝影機）
    const handleDeviceChange = () => {
      enumerateVideoDevices();
    };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    // 清除：停止所有媒體軌道
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        handleDeviceChange
      );
    };
  }, [enumerateVideoDevices, startCamera]);

  return {
    stream,
    devices,
    activeDevice,
    switchCamera,
    startCamera,
    stopCamera,
    error,
    isLoading,
  };
}

export default useCamera;
