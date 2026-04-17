import { Router } from "express";
import { checkDatabaseHealth, getHealth } from "./health.controller";

const router = Router();

router.get("/", getHealth);
router.get("/db", checkDatabaseHealth);

export default router;
