import type { Request, Response } from "express";
import { testDatabaseConnection } from "../../lib/db";

export async function checkDatabaseHealth(_req: Request, res: Response): Promise<void> {
  const result = await testDatabaseConnection();

  if (result.success) {
    res.status(200).json({ status: "healthy", message: result.message });
  } else {
    res.status(503).json({ status: "unhealthy", message: result.message });
  }
}

export async function getHealth(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
}
