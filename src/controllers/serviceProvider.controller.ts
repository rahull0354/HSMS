import ServiceProvider from "#models/serviceProvider.model.js";
import ServiceRequests from "#models/serviceRequests.model.js";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendServiceProviderReactivationMail } from "#services/email.service.js";

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
        success: false,
      });
      return;
    }

    // check if account is deactivated
    if (!checkServiceProvider.isActive) {
      res.status(403).json({
        message: "Your account is deactivated. Please reactivate to continue.",
        success: false,
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
    if (profilePicture !== undefined)
      updateData.profilePicture = profilePicture;
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

    if (pricingType !== undefined) {
      const validPricingTypes = [
        "hourly",
        "fixed",
        "per-job",
        "per-visit",
        "quote",
      ];
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
      const workingHoursObj: any = {};

      if (workingHours.from !== undefined) {
        workingHoursObj.from = workingHours.from;
      }

      if (workingHours.to !== undefined) {
        workingHoursObj.to = workingHours.to;
      }

      if (workingHours.daysOff && Array.isArray(workingHours.daysOff)) {
        workingHoursObj.daysOff = workingHours.daysOff
          .filter((day: any) => day && typeof day === "string")
          .map((day: string) => day.trim());
      }

      if (Object.keys(workingHoursObj).length > 0) {
        updateData.workingHours = workingHoursObj;
      }
    }

    if (serviceArea !== undefined) {
      const serviceAreaObj: any = {};

      if (serviceArea.cities && Array.isArray(serviceArea.cities)) {
        serviceAreaObj.cities = serviceArea.cities
          .filter((city: any) => city && typeof city === "string")
          .map((city: string) => city.trim());
      }

      if (serviceArea.areas && Array.isArray(serviceArea.areas)) {
        serviceAreaObj.areas = serviceArea.areas
          .filter((area: any) => area && typeof area === "string")
          .map((area: string) => area.trim());
      }

      if (Object.keys(serviceAreaObj).length > 0) {
        updateData.serviceArea = serviceAreaObj;
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
      message: "Error Updating details for Service Provider",
      success: false,
    });
    return;
  }
};

export const deactivateAccount = async (req: Request, res: Response) => {
  try {
    const serviceProviderId = (req as any).user.id;

    const provider = await ServiceProvider.findById(serviceProviderId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider Not Found",
        success: false,
      });
      return;
    }

    if (!provider.isActive) {
      res.status(400).json({
        message: "Account already deactivated !",
        success: false,
      });
      return;
    }

    // check if provider has any active requests
    const activeRequests = await ServiceRequests.countDocuments({
      serviceProviderId: serviceProviderId,
      status: {
        $in: ["assigned", "in_progress"],
      },
    });

    if (activeRequests > 0) {
      res.status(400).json({
        message: `Cannot deactivate account. You have ${activeRequests} active service(s). Please complete or cancel them`,
        success: false,
      });
      return;
    }

    provider.isActive = false;
    provider.deactivatedAt = new Date();
    await provider.save();

    res.status(200).json({
      message: "Account deactivated. Will be permanently deleted in 30 Days !",
      success: true,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Deactivating account",
      success: false,
    });
    return;
  }
};

