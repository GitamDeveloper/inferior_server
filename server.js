const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const { json } = require("body-parser");
const { use } = require("react");

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

console.log("running on ws://0.0.0.0:${PORT}");

const rooms = {}; // { roomId: { users: [] } }

function ws_message(ws, obj) {
  let json = json.stringify(obj);
  ws.send(json);
}

server.on("connection", (ws) => {
  let current_room = null;

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    switch (data.action) {
      case "create_room_request":
        const room_id = uuidv4();
        rooms[room_id] = { users: [] };
        rooms[room_id].users.push(ws);

        current_room = room_id

        ws_message(ws, { event: "create_room_response", room_id: room_id, state: true })
        console.log("created room " + room_id);
        break;

      case "join_room_request":
        const join_id = data.room_id;
        if (!rooms[join_id]) {
          ws_message(ws, { event: "join_room_response", room_id: room_id, state: false})
          return;
        }

        rooms[room_id].users.push(ws);

        rooms[room_id].users.forEach((user) => {
          if (user !== ws) {
            ws_message(user, { event: "user_joined_room", room_id: room_id})
          }
        });

        current_room = room_id

        ws_message(ws, { event: "join_room_response", room_id: room_id, state: true})
        console.log("joined room " + room_id);
        
        break;
    }
  });

  ws.on("close", () => {
    if (current_room && rooms[current_room]) {
      let users = rooms[current_room].users
      if (users.length === 0) {
        delete rooms[current_room];

        console.log("deleted room " + current_room)
      }
    }
  });
});
