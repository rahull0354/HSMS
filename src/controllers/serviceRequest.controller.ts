import Customer from "#models/customer.model.js";
import Notification from "#models/notification.model.js";
import ServiceCategories from "#models/serviceCategories.model.js";
import ServiceProvider from "#models/serviceProvider.model.js";
import ServiceRequests from "#models/serviceRequests.model.js";
import {
  handleCancellationNotifications,
  handleRequestAcceptedNotifications,
  handleReschedulingNotifications,
} from "#services/notification.service.js";
import { Request, Response } from "express";

export const createServiceRequest = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const {
      serviceType,
      serviceCategoryId,
      serviceTitle,
      serviceDescription,
      schedule,
      serviceAddress,
      beforeImages,
      estimatedPrice,
      commonServiceName,
    } = req.body;

    if (
      !serviceType ||
      !serviceCategoryId ||
      !serviceTitle ||
      !schedule ||
      !serviceAddress
    ) {
      res.status(400).json({
        message: "Please provide all required fields",
        success: false,
      });
      return;
    }

    // validating customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Not Found",
        success: false,
      });
      return;
    }

    if (!customer.isActive) {
      res.status(403).json({
        message:
          "Your account is deactivated. Please reactivate to create service requests.",
        success: false,
      });
      return;
    }

    // validating service category
    const serviceCategory = await ServiceCategories.findOne({
      _id: serviceCategoryId,
      isActive: true,
    });
    if (!serviceCategory) {
      res.status(404).json({
        message: "Service Category Not Found",
        success: false,
      });
      return;
    }

    // scheduling validation for a request
    if (!schedule.date || !schedule.timeSlot) {
      res.status(400).json({
        message: "Schedule must include date and timeslot",
        success: false,
      });
      return;
    }

    const validTimeSlots = ["morning", "afternoon", "evening"];
    if (!validTimeSlots.includes(schedule.timeSlot)) {
      res.status(400).json({
        message: `Invalid Time Slot. Must be one of: ${validTimeSlots.join(", ")}`,
        success: false,
      });
      return;
    }

    const scheduleDate = new Date(schedule.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (scheduleDate < today) {
      res.status(400).json({
        message: "Schedule date must be today or in the future",
        sucess: false,
      });
      return;
    }

    if (
      !serviceAddress.street ||
      !serviceAddress.city ||
      !serviceAddress.state ||
      !serviceAddress.pincode
    ) {
      res.status(400).json({
        message:
          "Service address must include: street, city, state and pincode",
        success: false,
      });
      return;
    }

    // calculating estimated price from category
    let finalEstimatedPrice = estimatedPrice || 0;
    let selectedCommonService = null;
    let priceBreakdown = "";

    // check if a customer selected a common service from category
    if (
      commonServiceName &&
      serviceCategory.commonServices &&
      serviceCategory.commonServices.length > 0
    ) {
      selectedCommonService = serviceCategory.commonServices.find(
        (service) =>
          service.name.toLowerCase() === commonServiceName.toLowerCase(),
      );

      if (selectedCommonService) {
        finalEstimatedPrice = selectedCommonService.typicalPrice;
        priceBreakdown = `Standard ${selectedCommonService.name} service (${selectedCommonService.duration})`;
      }
    }

    // if no common service selected, use category price range
    if (!finalEstimatedPrice && serviceCategory.priceRange) {
      const avgPrice =
        (serviceCategory.priceRange.min + serviceCategory.priceRange.max) / 2;
      finalEstimatedPrice = avgPrice;
      priceBreakdown = `Estimated price based on ${serviceCategory.name} category range (${serviceCategory.priceRange.min} - ${serviceCategory.priceRange.max}${serviceCategory.priceRange.unit || ""})`;
    }

    // check active service providers
    const availableServiceProviders = await ServiceProvider.countDocuments({
      isActive: true,
      isSuspended: false,
      availabilityStatus: "available",
      $or: [
        {
          "serviceArea.cities": {
            $in: [serviceAddress.city.toLowerCase()],
          },
        },
        {
          "serviceArea.areas": {
            $in: [serviceAddress.city.toLowerCase()],
          },
        },
      ],
      skills: {
        $in: serviceCategory.requiredSkills || [],
      },
    });

    const hasAvailableProviders = availableServiceProviders > 0;

    // creating the request
    const newServiceRequest = new ServiceRequests({
      customerId,
      serviceType: serviceType.trim().toLowerCase(),
      serviceCategoryId,
      serviceTitle: serviceTitle.trim(),
      serviceDescription: serviceDescription?.trim() || "",
      schedule: {
        date: scheduleDate,
        timeSlot: schedule.timeSlot,
        preferredTime: schedule.preferredTime || "",
      },
      serviceAddress: {
        street: serviceAddress.street.trim(),
        city: serviceAddress.city.trim().toLowerCase(),
        state: serviceAddress.state.trim().toLowerCase(),
        pincode: serviceAddress.pincode.trim(),
        landmarks: serviceAddress.landmarks?.trim() || "",
      },
      beforeImages: beforeImages || [],
      afterImages: [],
      estimatedPrice: finalEstimatedPrice,
      finalPrice: 0,
      pricingDetails: {
        baseCharge: finalEstimatedPrice,
        additionalCharge: 0,
        breakdown:
          priceBreakdown || `Break service charge for ${serviceCategory.name}`,
      },
      paymentStatus: "pending",
      paymentMethod: "",
      status: "requested",
      statusHistory: [
        {
          status: "requested",
          timeStamp: new Date(),
          note: "Service Request Created",
          updatedBy: "customer",
        },
      ],
      isRecurring: false,
      recurringPattern: undefined,
      parentRequestId: undefined,
      completedAt: undefined,
    });

    await newServiceRequest.save();

    res.status(201).json({
      message: `Service Request for: ${serviceCategory.name} category created !`,
      success: true,
      data: {
        serviceRequest: newServiceRequest,
        category: {
          id: serviceCategory._id,
          name: serviceCategory.name,
          priceRange: serviceCategory.priceRange,
          commonServices: serviceCategory.commonServices || [],
        },
        pricing: {
          estimatedPrice: finalEstimatedPrice,
          breakdown: priceBreakdown,
        },
        availability: {
          hasAvailableProviders,
          availableProvidersCount: hasAvailableProviders
            ? `${availableServiceProviders} service provider(s) available in your area`
            : "No providers currently available in your area. We'll notify you when one becomes available",
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Creating Service Request",
      success: false,
    });
    return;
  }
};

export const getMyServiceRequests = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;

    const status = req.query.status as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";

    // validating customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(400).json({
        message: "Customer Not Found",
        success: false,
      });
      return;
    }

    // build filter object
    const filter: any = {
      customerId: customerId,
    };

    // filter by status if provided
    if (status) {
      const validStatuses = [
        "requested",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ];

      if (!validStatuses.includes(status)) {
        res.status(400).json({
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          success: false,
        });
        return;
      }
      filter.status = status;
    }

    // build sort object
    const validSortFields = [
      "createdAt",
      "schedule.date",
      "status",
      "estimatedPrice",
      "updatedAt",
    ];
    const sortObj: any = {};

    if (validSortFields.includes(sortBy)) {
      sortObj[sortBy] = order === "asc" ? 1 : -1;
    } else {
      sortObj.createdAt = -1; //default sort
    }

    // fetching requests
    const requests = await ServiceRequests.find(filter)
      .populate("customerId", "name email phone")
      .populate("serviceCategoryId", "name slug icon priceRange")
      .populate("serviceProviderId", "name email phone averageRating")
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    // count total requests
    const totalRequests = await ServiceRequests.countDocuments(filter);

    // calculate statistics
    const statusCounts = await ServiceRequests.aggregate([
      {
        $match: { customerId: customer._id },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      total: totalRequests,
      requested: 0,
      assigned: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    };

    statusCounts.forEach((item: any) => {
      if (item._id === "requested") stats.requested = item.count;
      if (item._id === "assigned") stats.assigned = item.count;
      if (item._id === "in_progress") stats.inProgress = item.count;
      if (item._id === "completed") stats.completed = item.count;
      if (item._id === "cancelled") stats.cancelled = item.count;
    });

    res.status(200).json({
      message: "Service Requests Retrieved",
      success: true,
      data: requests,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalRequests / limit),
        totalRequests,
        limit,
        hasNext: page < Math.ceil(totalRequests / limit),
        hasPrev: page > 1,
      },
      statistics: stats,
      filters: {
        status: status || "all",
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Service Requests",
      success: false,
    });
    return;
  }
};

