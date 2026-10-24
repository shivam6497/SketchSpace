import { Queue } from "bullmq";
import { dataClient } from "../lib/redis";
import { config } from "../config";

export const snapShot = new Queue('snapshot', {
    connection: dataClient,
    defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 20,
    },
});

export async function enqueueSnapshot(roomId: string): Promise<void> {
    await snapShot.add(
        'room-snapshot',
        { roomId },
        {
            jobId: `snapshot:${roomId}`,
            delay: config.SNAPSHOT_INTERVAL_MS,
        },
    );
}