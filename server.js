const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let rooms = {};

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const data = JSON.parse(msg.toString());

    if (data.action === "join") {
      const { roomId } = data;
      if (!rooms[roomId]) rooms[roomId] = [];
      rooms[roomId].push(ws);

      console.log(`[ROOM] Клиент подключился в комнату ${roomId}`);
      ws.send(JSON.stringify({ event: "joined", roomId }));
    }

    if (data.action === "chat") {
      const { roomId, text } = data;
      if (!rooms[roomId]) return;

      rooms[roomId].forEach((client) => {
        if (client !== ws) {
          client.send(JSON.stringify({ event: "chat", text }));
        }
      });
    }
  });

  ws.on("close", () => {
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(c => c !== ws);
    }
  });
});

const PORT = process.env.PORT || 3000;  // Render назначит PORT автоматически

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server запущен на ws://0.0.0.0:${PORT}`);
});

