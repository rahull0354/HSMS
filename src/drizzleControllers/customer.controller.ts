import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendCustomerReactivationMail } from "#services/email.service.js";
import ServiceRequests from "#models/serviceRequests.model.js";
import { customerRepository } from "#db/repositories/customer.repository.js";
import { serviceRequestRepository } from "#db/repositories/serviceRequests.repository.js";

export const registerCustomer = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, address, profilePicture } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        message: "Please input all required fields",
        success: false,
      });
      return;
    }

    const checkCustomer = await customerRepository.findByEmail(email);
    if (checkCustomer) {
      res.status(400).json({
        message: "Customer with this email exists",
        success: false,
      });
      return;
    }

    // email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({
        message: "Invalid email format",
        success: false,
      });
      return;
    }

    // password length validation
    if (password.length < 6) {
      res.status(400).json({
        message: "Length of the password must be 6 characters",
        success: false,
      });
      return;
    }

    const hashPassword = await bcrypt.hash(password, 10);
    const customer = await customerRepository.create({
      name,
      email,
      phone,
      password: hashPassword,
      address,
      profilePicture,
    });

    res.status(201).json({
      message: "Customer Registered !",
      success: true,
      customer,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error registering customer",
      success: false,
    });
    return;
  }
};

export const loginCustomer = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        message: "Please input all required fields",
        success: false,
      });
      return;
    }

    const checkCustomer = await customerRepository.findByEmail(email);
    if (!checkCustomer) {
      res.status(400).json({
        message: "Customer with this email doesn't exits",
        success: false,
      });
      return;
    }

    // password matching
    const checkPassword = await bcrypt.compare(
      password,
      checkCustomer.password,
    );
    if (!checkPassword) {
      res.status(400).json({
        message: "Invalid Password",
        success: false,
      });
      return;
    }

    // saving the lastLogin date & time
    await customerRepository.updateLastLogin(checkCustomer.id);

    // generate tokens using auth service
    const { authService } = await import("#drizzleServices/auth.service.js");
    const tokens = await authService.generateTokens(
      checkCustomer.id,
      "customer",
      req,
    );

    res.status(200).json({
      message: `Welcome back ${checkCustomer.name}`,
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      checkCustomer: {
        id: checkCustomer.id,
        name: checkCustomer.name,
        email: checkCustomer.email,
        phone: checkCustomer.phone,
        profilePicture: checkCustomer.profilePicture,
        address: checkCustomer.address,
        isActive: checkCustomer.isActive,
        deactivatedAt: checkCustomer.deactivatedAt,
        reactivationToken: checkCustomer.reactivationToken,
        reactivationExpires: checkCustomer.reactivationExpires,
        createdAt: checkCustomer.createdAt,
        updatedAt: checkCustomer.updatedAt,
        lastLogin: checkCustomer.lastLogin,
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error logging customer",
      success: false,
    });
    return;
  }
};

export const updateCustomerDetails = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, email, phone, password, address, profilePicture } = req.body;

    const customer = await customerRepository.findById(userId);
    if (!customer) {
      res.status(400).json({
        message: "Customer doesn't exist",
        success: false,
      });
      return;
    }

    if (email && email !== customer.email) {
      const emailExists = await customerRepository.findByEmail(email);
      if (emailExists) {
        res.status(400).json({
          message: "Email already in use",
          success: false,
        });
        return;
      }
    }

    const updateData: any = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (profilePicture) updateData.profilePicture = profilePicture;

    const updatedCustomer = await customerRepository.update(
      userId,
      updateData,
    );

    res.status(200).json({
      message: `Profile details for ${customer.name} updated !`,
      success: true,
      customer: updatedCustomer,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error updating customer details",
      success: false,
    });
    return;
  }
};

export const deactivateAccount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const customer = await customerRepository.findById(userId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Not Found !",
        success: false,
      });
      return;
    }

    if (!customer.isActive) {
      res.status(400).json({
        message: "Account Already Deactivated !",
        success: false,
      });
      return;
    }

    // check for active services
    const activeServicesCount = await serviceRequestRepository.countActiveServicesForCustomer(userId);

    if (activeServicesCount > 0) {
      res.status(400).json({
        message: `Cannot deactivate account. You have ${activeServicesCount} active service(s). Please complete or cancel them first`,
        success: false,
      });
      return;
    }

    const deactivatedCustomer = await customerRepository.update(userId, {
      isActive: false,
      deactivatedAt: new Date()
    })

    res.status(200).json({
      message: "Account Deactivated. Will be permanently deleted in 30 Days !",
      success: true,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error deactivating account",
      success: false,
    });
    return;
  }
};

// Cleanup function to permanently delete accounts deactivated more than 30 days ago
export const deleteInactiveCustomerAccounts = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await customerRepository.deleteMany({
      isActive: false,
      deactivatedBefore: thirtyDaysAgo,
    });

    if (result.length > 0) {
      console.log(
        `[Cleanup] Deleted ${result.length} inactive CUSTOMER accounts (older than 30 days)`,
      );
    }
  } catch (error) {
    console.error("[Cleanup] Error deleting inactive accounts:", error);
  }
};

