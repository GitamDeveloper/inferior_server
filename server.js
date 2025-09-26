const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

console.log("running on ws://0.0.0.0:${PORT}");

const rooms = {}; // { roomId: { users: [] } }

function ws_message(ws, obj) {
  let obj_json = JSON.stringify(obj);
  ws.send(obj_json);
}

server.on("connection", (ws) => {
  let current_room = null;
  let current_nickname = "notreal"

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    console.log(data)

    switch (data.event) {
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
          ws_message(ws, { event: "join_room_response", room_id: join_id, state: false})
          return;
        }

        rooms[join_id].users.push(ws.id);

        rooms[join_id].users.forEach((user) => {
          if (user !== ws) {
            ws_message(user, { event: "user_joined_room", room_id: join_id, user_nickname: current_nickname})
          }
        });

        current_room = join_id

        ws_message(ws, { event: "join_room_response", room_id: join_id, state: true})
        console.log("joined room " + join_id);
        
        break;
      case "send_msg_request":

        let send_to_id = data.room_id
        let sended_msg = data.msg

        console.log(rooms)
        
        if (!rooms[send_to_id] || !rooms[send_to_id].users[ws.id]) {
          ws_message(ws, {event: "send_msg_response", state: false})
          return
        }

        rooms[send_to_id].users.forEach((user) => {
          if (user !== ws) {
            ws_message(user, { event: "user_send_msg", room_id: join_id, user_nickname: current_nickname, msg: sended_msg})
          }
        });
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
