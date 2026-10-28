import type { Server, Socket } from "socket.io";
import { prisma } from "@sketchspace/db";
import {
  SOCKET_EVENTS,
  type JoinRoomPayload,
  type ActiveMember,
  type RoomStatePayload,
} from "@sketchspace/types";
import {
  getDoc,
  addObserver,
  removeObserver,
} from "../../services/ydoc.service";
import { enqueueSnapshot } from "../../jobs/snapShot.job";
import { assertRoomMember } from "../roomGuard";
import { AppError } from "../../middleware/error.middleware";
import * as Y from "yjs";

function userColor(userId: string): string {
  const palette = [
    "#e03131",
    "#2f9e44",
    "#1971c2",
    "#ae3ec9",
    "#f08c00",
    "#0c8599",
    "#d6336c",
    "#364fc7",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++)
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length]!;
}

export function registerPresenceHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;
  let joinAttempt = 0;
  socket.on(SOCKET_EVENTS.JOIN_ROOM, async (payload: JoinRoomPayload) => {
    const attempt = ++joinAttempt;
    try {
      const roomId = payload?.roomId;
      if (typeof roomId !== "string" || !roomId)
        throw new AppError(400, "BAD_REQUEST", "A room is required");
      const profile = await prisma.profile.findUnique({
        where: { clerkUserId: userId },
        select: { displayName: true, avatarUrl: true },
      });
      if (!profile)
        throw new AppError(
          404,
          "PROFILE_REQUIRED",
          "Complete your profile before joining",
        );
      const member = await assertRoomMember(userId, roomId);
      const doc = await getDoc(roomId);
      if (!socket.connected || attempt !== joinAttempt) return;
      if (socket.data.roomId && socket.data.roomId !== roomId)
        await handleLeave(io, socket, userId);
      await socket.join(roomId);
      socket.data.roomId = roomId;
      addObserver(roomId, socket.id);
      const roomState: RoomStatePayload = {
        roomId,
        update: Y.encodeStateAsUpdate(doc).buffer as ArrayBuffer,
        myRole: member.role,
        members: await activeMembers(io, roomId, userId),
      };
      socket.emit(SOCKET_EVENTS.ROOM_STATE, roomState);
      socket
        .to(roomId)
        .emit(SOCKET_EVENTS.USER_JOINED, {
          roomId,
          member: {
            userId,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            color: userColor(userId),
          },
        });
    } catch (error) {
      emitError(socket, error);
    }
  });
  socket.on(SOCKET_EVENTS.LEAVE_ROOM, () => {
    joinAttempt++;
    void handleLeave(io, socket, userId).catch((error) =>
      emitError(socket, error),
    );
  });
  socket.on("disconnect", () => {
    joinAttempt++;
    void handleLeave(io, socket, userId).catch((error) =>
      console.error("[presence] leave failed", error),
    );
  });
}

async function handleLeave(io: Server, socket: Socket, userId: string) {
  const roomId = socket.data.roomId as string | undefined;
  if (!roomId) return;
  delete socket.data.roomId;
  await socket.leave(roomId);
  removeObserver(roomId, socket.id);
  await enqueueSnapshot(roomId).catch((error) =>
    console.error("[presence] snapshot failed", error),
  );
  const others = await io.in(roomId).fetchSockets();
  if (!others.some((other) => other.data.userId === userId)) {
    io.to(roomId).emit(SOCKET_EVENTS.USER_LEFT, { roomId, userId });
  }
}
async function activeMembers(
  io: Server,
  roomId: string,
  excludeUserId: string,
): Promise<ActiveMember[]> {
  const sockets = await io.in(roomId).fetchSockets();
  const users = [
    ...new Set(
      sockets
        .map((socket) => socket.data.userId as string)
        .filter((id) => id !== excludeUserId),
    ),
  ];
  return Promise.all(
    users.map(async (userId) => {
      const profile = await prisma.profile.findUnique({
        where: { clerkUserId: userId },
        select: { displayName: true, avatarUrl: true },
      });
      return {
        userId,
        displayName: profile?.displayName ?? "Unknown",
        avatarUrl: profile?.avatarUrl ?? null,
        color: userColor(userId),
      };
    }),
  );
}
function emitError(socket: Socket, error: unknown) {
  socket.emit(
    SOCKET_EVENTS.ERROR,
    error instanceof AppError
      ? { code: error.code, message: error.message }
      : { code: "INTERNAL_ERROR", message: "Could not join the room" },
  );
}
