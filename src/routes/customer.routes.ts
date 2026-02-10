import { loginCustomer, registerCustomer, updateCustomerDetails, deactivateAccount, requestReactivation, verifyAndReactivateAccount } from "#controllers/user.controller.js"
import { authMiddleware } from "#middlewares/auth.middleware.js"
import express from "express"

const router = express.Router()

router.post("/register", registerCustomer)
router.post("/login", loginCustomer)
router.put("/update-profile", authMiddleware, updateCustomerDetails)
router.post("/deactivate-account", authMiddleware, deactivateAccount)

// reactivation routes
router.post("/request-reactivation", requestReactivation)
router.get("/reactivate-account/:token", verifyAndReactivateAccount)

export default router
