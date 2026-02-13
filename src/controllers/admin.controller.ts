import Admin from "#models/admin.model.js";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import ServiceCategories from "#models/serviceCategories.model.js";
import ServiceRequests from "#models/serviceRequests.model.js";
import ServiceProvider from "#models/serviceProvider.model.js";
import {
  sendServiceProviderSuspensionMail,
  sendServiceProviderUnsuspensionMail,
} from "#services/email.service.js";
import Customer from "#models/customer.model.js";

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
    const adminId = (req as any).user.id;

    if (!adminId) {
      res.status(400).json({
        message: "Admin Id Not Found",
        success: false,
      });
      return;
    }

    const admin = await Admin.findById(adminId).select("-password");
    if (!admin) {
      res.status(404).json({
        message: "Admin Not Found With this Details",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: `Account Details for: ${admin.name}`,
      success: true,
      admin,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Details for Admin",
      success: false,
    });
    return;
  }
};

// service categories management

export const createCategory = async (req: Request, res: Response) => {
  try {
    const {
      name,
      slug,
      description,
      icon,
      priceRange,
      commonServices,
      requiredSkills,
    } = req.body;

    if (!name || !slug) {
      res.status(400).json({
        message: "Name and slug are required to create a category",
        success: false,
      });
      return;
    }

    const existingCategory = await ServiceCategories.findOne({
      $or: [{ name }, { slug }],
    });
    if (existingCategory) {
      res.status(400).json({
        message: "Category with this name or slug already exists",
        success: false,
      });
      return;
    }

    // validating price range
    if (priceRange) {
      if (priceRange.min !== undefined && priceRange.max !== undefined) {
        if (priceRange.min >= priceRange.max) {
          res.status(400).json({
            message: "Minimum price must be less than maximum price",
            success: false,
          });
          return;
        }
      }
    }

    // validate common services if provided
    let validatedServices: any[] = [];
    if (commonServices && Array.isArray(commonServices)) {
      validatedServices = commonServices
        .filter((service: any) => service.name)
        .map((service: any) => ({
          name: service.name,
          typicalPrice: service.typicalPrice || 0,
          duration: service.duration || "N/A",
        }));
    }

    // validate required skills array if provided
    let validatedSkills: string[] = [];
    if (requiredSkills && Array.isArray(requiredSkills)) {
      validatedSkills = requiredSkills
        .filter((skill: any) => skill && typeof skill === "string")
        .map((skill: any) => skill.trim().toLowerCase());
    }

    const category = new ServiceCategories({
      name,
      slug,
      description,
      icon,
      priceRange,
      commonServices: validatedServices,
      requiredSkills: validatedSkills,
    });
    await category.save();

    res.status(201).json({
      message: "Service Category Created !",
      success: true,
      category,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Creating Service Category",
      success: false,
    });
    return;
  }
};

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const isActive = req.query.isActive;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";

    // building filter object
    const filter: any = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // build sort object
    const validSortFields = [
      "name",
      "createdAt",
      "updatedAt",
      "priceRange.min",
    ];
    const sortObj: any = {};
    if (validSortFields.includes(sortBy)) {
      sortObj[sortBy] = order === "asc" ? 1 : -1;
    } else {
      sortObj.createdAt = -1;
    }

    const categories = await ServiceCategories.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    const totalCategories = await ServiceCategories.countDocuments(filter);

    res.status(200).json({
      message: "Categories: ",
      success: true,
      data: categories,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCategories / limit),
        totalCategories,
        limit,
        hasNext: page < Math.ceil(totalCategories / limit),
        hasPrev: page > 1,
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Categories",
      success: false,
    });
    return;
  }
};

