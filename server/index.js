// Camera Ops Console — 後端主伺服器
// Express REST API + WebSocket 伺服器 + WebRTC 信令

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { setupSignaling, getRoomsSummary } from './signaling.js';

// ── 設定 ──────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = 'http://localhost:5173';
const STATUS_BROADCAST_INTERVAL = 3000; // 每 3 秒廣播裝置狀態

// ── 裝置清單（硬編碼） ──────────────────────────────
const devices = [
  {
    id: 'usb-cam-1',
    name: 'Logitech USB Camera',
    model: 'UVC Camera VendorID_1133 ProductID_2075',
    uniqueId: '0x1140000046d081b',
    type: 'usb',
    status: 'online',
    resolution: '1920x1080',
    fps: 30,
  },
  {
    id: 'iphone-cam-1',
    name: "Pochin's iPhone",
    model: 'iPhone18,5',
    uniqueId: 'FB7C63C1-7BAD-48C8-8AC7-747200000001',
    type: 'webrtc',
    status: 'offline',
    resolution: '1920x1080',
    fps: 30,
  },
];

// ── 警報儲存（記憶體中） ─────────────────────────────
const alerts = [];
const MAX_ALERTS = 100; // 最多保留 100 筆警報

// ── Express 應用程式 ─────────────────────────────────
const app = express();
app.use(express.json());

// CORS 中介層
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// 提供 mobile 靜態頁面
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use('/mobile', express.static(join(__dirname, '..', 'mobile')));

// ── REST API 路由 ────────────────────────────────────

// 取得所有裝置
app.get('/api/devices', (req, res) => {
  res.json({
    success: true,
    data: devices,
    total: devices.length,
  });
});

// 取得單一裝置
app.get('/api/devices/:id', (req, res) => {
  const device = devices.find((d) => d.id === req.params.id);
  if (!device) {
    return res.status(404).json({
      success: false,
      error: '找不到指定裝置',
    });
  }
  res.json({
    success: true,
    data: device,
  });
});

// 觸發快照（模擬回應）
app.post('/api/devices/:id/snapshot', (req, res) => {
  const device = devices.find((d) => d.id === req.params.id);
  if (!device) {
    return res.status(404).json({
      success: false,
      error: '找不到指定裝置',
    });
  }
  if (device.status !== 'online') {
    return res.status(400).json({
      success: false,
      error: '裝置目前離線，無法擷取快照',
    });
  }

  // 模擬快照回應
  const snapshot = {
    deviceId: device.id,
    timestamp: new Date().toISOString(),
    filename: `snapshot_${device.id}_${Date.now()}.jpg`,
    resolution: device.resolution,
    size: Math.floor(Math.random() * 500000) + 100000, // 隨機檔案大小
    url: `/snapshots/snapshot_${device.id}_${Date.now()}.jpg`,
  };

  res.json({
    success: true,
    data: snapshot,
  });
});

// 取得警報清單
app.get('/api/alerts', (req, res) => {
  // 支援 limit 參數
  const limit = parseInt(req.query.limit) || 50;
  const recent = alerts.slice(-limit).reverse(); // 最新的在前

  res.json({
    success: true,
    data: recent,
    total: alerts.length,
  });
});

// 新增警報
app.post('/api/alerts', (req, res) => {
  const { level, message, deviceId } = req.body;

  if (!message) {
    return res.status(400).json({
      success: false,
      error: '缺少 message 欄位',
    });
  }

  const alert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    level: level || 'info', // info / warning / error / critical
    message,
    deviceId: deviceId || null,
    timestamp: new Date().toISOString(),
    acknowledged: false,
  };

  alerts.push(alert);

  // 超出上限時移除最舊的
  if (alerts.length > MAX_ALERTS) {
    alerts.splice(0, alerts.length - MAX_ALERTS);
  }

  // 透過 WebSocket 廣播給所有客戶端
  broadcastToAll({
    type: 'alert',
    data: alert,
  });

  res.status(201).json({
    success: true,
    data: alert,
  });
});

// 取得房間狀態（除錯用）
app.get('/api/rooms', (req, res) => {
  res.json({
    success: true,
    data: getRoomsSummary(),
  });
});

// 健康檢查端點
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    connections: wss.clients.size,
  });
});

// ── HTTP + WebSocket 伺服器 ──────────────────────────
const server = createServer(app);
const wss = new WebSocketServer({ server });

