import { Worker, Job } from "bullmq";
import * as Y from "yjs";
import { prisma } from "@sketchspace/db";
import { Redis } from "ioredis";
import type { YShape } from "@sketchspace/types";

interface SnapshotJobData {
  roomId: string;
}

export function createSnapshotWorker(redis: Redis) {
  const worker = new Worker<SnapshotJobData>(
    "snapshot",
    async (job: Job<SnapshotJobData>) => {
      const { roomId } = job.data;

      const cached = await redis.getBuffer(`ydoc:${roomId}`);

      if (!cached) {
        console.log(
          `[snapshot-worker] no Redis cache for ${roomId} - skipping`,
        );
        return;
      }

      const doc = new Y.Doc();
      Y.applyUpdate(doc, new Uint8Array(cached));
      const elements = Array.from(doc.getMap<YShape>("shapes").values());
      doc.destroy();

      await prisma.room.update({
        where: { id: roomId },
        data: {
          yjsSnapshot: Buffer.from(cached),
          elements,
          updatedAt: new Date(),
        },
      });
      console.log(
        `[snapshot-worker] persisted ${roomId} (${elements.length} shapes)`,
      );
    },
    {
      connection: redis,
      concurrency: 5,
      drainDelay: 300_000,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[snapshot-worker] job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[snapshot-worker] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
