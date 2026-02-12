import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  getProfile,
  loginAdmin,
  registerAdmin,
  toggleCategoryStatus,
  updateCategory,
} from "#controllers/admin.controller.js";
import { authMiddleware } from "#middlewares/auth.middleware.js";
import express from "express";

const router = express.Router();

router.post("/register", registerAdmin);
router.get("/login", loginAdmin);

// middleware protected routes
router.get("/profile", authMiddleware(["admin"]), getProfile);

// service category routes
router.post("/createCategory", authMiddleware(["admin"]), createCategory);
router.get("/categories", authMiddleware(["admin"]), getAllCategories);
router.get("/category/:categoryId", authMiddleware(["admin"]), getCategoryById);
router.put(
  "/category/update/:categoryId",
  authMiddleware(["admin"]),
  updateCategory,
);
router.patch(
  "/category/:categoryId/toggle",
  authMiddleware(["admin"]),
  toggleCategoryStatus,
);
router.delete(
  "/category/delete/:categoryId",
  authMiddleware(["admin"]),
  deleteCategory,
);

export default router;