export const getRequestById = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const { requestId } = req.params;

    if (!requestId) {
      res.status(400).json({
        message: "Request ID is required",
        success: false,
      });
      return;
    }

    const serviceRequest = await ServiceRequests.findOne({
      _id: requestId,
      customerId: customerId,
    })
      .populate("customerId", "name email phone profilePicture")
      .populate(
        "serviceCategoryId",
        "name slug icon description priceRange commonServices",
      )
      .populate(
        "serviceProviderId",
        "name email phone profilePicture averageRating totalReviews experienceYears",
      )
      .populate("parentRequestId", "serviceTitle schedule.status");

    if (!serviceRequest) {
      res.status(404).json({
        message: "Service Request Not Found",
        success: false,
      });
      return;
    }

    const now = new Date();
    const scheduleDate = new Date(serviceRequest.schedule.date);
    const timeRemaining = scheduleDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

    let statusInfo = {
      current: serviceRequest.status,
      canCancel: false,
      canModify: false,
      canReschedule: false,
      message: "",
    };

    switch (serviceRequest.status) {
      case "requested":
        statusInfo.canCancel = true;
        statusInfo.canModify = true;
        statusInfo.canReschedule = true;
        statusInfo.message =
          "Your request is waiting for a service provider to accept.";
        break;
      case "assigned":
        statusInfo.canCancel = true;
        statusInfo.canReschedule = true;
        statusInfo.message = `Assigned to ${(serviceRequest.serviceProviderId as any)?.name || "a provider"}. Contact them to discuss details.`;
        break;
      case "in_progress":
        statusInfo.message = "Service is currently in progress.";
        break;
      case "completed":
        statusInfo.message =
          "Service has been completed. Please rate your provider.";
        break;
      case "cancelled":
        statusInfo.message = `Request cancelled. Reason: ${serviceRequest.cancellationReason || "Not specified"}`;
        break;
    }

    res.status(200).json({
      message: "Service Request Retrieved Successfully",
      success: true,
      data: {
        request: serviceRequest,
        timing: {
          scheduleDate: serviceRequest.schedule.date,
          timeSlot: serviceRequest.schedule.timeSlot,
          preferredTime: serviceRequest.schedule.preferredTime,
          daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
          isUrgent: daysRemaining <= 2 && daysRemaining > 0,
          isOverdue: daysRemaining <= 0,
        },
        status: statusInfo,
        pricing: {
          estimated: serviceRequest.estimatedPrice,
          final: serviceRequest.finalPrice || 0,
          paymentStatus: serviceRequest.paymentStatus,
          breakdown: serviceRequest.pricingDetails,
        },
        history: {
          statusHistory: serviceRequest.statusHistory,
          totalUpdates: serviceRequest.statusHistory.length,
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Service Request BY ID",
      success: false,
    });
    return;
  }
};

