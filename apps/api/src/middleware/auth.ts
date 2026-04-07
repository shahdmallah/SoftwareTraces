import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../lib/httpError";

export interface JwtPayload {
  sub: string;
  email: string;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Missing bearer token"));
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    req.auth = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    next();
  } catch {
    next(new HttpError(401, "Invalid token"));
  }
}