export const deleteInactiveServiceProviderAccounts = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await ServiceProvider.deleteMany({
      isActive: false,
      deactivatedAt: {
        $lt: thirtyDaysAgo,
      },
    });

    if (result.deletedCount > 0) {
      console.log(
        `[Cleanup] Deleted ${result.deletedCount} inactive SERVICE PROVIDER accounts (older than 30 days)`,
      );
    }
  } catch (error) {
    console.error("[Cleanup] Error deleting inactive accounts: ", error);
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
    const provider = await ServiceProvider.findOne({ email });
    if (!provider) {
      res.status(200).json({
        message:
          "If an account exists with this email, reactivation instructions have been sent.",
        success: true,
      });
      return;
    }

    // check if account is already active
    if (provider.isActive) {
      res.status(400).json({
        message: "Account already active. Please login",
        success: false,
      });
      return;
    }

    // check if 30 days grace period has expired or not
    if (!provider.deactivatedAt) {
      res.status(400).json({
        message: "Invalid account state. Please contact support",
        success: false,
      });
      return;
    }

    const daySinceDeactivation =
      (Date.now() - provider.deactivatedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daySinceDeactivation > 30) {
      res.status(400).json({
        message: "Grace period has expired. Account cannot be reactivated !",
        success: false,
      });
      return;
    }

    // generating random token for sending reactivationToken to email
    const reactivationToken = crypto.randomBytes(32).toString("hex");
    const reactivationExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // saving the token to db
    provider.reactivationToken = reactivationToken;
    provider.reactivationExpires = reactivationExpires;
    await provider.save();

    // sending email
    await sendServiceProviderReactivationMail(
      provider.email,
      provider.name,
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

    if (!token) {
      res.status(400).json({
        message: "Reactivation token is required",
        success: false,
      });
      return;
    }

    // Use raw MongoDB collection to bypass Mongoose select: false restriction
    const provider = await ServiceProvider.findOne({
      reactivationToken: token,
      reactivationExpires: {
        $gt: new Date(),
      },
    }).select("+reactivationToken +reactivationExpires");

    if (!provider) {
      res.status(400).json({
        message:
          "Invalid or expired token. Please request a new reactivation link.",
        success: false,
      });
      return;
    }

    provider.isActive = true;
    provider.deactivatedAt = undefined as any;
    provider.reactivationToken = undefined as any;
    provider.reactivationExpires = undefined as any;
    await provider.save();

    res.status(200).json({
      message: "Account reactivated ! You can now login",
      success: true,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Reactivating Provider Account",
      success: false,
    });
    return;
  }
};

export const getProfileDetails = async (req: Request, res: Response) => {
  try {
    const serviceProviderId = (req as any).user.id;

    const provider = await ServiceProvider.findById(serviceProviderId).select(
      "-password -reactivationToken -reactivationExpires -suspensionReason -deactivatedAt",
    );

    if (!provider) {
      res.status(404).json({
        message: "Provider details not found",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: `Profile Details for ${provider.name}: `,
      provider,
      success: true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Profile Details",
      success: false,
    });
    return;
  }
};

export const toggleAvailability = async (req: Request, res: Response) => {
  try {
    const serviceProviderId = (req as any).user.id;
    const { status } = req.body;

    const validateStatus = ["available", "busy", "offline"];
    if (!status || !validateStatus.includes(status)) {
      res.status(400).json({
        message: `Invalid status. Must be one of: ${validateStatus.join(", ")}`,
        success: false,
      });
      return;
    }

    const provider = await ServiceProvider.findById(serviceProviderId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider not Found !",
        success: false,
      });
      return;
    }

    // check if provider is suspended
    if (provider.isSuspended) {
      res.status(403).json({
        message: "Cannot change availability. Account is suspended.",
        success: false,
      });
      return;
    }

    // check if provider is active
    if (!provider.isActive) {
      res.status(403).json({
        message: "Cannot change availability. Account is deactivated.",
        success: false,
      });
      return;
    }

    // updating the availability status
    provider.availabilityStatus = status;
    await provider.save();

    res.status(200).json({
      message: `Availability updated to: ${status}`,
      success: true,
      availabilityStatus: provider.availabilityStatus,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Changing Availability",
      success: false,
    });
    return;
  }
};

export const getAllServiceProviders = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const providers = await ServiceProvider.find({
      isActive: true,
      isSuspended: false,
    })
      .select(
        "-password -reactivationToken -reactivationExpires -suspensionReason -deactivatedAt",
      )
      .skip(skip)
      .limit(limit)
      .sort({ averageRating: -1, totalJobsCompleted: -1 });

    const totalProviders = await ServiceProvider.countDocuments({
      isActive: true,
      isSuspended: false,
    });

    res.status(200).json({
      message: "Providers Retrieved Successfully",
      success: true,
      data: providers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalProviders / limit),
        totalProviders,
        limit,
        hasNext: page < Math.ceil(totalProviders / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching all providers",
      success: false,
    });
    return;
  }
};