export const requestReactivation = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        message: "Email is required",
        success: false,
      });
      return;
    }

    // always return success if account exists or not
    const customer = await customerRepository.findByEmail(email);
    if (!customer) {
      res.status(200).json({
        message:
          "If an account exits with this email, reactivation instructions have been sent.",
        success: true,
      });
      return;
    }

    // check if account is already active
    if (customer.isActive) {
      res.status(400).json({
        message: "Account is already active. Please login",
        success: false,
      });
      return;
    }

    // check if 30 day grace period has expired or not
    if (!customer.deactivatedAt) {
      res.status(400).json({
        message: "Invalid account state. Please contact support.",
        success: false,
      });
      return;
    }

    const daySinceDeactivation =
      (Date.now() - customer.deactivatedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daySinceDeactivation > 30) {
      res.status(400).json({
        message:
          "Grace period of 30 days has expired. Account cannot be reactivated !",
        success: false,
      });
      return;
    }

    // generating random token for sending reactivationToken to email
    const reactivationToken = crypto.randomBytes(32).toString("hex");
    const reactivationExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // saving token to db
    await customerRepository.update(customer.id, {
      reactivationToken,
      reactivationExpires
    })

    // sending email
    await sendCustomerReactivationMail(
      customer.email,
      customer.name,
      reactivationToken,
    );

    res.status(200).json({
      message: "Reactivation mail sent. Please check your inbox !",
      success: true,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Requesting Reactivation",
      success: false,
    });
    return;
  }
};

export const verifyAndReactivateAccount = async (
  req: Request,
  res: Response,
) => {
  try {
    const { token } = req.params;
    const tokenValue = Array.isArray(token) ? token[0] : token;

    if (!token) {
      res.status(400).json({
        message: "Reactivation Token is required",
        success: false,
      });
      return;
    }

    // find customer with valid token
    const customer = await customerRepository.findByReactivationToken(tokenValue);

    if (!customer) {
      res.status(400).json({
        message:
          "Invalid or expired token. Please request a new reactivation link.",
        success: false,
      });
      return;
    }

    // reactivate account
    await customerRepository.update(customer.id, {
      isActive: true,
      deactivatedAt: null,
      reactivationToken: null,
      reactivationExpires: null
    })

    res.status(200).json({
      message: "Account reactivated successfully! You can now login",
      success: true,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Reactivating Account",
      success: false,
    });
    return;
  }
};

export const getProfileDetails = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;

    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      res.status(404).json({
        message: "User details not found",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: `Profile details for ${customer.name}: `,
      customer,
      success: true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching profile details !",
      success: false,
    });
    return;
  }
};

// Refresh token endpoint
export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        message: "Refresh token is required",
        success: false,
      });
      return;
    }

    const { authService } = await import("#drizzleServices/auth.service.js");
    const result = await authService.refreshAccessToken(refreshToken, req);

    if (!result.success) {
      res.status(401).json({
        message: result.error,
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: "Token refreshed successfully",
      success: true,
      accessToken: result.tokens!.accessToken,
      refreshToken: result.tokens!.refreshToken,
      expiresIn: result.tokens!.expiresIn,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error refreshing token",
      success: false,
    });
    return;
  }
};

// Logout (revoke current refresh token)
export const logout = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const userId = (req as any).user.id;

    if (!refreshToken) {
      res.status(400).json({
        message: "Refresh token is required",
        success: false,
      });
      return;
    }

    const { authService } = await import("#drizzleServices/auth.service.js");
    const result = await authService.revokeRefreshToken(refreshToken, userId);

    if (!result.success) {
      res.status(400).json({
        message: result.error,
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: "Logged out successfully",
      success: true,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error during logout",
      success: false,
    });
    return;
  }
};

// Get active sessions
export const getActiveSessions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const { authService } = await import("#drizzleServices/auth.service.js");
    const sessions = await authService.getUserActiveSessions(userId, "customer");

    // Mark current session
    const userAgent = req.headers["user-agent"] || "";
    const currentSession = sessions.find(
      (s) =>
        s.deviceInfo?.userAgent &&
        userAgent.includes(s.deviceInfo.userAgent.substring(0, 50)),
    );
    if (currentSession) {
      currentSession.isCurrent = true;
    }

    res.status(200).json({
      message: "Active sessions retrieved",
      success: true,
      sessions,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error fetching sessions",
      success: false,
    });
    return;
  }
};

// Revoke specific session
export const revokeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const sessionIdValue = Array.isArray(sessionId) ? sessionId[0] : sessionId;
    const userId = (req as any).user.id;

    const { authService } = await import("#drizzleServices/auth.service.js");
    const result = await authService.revokeSessionById(sessionIdValue, userId);

    if (!result.success) {
      res.status(400).json({
        message: result.error,
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: "Session revoked successfully",
      success: true,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error revoking session",
      success: false,
    });
    return;
  }
};

// Logout from all devices
export const logoutAll = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const { authService } = await import("#drizzleServices/auth.service.js");
    const result = await authService.revokeAllSessions(userId, "customer");

    if (!result.success) {
      res.status(400).json({
        message: result.error,
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: `Logged out from ${result.count} device(s)`,
      success: true,
      count: result.count,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error during logout all",
      success: false,
    });
    return;
  }
};

