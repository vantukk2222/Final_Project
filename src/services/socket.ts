// src/services/socket.ts
import { io, Socket } from "socket.io-client";

const socket: Socket = io("http://localhost:3000", {
  transports: ["websocket"],
  autoConnect: false,
});

export default socket;
