import * as Y from "yjs";
import { prisma } from "@sketchspace/db";
import { dataClient } from "../lib/redis";
import { config } from "../config";
import type { YShape } from "@sketchspace/types";

const redisKey = (roomId: string) => `ydoc:${roomId}`;

interface DocEntry {
  doc: Y.Doc;
  lastUpdate: number;
  updateCount: number;
  observers: Set<string>;
}

const docs = new Map<string, DocEntry>();
const loads = new Map<string, Promise<Y.Doc>>();

export async function getDoc(roomId: string): Promise<Y.Doc> {
  const existing = docs.get(roomId);
  if (existing) {
    existing.lastUpdate = Date.now();
    return existing.doc;
  }

  const pending = loads.get(roomId);
  if (pending) return pending;
  const loading = loadDoc(roomId).finally(() => loads.delete(roomId));
  loads.set(roomId, loading);
  return loading;
}

export async function applyClientUpdate(
  roomId: string,
  update: Uint8Array,
  originSocketId: string,
): Promise<Uint8Array> {
  const doc = await getDoc(roomId);
  const entry = docs.get(roomId)!;

  Y.applyUpdate(doc, update, originSocketId);

  entry.lastUpdate = Date.now();
  entry.updateCount++;

  if (entry.updateCount >= config.SNAPSHOT_UPDATE_THRESHOLD) {
    await flushToRedis(roomId, doc);
    entry.updateCount = 0;
  }

  return Y.encodeStateAsUpdate(doc);
}

export async function flushToRedis(roomId: string, doc: Y.Doc): Promise<void> {
  const update = Y.encodeStateAsUpdate(doc);

  await dataClient.setex(redisKey(roomId), 600, Buffer.from(update));
  console.log("[YDoc] flushed to redis for room:", roomId);
}

export async function persistDocNow(roomId: string): Promise<void> {
  const entry = docs.get(roomId);
  if (!entry) return;

  const update = Y.encodeStateAsUpdate(entry.doc);
  const elements = Array.from(entry.doc.getMap<YShape>("shapes").values());

  await Promise.all([
    dataClient.setex(redisKey(roomId), 600, Buffer.from(update)),
    prisma.room.update({
      where: { id: roomId },
      data: {
        yjsSnapshot: Buffer.from(update),
        elements,
        updatedAt: new Date(),
      },
    }),
  ]);

  console.log(
    `[ydoc] emergency persist: ${roomId} (${elements.length} shapes)`,
  );
}

export function addObserver(roomId: string, socketId: string): void {
  docs.get(roomId)?.observers.add(socketId);
}

export function removeObserver(roomId: string, socketId: string): void {
  const entry = docs.get(roomId);
  if (!entry) return;

  entry.observers.delete(socketId);

  if (entry.observers.size === 0) {
    flushToRedis(roomId, entry.doc).catch((err) => {
      console.error(`[ydoc] flush on empty room failed: ${roomId}`, err);
    });

    scheduleEviction(roomId);
  }
}

export function getAllActiveRooms(): string[] {
  return Array.from(docs.keys());
}

async function loadDoc(roomId: string): Promise<Y.Doc> {
  const doc = new Y.Doc();

  const cached = await dataClient.getBuffer(redisKey(roomId));
  if (cached) {
    Y.applyUpdate(doc, cached);
    console.log(`[YDoc] loaded from Redis: ${roomId}`);
  } else {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { yjsSnapshot: true },
    });

    if (room?.yjsSnapshot) {
      Y.applyUpdate(doc, room.yjsSnapshot);
      console.log(`[YDoc] loaded from Postgres: ${roomId}`);
    } else {
      console.log(`[YDoc] new doc: ${roomId}`);
    }
  }

  docs.set(roomId, {
    doc,
    lastUpdate: Date.now(),
    updateCount: 0,
    observers: new Set(),
  });
  return doc;
}

function scheduleEviction(roomId: string): void {
  setTimeout(() => {
    const entry = docs.get(roomId);
    if (!entry) return;

    if (entry.observers.size === 0) {
      docs.delete(roomId);
      console.log(`[ydoc] evicted: ${roomId}`);
    }
  }, config.YDOC_EVICT_AFTER_MS);
}
export async function deleteRoomState(roomId: string): Promise<void> {
  await loads.get(roomId)?.catch(() => {});
  const entry = docs.get(roomId);
  docs.delete(roomId);
  entry?.doc.destroy();
  await dataClient.del(redisKey(roomId));
}
