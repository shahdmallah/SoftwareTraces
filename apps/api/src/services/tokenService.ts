import jwt from "jsonwebtoken";
import { env } from "../config/env";

/**
 * Signs an access token for the authenticated user.
 */
export function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}
