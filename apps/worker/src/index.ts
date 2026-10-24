import "dotenv/config";
import { Redis } from "ioredis";
import { prisma } from "@sketchspace/db";
import { createSnapshotWorker } from "./jobs/snapshot.job";

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("connect", () => console.log("[redis] connected"));
redis.on("error", (err) => console.error("[redis] error", err));

const snapshotWorker = createSnapshotWorker(redis);

console.log("[worker] snapshot worker started");

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[${signal}] worker shutting down`);

  await snapshotWorker.close();
  await redis.quit();
  await prisma.$disconnect();

  console.log("[worker] shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
