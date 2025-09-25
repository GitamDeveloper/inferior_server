const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

console.log(`Signaling server запущен на ws://0.0.0.0:${PORT}`);

const rooms = {}; // { roomId: { users: [] } }

server.on("connection", (ws) => {
  let currentRoom = null;

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    switch (data.action) {
      case "createRoom":
        // Сервер генерирует уникальный UUID
        const roomId = uuidv4();
        rooms[roomId] = { users: [] };
        currentRoom = roomId;
        rooms[roomId].users.push(ws);

        ws.send(JSON.stringify({ event: "roomCreated", roomId }));
        console.log(`[ROOM] Создана новая комната: ${roomId}`);
        break;

      case "joinRoom":
        const joinId = data.roomId;
        if (!rooms[joinId]) {
          ws.send(JSON.stringify({ event: "error", msg: "Room does not exist" }));
          return;
        }

        currentRoom = joinId;
        rooms[joinId].users.push(ws);
        ws.send(JSON.stringify({ event: "joined", roomId: joinId }));
        console.log(`[ROOM] Пользователь присоединился к комнате: ${joinId}`);
        break;

      case "chat":
        if (!currentRoom) return;
        // Рассылаем сообщение всем пользователям в комнате
        rooms[currentRoom].users.forEach((user) => {
          if (user !== ws) {
            user.send(JSON.stringify({ event: "chat", text: data.text }));
          }
        });
        break;
    }
  });

  ws.on("close", () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].users = rooms[currentRoom].users.filter((u) => u !== ws);
      if (rooms[currentRoom].users.length === 0) {
        delete rooms[currentRoom];
        console.log(`[ROOM] Комната ${currentRoom} удалена`);
      }
    }
  });
});
