import Customer from "#models/customer.model.js";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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

    const checkCustomer = await Customer.findOne({ email });
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
    const customer = new Customer({
      name,
      email,
      phone,
      password: hashPassword,
      address,
      profilePicture,
    });
    await customer.save();

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

    const checkCustomer = await Customer.findOne({ email }).select("+password");
    if (!checkCustomer) {
      res.status(400).json({
        message: "Customer with this email doesn't exits",
        success: false,
      });
      return;
    }

    // check if account is deactivated
    if (!checkCustomer.isActive) {
      res.status(403).json({
        message: "Your account is deactivated. Please reactivate to continue.",
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
    checkCustomer.lastLogin = new Date();
    await checkCustomer.save();

    // generate token
    const token = jwt.sign(
      { id: checkCustomer._id },
      process.env.JWT_SECRET_KEY || "secret",
      { expiresIn: "7d" },
    );

    res.status(200).json({
      message: `Welcome back ${checkCustomer.name}`,
      success: true,
      token,
      checkCustomer: {
        id: checkCustomer._id,
        name: checkCustomer.name,
        email: checkCustomer.email,
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

    const customer = await Customer.findById(userId);
    if (!customer) {
      res.status(400).json({
        message: "Customer doesn't exist",
        success: false,
      });
      return;
    }

    if (email && email !== customer.email) {
      const emailExists = await Customer.findOne({ email });
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

    const updatedCustomer = await Customer.findByIdAndUpdate(
      userId,
      updateData,
      { new: true },
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

    const customer = await Customer.findById(userId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Not Found !",
        success: false,
      });
      return;
    }

    customer.isActive = false;
    customer.deactivatedAt = new Date();
    await customer.save();

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

export const reactivateAccount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const customer = await Customer.findById(userId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Not Found !",
        success: false,
      });
      return;
    }

    if (customer.isActive) {
      res.status(400).json({
        message: "Account is already Active !",
        success: false,
      });
      return;
    }

    // checking if the account is already withing the 30 days grace period
    if (!customer.deactivatedAt) {
      res.status(400).json({
        message: "Deactivation date not found!",
        success: false,
      });
      return;
    }

    const daySinceDeactivation =
      (Date.now() - customer.deactivatedAt.getTime()) / (1000 * 60 * 60 * 24);

    // Check if 30 days grace period is expired or not
    if (daySinceDeactivation > 30) {
      res.status(400).json({
        message:
          "Grace period of 30 days has expired. Account cannot be reactivated.",
        success: false,
      });
      return;
    }

    // Reactivate the account
    customer.isActive = true;
    customer.deactivatedAt = undefined;
    await customer.save();

    res.status(200).json({
      message: "Account reactivated successfully!",
      success: true,
      data: {
        isActive: customer.isActive,
        email: customer.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Re-Activating account",
      success: false,
    });
    return;
  }
};

// Cleanup function to permanently delete accounts deactivated more than 30 days ago
// This will be called periodically from index.ts
export const deleteInactiveAccounts = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await Customer.deleteMany({
      isActive: false,
      deactivatedAt: { $lt: thirtyDaysAgo },
    });

    if (result.deletedCount > 0) {
      console.log(
        `[Cleanup] Deleted ${result.deletedCount} inactive accounts (older than 30 days)`,
      );
    }
  } catch (error) {
    console.error("[Cleanup] Error deleting inactive accounts:", error);
  }
};
