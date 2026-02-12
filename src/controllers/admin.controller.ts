import Admin from "#models/admin.model.js";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerAdmin = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        message: "Please input all fields",
        success: false,
      });
      return;
    }

    // Check if admin already exists (only one admin allowed for security)
    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      res.status(403).json({
        message: "Admin already exists. Only one admin account allowed.",
        success: false,
      });
      return;
    }

    const adminCheck = await Admin.findOne({ email });
    if (adminCheck) {
      res.status(400).json({
        message: "Admin with this email already exists",
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

    // password hashing
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({
      name,
      email,
      password: hashedPassword,
    });
    await admin.save();

    res.status(200).json({
      message: "Admin Created Successfully !",
      success: true,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Registering Admin",
      success: false,
    });
    return;
  }
};

export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        message: "Input Missing Fields",
        success: false,
      });
      return;
    }

    const checkAdmin = await Admin.findOne({ email }).select("+password");
    if (!checkAdmin) {
      res.status(404).json({
        message: "Admin with this details not found",
        success: false,
      });
      return;
    }

    // password matching
    const checkPassword = await bcrypt.compare(password, checkAdmin.password);
    if (!checkPassword) {
      res.status(400).json({
        message: "Incorrect Credentials !",
        success: false,
      });
      return;
    }

    // saving lastLogin Date
    checkAdmin.lastLogin = new Date();
    await checkAdmin.save();

    // token generation
    const token = jwt.sign(
      {
        id: checkAdmin._id,
        role: "admin",
      },
      process.env.JWT_SECRET_KEY || "",
      { expiresIn: "7d" },
    );

    res.status(200).json({
      message: `Welcome ${checkAdmin.name}`,
      success: true,
      checkAdmin: {
        id: checkAdmin._id,
        name: checkAdmin.name,
        email: checkAdmin.email,
        lastLogin: checkAdmin.lastLogin,
      },
      token,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Logging Admin",
      success: false,
    });
    return;
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id

    if(!adminId) {
        res.status(400).json({
            message: "Admin Id Not Found",
            success: false
        })
        return
    }

    const admin = await Admin.findById(adminId).select('-password')
    if(!admin) {
        res.status(404).json({
            message: "Admin Not Found With this Details",
            success: false
        })
        return
    }

    res.status(200).json({
        message: `Account Details for: ${admin.name}`,
        success: true,
        admin
    })
    return
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Details for Admin",
      success: false,
    });
    return;
  }
};
