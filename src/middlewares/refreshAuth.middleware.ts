import { Request, Response, NextFunction } from "express";

export const refreshAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        message: "Refresh token is required",
        success: false,
      });
      return;
    }

    // Validate refresh token exists and is valid format
    if (typeof refreshToken !== "string" || refreshToken.length < 10) {
      res.status(400).json({
        message: "Invalid refresh token format",
        success: false,
      });
      return;
    }

    // Store refresh token in request for use in controller
    (req as any).refreshToken = refreshToken;
    next();
  } catch (error) {
    console.error("Refresh auth middleware error:", error);
    res.status(500).json({
      message: "Authentication middleware error",
      success: false,
    });
    return;
  }
};
