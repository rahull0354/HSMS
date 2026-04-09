import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  sendServiceProviderSuspensionMail,
  sendServiceProviderUnsuspensionMail,
} from "#services/email.service.js";
import { adminRepository } from "#db/repositories/admin.repository.js";
import { serviceCategory } from "#db/repositories/serviceCategory.repository.js";
import { serviceRequestRepository } from "#db/repositories/serviceRequests.repository.js";
import { serviceProviderRepository } from "#db/repositories/serviceProvider.repository.js";
import { invoiceRepository } from "#db/repositories/invoice.repository.js";

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
    // const adminCount = await adminRepository.count();
    // if (adminCount > 0) {
    //   res.status(403).json({
    //     message: "Admin already exists. Only one admin account allowed.",
    //     success: false,
    //   });
    //   return;
    // }

    const adminCheck = await adminRepository.findByEmail(email);
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
    await adminRepository.create({
      name,
      email,
      password: hashedPassword,
    });

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

    const checkAdmin = await adminRepository.findByEmail(email);
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
    await adminRepository.updateLastLogin(checkAdmin.id);

    // token generation
    const token = jwt.sign(
      {
        id: checkAdmin.id,
        role: "admin",
      },
      process.env.JWT_SECRET_KEY || "",
      { expiresIn: "7d" },
    );

    res.status(200).json({
      message: `Welcome ${checkAdmin.name}`,
      success: true,
      checkAdmin: {
        id: checkAdmin.id,
        name: checkAdmin.name,
        email: checkAdmin.email,
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

    const admin = await adminRepository.findById(adminId);
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
      adminCommission,
    } = req.body;

    if (!name || !slug) {
      res.status(400).json({
        message: "Name and slug are required to create a category",
        success: false,
      });
      return;
    }

    const existingCategory = await serviceCategory.findCategoryByNameOrSlug(name, slug);
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

    // validate and set admin commission
    let validatedCommission: {
      type: "fixed" | "percentage" | "hybrid";
      fixed?: number;
      percentage?: number;
      minCommission?: number;
      maxCommission?: number;
    };

    if (adminCommission) {
      // Validate commission type
      if (!["fixed", "percentage", "hybrid"].includes(adminCommission.type)) {
        res.status(400).json({
          message: "Invalid commission type. Must be 'fixed', 'percentage', or 'hybrid'",
          success: false,
        });
        return;
      }

      validatedCommission = {
        type: adminCommission.type,
      };

      // Validate based on commission type
      if (adminCommission.type === "fixed") {
        if (!adminCommission.fixed || adminCommission.fixed < 0) {
          res.status(400).json({
            message: "Fixed commission amount is required and must be non-negative",
            success: false,
          });
          return;
        }
        validatedCommission.fixed = adminCommission.fixed;
      }

      if (adminCommission.type === "percentage") {
        if (
          adminCommission.percentage === undefined ||
          adminCommission.percentage < 0 ||
          adminCommission.percentage > 100
        ) {
          res.status(400).json({
            message: "Percentage commission must be between 0 and 100",
            success: false,
          });
          return;
        }
        validatedCommission.percentage = adminCommission.percentage;

        // Optional min/max for percentage
        if (adminCommission.minCommission !== undefined) {
          validatedCommission.minCommission = adminCommission.minCommission;
        }
        if (adminCommission.maxCommission !== undefined) {
          validatedCommission.maxCommission = adminCommission.maxCommission;
        }
      }

      if (adminCommission.type === "hybrid") {
        if (
          !adminCommission.percentage ||
          adminCommission.percentage < 0 ||
          adminCommission.percentage > 100
        ) {
          res.status(400).json({
            message: "Hybrid commission requires percentage between 0 and 100",
            success: false,
          });
          return;
        }
        if (!adminCommission.fixed || adminCommission.fixed < 0) {
          res.status(400).json({
            message: "Hybrid commission requires a fixed base amount",
            success: false,
          });
          return;
        }
        validatedCommission.percentage = adminCommission.percentage;
        validatedCommission.fixed = adminCommission.fixed;

        // Optional min/max for hybrid
        if (adminCommission.minCommission !== undefined) {
          validatedCommission.minCommission = adminCommission.minCommission;
        }
        if (adminCommission.maxCommission !== undefined) {
          validatedCommission.maxCommission = adminCommission.maxCommission;
        }
      }
    } else {
      // Default commission: 15% percentage
      validatedCommission = {
        type: "percentage",
        percentage: 15,
      };
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

    const category = await serviceCategory.createCategory({
      name,
      slug,
      description,
      icon,
      priceRange,
      adminCommission: validatedCommission,
      commonServices: validatedServices,
      requiredSkills: validatedSkills,
    });

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
    
    const isActive = req.query.isActive;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";

    // building filter object
    const filter: any = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const result = await serviceCategory.findAllCategories(filter, {page, limit})

    res.status(200).json({
      message: "Categories: ",
      success: true,
      data: result.categories,
      pagination: {
        currentPage: page,
        totalPages: result.totalPages,
        totalCategories: result.total,
        limit,
        hasNext: page < result.totalPages,
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
    const categoryIdValue = Array.isArray(categoryId) ? categoryId[0] : categoryId

    if (!categoryId) {
      res.status(400).json({
        message: "Category Id not provided",
        success: false,
      });
      return;
    }

    const category = await serviceCategory.findCategoryById(categoryIdValue);
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

export const getCategoryBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const slugValue = Array.isArray(slug) ? slug[0] : slug;

    if (!slugValue) {
      res.status(400).json({
        message: "Slug not provided",
        success: false,
      });
      return;
    }

    const category = await serviceCategory.findCategoryBySlug(slugValue);
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
      message: "Error Fetching Category BY Slug",
      success: false,
    });
    return;
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const categoryIdValue = Array.isArray(categoryId) ? categoryId[0] : categoryId
    const {
      name,
      slug,
      description,
      icon,
      priceRange,
      commonServices,
      requiredSkills,
      adminCommission,
    } = req.body;

    if (!categoryId) {
      res.status(400).json({
        message: "Category Id Not Provided !",
        success: false,
      });
      return;
    }

    const category = await serviceCategory.findCategoryById(categoryIdValue);
    if (!category) {
      res.status(404).json({
        message: "Category Not Found",
        success: false,
      });
      return;
    }

    const updateData: any = {};

    if (name) {
        const existingName = await serviceCategory.checkCategoryNameExists(name, categoryIdValue)

        if(existingName) {
            res.status(400).json({
                message: "Category Name already Exists",
                success: false
            })
            return
        }
        updateData.name = name
    }

    if(slug) {
        const normalSlug = slug.trim().toLowerCase()
        const existingSlug = await serviceCategory.checkCategorySlugExists(normalSlug, categoryIdValue)

        if(existingSlug) {
            res.status(400).json({
                message: "Category slug already exists",
                success: false
            })
            return
        }
        updateData.slug = slug
    }

    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;

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

    // validate and update admin commission
    if (adminCommission) {
      // Validate commission type
      if (!["fixed", "percentage", "hybrid"].includes(adminCommission.type)) {
        res.status(400).json({
          message: "Invalid commission type. Must be 'fixed', 'percentage', or 'hybrid'",
          success: false,
        });
        return;
      }

      const validatedCommission: {
        type: "fixed" | "percentage" | "hybrid";
        fixed?: number;
        percentage?: number;
        minCommission?: number;
        maxCommission?: number;
      } = {
        type: adminCommission.type,
      };

      // Validate based on commission type
      if (adminCommission.type === "fixed") {
        if (adminCommission.fixed !== undefined && adminCommission.fixed < 0) {
          res.status(400).json({
            message: "Fixed commission must be non-negative",
            success: false,
          });
          return;
        }
        if (adminCommission.fixed !== undefined) {
          validatedCommission.fixed = adminCommission.fixed;
        }
      }

      if (adminCommission.type === "percentage") {
        if (
          adminCommission.percentage !== undefined &&
          (adminCommission.percentage < 0 || adminCommission.percentage > 100)
        ) {
          res.status(400).json({
            message: "Percentage commission must be between 0 and 100",
            success: false,
          });
          return;
        }
        if (adminCommission.percentage !== undefined) {
          validatedCommission.percentage = adminCommission.percentage;
        }
        if (adminCommission.minCommission !== undefined) {
          validatedCommission.minCommission = adminCommission.minCommission;
        }
        if (adminCommission.maxCommission !== undefined) {
          validatedCommission.maxCommission = adminCommission.maxCommission;
        }
      }

      if (adminCommission.type === "hybrid") {
        if (
          adminCommission.percentage !== undefined &&
          (adminCommission.percentage < 0 || adminCommission.percentage > 100)
        ) {
          res.status(400).json({
            message: "Hybrid commission percentage must be between 0 and 100",
            success: false,
          });
          return;
        }
        if (
          adminCommission.fixed !== undefined &&
          adminCommission.fixed < 0
        ) {
          res.status(400).json({
            message: "Hybrid commission fixed amount must be non-negative",
            success: false,
          });
          return;
        }
        if (adminCommission.percentage !== undefined) {
          validatedCommission.percentage = adminCommission.percentage;
        }
        if (adminCommission.fixed !== undefined) {
          validatedCommission.fixed = adminCommission.fixed;
        }
        if (adminCommission.minCommission !== undefined) {
          validatedCommission.minCommission = adminCommission.minCommission;
        }
        if (adminCommission.maxCommission !== undefined) {
          validatedCommission.maxCommission = adminCommission.maxCommission;
        }
      }

      updateData.adminCommission = validatedCommission;
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

    const updatedCategory = await serviceCategory.updateCategoryById(categoryIdValue, updateData);

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
    const categoryIdValue = Array.isArray(categoryId) ? categoryId[0] : categoryId

    if (!categoryId) {
      res.status(400).json({
        message: "Status is not provided",
        success: false,
      });
      return;
    }

    const category = await serviceCategory.findCategoryById(categoryIdValue);
    if (!category) {
      res.status(404).json({
        message: "Category Not Found",
        success: false,
      });
      return;
    }

    
    const updatedCategory = await serviceCategory.toggleCategoryStatus(categoryIdValue)

    res.status(200).json({
      message: `Category ${category.isActive ? "activated" : "deactivated"} successfully !`,
      success: true,
      data: {
        categoryId: updatedCategory?.id,
        name: updatedCategory?.name,
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
    const categoryIdValue = Array.isArray(categoryId) ? categoryId[0] : categoryId

    if (!categoryId) {
      res.status(400).json({
        message: "Please provide category Id",
        success: false,
      });
      return;
    }

    const category = await serviceCategory.findCategoryById(categoryIdValue);
    if (!category) {
      res.status(404).json({
        message: "No Category Found with this ID",
        success: false,
      });
      return;
    }

    // check if there are any active requests inside the category
    const requests = await serviceRequestRepository.countActiveRequestsInCategory(categoryIdValue)

    if (requests > 0) {
      res.status(400).json({
        message: `Cannot delete category. ${requests} active requests using this category. Please deactivate the category instead.`,
        success: false,
      });
      return;
    }

    await serviceCategory.deleteCategory(categoryIdValue)

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

    const isActive = req.query.isActive;
    const isSuspended = req.query.isSuspended;
    const search = req.query.search as string;

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
      filter.search = search
    }

    const result = await adminRepository.getAllServiceProviders(filter, {page, limit})

    res.status(200).json({
      message: "Providers retrieved successfully",
      success: true,
      data: result.providers,
      pagination: {
        currentPage: page,
        totalPages: result.totalPages,
        totalProviders: result.total,
        limit,
        hasNext: page < result.totalPages,
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
    const serviceProviderIdValue = Array.isArray(serviceProviderId) ? serviceProviderId[0] : serviceProviderId

    if (!serviceProviderId) {
      res.status(400).json({
        message: "Service Provider Id Not provided",
        success: false,
      });
      return;
    }

    const provider = await adminRepository.findProviderWithoutCreds(serviceProviderIdValue);
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
    const serviceProviderIdValue = Array.isArray(serviceProviderId) ? serviceProviderId[0] : serviceProviderId
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

    const provider = await serviceProviderRepository.findById(serviceProviderIdValue);
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

    const activeRequests = await serviceRequestRepository.countActiveServicesForProvider(serviceProviderIdValue);

    if (activeRequests > 0) {
      res.status(400).json({
        message: `Cannot suspend account. Provider has ${activeRequests} active service request(s). Please complete or cancel them first.`,
        success: false,
      });
      return;
    }

    // suspending the provider
    await adminRepository.suspendProviderAccount(serviceProviderIdValue, suspensionReason)

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
    const serviceProviderIdValue = Array.isArray(serviceProviderId) ? serviceProviderId[0] : serviceProviderId

    if (!serviceProviderId) {
      res.status(400).json({
        message: "Provide ServiceProvider Id",
        success: false,
      });
      return;
    }

    const provider = await serviceProviderRepository.findById(serviceProviderIdValue);
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

    await adminRepository.unsuspendProviderAccount(serviceProviderIdValue)

    // send unsuspension email
    await sendServiceProviderUnsuspensionMail(provider.email, provider.name);

    res.status(200).json({
      message: `Account un-suspended for ${provider.name}`,
      success: true,
      provider: {
        id: provider.id,
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
    const isActive = req.query.isActive;
    const search = req.query.search as string;

    // building filter object
    const filter: any = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // search funtionality
    if (search) {
      filter.search = search
    }

    // building sort object
    const result = await adminRepository.findAllCustomers(filter, {page, limit})

    res.status(200).json({
      message: "customers retrieved successfuly !",
      success: true,
      data: result.customers,
      pagination: {
        currentPage: page,
        totalPages: result.totalPages,
        totalCustomers: result.total,
        limit,
        hasNext: page < result.totalPages,
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
    const idValue = Array.isArray(customerId) ? customerId[0] : customerId

    if (!idValue) {
      res.status(400).json({
        message: "Customer Id not provided",
        success: false,
      });
      return;
    }

    const customer = await adminRepository.findCustomersWithoutCreds(idValue);
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
    const stats = await adminRepository.getDashboardStats()
    const revenueStats = await invoiceRepository.getRevenueStats()

    // Transform stats to match frontend expectations
    const transformedStats = {
      totalUsers: stats.customers.total + stats.providers.total,
      totalProviders: stats.providers.total,
      totalCustomers: stats.customers.total,
      totalCategories: stats.categories.total,
      totalRequests: stats.requests.total,
      pendingRequests: stats.requests.requested,
      inProgressRequests: stats.requests.inProgress,
      completedRequests: stats.requests.completed,
      cancelledRequests: stats.requests.cancelled,
      totalRevenue: revenueStats.totalRevenue,
      pendingRevenue: revenueStats.pendingRevenue,
      totalAmountProcessed: revenueStats.totalAmountProcessed,
      paidInvoices: revenueStats.invoiceCounts.paid,
      pendingInvoices: revenueStats.invoiceCounts.pending,
      activeProviders: stats.providers.active,
      suspendedProviders: stats.providers.suspended,
    };

    res.status(200).json({
        message: "Dashboard Statistics: ",
        success: true,
        data: transformedStats
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

export const getServiceDistribution = async (req: Request, res: Response) => {
  try {
    // Get service distribution by category
    const distribution = await serviceRequestRepository.getServiceDistributionByCategory();

    // Get all categories to map IDs to names
    const allCategories = await serviceCategory.getAllCategories();

    // Create a map of category ID to category details
    const categoryMap = new Map();
    allCategories.forEach((cat: any) => {
      categoryMap.set(cat.id, {
        name: cat.name,
        slug: cat.slug,
      });
    });

    // Transform distribution data with category names
    const transformedDistribution = distribution.map((item) => {
      const categoryInfo = categoryMap.get(item.serviceCategoryId);
      return {
        categoryId: item.serviceCategoryId,
        name: categoryInfo?.name || 'Unknown Category',
        slug: categoryInfo?.slug || 'unknown',
        count: item.count,
      };
    });

    // Sort by count (descending)
    transformedDistribution.sort((a, b) => b.count - a.count);

    res.status(200).json({
      message: "Service Distribution Data",
      success: true,
      data: transformedDistribution,
    });
    return;
  } catch (error) {
    console.error("Error fetching service distribution:", error);
    res.status(500).json({
      message: "Error Fetching Service Distribution",
      success: false,
    });
    return;
  }
};

// Revenue distribution - shows how earnings are split between admin and provider
export const getRevenueDistribution = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as "paid" | "pending" | "overdue" | "cancelled" | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const distribution = await invoiceRepository.getRevenueDistribution({
      status,
      startDate,
      endDate,
    });

    res.status(200).json({
      message: "Revenue Distribution - Admin vs Provider Earnings",
      success: true,
      data: distribution,
    });
    return;
  } catch (error) {
    console.error("Error fetching revenue distribution:", error);
    res.status(500).json({
      message: "Error Fetching Revenue Distribution",
      success: false,
    });
    return;
  }
};

// Extract earnings breakdown from a specific service
export const getServiceEarnings = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const requestIdValue = Array.isArray(requestId) ? requestId[0] : requestId;

    if (!requestIdValue) {
      res.status(400).json({
        message: "Request ID is required",
        success: false,
      });
      return;
    }

    const earnings = await invoiceRepository.extractEarningsFromService(requestIdValue);

    if (!earnings) {
      res.status(404).json({
        message: "No invoice found for this service request",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: "Service Earnings Breakdown",
      success: true,
      data: earnings,
    });
    return;
  } catch (error) {
    console.error("Error extracting service earnings:", error);
    res.status(500).json({
      message: "Error Extracting Service Earnings",
      success: false,
    });
    return;
  }
}

export const getProviderEarnings = async (req: Request, res: Response) => {
  try {

    // Get all service providers with their basic info
    const allProviders = await adminRepository.getAllServiceProviders();

    // Import repositories we need
    const { paymentRepository } = await import("#db/repositories/payment.repository.js");
    const { bankAccountRepository } = await import("#db/repositories/bankAccount.repository.js");

    // Get earnings data for each provider
    const providersWithEarnings = await Promise.all(
      allProviders.providers.map(async (provider: any) => {
        try {
          // Get completed payments (earnings)
          const completedPayments = await paymentRepository.getAllPayments({
            serviceProviderId: provider.id,
            status: 'completed'
          });

          // Get pending payments
          const pendingPayments = await paymentRepository.getAllPayments({
            serviceProviderId: provider.id,
            status: 'initiated'
          });

          // Calculate totals
          const totalEarnings = completedPayments.payments.reduce((sum: number, p: any) =>
            sum + parseFloat(p.amount || 0), 0
          );

          const pendingEarnings = pendingPayments.payments.reduce((sum: number, p: any) =>
            sum + parseFloat(p.amount || 0), 0
          );

          // Get bank verification status - use correct method name
          const bankAccounts = await bankAccountRepository.getProviderBankAccounts(provider.id);
          const bankDetailsVerified = bankAccounts.some((ba: any) => ba.isVerified === true);

          // Get last payment date
          const lastPayment = completedPayments.payments
            .filter((p: any) => p.completedAt)
            .sort((a: any, b: any) =>
              new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
            )[0];

          return {
            providerId: provider.id,
            providerName: provider.name,
            providerEmail: provider.email,
            totalEarnings: totalEarnings,
            pendingEarnings: pendingEarnings,
            completedPayments: completedPayments.payments.length,
            pendingPayments: pendingPayments.payments.length,
            averageRating: provider.averageRating || null,
            totalServices: provider.totalJobsCompleted || 0,
            lastPaymentDate: lastPayment?.completedAt || null,
            bankDetailsVerified: bankDetailsVerified,
          };
        } catch (providerError: any) {
          console.error(`Error processing provider ${provider.id}:`, providerError);
          // Return default values for providers with errors
          return {
            providerId: provider.id,
            providerName: provider.name,
            providerEmail: provider.email,
            totalEarnings: 0,
            pendingEarnings: 0,
            completedPayments: 0,
            pendingPayments: 0,
            averageRating: provider.averageRating || null,
            totalServices: provider.totalJobsCompleted || 0,
            lastPaymentDate: null,
            bankDetailsVerified: false,
          };
        }
      })
    );

    // Calculate overall stats
    const stats = {
      totalProviders: allProviders.providers.length,
      totalEarnings: providersWithEarnings.reduce((sum, p) => sum + p.totalEarnings, 0),
      pendingEarnings: providersWithEarnings.reduce((sum, p) => sum + p.pendingEarnings, 0),
      completedPayouts: providersWithEarnings.reduce((sum, p) => sum + p.completedPayments, 0),
      pendingPayouts: providersWithEarnings.reduce((sum, p) => sum + p.pendingPayments, 0),
    };

    res.status(200).json({
      message: "Provider earnings fetched successfully",
      success: true,
      data: {
        earnings: providersWithEarnings,
        stats: stats,
      },
    });
    return;
  } catch (error: any) {
    console.error("❌ [ADMIN] Error fetching provider earnings:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch provider earnings",
      success: false,
    });
    return;
  }
};
