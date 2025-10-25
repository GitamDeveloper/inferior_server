const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

console.log(`running on ws://0.0.0.0:${PORT}`);

const rooms = {}; // { roomId: { users: [], call: { active: false, users: [], audio_buffers: {} } } }

function ws_message(ws, obj) {
  ws.send(JSON.stringify(obj));
}

function room_has_user(room, ws) {
  return rooms[room]?.users.includes(ws);
}

function room_call_has_user(room, ws) {
  return rooms[room]?.call?.users.includes(ws);
}

server.on("connection", (ws) => {
  let current_room = null;
  let current_nickname = "anonymous";

  function leaveRoom(ws, room) {
    if (!rooms[room] || !room_has_user(room, ws)) return;
    rooms[room].users = rooms[room].users.filter(u => u !== ws);

    rooms[room].users.forEach(u => {
      ws_message(u, { event: "user_leaved_room", user_nickname: current_nickname });
    });

    // leave call if in
    if (rooms[room].call) {
      rooms[room].call.users = rooms[room].call.users.filter(u => u !== ws);
      rooms[room].call.users.forEach(u => {
        ws_message(u, { event: "user_left_call", user_nickname: current_nickname });
      });
    }

    if (rooms[room].users.length === 0) delete rooms[room];
    current_room = null;
  }

  ws.on("message", (message) => {
    const data = JSON.parse(message.toString());

    switch(data.event){
      case "create_room_request":
        leaveRoom(ws, current_room);
        const room_id = uuidv4();
        rooms[room_id] = { users: [ws], call: { active: false, users: [], audio_buffers: {} } };
        current_room = room_id;
        ws_message(ws, { event: "create_room_response", room_id, status: true });
        break;

      case "join_room_request":
        if (!rooms[data.room_id] || room_has_user(data.room_id, ws)) {
          ws_message(ws, { event: "join_room_response", status: false });
          return;
        }
        leaveRoom(ws, current_room);
        rooms[data.room_id].users.push(ws);
        rooms[data.room_id].users.forEach(u => {
          if (u !== ws) ws_message(u, { event: "user_joined_room", user_nickname: current_nickname });
        });
        current_room = data.room_id;
        ws_message(ws, { event: "join_room_response", room_id: data.room_id, status: true });
        break;

      case "send_msg_request":
        if (!rooms[data.room_id] || !room_has_user(data.room_id, ws)) return;
        rooms[data.room_id].users.forEach(u => {
          if (u !== ws) ws_message(u, { event: "user_send_msg", user_nickname: current_nickname, msg: data.msg });
        });
        break;

      case "leave_room_request":
        leaveRoom(ws, data.room_id);
        ws_message(ws, { event: "leave_room_response", status: true });
        break;

      case "set_current_nickname_request":
        if (data.user_nickname && data.user_nickname.length < 20) {
          current_nickname = data.user_nickname;
          ws_message(ws, { event: "set_current_nickname_response", status: true });
        } else ws_message(ws, { event: "set_current_nickname_response", status: false });
        break;

      // Call events
      case "join_room_call_request":
        if (!rooms[data.room_id] || !room_has_user(data.room_id, ws) || room_call_has_user(data.room_id, ws)) {
          ws_message(ws, { event: "join_room_call_response", status: false });
          return;
        }
        if (!rooms[data.room_id].call.active) rooms[data.room_id].call.active = true;
        rooms[data.room_id].call.users.push(ws);
        rooms[data.room_id].call.users.forEach(u => {
          if (u !== ws) ws_message(u, { event: "user_joined_room_call", user_nickname: current_nickname });
        });
        ws_message(ws, { event: "join_room_call_response", status: true });
        break;

      case "leave_room_call_request":
        if (!rooms[data.room_id] || !room_call_has_user(data.room_id, ws)) return;
        rooms[data.room_id].call.users = rooms[data.room_id].call.users.filter(u => u !== ws);
        rooms[data.room_id].call.users.forEach(u => {
          ws_message(u, { event: "user_left_call", user_nickname: current_nickname });
        });
        break;

      case "send_audio_chunk":
        if (!rooms[data.room_id] || !room_call_has_user(data.room_id, ws)) return;
        rooms[data.room_id].call.users.forEach(u => {
          if (u !== ws) ws_message(u, { event: "receive_audio_chunk", user_id: current_nickname, chunk: data.chunk });
        });
        break;
    }
  });

  ws.on("close", () => {
    leaveRoom(ws, current_room);
  });
});
