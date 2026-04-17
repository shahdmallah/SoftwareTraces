import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { getElevationDebug } from "./debug.controller";

const router = Router();

router.get("/elevation/:lat/:lng", asyncHandler(getElevationDebug));

export default router;
