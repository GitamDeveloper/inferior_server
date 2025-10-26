const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

console.log(`running on ws://0.0.0.0:${PORT}`);

const rooms = {}; // { roomId: { users: [], call: { active: false, users: [] } } }

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

function room_call_has_user(room, ws) {
  let result = false
  rooms[room].call.users.forEach((user) => {
    if (user == ws) {
      result = true
    }
  });
  return result
}

server.on("connection", (ws) => {
  let current_room = null;
  let current_nickname = "anonymous"

  function room_call_user_leave(ws, room) {
    let leave_room = room

    if (!rooms[leave_room] || !room_has_user(leave_room, ws) || !room_call_has_user(leave_room, ws)) {
      // ws_message(ws, { event: "leave_room_call_response", status: false })
      return
    }

    rooms[leave_room].call.users = rooms[leave_room].call.users.filter(user => user !== ws);

    rooms[leave_room].users.forEach((user) => {
      if (user !== ws) {
        ws_message(user, { event: "user_leaved_room_call", room_id: leave_room, user_nickname: current_nickname })
      }
    });

    if (rooms[leave_room].call.users.length == 0) {
      rooms[leave_room].call.active = false;
      console.log("call ended " + leave_room);
    }
  }

  function room_user_leave(ws, room) {

    let leave_room = room

    if (!rooms[leave_room] || !room_has_user(leave_room, ws)) {
      // ws_message(ws, { event: "leave_room_response", status: false })
      return
    }

    room_call_user_leave(ws, room);
    rooms[leave_room].users = rooms[leave_room].users.filter(user => user !== ws);

    rooms[leave_room].users.forEach((user) => {
      if (user !== ws) {
        ws_message(user, { event: "user_leaved_room", room_id: leave_room, user_nickname: current_nickname })
      }
    });

    if (rooms[leave_room].users.length == 0) {
      delete rooms[leave_room]
      console.log("deleted room " + leave_room)
    }

    current_room = null
  }

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    console.log(data)
    console.log(rooms)

    switch (data.event) {
      case "create_room_request":

        room_user_leave(ws, current_room)

        const room_id = uuidv4();
        rooms[room_id] = { users: [], call: { active: false, users: [] } };
        rooms[room_id].users.push(ws);

        current_room = room_id

        ws_message(ws, { event: "create_room_response", room_id: room_id, status: true })
        console.log("created room " + room_id);
        break;
      case "join_room_request":
        const join_id = data.room_id;
        if (!rooms[join_id] || room_has_user(join_id, ws)) {
          ws_message(ws, { event: "join_room_response", room_id: join_id, status: false })
          return;
        }

        room_user_leave(ws, current_room)

        rooms[join_id].users.push(ws);

        rooms[join_id].users.forEach((user) => {
          if (user !== ws) {
            ws_message(user, { event: "user_joined_room", room_id: join_id, user_nickname: current_nickname })
          }
        });

        current_room = join_id

        ws_message(ws, { event: "join_room_response", room_id: join_id, status: true })

        ws_message(ws, { event: "set_room_call_data_request", room_id: join_id, data: rooms[join_id].call })

        console.log("joined room " + join_id);

        break;
      case "send_msg_request":

        let send_to_id = data.room_id
        let send_msg = data.msg

        console.log(rooms)

        if (!rooms[send_to_id] || !room_has_user(send_to_id, ws)) {
          ws_message(ws, { event: "send_msg_response", status: false })
          return
        }

        rooms[send_to_id].users.forEach((user) => {
          if (user !== ws) {
            ws_message(user, { event: "user_send_msg", room_id: send_to_id, user_nickname: current_nickname, msg: send_msg })
          }
        });
        break
      case "leave_room_request":
        let leave_room = data.room_id

        if (!rooms[leave_room] || !room_has_user(leave_room, ws)) {
          ws_message(ws, { event: "leave_room_response", status: false })
          return
        }

        room_call_user_leave(ws, leave_room);
        rooms[leave_room].users = rooms[leave_room].users.filter(user => user !== ws);

        rooms[leave_room].users.forEach((user) => {
          if (user !== ws) {
            ws_message(user, { event: "user_leaved_room", room_id: leave_room, user_nickname: current_nickname })
          }
        });

        if (rooms[leave_room].users.length == 0) {
          delete rooms[leave_room]
          console.log("deleted room " + leave_room)
        }

        ws_message(ws, { event: "leave_room_response", status: true })

        current_room = null

        break
      case "set_current_nickname_request":
        let new_nickname = data.user_nickname

        if (new_nickname && new_nickname != "" && new_nickname.length < 20) {
          current_nickname = new_nickname
          ws_message(ws, { event: "set_current_nickname_response", status: true })
        } else {
          ws_message(ws, { event: "set_current_nickname_response", status: false })
        }

        break
      case "join_room_call_request":

        let join_room = data.room_id

        if (!rooms[join_room] || !room_has_user(join_room, ws) || room_call_has_user(join_room, ws)) {
          ws_message(ws, { event: "join_room_call_response", status: false })
          return
        }

        rooms[join_room].call.active = true

        rooms[join_room].call.users.push(ws);

        rooms[join_room].users.forEach((user) => {

          ws_message(user, { event: "user_joined_room_call", room_id: join_room, user_nickname: current_nickname })
          
        });

        ws_message(ws, { event: "join_room_call_response", status: true, room_id: join_room })
        console.log("joined room call " + join_room)

        break
      case "get_room_data":

        let data_room = data.room_id

        if (!rooms[data_room] || !room_has_user(data_room, ws)) {
          ws_message(ws, { event: "get_room_data_response", status: false })
          return
        }

        let room_data = rooms[data_room]

        ws_message(ws, { event: "get_room_data_response", status: true, room_data: room_data })

        break
      case "leave_room_call_request":
        room_call_user_leave(ws, data.room_id);
        break
      case "send_room_call_voice_data_request":
        if (!rooms[data.room_id] || !room_has_user(data.room_id, ws) || !room_call_has_user(data.room_id, ws)) {
          ws_message(ws, { event: "end_room_call_voice_data_response", status: false })
          return
        }

        let voice_data = data.voice_data

        rooms[data.room_id].call.users.forEach((user) => {
          if (user !== ws) {
            ws_message(user, { event: "user_sended_room_call_voice_data", room_id: data.room_id, user_nickname: current_nickname, voice_data: voice_data})
          }
        });
        break
    }
  });

  ws.on("close", () => {
    room_user_leave(ws, current_room)
  });
});
