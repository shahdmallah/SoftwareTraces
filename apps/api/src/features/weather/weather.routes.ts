import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middleware/validate";
import { getForecast } from "./weather.controller";

const router = Router();

router.get(
  "/forecast",
  validate(
    z.object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    "query",
  ),
  asyncHandler(getForecast),
);

export default router;