export const cancelServiceRequest = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const { requestId } = req.params;
    const { cancellationReason } = req.body;

    if (!requestId) {
      res.status(400).json({
        message: "Request Id is required.",
        success: false,
      });
      return;
    }

    if (!cancellationReason || cancellationReason.trim().length === 0) {
      res.status(400).json({
        message: "Please provide a reason for cancellation",
        success: false,
      });
      return;
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Not Found",
        success: false,
      });
      return;
    }

    const serviceRequest = await ServiceRequests.findOne({
      _id: requestId,
      customerId: customerId,
    }).populate("serviceProviderId", "name email");

    if (!serviceRequest) {
      res.status(404).json({
        message: "Service Request not found",
        success: false,
      });
      return;
    }

    const cancellableStatuses = ["requested", "assigned"];

    if (!cancellableStatuses.includes(serviceRequest.status)) {
      let message = "";
      switch (serviceRequest.status) {
        case "in_progress":
          message = "Cannot cancel request. Service is already in progress.";
          break;
        case "completed":
          message = "Cannot cancel request. Service is already completed.";
          break;
        case "cancelled":
          message = "Request has already been cancelled.";
          break;
        default:
          message = "Cannot cancel request in current status.";
      }

      res.status(400).json({
        message,
        success: false,
        currentStatus: serviceRequest.status,
        canCancel: false,
      });
      return;
    }

    serviceRequest.status = "cancelled";
    serviceRequest.cancellationReason = cancellationReason;
    serviceRequest.cancelledBy = "customer";
    serviceRequest.cancelledAt = new Date();
    serviceRequest.statusHistory.push({
      status: "cancelled",
      timeStamp: new Date(),
      note: `Request cancelled by customer. Reason: ${cancellationReason}`,
      updatedBy: "customer",
    });

    await serviceRequest.save();

    // sending notification
    const provider = serviceRequest.serviceProviderId as any;

    const notificationResult = await handleCancellationNotifications(
      customer._id as any,
      customer.name,
      provider?._id || null,
      provider?.name || null,
      serviceRequest._id as any,
      serviceRequest.serviceTitle,
      cancellationReason,
    );

    res.status(200).json({
      message: "Service Request Cancelled.",
      success: true,
      data: {
        request: {
          _id: serviceRequest._id,
          serviceTitle: serviceRequest.serviceTitle,
          status: "cancelled",
          cancelledAt: serviceRequest.cancelledAt,
          cancellationReason: serviceRequest.cancellationReason,
        },
        provider: {
          wasAssigned: !!serviceRequest.serviceProviderId,
          providerName: (serviceRequest.serviceProviderId as any)?.name || null,
          providerEmail:
            (serviceRequest.serviceProviderId as any)?.email || null,
          notified: !!provider, // if provider exists, they will be notified
        },
        refund: {
          applicable: true,
          message:
            "Any payments made will be refunded within 5-7 business days.",
          paymentStatus:
            serviceRequest.paymentStatus === "paid"
              ? "refund_initiated"
              : "no_payment",
        },
        notifications: {
          sent: notificationResult.success,
          count: notificationResult.notificationsCreated,
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Service Request BY ID",
      success: false,
    });
    return;
  }
};

