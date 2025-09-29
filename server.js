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

function room_has_user(room, ws) {
  let result = false
  rooms[room].users.forEach((user) => {
    if (user == ws) {
      result = true
    }
  });
  return result
}

server.on("connection", (ws) => {
  let current_room = null;
  let current_nickname = "anonymous"

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    console.log(data)

    switch (data.event) {
      case "create_room_request":
        const room_id = uuidv4();
        rooms[room_id] = { users: [] };
        rooms[room_id].users.push(ws);

        current_room = room_id

        ws_message(ws, { event: "create_room_response", room_id: room_id, status: true })
        console.log("created room " + room_id);
        break;

      case "join_room_request":
        const join_id = data.room_id;
        if (!rooms[join_id]) {
          ws_message(ws, { event: "join_room_response", room_id: join_id, status: false})
          return;
        }

        rooms[join_id].users.push(ws);

        rooms[join_id].users.forEach((user) => {
          if (user !== ws) {
            ws_message(user, { event: "user_joined_room", room_id: join_id, user_nickname: current_nickname})
          }
        });

        current_room = join_id

        ws_message(ws, { event: "join_room_response", room_id: join_id, status: true})
        console.log("joined room " + join_id);
        
        break;
      case "send_msg_request":

        let send_to_id = data.room_id
        let sended_msg = data.msg

        console.log(rooms)
        
        if (!rooms[send_to_id] || !room_has_user(send_to_id, ws)) {
          ws_message(ws, {event: "send_msg_response", status: false})
          return
        }

        rooms[send_to_id].users.forEach((user) => {
          if (user !== ws) {
            ws_message(user, { event: "user_send_msg", room_id: send_to_id, user_nickname: current_nickname, msg: sended_msg})
          }
        });
        break
      case "leave_room_request":
        let leave_room = data.room_id

        if (!rooms[leave_room] || !room_has_user(leave_room, ws)) {
          ws_message(ws, {event: "leave_room_response", status: false})
          return
        }

        rooms[leave_room].users = rooms[leave_room].users.filter(user => user !== ws);

        rooms[leave_room].users.forEach((user) => {
          if (user !== ws) {
            ws_message(user, { event: "user_leaved_room", room_id: leave_room, user_nickname: current_nickname})
          }
        });

        if (leave_room.users.length == 0) {
          delete rooms[leave_room]
          console.log("deleted room " + leave_room)
        }

        break
      case "set_current_nickname_request":
        let new_nickname = data.user_nickname

        if (new_nickname && new_nickname!= "" && new_nickname.length < 10) {
          current_nickname = new_nickname
          ws_message(ws, {event: "set_current_nickname_response", status: true})
        }else{
          ws_message(ws, {event: "set_current_nickname_response", status: false})
        }

        break

    }
  });

  ws.on("close", () => {

    if (!rooms[current_room] || !room_has_user(current_room, ws)) {
      return
    }

    rooms[current_room].users = rooms[current_room].users.filter(user => user !== ws);

    rooms[current_room].users.forEach((user) => {
      if (user !== ws) {
        ws_message(user, { event: "user_leaved_room", room_id: current_room, user_nickname: current_nickname })
      }
    });

    if (current_room.users.length == 0) {
      delete rooms[current_room]
      console.log("deleted room " + current_room)
    }

  });
});
