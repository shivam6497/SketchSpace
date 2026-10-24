import { Redis } from "ioredis";
import { config } from "../config";

function createClient(name: string) {
  const client = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });

  client.on("connect", () => console.log(`[Redis:${name}] connected`));
  client.on("error", (err) => console.error(`[Redis:${name}] error`, err));
  return client;
}

export const pubClient = createClient("pub");
export const subClient = createClient("sub");

export const dataClient = createClient("data");

export async function closeRedis() {
  await Promise.all([pubClient.quit(), subClient.quit(), dataClient.quit()]);
}