export const rescheduleServiceRequest = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const { requestId } = req.params;
    const { schedule } = req.body;

    if (!requestId) {
      res.status(400).json({
        message: "Request Id is required",
        success: false,
      });
      return;
    }

    if (!schedule) {
      res.status(400).json({
        message: "Please provider schedule details (date, timeSlot)",
        success: false,
      });
      return;
    }

    if (!schedule.date || !schedule.timeSlot) {
      res.status(400).json({
        message: "Schedule must include date and timeSlot",
        success: false,
      });
      return;
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Not Found",
        success: false,
      });
      return;
    }

    const serviceRequest = await ServiceRequests.findOne({
      _id: requestId,
      customerId: customerId,
    });

    if (!serviceRequest) {
      res.status(404).json({
        message: "Service Request Not Found",
        success: false,
      });
      return;
    }

    // check if request can be rescheduled
    const reschedulableStatuses = ["requested", "assigned"];

    if (!reschedulableStatuses.includes(serviceRequest.status)) {
      let message = "";
      switch (serviceRequest.status) {
        case "in_progress":
          message =
            "Cannot reschedule request. Service is already in progress. Please contact the provider directly.";
          break;
        case "completed":
          message =
            "Cannot reschedule request. Service has already been completed.";
          break;
        case "cancelled":
          message = "Cannot reschedule request. Service has been cancelled";
          break;
        default:
          message = "Cannot reschedule request in current status";
      }

      res.status(400).json({
        message,
        success: false,
        currentStatus: serviceRequest.status,
        canReschedule: false,
      });
      return;
    }

    // validate new schedule
    const newScheduleDate = new Date(schedule.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (newScheduleDate < today) {
      res.status(400).json({
        message: "New Schedule date must be today or in the future",
        success: false,
      });
      return;
    }

    // validate time slot
    const validTimeSlots = ["morning", "afternoon", "evening"];
    if (!validTimeSlots.includes(schedule.timeSlot)) {
      res.status(400).json({
        message: `Invalid timeSlot. Must be one of: ${validTimeSlots.join(", ")}`,
        success: false,
      });
      return;
    }

    // check if same as current schedule
    const currentScheduleDate = new Date(serviceRequest.schedule.date);
    const isSameSchedule =
      newScheduleDate.toDateString() === currentScheduleDate.toDateString() &&
      schedule.timeSlot === serviceRequest.schedule.timeSlot;

    if (isSameSchedule) {
      res.status(400).json({
        message:
          "New schedule is the same as current schedule. Please choose a different date or time slot.",
        success: false,
        currentSchedule: {
          date: serviceRequest.schedule.date,
          timeSlot: serviceRequest.schedule.timeSlot,
        },
      });
      return;
    }

    // rescheduling the request
    const oldSchedule = {
      date: serviceRequest.schedule.date,
      timeSlot: serviceRequest.schedule.timeSlot,
      preferredTime: serviceRequest.schedule.preferredTime,
    };

    serviceRequest.schedule = {
      date: schedule,
      timeSlot: schedule.timeSlot,
      preferredTime:
        schedule.preferredTime || serviceRequest.schedule.preferredTime,
    };

    serviceRequest.statusHistory.push({
      status: serviceRequest.status,
      timeStamp: new Date(),
      note: `Request rescheduled from ${oldSchedule.timeSlot} (${new Date(oldSchedule.date).toLocaleDateString()}) to ${schedule.timeSlot} (${schedule.toLocaleDateString()})`,
      updatedBy: "customer",
    });

    await serviceRequest.save();

    // sending notification
    const provider = serviceRequest.serviceProviderId as any;

    const notificationResult = await handleReschedulingNotifications(
      customer._id as any,
      customer.name,
      provider?._id || null,
      provider?.name || null,
      serviceRequest._id as any,
      serviceRequest.serviceTitle,
    );

    res.status(200).json({
      message: "Service Request Rescheduled Successfully !",
      success: true,
      data: {
        request: {
          _id: serviceRequest._id,
          serviceTitle: serviceRequest.serviceTitle,
          status: serviceRequest.status,
        },
        schedule: {
          old: oldSchedule,
          new: {
            date: schedule,
            timeSlot: schedule.timeSlot,
            preferredTime: schedule.preferredTime || oldSchedule.preferredTime,
          },
        },
        provider: {
          isAssigned: !!serviceRequest.serviceProviderId,
          willBeNotified: !!serviceRequest.serviceProviderId,
        },
        timing: {
          daysUntilService: Math.ceil(
            (schedule.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          ),
          isUrgent:
            Math.ceil(
              (schedule.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
            ) <= 2,
        },
        notifications: {
          sent: notificationResult.success,
          count: notificationResult.notificationsCreated,
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Re-Scheduling Service Request",
      success: false,
    });
    return;
  }
};

// service provider functions

export const getAvailableRequests = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";
    const city = (req.query.city as string)?.toLowerCase();
    const skillCategory = req.query.skillCategory as string;

    const provider = await ServiceProvider.findById(providerId);
    if (!provider) {
      res.status(400).json({
        message: "Service Provider Not Found",
        success: false,
      });
      return;
    }

    if (!provider.isActive) {
      res.status(403).json({
        message:
          "Your account is deactivated. Please reactivate to view available requests.",
        success: false,
      });
      return;
    }

    if (provider.isSuspended === true) {
      res.status(403).json({
        message: `Your account is suspended. Reason: ${provider.suspensionReason || "Contact support for details."}`,
        success: false,
      });
      return;
    }

    const matchingCategories = await ServiceCategories.find({
      isActive: true,
      requiredSkills: {
        $in: provider.skills || [],
      },
    }).select("_id requiredSkills name");

    const matchingCategoryIds = matchingCategories.map((cat) => cat._id);

    if (matchingCategoryIds.length === 0) {
      res.status(400).json({
        message: "No available requests found",
        success: false,
      });
      return;
    }

    // build filter object
    const filter: any = {
      status: "requested",
      serviceProviderId: { $exists: false },
      serviceCategoryId: { $in: matchingCategoryIds },
    };

    // filter by provider's service area
    const providerCities = provider.serviceArea?.cities || [];
    const providerAreas = provider.serviceArea?.areas || [];

    if (providerCities.length > 0 || providerAreas.length > 0) {
      filter.$or = [
        { "serviceAddress.city": { $in: providerCities } },
        { "serviceAddress.city": { $in: providerAreas } },
      ];
    }

    // filter by city if provided
    if (city) {
      filter["serviceAddress.city"] = city;
    }

    // filter by skill category if provided
    if (skillCategory) {
      const category = await ServiceCategories.findOne({
        slug: skillCategory,
        isActive: true,
      });
      if (category) {
        filter.serviceCategoryId = category._id;
      } else {
        res.status(400).json({
          message: "Invalid Skill Category",
          success: false,
        });
        return;
      }
    }

    // build sort object
    const validSortFields = [
      "createdAt",
      "schedule.date",
      "estimatedPrice",
      "serviceTitle",
    ];
    const sortObj: any = {};

    if (validSortFields.includes(sortBy)) {
      sortObj[sortBy] = order === "asc" ? 1 : -1;
    } else {
      sortObj.createdAt = -1; // default sort
    }

    const requests = await ServiceRequests.find(filter)
      .populate("customerId", "name email phone")
      .populate("serviceCategoryId", "name slug icon requiredSkills")
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    const totalRequests = await ServiceRequests.countDocuments(filter);

    res.status(200).json({
      message: "Available service requests retrieved",
      success: true,
      data: requests,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalRequests / limit),
        totalRequests,
        limit,
        hasNext: page < Math.ceil(totalRequests / limit),
        hasPrev: page > 1,
      },
      filters: {
        city: city || "all",
        skillCategory: skillCategory || "all",
        providerSkills: provider.skills || [],
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Available Service Request",
      success: false,
    });
    return;
  }
};