export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId) {
      res.status(400).json({
        message: "Category Id not provided",
        success: false,
      });
      return;
    }

    const category = await ServiceCategories.findById(categoryId);
    if (!category) {
      res.status(404).json({
        message: "Category Not Found",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: `${category.name} Details: `,
      success: true,
      data: category,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Category BY ID",
      success: false,
    });
    return;
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    // solution to problem remaining: admin can register category with same names
    const { categoryId } = req.params;
    const {
      name,
      slug,
      description,
      icon,
      priceRange,
      commonServices,
      requiredSkills,
    } = req.body;

    if (!categoryId) {
      res.status(400).json({
        message: "Category Id Not Provided !",
        success: false,
      });
      return;
    }

    const category = await ServiceCategories.findById(categoryId);
    if (!category) {
      res.status(404).json({
        message: "Category Not Found",
        success: false,
      });
      return;
    }

    const updateData: any = {};

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (slug) updateData.slug = slug;

    // validate and update price range
    if (priceRange) {
      if (
        priceRange.min !== undefined &&
        priceRange.max !== undefined &&
        priceRange.min >= priceRange.max
      ) {
        res.status(400).json({
          message: "Minimum price must be less than maximum price",
          success: false,
        });
        return;
      }
      updateData.priceRange = priceRange;
    }

    // validate and update common services
    if (commonServices !== undefined) {
      if (Array.isArray(commonServices)) {
        updateData.commonServices = commonServices
          .filter((service: any) => service.name)
          .map((service: any) => ({
            name: service.name,
            typicalPrice: service.typicalPrice || 0,
            duration: service.duration || "N/A",
          }));
      }
    }

    // validate and update required skills
    if (requiredSkills !== undefined) {
      if (Array.isArray(requiredSkills)) {
        updateData.requiredSkills = requiredSkills
          .filter((skill: any) => skill && typeof skill === "string")
          .map((skill: any) => skill.trim().toLowerCase());
      }
    }

    if (name) {
      const existingName = await ServiceCategories.findOne({
        name: name.trim(),
        _id: { $ne: categoryId as any },
      });

      if (existingName) {
        res.status(400).json({
          message: "Category Name already exists",
          success: false,
        });
        return;
      }

      updateData.name = name;
    }

    if (slug) {
      const normalSlug = slug.trim().toLowerCase();
      const existingSlug = await ServiceCategories.findOne({
        slug: normalSlug,
        _id: { $ne: categoryId as any },
      });

      if (existingSlug) {
        res.status(400).json({
          message: "Category slug already exists",
          success: false,
        });
        return;
      }

      updateData.slug = normalSlug;
    }

    const updatedCategory = await ServiceCategories.findByIdAndUpdate(
      categoryId,
      updateData,
      { new: true },
    );

    res.status(200).json({
      message: `Details for ${category.name} Updated !`,
      success: true,
      data: updatedCategory,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Updating Category Details",
      success: false,
    });
    return;
  }
};

export const toggleCategoryStatus = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId) {
      res.status(400).json({
        message: "Status is not provided",
        success: false,
      });
      return;
    }

    const category = await ServiceCategories.findById(categoryId);
    if (!category) {
      res.status(404).json({
        message: "Category Not Found",
        success: false,
      });
      return;
    }

    category.isActive = !category.isActive;
    await category.save();

    res.status(200).json({
      message: `Category ${category.isActive ? "activated" : "deactivated"} successfully !`,
      success: true,
      data: {
        categoryId: category._id,
        name: category.name,
        isActive: category.isActive,
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Toggling the status of Category",
      success: false,
    });
    return;
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId) {
      res.status(400).json({
        message: "Please provide category Id",
        success: false,
      });
      return;
    }

    const category = await ServiceCategories.findByIdAndDelete(categoryId);
    if (!category) {
      res.status(404).json({
        message: "No Category Found with this ID",
        success: false,
      });
      return;
    }

    // check if there are any active requests inside the category
    const requests = await ServiceRequests.countDocuments({
      serviceCategoryId: categoryId as any,
      status: {
        $in: ["requested", "assigned", "in_progress"],
      },
    });

    if (requests > 0) {
      res.status(400).json({
        message: `Cannot delete category. ${requests} active requests using this category. Please deactivate the category instead.`,
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: `Category Deleted !`,
      success: true,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Deleting Category",
      success: false,
    });
    return;
  }
};

