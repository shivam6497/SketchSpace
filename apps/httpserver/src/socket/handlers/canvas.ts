import { Socket, Server } from "socket.io";
import {
  SOCKET_EVENTS,
  YjsUpdatePayload,
  AwarenessUpdatePayload,
  YjsBroadcastPayload,
} from "@sketchspace/types";
import {
  applyClientUpdate,
  flushToRedis,
  getDoc,
} from "../../services/ydoc.service";
import { enqueueSnapshot } from "../../jobs/snapShot.job";
import { assertCanEdit, assertJoinedRoom } from "../roomGuard";
import { socketRateLimiter } from "../../middleware/rateLimiter.middleware";
import { AppError } from "../../middleware/error.middleware";

export function registerCanvasHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;

  socket.on(SOCKET_EVENTS.YJS_UPDATE, async (payload: YjsUpdatePayload) => {
    try {
      const { roomId, update } = payload;
      assertJoinedRoom(socket, roomId);

      await socketRateLimiter(userId);

      await assertCanEdit(userId, roomId);

      const updateBytes = new Uint8Array(update);

      const broadcastUpdate = await applyClientUpdate(
        roomId,
        updateBytes,
        socket.id,
      );

      const doc = await getDoc(roomId);
      await flushToRedis(roomId, doc);
      await enqueueSnapshot(roomId);

      const broadcast: YjsBroadcastPayload = {
        roomId,
        update: broadcastUpdate.buffer as ArrayBuffer,
      };

      socket.to(roomId).emit(SOCKET_EVENTS.YJS_BROADCAST, broadcast);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on(
    SOCKET_EVENTS.AWARENESS_UPDATE,
    (payload: AwarenessUpdatePayload & { x?: number; y?: number }) => {
      try {
        const { roomId, update, x, y } = payload;
        assertJoinedRoom(socket, roomId);
        if (
          typeof x !== "number" ||
          typeof y !== "number" ||
          !Number.isFinite(x) ||
          !Number.isFinite(y)
        )
          return;
        socket
          .to(roomId)
          .emit(SOCKET_EVENTS.AWARENESS_BROADCAST, {
            roomId,
            update,
            userId,
            x,
            y,
          });
      } catch (error) {
        emitError(socket, error);
      }
    },
  );

  function emitError(socket: Socket, err: unknown): void {
    const error =
      err instanceof AppError
        ? { code: err.code, message: err.message }
        : { code: "INTERNAL_ERROR", message: "Unexpected error" };

    socket.emit(SOCKET_EVENTS.ERROR, error);
  }
}