export const acceptRequest = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;
    const { requestId } = req.params;

    if (!requestId) {
      res.status(400).json({
        message: "Request Id is required",
        success: false,
      });
    }

    const provider = await ServiceProvider.findById(providerId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider Not Found",
        success: false,
      });
      return;
    }

    if (!provider.isActive) {
      res.status(403).json({
        message:
          "Your account is deactivated. Please reactivate to accept requests.",
        success: false,
      });
      return;
    }

    if (provider.isSuspended) {
      res.status(403).json({
        message: `Your account is suspended. Reason: ${provider.suspensionReason || "Contact support for details."}`,
        success: false,
      });
      return;
    }

    const serviceRequests = await ServiceRequests.findOne({
      _id: requestId,
    }).populate("customerId", "name email");

    if (!serviceRequests) {
      res.status(404).json({
        message: "Service Request Not Found.",
        success: false,
      });
      return;
    }

    // check if request is already assigned
    if (serviceRequests.serviceProviderId) {
      res.status(400).json({
        message: "This request has already been accepted by another provider",
        success: false,
      });
      return;
    }

    if (serviceRequests.status !== "requested") {
      let message = "";
      switch (serviceRequests.status) {
        case "cancelled":
          message =
            "Cannot accept the request. It has been cancelled by the customer.";
          break;
        case "assigned":
          message =
            "This request has already been accepted by another provider.";
          break;
        case "in_progress":
          message =
            "This request is already in progress with another provider.";
          break;
        case "completed":
          message = "This request has already been completed.";
          break;
        default:
          message = `Cannot accept the request in current status: ${serviceRequests.status}`;
      }

      res.status(400).json({
        message,
        success: false,
        currentStatus: serviceRequests.status,
      });
      return;
    }

    // update the request
    serviceRequests.serviceProviderId = providerId;
    serviceRequests.status = "assigned";
    serviceRequests.statusHistory.push({
      status: "assigned",
      timeStamp: new Date(),
      note: `Request accepted by service provider ${provider.name}`,
      updatedBy: "service_provider",
    });

    await serviceRequests.save();

    const customer = serviceRequests.customerId as any;

    const notificationResult = await handleRequestAcceptedNotifications(
      customer._id as any,
      customer.name,
      provider._id as any,
      provider.name,
      requestId as any,
      serviceRequests.serviceTitle,
    );

    res.status(200).json({
      message: "Service Request Accepted Successfully",
      success: true,
      data: {
        request: {
          _id: serviceRequests._id,
          serviceTitle: serviceRequests.serviceTitle,
          status: "assigned",
          schedule: serviceRequests.schedule,
          serviceAddress: serviceRequests.serviceAddress,
        },
        provider: {
          name: provider.name,
          email: provider.email,
          phone: provider.phone,
        },
        cusotmer: {
          name: customer.name,
          email: customer.email,
          notified: true,
        },
        notifications: {
          sent: notificationResult.success,
          count: notificationResult.notificationsCreated,
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Accepting Service Request",
      success: false,
    });
    return;
  }
};

