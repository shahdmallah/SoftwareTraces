import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { getBubblePhotos, getMapBubbles, uploadMedia } from "./media.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/", authenticate, upload.single("file"), asyncHandler(uploadMedia));
router.get("/map/bubbles", asyncHandler(getMapBubbles));
router.get("/map/bubbles/photos", asyncHandler(getBubblePhotos));

export default router;