export const getPublicProfile = async (req: Request, res: Response) => {
  try {
    const { serviceProviderId } = req.params;

    if (!serviceProviderId) {
      res.status(400).json({
        message: "Provider Id is required",
        success: false,
      });
      return;
    }

    const provider = await ServiceProvider.findOne({
      _id: serviceProviderId,
      isActive: true,
      isSuspended: false,
    }).select(
      "-password -reactivationToken -reactivationExpires -suspensionReason -deactivatedAt -lastLogin",
    );

    if (!provider) {
      res.status(404).json({
        message: "Provider not found or unavailable",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: `Profile Details for ${provider.name}: `,
      success: true,
      data: provider,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Public Profile",
      success: false,
    });
    return;
  }
};

export const searchProviders = async (req: Request, res: Response) => {
  try {
    const {
      skill,
      city,
      area,
      minRating,
      maxRating,
      pricingType,
      availabilityStatus,
      sortBy = "averageRating",
      order = "desc",
      page = "1",
      limit = "10",
    } = req.query;

    const pageNum = parseInt(page as string) || 1    
    const limitNum = parseInt(limit as string) || 10
    const skip = (pageNum - 1) * limitNum

    // building filter object
    const filter: any = {
      isActive: true,
      isSuspended: false
    }

    // filter by skills
    if(skill) {
      filter.skills = {
        $in: [(skill as string).trim().toLowerCase()]
      }
    }

    // filter by service area - city
    if(city) {
      filter["serviceArea.cities"] = {
        $in: [(city as string).trim().toLocaleLowerCase()]
      }
    }

    // filter by service area - area
    if(area) {
      filter["serviceArea.areas"] = {
        $in: [(area as string).trim().toLowerCase()]
      }
    }

    // filter by rating range
    if(minRating || maxRating) {
      filter.averageRating = {}
      if(minRating) {
        filter.averageRating.$gte = parseFloat(minRating as string)
      }
      if(maxRating) {
        filter.averageRating.$lte = parseFloat(maxRating as string)
      }
    }

    // filter by pricing type
    if(pricingType) {
      const validPricingTypes = ['hourly', 'fixed', 'per-job', 'per-visit', 'quote']
      if(validPricingTypes.includes(pricingType as string)) {
        filter.pricingType = pricingType
      }
    }

    // filter by availability status
    if(availabilityStatus) {
      const validStatuses = ['available', 'busy', 'offline']
      if(validStatuses.includes(availabilityStatus as string)) {
        filter.availabilityStatus = availabilityStatus
      }
    }

    // build sort object
    const sortObj: any = {}
    const validSortFields = [
      "averageRating",
      "totalReviews",
      "totalJobsCompleted",
      "experienceYears",
      "name",
      "createdAt"
    ]

    if(validSortFields.includes(sortBy as string)) {
      sortObj[sortBy as string] = order ===  "asc" ? 1 : -1
    } else {
      sortObj.averageRating = -1 // default sort
    }

    const providers = await ServiceProvider.find(filter)
    .select('-password -reactivationToken -reactivationExpires -suspensionReason -deactivatedAd -lastLogin')
    .sort(sortObj)
    .skip(skip)
    .limit(limitNum)

    const totalProviders = await ServiceProvider.countDocuments(filter)

    res.status(200).json({
      message: "Providers retrieved successfully",
      success: true,
      data: providers,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalProviders / limitNum),
        totalProviders,
        limit: limitNum,
        hasNext: pageNum < Math.ceil(totalProviders / limitNum),
        hasPrev: pageNum > 1
      },
      filters: {
        skill: skill || null,
        city: city || null,
        area: area || null,
        minRating: minRating || null,
        maxRating: maxRating || null,
        pricingType: pricingType || null,
        availabilityStatus: availabilityStatus || null
      }
    })
    return
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Applying search filters",
      success: false,
    });
    return;
  }
};
