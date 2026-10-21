import { z } from "zod";

export const ShapeTypeSchema = z.enum([
  "rect",
  "ellipse",
  "arrow",
  "line",
  "freehand",
  "text",
]);

export type ShapeType = z.infer<typeof ShapeTypeSchema>;

export const ShapeSchema = z.object({
  id: z.string(),
  type: ShapeTypeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  points: z.array(z.tuple([z.number(), z.number()])).optional(), 
  text: z.string().optional(),
  stroke: z.string().default("#1e1e1e"),
  fill: z.string().default("transparent"),
  fillStyle: z
    .enum(["hachure", "solid", "zigzag", "cross-hatch", "dots"])
    .default("hachure"),
  strokeWidth: z.number().default(2),
  roughness: z.number().min(0).max(3).default(1),
  opacity: z.number().min(0).max(1).default(1),
  seed: z.number(),
  angle: z.number().default(0),
  createdBy: z.string(),
  createdAt: z.number(),
});

export type Shape = z.infer<typeof ShapeSchema>;

export type YShape = Shape;