// service provider management

export const getAllServiceProviders = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const isActive = req.query.isActive;
    const isSuspended = req.query.isSuspended;
    const search = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";

    // building filter object
    const filter: any = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    if (isSuspended !== undefined) {
      filter.isSuspended = isSuspended === "true";
    }

    // search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // building sort object
    const validSortFields = [
      "name",
      "createdAt",
      "email",
      "averageRating",
      "totalJobsCompleted",
    ];
    const sortObj: any = {};
    if (validSortFields.includes(sortBy)) {
      sortObj[sortBy] = order === "asc" ? 1 : -1;
    } else {
      sortObj.createdAt = -1;
    }

    const providers = await ServiceProvider.find(filter)
      .select(
        "-password -reactivationToken -suspensionReason -deactivatedAt -reactivationExpires",
      )
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    const totalProviders = await ServiceProvider.countDocuments(filter);

    res.status(200).json({
      message: "Providers retrieved successfully",
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
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Service Provider",
      success: false,
    });
    return;
  }
};

export const getServiceProviderById = async (req: Request, res: Response) => {
  try {
    const { serviceProviderId } = req.params;

    if (!serviceProviderId) {
      res.status(400).json({
        message: "Service Provider Id Not provided",
        success: false,
      });
      return;
    }

    const provider = await ServiceProvider.findById(serviceProviderId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider Not Found",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: `Details for ${provider.name}: `,
      success: true,
      data: provider,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Service Provider BY ID",
      success: false,
    });
    return;
  }
};

export const suspendProvider = async (req: Request, res: Response) => {
  try {
    const { serviceProviderId } = req.params;
    const { suspensionReason } = req.body;

    if (!serviceProviderId) {
      res.status(400).json({
        message: "Provider ID not found",
        success: false,
      });
      return;
    }

    if (!suspensionReason) {
      res.status(400).json({
        message: "Please provide suspension reason",
        success: false,
      });
      return;
    }

    const provider = await ServiceProvider.findById(serviceProviderId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider not found",
        success: false,
      });
      return;
    }

    if (provider.isSuspended) {
      res.status(400).json({
        message: "Provider already suspended",
        success: false,
      });
      return;
    }

    const activeRequests = await ServiceRequests.countDocuments({
      serviceProviderId: serviceProviderId as any,
      status: {
        $in: ["assigned", "in_progress"],
      },
    });

    if (activeRequests > 0) {
      res.status(400).json({
        message: `Cannot suspend account. Provider has ${activeRequests} active service request(s). Please complete or cancel them first.`,
        success: false,
      });
      return;
    }

    // suspending the provider
    provider.isSuspended = true;
    provider.suspensionReason = suspensionReason;
    provider.isActive = false;
    await provider.save();

    // sending suspension email
    await sendServiceProviderSuspensionMail(
      provider.email,
      provider.name,
      suspensionReason,
    );

    res.status(200).json({
      message: `Account suspended for ${provider.name}`,
      success: true,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Suspending Service Provider",
      success: false,
    });
    return;
  }
};

export const unsuspendProvider = async (req: Request, res: Response) => {
  try {
    const { serviceProviderId } = req.params;

    if (!serviceProviderId) {
      res.status(400).json({
        message: "Provide ServiceProvider Id",
        success: false,
      });
      return;
    }

    const provider = await ServiceProvider.findById(serviceProviderId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider Not Found",
        success: false,
      });
      return;
    }

    if (!provider.isSuspended) {
      res.status(400).json({
        message: "Provider Alrady Un-Suspended",
        success: false,
      });
      return;
    }

    provider.isSuspended = false;
    provider.isActive = true;
    provider.suspensionReason = undefined;
    await provider.save();

    // send unsuspension email
    await sendServiceProviderUnsuspensionMail(provider.email, provider.name);

    res.status(200).json({
      message: `Account un-suspended for ${provider.name}`,
      success: true,
      provider: {
        id: provider._id,
        name: provider.name,
        email: provider.email,
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Un-Suspending Service Provider",
      success: false,
    });
    return;
  }
};

