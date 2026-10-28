import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@sketchspace/db";
import { ERROR_CODES } from "@sketchspace/types";
import { success } from "zod/v4";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        issues: err.flatten().fieldErrors,
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: {
          code: ERROR_CODES.CONFLICT,
          message: "Resource already exists",
        },
      });
    }

    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: "Resource not found" },
      });
    }
  }

  console.error("[UNHANDLED ERROR]", err);
  return res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Something went wrong",
    },
  });
}
