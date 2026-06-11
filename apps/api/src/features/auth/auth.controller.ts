import type { Request, Response } from "express";
import { trackUserActivity } from "../analytics/analytics.service";
import { requireAuth } from "../../middleware/auth";
import { authService } from "./auth.service";

export async function signup(req: Request, res: Response): Promise<void> {
  const user = await authService.signup(req.body);
  res.status(201).json(user);
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);
  await trackUserActivity({
    userId: result.user.id,
    eventType: "login",
    metadata: { email: result.user.email },
  });
  res.status(200).json(result);
}

export async function me(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const user = await authService.getCurrentUser(auth.sub);

  res.json({ user });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const result = await authService.refresh(String(req.body.refreshToken ?? ""));
  res.json(result);
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.status(204).send();
}