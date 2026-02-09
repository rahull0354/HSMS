import Customer from "#models/customer.model.js";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    // check if token exits
    if (!token) {
      res.status(501).json({
        message: "No Token Provided",
        success: false,
      });
      return;
    }

    // Verify token and get user ID
    const decoded: any = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY || "secret",
    );
    (req as any).user = decoded;
    next();
  } catch (error) {
    console.error("Auth Error: ", error);
    res.status(401).json({
      message: "Invalid or expired token",
      success: false,
    });
    return;
  }
};
