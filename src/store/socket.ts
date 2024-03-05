import { Socket, io } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (isDev = true): Socket => {
    if (socket == null) socket = io(`${isDev ? 'ws://localhost:7000' : 'ws://124.221.116.109:7000'}`);
    return socket;
}