// ── WebSocket 訊息處理 ──────────────────────────────
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WS] 新連線: ${clientIp}，目前連線數: ${wss.clients.size}`);

  // 連線時傳送歡迎訊息
  ws.send(JSON.stringify({
    type: 'welcome',
    data: {
      message: 'Camera Ops Console 已連線',
      timestamp: new Date().toISOString(),
    },
  }));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: '無效的 JSON 格式' },
      }));
      return;
    }

    // 信令相關訊息由 signaling 模組處理
    const signalingTypes = ['join_room', 'offer', 'answer', 'ice_candidate', 'leave_room'];
    if (signalingTypes.includes(msg.type)) {
      return; // 已由 setupSignaling 處理
    }

    // 處理一般 WebSocket 訊息
    switch (msg.type) {
      case 'ptz_command':
        handlePtzCommand(ws, msg);
        break;

      case 'alert':
        handleAlert(ws, msg);
        break;

      case 'device_status':
        handleDeviceStatus(ws, msg);
        break;

      case 'heartbeat':
        handleHeartbeat(ws);
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: `未知的訊息類型: ${msg.type}` },
        }));
    }
  });

  ws.on('close', () => {
    console.log(`[WS] 連線斷開，剩餘連線數: ${wss.clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[WS] 連線錯誤:', err.message);
  });
});

// ── PTZ 控制處理 ─────────────────────────────────────
function handlePtzCommand(ws, msg) {
  const { deviceId, action, value } = msg.data || {};

  if (!deviceId || !action) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'PTZ 指令缺少 deviceId 或 action' },
    }));
    return;
  }

  const device = devices.find((d) => d.id === deviceId);
  if (!device) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: `找不到裝置: ${deviceId}` },
    }));
    return;
  }

  console.log(`[PTZ] 裝置=${deviceId} 動作=${action} 數值=${JSON.stringify(value)}`);

  // 回傳確認
  ws.send(JSON.stringify({
    type: 'ptz_ack',
    data: {
      deviceId,
      action,
      value,
      timestamp: new Date().toISOString(),
      status: 'executed',
    },
  }));
}

// ── 警報處理 ─────────────────────────────────────────
function handleAlert(ws, msg) {
  const { level, message, deviceId } = msg.data || {};

  const alert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    level: level || 'info',
    message: message || '未知警報',
    deviceId: deviceId || null,
    timestamp: new Date().toISOString(),
    acknowledged: false,
  };

  alerts.push(alert);
  if (alerts.length > MAX_ALERTS) {
    alerts.splice(0, alerts.length - MAX_ALERTS);
  }

  // 廣播給所有客戶端
  broadcastToAll({
    type: 'alert',
    data: alert,
  });
}

// ── 裝置狀態處理 ─────────────────────────────────────
function handleDeviceStatus(ws, msg) {
  const { deviceId, status } = msg.data || {};

  if (deviceId && status) {
    const device = devices.find((d) => d.id === deviceId);
    if (device) {
      device.status = status;
      console.log(`[狀態] 裝置 ${deviceId} 狀態更新為 ${status}`);
    }
  }

  // 回傳全部裝置的最新狀態
  ws.send(JSON.stringify({
    type: 'device_status',
    data: devices,
  }));
}

// ── 心跳回應 ─────────────────────────────────────────
function handleHeartbeat(ws) {
  ws.send(JSON.stringify({
    type: 'heartbeat_ack',
    data: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  }));
}

// ── 廣播工具函式 ─────────────────────────────────────
function broadcastToAll(message) {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(payload);
    }
  }
}

// ── 定時廣播裝置狀態 ─────────────────────────────────
setInterval(() => {
  broadcastToAll({
    type: 'device_status',
    data: devices,
    timestamp: new Date().toISOString(),
  });
}, STATUS_BROADCAST_INTERVAL);

// ── 註冊信令模組 ─────────────────────────────────────
setupSignaling(wss, { devices });

// ── 啟動伺服器 ───────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🎥 Camera Ops Console 後端伺服器`);
  console.log(`   REST API:  http://localhost:${PORT}/api`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   行動版:    http://localhost:${PORT}/mobile\n`);
});

// 優雅關閉
const gracefulShutdown = (signal) => {
  console.log(`[伺服器] 收到 ${signal}，正在關閉...`);
  
  // 設定 500ms 安全時間，時間到不管連線是否斷開都強制退出，避免 Ctrl+C 塞車
  setTimeout(() => {
    console.log('[伺服器] 已強制關閉');
    process.exit(0);
  }, 500);

  try {
    wss.close();
    server.close(() => {
      console.log('[伺服器] 已優雅關閉');
      process.exit(0);
    });
  } catch (err) {
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
