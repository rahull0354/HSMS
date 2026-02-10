import ServiceProvider from "#models/serviceProvider.model.js";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";

export const registerServiceProvider = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        message: "Please input all required fields",
        success: false,
      });
      return;
    }

    const checkServiceProvider = await ServiceProvider.findOne({ email });
    if (checkServiceProvider) {
      res.status(400).json({
        message: "User with this email already exists",
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

    const serviceProvider = new ServiceProvider({
      name,
      email,
      password: hashedPassword,
    });
    await serviceProvider.save();

    res.status(201).json({
      message: "Service Provider Registered !",
      success: true,
      serviceProvider,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Registering Service Provider",
      success: false,
    });
    return;
  }
};

export const loginServiceProvider = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        message: "Please input all fields",
        success: false,
      });
      return;
    }

    const checkServiceProvider = await ServiceProvider.findOne({
      email,
    }).select("+password");
    if (!checkServiceProvider) {
      res.status(404).json({
        message: "Provider not found",
        sucess: false,
      });
      return;
    }

    // password matching
    const matchPassword = await bcrypt.compare(
      password,
      checkServiceProvider.password,
    );
    if (!matchPassword) {
      res.status(400).json({
        message: "Incorrect email or password",
        success: false,
      });
      return;
    }

    // saving last login date
    checkServiceProvider.lastLogin = new Date();
    await checkServiceProvider.save();

    // token generation
    const token = jwt.sign(
      {
        id: checkServiceProvider._id,
        role: "serviceProvider",
      },
      process.env.JWT_SECRET_KEY || "",
      { expiresIn: "7d" },
    );

    res.status(200).json({
      message: `Welcome back ${checkServiceProvider.name} !`,
      success: true,
      token,
      checkServiceProvider: {
        id: checkServiceProvider._id,
        name: checkServiceProvider.name,
        email: checkServiceProvider.email,
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Logging Service Provider",
      success: false,
    });
    return;
  }
};

export const updateServiceProviderDetails = async (
  req: Request,
  res: Response,
) => {
  try {
    const serviceProviderId = (req as any).user.id;
    const {
      name,
      email,
      phone,
      password,
      profilePicture,
      bio,
      skills,
      experienceYears,
      certifications,
      pricingType,
      workingHours,
      serviceArea,
    } = req.body;

    const provider = await ServiceProvider.findById(serviceProviderId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider not found!",
        success: false,
      });
      return;
    }

    // check if user tries to update email and that is not already in use by someone another
    if (email && email !== provider.email) {
      const emailExists = await ServiceProvider.findOne({ email });
      if (emailExists) {
        res.status(400).json({
          message: "Email already in use. Try a different one",
          success: false,
        });
        return;
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (profilePicture !== undefined) updateData.profilePiture = profilePicture;
    if (bio !== undefined) updateData.bio = bio;
    if (skills !== undefined) {
      if (Array.isArray(skills)) {
        updateData.skills = skills
          .filter((skill: any) => skill && typeof skill === "string")
          .map((skill: string) => skill.trim());
      }
    }
    if (experienceYears !== undefined)
      updateData.experienceYears = experienceYears;

    // nested objects
    if (certifications !== undefined) {
      if (Array.isArray(certifications)) {
        // validate each certification has required fields
        const validCertifications = certifications
          .filter((cert: any) => {
            return cert.name && cert.issuedBy && cert.year;
          })
          .map((cert: any) => ({
            name: cert.name,
            issuedBy: cert.issuedBy,
            year: cert.year,
            certificateUrl: cert.certificateUrl || "",
          }));

        if (validCertifications.length > 0) {
          updateData.certifications = validCertifications;
        }
      }
    }

    // Handle pricingType (direct field)
    if (pricingType !== undefined) {
      const validPricingTypes = ["hourly", "fixed", "per-job", "per-visit", "quote"];
      if (validPricingTypes.includes(pricingType)) {
        updateData.pricingType = pricingType;
      } else {
        res.status(400).json({
          message: `Invalid pricing type. Must be one of: ${validPricingTypes.join(", ")}`,
          success: false,
        });
        return;
      }
    }

    if (workingHours !== undefined) {
        const workingHoursObj: any = {}

        if(workingHours.from !== undefined) {
            workingHoursObj.from = workingHours.from
        }

        if(workingHours.to !== undefined) {
            workingHoursObj.to = workingHours.to
        }

        if(workingHours.daysOff && Array.isArray(workingHours.daysOff)) {
            workingHoursObj.daysOff = workingHours.daysOff
            .filter((day: any) => day && typeof day === 'string')
            .map((day: string) => day.trim())
        }

        if(Object.keys(workingHoursObj).length > 0) {
            updateData.workingHours = workingHoursObj
        }
    }

    if (serviceArea !== undefined) {
        const serviceAreaObj: any = {}

        if(serviceArea.cities && Array.isArray(serviceArea.cities)) {
            serviceAreaObj.cities = serviceArea.cities
            .filter((city: any) => city && typeof city === 'string')
            .map((city: string) => city.trim())
        }

        if(serviceArea.areas && Array.isArray(serviceArea.areas)) {
            serviceAreaObj.areas = serviceArea.areas
            .filter((area: any) => area && typeof area === 'string')
            .map((area: string) => area.trim())
        }

        if(Object.keys(serviceAreaObj).length > 0) {
            updateData.serviceArea = serviceAreaObj
        }
    }

    const updatedProvider = await ServiceProvider.findByIdAndUpdate(
      serviceProviderId,
      updateData,
      { new: true },
    );

    res.status(200).json({
      message: `Profile details for ${provider.name} updated !`,
      success: true,
      provider: updatedProvider,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Logging Service Provider",
      success: false,
    });
    return;
  }
};
