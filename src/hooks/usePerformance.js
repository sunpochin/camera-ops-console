import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * FPS 歷史記錄長度
 */
const FPS_HISTORY_SIZE = 60;

/**
 * DOM 節點輪詢間隔（毫秒）
 */
const DOM_POLL_INTERVAL = 5000;

/**
 * 效能監控 Hook
 * 追蹤 FPS、記憶體使用量、DOM 節點數、長任務
 *
 * @returns {{ fps, avgFps, memoryUsage, domNodes, longTasks, fpsHistory }}
 */
export function usePerformance() {
  const [fps, setFps] = useState(0);
  const [avgFps, setAvgFps] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(null);
  const [domNodes, setDomNodes] = useState(0);
  const [longTasks, setLongTasks] = useState(0);
  const [fpsHistory, setFpsHistory] = useState(
    () => new Array(FPS_HISTORY_SIZE).fill(0)
  );

  // 內部參考
  const rafRef = useRef(null);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const domTimerRef = useRef(null);
  const observerRef = useRef(null);
  const mountedRef = useRef(true);

  /**
   * 更新 FPS 歷史與滾動平均
   */
  const updateFpsHistory = useCallback((currentFps) => {
    setFpsHistory((prev) => {
      const next = [...prev.slice(1), currentFps];
      // 計算滾動平均（排除 0 值）
      const nonZero = next.filter((v) => v > 0);
      const avg =
        nonZero.length > 0
          ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length)
          : 0;
      if (mountedRef.current) {
        setAvgFps(avg);
      }
      return next;
    });
  }, []);

  /**
   * FPS 計算迴圈
   * 每秒計算一次渲染幀數
   */
  const measureFps = useCallback(
    (now) => {
      frameCountRef.current++;

      const elapsed = now - lastTimeRef.current;

      // 每秒更新一次
      if (elapsed >= 1000) {
        const currentFps = Math.round(
          (frameCountRef.current * 1000) / elapsed
        );
        if (mountedRef.current) {
          setFps(currentFps);
          updateFpsHistory(currentFps);
        }
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafRef.current = requestAnimationFrame(measureFps);
    },
    [updateFpsHistory]
  );

  /**
   * 取得記憶體使用量（僅 Chrome 支援）
   */
  const pollMemory = useCallback(() => {
    if (performance.memory) {
      return {
        // 已使用的 JS 堆疊大小（MB）
        usedJSHeapSize: Math.round(
          performance.memory.usedJSHeapSize / 1048576
        ),
        // JS 堆疊總大小（MB）
        totalJSHeapSize: Math.round(
          performance.memory.totalJSHeapSize / 1048576
        ),
        // JS 堆疊大小上限（MB）
        jsHeapSizeLimit: Math.round(
          performance.memory.jsHeapSizeLimit / 1048576
        ),
      };
    }
    return null;
  }, []);

  /**
   * 輪詢 DOM 節點數
   */
  const pollDomNodes = useCallback(() => {
    if (mountedRef.current) {
      const count = document.querySelectorAll('*').length;
      setDomNodes(count);

      // 同時更新記憶體
      const mem = pollMemory();
      if (mem) {
        setMemoryUsage(mem);
      }
    }
  }, [pollMemory]);

  // 啟動 FPS 監測
  useEffect(() => {
    mountedRef.current = true;
    lastTimeRef.current = performance.now();
    frameCountRef.current = 0;
    rafRef.current = requestAnimationFrame(measureFps);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [measureFps]);

  // 啟動 DOM 節點輪詢
  useEffect(() => {
    // 立即執行一次
    pollDomNodes();
    domTimerRef.current = setInterval(pollDomNodes, DOM_POLL_INTERVAL);

    return () => {
      if (domTimerRef.current) {
        clearInterval(domTimerRef.current);
        domTimerRef.current = null;
      }
    };
  }, [pollDomNodes]);

  // 啟動長任務觀察器
  useEffect(() => {
    // 檢查 PerformanceObserver 是否支援 longtask
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const supported = PerformanceObserver.supportedEntryTypes;
        if (supported && supported.includes('longtask')) {
          observerRef.current = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (mountedRef.current && entries.length > 0) {
              setLongTasks((prev) => prev + entries.length);
            }
          });
          observerRef.current.observe({ entryTypes: ['longtask'] });
        }
      } catch (err) {
        // 瀏覽器不支援 longtask 觀察
        console.warn('Long Task 觀察器不可用:', err);
      }
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  // 卸載標記
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    fps,
    avgFps,
    memoryUsage,
    domNodes,
    longTasks,
    fpsHistory,
  };
}

export default usePerformance;
