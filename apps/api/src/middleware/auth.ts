import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../integrations/supabase";
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

  const token = authHeader.replace("Bearer ", "");

  void supabaseAdmin.auth
    .getUser(token)
    .then(({ data, error }) => {
      if (error || !data.user) {
        next(new HttpError(401, "Invalid token"));
        return;
      }

      req.auth = {
        sub: data.user.id,
        email: data.user.email ?? ""
      };
      next();
    })
    .catch(() => {
      next(new HttpError(401, "Invalid token"));
    });
}
