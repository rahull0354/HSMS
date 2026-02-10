import Customer from "#models/customer.model.js";
import ServiceProvider from "#models/serviceProvider.model.js";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authMiddleware = (allowedRoles: String[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
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

      // check if user has allowed role
      if(!allowedRoles.includes(decoded.role)) {
        res.status(403).json({
          message: "Access Denied",
          success: false
        })
        return
      }

      // verify user exists in correct collection
      let user
      if(decoded.role === "customer") {
        user = await Customer.findById(decoded.id)
      } else if (decoded.role === "serviceProvider") {
        user = await ServiceProvider.findById(decoded.id)
      }

      if(!user) {
        res.status(401).json({
          message: "User not found",
          success: false
        })
        return
      }
      
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
};