export const getMyAssignedRequests = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;

    const status = req.query.status as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";

    const provider = await ServiceProvider.findById(providerId);
    if (!provider) {
      res.status(404).json({
        message: "Provider Not Found",
        success: false,
      });
      return;
    }

    // build filter object
    const filter: any = {
      serviceProviderId: providerId,
    };

    // filter by status if provided
    if (status) {
      const validStatuses = [
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ];

      if (!validStatuses.includes(status)) {
        res.status(400).json({
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          success: false,
        });
        return;
      }
      filter.status = status;
    }

    // build sort object
    const validSortFields = [
      "createdAt",
      "schedule.date",
      "status",
      "estimatedPrice",
      "updatedAt",
    ];
    const sortObj: any = {};

    if (validSortFields.includes(sortBy)) {
      sortObj[sortBy] = order === "asc" ? 1 : -1;
    } else {
      sortObj.createdAt = -1;
    }

    // fetching requests
    const requests = await ServiceRequests.find(filter)
      .populate("customerId", "name email phone profilePicture")
      .populate("serviceCategoryId", "name slug icon priceRange")
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    // count total requests
    const totalRequests = await ServiceRequests.countDocuments(filter);

    // calculate statistics
    const statusCounts = await ServiceRequests.aggregate([
      {
        $match: { serviceProviderId: provider._id },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      total: totalRequests,
      assigned: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    };

    statusCounts.forEach((item: any) => {
      if (item._id === "assigned") stats.assigned = item.count;
      if (item._id === "in_progress") stats.inProgress = item.count;
      if (item._id === "completed") stats.completed = item.count;
      if (item._id === "cancelled") stats.cancelled = item.count;
    });

    res.status(200).json({
      message: "Requests Retrieved: ",
      success: true,
      data: requests,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalRequests / limit),
        totalRequests,
        limit,
        hasNext: page < Math.ceil(totalRequests / limit),
        hasPrev: page > 1,
      },
      statistics: stats,
      filters: {
        status: status || "all",
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Assigned Service Request",
      success: false,
    });
    return;
  }
};

