// WebRTC 信令模組 — 處理房間管理與 SDP/ICE 中繼

// 房間 → 已連線的 WebSocket 集合
const rooms = new Map();

// 對外暴露的裝置狀態參照（由主伺服器注入）
let devicesRef = null;

/**
 * 設定信令處理邏輯
 * @param {import('ws').WebSocketServer} wss - WebSocket 伺服器實例
 * @param {object} options - 設定選項
 * @param {Array} options.devices - 裝置清單參照，用於更新上線狀態
 */
function setupSignaling(wss, options = {}) {
  devicesRef = options.devices || null;

  wss.on('connection', (ws) => {
    // 追蹤此連線目前加入的房間
    ws.currentRoom = null;
    ws.peerId = null;

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return; // 無效 JSON，忽略
      }

      switch (msg.type) {
        case 'join_room':
          handleJoinRoom(ws, msg);
          break;
        case 'offer':
          relayToRoom(ws, msg);
          break;
        case 'answer':
          relayToRoom(ws, msg);
          break;
        case 'ice_candidate':
          relayToRoom(ws, msg);
          break;
        case 'leave_room':
          handleLeaveRoom(ws);
          break;
        default:
          break; // 非信令訊息，交由主伺服器處理
      }
    });

    ws.on('close', () => {
      // 斷線時自動離開房間
      handleLeaveRoom(ws);
    });
  });
}

/**
 * 處理加入房間
 */
function handleJoinRoom(ws, msg) {
  const roomId = msg.roomId;
  const peerId = msg.peerId || generatePeerId();

  // 若已在其他房間，先離開
  if (ws.currentRoom) {
    handleLeaveRoom(ws);
  }

  ws.currentRoom = roomId;
  ws.peerId = peerId;

  // 建立或取得房間
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  const room = rooms.get(roomId);
  room.add(ws);

  // 若加入 camera-stream 房間，更新 iPhone 裝置狀態為上線
  if (roomId === 'camera-stream' && devicesRef) {
    updateDeviceStatus('iphone-cam-1', 'online');
  }

  // 通知房間內其他成員
  const peerIds = [];
  for (const peer of room) {
    if (peer !== ws && peer.readyState === 1) {
      peerIds.push(peer.peerId);
      peer.send(JSON.stringify({
        type: 'peer_joined',
        peerId,
        roomId,
      }));
    }
  }

  // 回傳目前房間成員列表給新加入的 peer
  ws.send(JSON.stringify({
    type: 'room_joined',
    roomId,
    peerId,
    peers: peerIds,
  }));

  console.log(`[信令] peer ${peerId} 加入房間 ${roomId}，目前人數: ${room.size}`);
}

/**
 * 處理離開房間
 */
function handleLeaveRoom(ws) {
  const roomId = ws.currentRoom;
  const peerId = ws.peerId;

  if (!roomId || !rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  room.delete(ws);

  // 通知其他成員
  for (const peer of room) {
    if (peer.readyState === 1) {
      peer.send(JSON.stringify({
        type: 'peer_left',
        peerId,
        roomId,
      }));
    }
  }

  // 房間清空時移除
  if (room.size === 0) {
    rooms.delete(roomId);
  }

  // 若離開 camera-stream 房間，更新 iPhone 裝置狀態為離線
  if (roomId === 'camera-stream' && devicesRef) {
    // 只在沒有其他 peer 時才設為離線
    const remaining = rooms.get(roomId);
    if (!remaining || remaining.size === 0) {
      updateDeviceStatus('iphone-cam-1', 'offline');
    }
  }

  console.log(`[信令] peer ${peerId} 離開房間 ${roomId}`);

  ws.currentRoom = null;
  ws.peerId = null;
}

/**
 * 將訊息轉發給同房間的其他 peer
 */
function relayToRoom(ws, msg) {
  const roomId = ws.currentRoom;
  if (!roomId || !rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  const payload = JSON.stringify({
    ...msg,
    from: ws.peerId,
  });

  // 若有指定目標 peer，則僅轉發給該 peer
  if (msg.targetPeerId) {
    for (const peer of room) {
      if (peer.peerId === msg.targetPeerId && peer.readyState === 1) {
        peer.send(payload);
        return;
      }
    }
  }

  // 否則廣播給所有其他 peer
  for (const peer of room) {
    if (peer !== ws && peer.readyState === 1) {
      peer.send(payload);
    }
  }
}

/**
 * 更新裝置狀態
 */
function updateDeviceStatus(deviceId, status) {
  if (!devicesRef) return;
  const device = devicesRef.find((d) => d.id === deviceId);
  if (device) {
    device.status = status;
    console.log(`[信令] 裝置 ${deviceId} 狀態更新為 ${status}`);
  }
}

/**
 * 產生隨機 peer ID
 */
function generatePeerId() {
  return `peer-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * 取得目前所有房間的狀態摘要
 */
function getRoomsSummary() {
  const summary = {};
  for (const [roomId, peers] of rooms) {
    summary[roomId] = {
      peerCount: peers.size,
      peerIds: [...peers].map((p) => p.peerId).filter(Boolean),
    };
  }
  return summary;
}

export { setupSignaling, getRoomsSummary };
