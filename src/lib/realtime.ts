import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "./api";
import { getAccessToken } from "./session";

/**
 * Socket.IO connection for live dashboard counters. Admin sockets join the backend's
 * `admins` room and receive `admin:counters` / `admin:activity`. Reconnects with the new
 * access token whenever the session is refreshed.
 */
let socket: Socket | null = null;

export function adminSocket(): Socket | null {
  const url = getApiBaseUrl();
  if (!url || !getAccessToken()) return null;
  if (!socket) {
    socket = io(url, {
      transports: ["websocket", "polling"],
      auth: (cb) => cb({ token: getAccessToken() }),
      reconnectionDelay: 2000,
    });
    // Token expired between reconnects: pick up the refreshed one
    window.addEventListener("rr-admin-token", () => {
      if (socket && !socket.connected) socket.connect();
    });
  }
  return socket;
}

export function closeAdminSocket() {
  socket?.disconnect();
  socket = null;
}
