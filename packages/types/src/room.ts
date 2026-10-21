import { z } from "zod";

export const RoleSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER']);
export type Role = z.infer<typeof RoleSchema>;

export const CreateRoomSchema = z.object({
    name: z.string().min(1).max(100).trim(),
});

export const UpdateRoomSchema = z.object({
    name: z.string().min(1).max(100).trim().optional(),
});

export const InviteMemberSchema = z.object({
    clerkUserId: z.string(),
    role: RoleSchema.exclude(['OWNER']),
});

export const UpdateMemberRoleSchema = z.object({
    role: RoleSchema.exclude(['OWNER']),
});

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;