// customer management

export const getAllCustomers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const isActive = req.query.isActive;
    const search = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";

    // building filter object
    const filter: any = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // search funtionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // building sort object
    const validSortFields = ["name", "email", "createdAt"];
    const sortObj: any = {};
    if (validSortFields.includes(sortBy)) {
      sortObj[sortBy] = order === "asc" ? 1 : -1;
    } else {
      sortObj.createdAt = -1;
    }

    const customers = await Customer.find(filter)
      .select("-password -reactivationToken -reactivationExpires")
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    const totalCustomers = await Customer.countDocuments(filter);

    res.status(200).json({
      message: "customers retrieved successfuly !",
      success: true,
      data: customers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCustomers / limit),
        totalCustomers,
        limit,
        hasNext: page < Math.ceil(totalCustomers / limit),
        hasPrev: page > 1,
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Customers",
      success: false,
    });
    return;
  }
};

export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      res.status(400).json({
        message: "Customer Id not provided",
        success: false,
      });
      return;
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Doesn't Exist !",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: `Details for ${customer.name}: `,
      success: true,
      data: customer,
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Customer BY ID",
      success: false,
    });
    return;
  }
};

// dashboard management

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // fetching current date range for todays stats
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date()
    endOfDay.setHours(23,59,59,999)

    // customer statistics
    const totalCustomers = await Customer.countDocuments()
    const activeCustomers = await Customer.countDocuments({
        isActive: true
    })
    const newCustomersToday = await Customer.countDocuments({
        createdAt: {
            $gte: startOfDay,
            $lte: endOfDay
        }
    })

    // service provider statisticsd
    const totalProviders = await ServiceProvider.countDocuments()
    const activeProviders = await ServiceProvider.countDocuments({
        isActive: true,
        isSuspended: false
    })
    const suspendedProviders = await ServiceProvider.countDocuments({
        isSuspended: true
    })
    const newProvidersToday = await ServiceProvider.countDocuments({
        createdAt: {
            $gte: startOfDay,
            $lte: endOfDay
        }
    })

    // service categories statistics
    const totalServiceCategories = await ServiceCategories.countDocuments()
    const activeServiceCategories = await ServiceCategories.countDocuments({
        isActive: true
    })

    // service requests statistics
    const totalRequests = await ServiceRequests.countDocuments()
    const requestedCount = await ServiceRequests.countDocuments({
        status: "requested"
    })
    const assignedCount = await ServiceRequests.countDocuments({
        status: "assigned"
    })
    const inProgressCount = await ServiceRequests.countDocuments({
        status: "in_progress"
    })
    const completedCount = await ServiceRequests.countDocuments({
        status: "completed"
    })
    const cancelledCount = await ServiceRequests.countDocuments({
        status: "cancelled"
    })

    // active requests (requested + assigned + in_progress)
    const activeRequests = requestedCount + assignedCount + inProgressCount

    // total new registrations today
    const newRegistrationsToday = newCustomersToday + newProvidersToday

    res.status(200).json({
        message: "Dashboard Statistics: ",
        success: true,
        data: {
            customers: {
                total: totalCustomers,
                active: activeCustomers,
                inactive: totalCustomers - activeCustomers,
                newToday: newCustomersToday
            },
            providers: {
                total: totalProviders,
                active: activeProviders,
                suspended: suspendedProviders,
                inactive: totalProviders - activeProviders,
                newToday: newProvidersToday
            },
            categories: {
                total: totalServiceCategories,
                active: activeServiceCategories,
                inactive: totalServiceCategories - activeServiceCategories
            },
            requests: {
                total: totalRequests,
                active: activeRequests,
                requested: requestedCount,
                assigned: assignedCount,
                inProgress: inProgressCount,
                completed: completedCount,
                cancelled: cancelledCount
            },
            overview: {
                newRegistrationsToday: newRegistrationsToday,
                activeRequests: activeRequests
            }
        }
    })
    return
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Dashboard Stats",
      success: false,
    });
    return;
  }
};
