import { createClerkClient } from "@clerk/backend";
import { config } from "../config";

export const clerkClient = createClerkClient({
    secretKey: config.CLERK_SECRET_KEY,
});

