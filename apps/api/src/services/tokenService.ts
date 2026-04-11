import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

/**
 * Signs an access token for the authenticated user.
 */
export function signAccessToken(userId: string, email: string): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign({ sub: userId, email }, env.JWT_SECRET, options);
}
