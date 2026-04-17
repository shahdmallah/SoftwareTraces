import type { JwtPayload } from "../middleware/auth";

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export {};