export const startService = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;
    const { requestId } = req.params;

    if (!requestId) {
      res.status(400).json({
        message: "Request Id is required.",
        success: false,
      });
      return;
    }

    const provider = await ServiceProvider.findById(providerId);
    if (!provider) {
      res.status(404).json({
        message: "Provider Not Found.",
        success: false,
      });
      return;
    }

    if (!provider.isActive) {
      res.status(403).json({
        message:
          "Your account is deactivated. Please reactivate to start services.",
        success: false,
      });
      return;
    }

    if (provider.isSuspended === true) {
      res.status(403).json({
        message: `Your account is suspended. Reason: ${provider.suspensionReason || "Contact support for details."}`,
        success: false,
      });
      return;
    }

    // find the service request
    const serviceRequest = await ServiceRequests.findOne({
      _id: requestId,
    }).populate("customerId", "name email");

    if (!serviceRequest) {
      res.status(404).json({
        message: "Service Request Not Found!",
        success: false,
      });
      return;
    }

    if (!serviceRequest.serviceProviderId) {
      res.status(400).json({
        message: "This request is not assigned to any provider",
        success: false,
      });
      return;
    }

    // only assigned status request can start
    if (serviceRequest.status !== "assigned") {
      let message = "";
      switch (serviceRequest.status) {
        case "requested":
          message = "Cannot start request. Please accept the request first.";
          break;
        case "in_progress":
          message = "Service is already in progress.";
          break;
        case "completed":
          message = "service has already been completed.";
          break;
        case "cancelled":
          message = "Cannot start request. Service has been cancelled.";
          break;
        default:
          message = `Cannot start request in current status: ${serviceRequest.status}`;
      }

      res.status(400).json({
        message,
        success: false,
        currentStatus: serviceRequest.status,
      });
      return;
    }

    // updating the request
    serviceRequest.status = "in_progress";
    serviceRequest.statusHistory.push({
      status: "in_progress",
      timeStamp: new Date(),
      note: `Service started by ${provider.name}`,
      updatedBy: "service_provider",
    });

    await serviceRequest.save();

    res.status(200).json({
      message: "Service Started Successfully",
      success: true,
      data: {
        request: {
          _id: serviceRequest._id,
          serviceTitle: serviceRequest.serviceTitle,
          status: "in_progress",
          schedule: serviceRequest.schedule,
        },
        provider: {
          name: provider.name,
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Starting Service",
      success: false,
    });
    return;
  }
};

