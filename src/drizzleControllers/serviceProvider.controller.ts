import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendServiceProviderReactivationMail } from "#services/email.service.js";
import { serviceProviderRepository } from "#db/repositories/serviceProvider.repository.js";
import { serviceRequestRepository } from "#db/repositories/serviceRequests.repository.js";
import { reviewsRepository } from "#db/repositories/reviews.repository.js";
import { serviceCategory } from "#db/repositories/serviceCategory.repository.js";

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

    const checkServiceProvider =
      await serviceProviderRepository.findByEmail(email);
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

    const serviceProvider = await serviceProviderRepository.create({
      name,
      email,
      password: hashedPassword,
    });

    console.log(serviceProvider);

    res.status(201).json({
      message: "Service Provider Registered !",
      success: true,
      ServiceProvider: serviceProvider,
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

    const checkServiceProvider =
      await serviceProviderRepository.findByEmail(email);
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

    // check if account is suspended
    if (checkServiceProvider.isSuspended) {
      res.status(403).json({
        message: "Your account is Suspended. Please contact support.",
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
    await serviceProviderRepository.updateLastLogin(checkServiceProvider.id);

    // token generation
    const token = jwt.sign(
      {
        id: checkServiceProvider.id,
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
        id: checkServiceProvider.id,
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
      baseRate,
      rateUnit,
      servicePricing,
      workingHours,
      serviceArea,
    } = req.body;

    const provider =
      await serviceProviderRepository.findById(serviceProviderId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider not found!",
        success: false,
      });
      return;
    }

    // check if user tries to update email and that is not already in use by someone another
    if (email && email !== provider.email) {
      const emailExists = await serviceProviderRepository.findByEmail(email);
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

    // Handle baseRate - provider's base rate for services
    if (baseRate !== undefined) {
      const rate = parseFloat(baseRate);
      if (!isNaN(rate) && rate >= 0) {
        updateData.baseRate = rate;
      } else {
        res.status(400).json({
          message: "Invalid base rate. Must be a non-negative number",
          success: false,
        });
        return;
      }
    }

    // Handle rateUnit - pricing unit (per-visit, per-hour, etc.)
    if (rateUnit !== undefined) {
      const validRateUnits = ["per-visit", "per-hour", "per-day", "per-job"];
      if (validRateUnits.includes(rateUnit)) {
        updateData.rateUnit = rateUnit;
      } else {
        res.status(400).json({
          message: `Invalid rate unit. Must be one of: ${validRateUnits.join(", ")}`,
          success: false,
        });
        return;
      }
    }

    // Handle servicePricing - custom rates for specific service categories
    if (servicePricing !== undefined && Array.isArray(servicePricing)) {
      const validServicePricing = servicePricing
        .filter((sp: any) => {
          return sp.rate !== undefined && !isNaN(parseFloat(sp.rate));
        })
        .map((sp: any) => ({
          serviceCategoryId: sp.serviceCategoryId || undefined,
          rate: parseFloat(sp.rate),
          minRate: sp.minRate !== undefined ? parseFloat(sp.minRate) : undefined,
          maxRate: sp.maxRate !== undefined ? parseFloat(sp.maxRate) : undefined,
        }));

      if (validServicePricing.length > 0) {
        updateData.servicePricing = validServicePricing;
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
      // Handle both old flat format and new nested format for backwards compatibility
      if (Array.isArray(serviceArea)) {
        // New format: Array of {city, areas}
        const validServiceAreas = serviceArea
          .filter((sa: any) => sa.city && typeof sa.city === "string")
          .map((sa: any) => ({
            city: sa.city.trim(),
            areas: Array.isArray(sa.areas)
              ? sa.areas.filter((area: any) => area && typeof area === "string").map((area: string) => area.trim())
              : []
          }));

        if (validServiceAreas.length > 0) {
          updateData.serviceArea = validServiceAreas;
        }
      } else if (serviceArea.cities || serviceArea.areas) {
        // Old format: {cities: [], areas: []} - for backwards compatibility
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
    }

    const updatedProvider = await serviceProviderRepository.update(
      serviceProviderId,
      updateData,
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

    const provider =
      await serviceProviderRepository.findById(serviceProviderId);
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
    const activeRequests =
      await serviceRequestRepository.countActiveServicesForProvider(
        serviceProviderId,
      );

    if (activeRequests > 0) {
      res.status(400).json({
        message: `Cannot deactivate account. You have ${activeRequests} active service(s). Please complete or cancel them`,
        success: false,
      });
      return;
    }

    const deactivateProviders = await serviceProviderRepository.update(
      serviceProviderId,
      {
        isActive: false,
        deactivatedAt: new Date(),
      },
    );

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

    const result = await serviceProviderRepository.deleteMany({
      isActive: false,
      deactivateBefore: thirtyDaysAgo,
    });

    if (result.length > 0) {
      console.log(
        `[Cleanup] Deleted ${result.length} inactive SERVICE PROVIDER accounts (older than 30 days)`,
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
    const provider = await serviceProviderRepository.findByEmail(email);
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
    await serviceProviderRepository.update(provider.id, {
      reactivationToken,
      reactivationExpires,
    });

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
    const tokenValue = Array.isArray(token) ? token[0] : token;
    if (!token) {
      res.status(400).json({
        message: "Reactivation token is required",
        success: false,
      });
      return;
    }

    // Use raw MongoDB collection to bypass Mongoose select: false restriction
    const provider =
      await serviceProviderRepository.findByReactivationToken(tokenValue);

    if (!provider) {
      res.status(400).json({
        message:
          "Invalid or expired token. Please request a new reactivation link.",
        success: false,
      });
      return;
    }

    await serviceProviderRepository.update(provider.id, {
      isActive: true,
      deactivatedAt: null,
      reactivationToken: null,
      reactivationExpires: null,
    });

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

    const provider =
      await serviceProviderRepository.findById(serviceProviderId);

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

    const provider =
      await serviceProviderRepository.findById(serviceProviderId);
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
    await serviceProviderRepository.update(serviceProviderId, {
      availabilityStatus: status,
    });

    res.status(200).json({
      message: `Availability updated to: ${status}`,
      success: true,
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

    const providers = await serviceProviderRepository.findAll({
      isActive: true,
    });

    // Calculate pagination manually
    const totalProviders = providers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProviders = providers.slice(startIndex, endIndex);

    // Remove sensitive fields
    const sanitizedProviders = paginatedProviders.map(
      ({
        password,
        reactivationToken,
        reactivationExpires,
        suspensionReason,
        deactivatedAt,
        ...rest
      }) => rest,
    );

    res.status(200).json({
      message: "Providers Retrieved Successfully",
      success: true,
      data: sanitizedProviders,
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
    const serviceProviderIdValue = Array.isArray(serviceProviderId)
      ? serviceProviderId[0]
      : serviceProviderId;

    if (!serviceProviderId) {
      res.status(400).json({
        message: "Provider Id is required",
        success: false,
      });
      return;
    }

    const provider = await serviceProviderRepository.getPublicProfile(
      serviceProviderIdValue,
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

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;

    // Build search filters
    const searchFilters: any = {
      page: pageNum,
      limit: limitNum,
      sortBy: sortBy as string,
      order: order as "asc" | "desc",
    };

    if (skill) searchFilters.skill = skill as string;
    if (city) searchFilters.city = city as string;
    if (area) searchFilters.area = area as string;
    if (minRating) searchFilters.minRating = parseFloat(minRating as string);
    if (maxRating) searchFilters.maxRating = parseFloat(maxRating as string);
    if (pricingType) searchFilters.pricingType = pricingType as string;
    if (availabilityStatus)
      searchFilters.availabilityStatus = availabilityStatus as string;

    const result =
      await serviceProviderRepository.searchProviders(searchFilters);

    // Remove sensitive fields
    const sanitizedProviders = result.providers.map(
      ({
        password,
        reactivationToken,
        reactivationExpires,
        suspensionReason,
        deactivatedAt,
        lastLogin,
        ...rest
      }) => rest,
    );

    res.status(200).json({
      message: "Providers retrieved successfully",
      success: true,
      data: sanitizedProviders,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalProviders: result.total,
        limit: result.limit,
        hasNext: result.page < result.totalPages,
        hasPrev: result.page > 1,
      },
      filters: {
        skill: skill || null,
        city: city || null,
        area: area || null,
        minRating: minRating || null,
        maxRating: maxRating || null,
        pricingType: pricingType || null,
        availabilityStatus: availabilityStatus || null,
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Applying search filters",
      success: false,
    });
    return;
  }
};

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const serviceProviderId = (req as any).user.id;

    const provider = await serviceProviderRepository.findById(serviceProviderId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider not found",
        success: false,
      });
      return;
    }

    // Get all service requests for this provider
    const allRequests = await serviceRequestRepository.findByProviderId(serviceProviderId);

    // Count by status
    const totalAssignments = allRequests.length;
    const completedServices = allRequests.filter(r => r.status === 'completed').length;
    const inProgressServices = allRequests.filter(r => r.status === 'in-progress').length;
    const assignedServices = allRequests.filter(r => r.status === 'assigned').length;

    // Calculate total earnings from completed services
    const totalEarnings = allRequests
      .filter(r => r.status === 'completed' && r.finalPrice)
      .reduce((sum, r) => sum + Number(r.finalPrice || 0), 0);

    // Get rating stats
    const ratingStats = await reviewsRepository.getProviderStats(serviceProviderId);
    const averageRating = ratingStats.averageRating || 0;

    res.status(200).json({
      message: "Dashboard stats retrieved successfully",
      success: true,
      data: {
        totalAssignments,
        completedServices,
        inProgressServices,
        assignedServices,
        totalEarnings,
        averageRating,
        ratingDistribution: ratingStats.ratingDistribution || [],
        isAvailable: provider.availabilityStatus === 'available',
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      message: "Error fetching dashboard stats",
      success: false,
    });
  }
};

export const getMonthlyEarnings = async (req: Request, res: Response) => {
  try {
    const serviceProviderId = (req as any).user.id;
    const months = parseInt(req.query.months as string) || 6;

    const provider = await serviceProviderRepository.findById(serviceProviderId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider not found",
        success: false,
      });
      return;
    }

    // Get completed services for this provider
    const allRequests = await serviceRequestRepository.findByProviderId(serviceProviderId);
    const completedRequests = allRequests.filter(r => r.status === 'completed' && r.completedAt);

    // Group by month
    const monthlyEarnings: { [key: string]: { month: string; earnings: number } } = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = monthNames[date.getMonth()];

      monthlyEarnings[monthKey] = { month: monthName, earnings: 0 };
    }

    // Sum earnings by month
    completedRequests.forEach(request => {
      if (request.completedAt && request.finalPrice) {
        const date = new Date(request.completedAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyEarnings[monthKey]) {
          monthlyEarnings[monthKey].earnings += Number(request.finalPrice || 0);
        }
      }
    });

    const earningsData = Object.values(monthlyEarnings);

    res.status(200).json({
      message: "Monthly earnings retrieved successfully",
      success: true,
      data: earningsData,
    });
  } catch (error) {
    console.error("Error fetching monthly earnings:", error);
    res.status(500).json({
      message: "Error fetching monthly earnings",
      success: false,
    });
  }
};

export const getMonthlyPerformance = async (req: Request, res: Response) => {
  try {
    const serviceProviderId = (req as any).user.id;
    const months = parseInt(req.query.months as string) || 6;

    const provider = await serviceProviderRepository.findById(serviceProviderId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider not found",
        success: false,
      });
      return;
    }

    // Get all service requests for this provider
    const allRequests = await serviceRequestRepository.findByProviderId(serviceProviderId);
    const completedRequests = allRequests.filter(r => r.status === 'completed' && r.completedAt);

    // Group by month
    const monthlyData: { [key: string]: { month: string; completed: number; earnings: number } } = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = monthNames[date.getMonth()];

      monthlyData[monthKey] = { month: monthName, completed: 0, earnings: 0 };
    }

    // Sum by month
    completedRequests.forEach(request => {
      if (request.completedAt) {
        const date = new Date(request.completedAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].completed += 1;
          monthlyData[monthKey].earnings += Number(request.finalPrice || 0);
        }
      }
    });

    const performanceData = Object.values(monthlyData);

    res.status(200).json({
      message: "Monthly performance retrieved successfully",
      success: true,
      data: performanceData,
    });
  } catch (error) {
    console.error("Error fetching monthly performance:", error);
    res.status(500).json({
      message: "Error fetching monthly performance",
      success: false,
    });
  }
};

export const getProvidersByCategory = async (req: Request, res: Response) => {
  try {
    const { categoryId, city } = req.query;

    if (!categoryId || typeof categoryId !== 'string') {
      res.status(400).json({
        message: "Category ID is required",
        success: false,
      });
      return;
    }


    // Get category details to find required skills
    const category = await serviceCategory.findById(categoryId);
    if (!category) {
      res.status(404).json({
        message: "Service category not found",
        success: false,
      });
      return;
    }

    // Get all active providers
    const allProviders = await serviceProviderRepository.findAll();

    console.log('📊 Price Estimation Debug:');
    console.log('  Category ID:', categoryId);
    console.log('  Category:', category.name);
    console.log('  Required Skills:', category.requiredSkills);
    console.log('  Total providers in DB:', allProviders.length);
    console.log('  City filter:', city || 'none');

    // Filter providers who match the category requirements
    const matchingProviders = allProviders.filter((provider: any) => {
      // Provider must be active and not suspended
      if (!provider.isActive || provider.isSuspended) {
        return false;
      }

      // SKIP skill filtering for price estimation
      // We want to show all available providers to customers, not filter by skills
      // Skill matching will happen when providers actually accept requests
      // This gives customers more options and realistic price ranges

      // Filter by city if provided (only if customer has entered city)
      if (city && typeof city === 'string' && city.trim() !== '' && provider.serviceArea) {
        const cityLower = city.toLowerCase().trim();

        // Handle both old flat format and new nested format
        let servesCity = false;
        if (Array.isArray(provider.serviceArea)) {
          // New nested format: [{city, areas}]
          servesCity = provider.serviceArea.some((sa: any) =>
            sa.city && sa.city.toLowerCase().trim() === cityLower
          );
        } else if (provider.serviceArea.cities) {
          // Old flat format: {cities: [], areas: []}
          servesCity = provider.serviceArea.cities.some((c: string) =>
            c.toLowerCase().trim() === cityLower
          );
        }

        if (!servesCity) {
          console.log(`  ❌ Filtered out ${provider.name} - doesn't serve city ${city}`);
          return false;
        }
      }

      console.log(`  ✓ Included ${provider.name} - rate: ${provider.baseRate}`);
      return true;
    });

    console.log(`  Final matching providers: ${matchingProviders.length}`);

    // Transform provider data for frontend
    const providersData = matchingProviders.map((provider: any) => {
      const rate = Number(provider.baseRate) || 0;
      // Assign default rate of 400 if provider hasn't set their rate yet
      const finalRate = rate > 0 ? rate : 400;

      return {
        id: provider.id,
        name: provider.name,
        baseRate: finalRate,
        rateUnit: provider.rateUnit || provider.pricingType || 'per-visit',
        rating: Number(provider.averageRating) || 0,
        reviewCount: provider.totalReviews || 0,
        completedJobs: provider.totalJobsCompleted || 0,
        skills: provider.skills || [],
        serviceArea: provider.serviceArea,
        isAvailable: provider.availabilityStatus === 'available' || provider.isAvailable === true,
      };
    });

    // Sort by rating and then by completed jobs
    providersData.sort((a: any, b: any) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating; // Higher rating first
      }
      return b.completedJobs - a.completedJobs; // More jobs first
    });

    res.status(200).json({
      message: "Providers retrieved successfully",
      success: true,
      data: providersData,
      count: providersData.length,
    });
  } catch (error) {
    console.error("Error fetching providers by category:", error);
    res.status(500).json({
      message: "Error fetching providers",
      success: false,
    });
  }
};
