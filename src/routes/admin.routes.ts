import { getProfile, loginAdmin, registerAdmin } from "#controllers/admin.controller.js"
import { authMiddleware } from "#middlewares/auth.middleware.js"
import express from "express"

const router = express.Router()

router.post("/register", registerAdmin)
router.get("/login", loginAdmin)

// middleware protected routes
router.get("/profile", authMiddleware(['admin']), getProfile)

export default router