export const completeService = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;
    const { requestId } = req.params;
    const { afterImages, finalPrice } = req.body;

    if (!requestId) {
      res.status(400).json({
        message: "Request Id Not Found",
        success: false,
      });
      return;
    }

    const provider = await ServiceProvider.findById(providerId);
    if (!provider) {
      res.status(404).json({
        message: "Provider Id not Found",
        success: false,
      });
      return;
    }

    if (!provider.isActive) {
      res.status(403).json({
        message:
          "Your Account is deactivated. Reactivate to completed services.",
        success: false,
      });
      return;
    }

    if (provider.isSuspended) {
      res.status(403).json({
        message: `Your account is suspended. Reason: ${provider.suspensionReason || "Contact support for details."}`,
        success: false,
      });
      return;
    }

    // find the service request
    const serviceRequest = await ServiceRequests.findOne({
      _id: requestId,
    }).populate("customerId", "name email");

    if (!serviceRequest) {
      res.status(404).json({
        message: "Service Request not found",
        success: false,
      });
      return;
    }

    if (!serviceRequest.serviceProviderId) {
      res.status(400).json({
        message: "This request is not assigned to any provider",
        success: false,
      });
      return;
    }

    if (serviceRequest.status !== "in_progress") {
      let message = "";
      switch (serviceRequest.status) {
        case "requested":
          message = "Cannot start request. Please accept the request first.";
          break;
        case "in_progress":
          message = "Service is already in progress.";
          break;
        case "completed":
          message = "service has already been completed.";
          break;
        case "cancelled":
          message = "Cannot start request. Service has been cancelled.";
          break;
        default:
          message = `Cannot start request in current status: ${serviceRequest.status}`;
      }

      res.status(400).json({
        message,
        success: false,
        currentStatus: serviceRequest.status,
      });
      return;
    }

    serviceRequest.status = "completed";
    serviceRequest.afterImages = afterImages || [];
    serviceRequest.finalPrice = finalPrice || serviceRequest.estimatedPrice;
    serviceRequest.completedAt = new Date();
    serviceRequest.statusHistory.push({
      status: "completed",
      timeStamp: new Date(),
      note: `Service completed by ${provider.name}. Final price: ${serviceRequest.finalPrice}`,
      updatedBy: "service_provider",
    });

    await serviceRequest.save();

    // Incrementing provider's totalJobsCompleted
    provider.totalJobsCompleted = (provider.totalJobsCompleted as number) + 1;
    await provider.save();

    res.status(200).json({
      message: "Service Completed Successfully.",
      success: true,
      data: {
        request: {
          _id: serviceRequest._id,
          serviceTitle: serviceRequest.serviceTitle,
          status: "completed",
          finalPrice: serviceRequest.finalPrice,
          estimatedPrice: serviceRequest.estimatedPrice,
          completedAt: serviceRequest.completedAt,
          afterImages: serviceRequest.afterImages,
        },
        provider: {
          name: provider.name,
        },
        pricing: {
          estimated: serviceRequest.estimatedPrice,
          final: serviceRequest.finalPrice,
          difference: serviceRequest.finalPrice - serviceRequest.estimatedPrice,
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Completing Service",
      success: false,
    });
    return;
  }
};
