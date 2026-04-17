import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../lib/httpError";

export interface JwtPayload {
  sub: string;
  email: string;
}

export function requireAuth(req: Request): JwtPayload {
  if (!req.auth?.sub) {
    throw new HttpError(401, "Authentication required");
  }

  return req.auth;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Missing bearer token"));
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = jwt.verify(token, env.JWT_SECRET);

    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string"
    ) {
      throw new HttpError(401, "Invalid token payload");
    }

    req.auth = {
      sub: payload.sub,
      email: payload.email
    };
    next();
  } catch {
    next(new HttpError(401, "Invalid token"));
  }
}
