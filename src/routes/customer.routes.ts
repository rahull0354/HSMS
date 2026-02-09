import { loginCustomer, registerCustomer, updateCustomerDetails, deactivateAccount, reactivateAccount } from "#controllers/user.controller.js"
import { authMiddleware } from "#middlewares/auth.middleware.js"
import express from "express"

const router = express.Router()

router.post("/register", registerCustomer)
router.post("/login", loginCustomer)
router.put("/update-profile", authMiddleware, updateCustomerDetails)
router.post("/deactivate-account", authMiddleware, deactivateAccount)
router.post("/reactivate-account", authMiddleware, reactivateAccount)

export default router
