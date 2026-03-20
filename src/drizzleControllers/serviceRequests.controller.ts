import { customerRepository } from "#db/repositories/customer.repository.js";
import { serviceProviderRepository } from "#db/repositories/serviceProvider.repository.js";
import { serviceRequestRepository } from "#db/repositories/serviceRequests.repository.js";
import { Request, Response } from "express";
import { serviceCategory } from "#db/repositories/serviceCategory.repository.js";
import { handleCancellationNotifications, handleRequestAcceptedNotifications, handleReschedulingNotifications } from "#drizzleServices/notification.service.js";

export const createServiceRequest = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const {
      serviceType,
      serviceCategoryId,
      serviceTitle,
      serviceDescription,
      additionalNotes,
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
    const customer = await customerRepository.findById(customerId);
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
    const category = await serviceCategory.findCategoryById(serviceCategoryId);
    if (!category || !category.isActive) {
      res.status(404).json({
        message: "Service Category Not Found or inactive",
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
        success: false,
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

    // calculating estimated price based on provider rates and admin commission
    let finalEstimatedPrice = estimatedPrice || 0;
    let priceBreakdown = "";
    let adminCommissionAmount = 0;
    let providerRateAmount = 0;

    // check if a customer selected a common service from category
    if (
      commonServiceName &&
      category.commonServices &&
      category.commonServices.length > 0
    ) {
      const selectedCommonService = category.commonServices.find(
        (service) =>
          service.name.toLowerCase() === commonServiceName.toLowerCase(),
      );

      if (selectedCommonService) {
        // For common services, use the typical price + admin commission
        providerRateAmount = selectedCommonService.typicalPrice;
        adminCommissionAmount = calculateAdminCommissionFromCategory(
          providerRateAmount,
          category.adminCommission
        );
        finalEstimatedPrice = providerRateAmount + adminCommissionAmount;
        priceBreakdown = `Standard ${selectedCommonService.name} service (${selectedCommonService.duration}) - Base: ₹${providerRateAmount} + Admin: ₹${adminCommissionAmount}`;
      }
    }

    // if no common service selected, calculate based on available providers
    if (!finalEstimatedPrice) {
      // Get providers who match the category requirements
      const matchingProviders = await getMatchingProviders(
        category,
        serviceAddress.city
      );

      // Calculate pricing using provider rates + admin commission
      if (matchingProviders.length > 0) {
        // Get provider rates for this category
        const providerRates = matchingProviders.map((provider: any) => {
          // Check if provider has specific pricing for this category
          const specificPricing = provider.servicePricing?.find(
            (p: any) => p.serviceCategoryId === category.id
          );

          if (specificPricing) {
            return {
              rate: specificPricing.rate,
              minRate: specificPricing.minRate ?? specificPricing.rate,
              maxRate: specificPricing.maxRate ?? specificPricing.rate,
            };
          }

          // Use provider's base rate
          const baseRate = parseFloat(provider.baseRate) || 0;
          return {
            rate: baseRate,
            minRate: baseRate,
            maxRate: baseRate,
          };
        });

        // Calculate average provider rate
        const avgProviderRate =
          providerRates.reduce((sum: number, r: any) => sum + r.rate, 0) / providerRates.length;

        const minProviderRate = Math.min(...providerRates.map((r: any) => r.minRate));
        const maxProviderRate = Math.max(...providerRates.map((r: any) => r.maxRate));

        // Calculate admin commission
        adminCommissionAmount = calculateAdminCommissionFromCategory(
          avgProviderRate,
          category.adminCommission
        );

        providerRateAmount = avgProviderRate;
        finalEstimatedPrice = avgProviderRate + adminCommissionAmount;
        priceBreakdown = `Estimated price based on ${providerRates.length} provider(s) (₹${minProviderRate} - ₹${maxProviderRate}) + admin charges (₹${adminCommissionAmount})`;
      } else {
        // No providers available, use category average
        const categoryMin = category.priceRange?.min ?? 0;
        const categoryMax = category.priceRange?.max ?? 0;
        const categoryAvg = categoryMin > 0 || categoryMax > 0 ? (categoryMin + categoryMax) / 2 : 0;

        adminCommissionAmount = calculateAdminCommissionFromCategory(
          categoryAvg,
          category.adminCommission
        );

        providerRateAmount = categoryAvg;
        finalEstimatedPrice = categoryAvg + adminCommissionAmount;
        priceBreakdown = `Estimated price based on ${category.name} category range (₹${categoryMin} - ₹${categoryMax}) + admin charges (₹${adminCommissionAmount})`;
      }
    }

    // Check provider availability
    let hasAvailableProviders = false;
    let availableProvidersCount = 0;

    const providerSearchResult =
      await serviceProviderRepository.searchProviders({
        city: serviceAddress.city,
        skill: category.requiredSkills?.[0] || "",
        availabilityStatus: "available",
        limit: 1,
      });

    hasAvailableProviders = providerSearchResult.providers.length > 0;
    availableProvidersCount = providerSearchResult.providers.length;

    // creating the request
    const newServiceRequest = await serviceRequestRepository.create({
      customerId,
      serviceType: serviceType.trim().toLowerCase(),
      serviceCategoryId,
      serviceTitle: serviceTitle.trim(),
      serviceDescription: serviceDescription?.trim() || "",
      additionalNotes: additionalNotes?.trim() || "",
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
      estimatedPrice: finalEstimatedPrice.toString(),
      finalPrice: "0",
      pricingDetails: {
        providerCharge: providerRateAmount,
        adminCharge: adminCommissionAmount,
        subtotal: providerRateAmount + adminCommissionAmount,
        total: finalEstimatedPrice,
        commissionRate: adminCommissionAmount,
        commissionType: category.adminCommission?.type || 'fixed',
        additionalBreakdown: priceBreakdown || `Service charge for ${category.name}`,
      },
      paymentStatus: "pending",
      paymentMethod: "",
      status: "requested",
      statusHistory: [
        {
          status: "requested",
          timestamp: new Date(),
          note: "Service Request Created",
          updatedBy: "customer",
        },
      ],
      isRecurring: false,
      recurringPattern: undefined,
      parentRequestId: undefined,
      completedAt: undefined,
    });

    res.status(201).json({
      message: `Service Request for: ${category.name} category created !`,
      success: true,
      data: {
        serviceRequest: newServiceRequest,
        category: {
          id: category.id,
          name: category.name,
          priceRange: category.priceRange,
          commonServices: category.commonServices || [],
        },
        pricing: {
          estimatedPrice: finalEstimatedPrice,
          providerRate: providerRateAmount,
          adminCommission: adminCommissionAmount,
          breakdown: priceBreakdown,
          commissionType: category.adminCommission?.type || 'fixed',
        },
        availability: {
          hasAvailableProviders,
          availableProvidersCount: hasAvailableProviders
            ? `${availableProvidersCount} service provider(s) available in your area`
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
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";

    // validating customer
    const customer = await customerRepository.findById(customerId);
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

    // fetching requests
    // fetching requests
    const result = await serviceRequestRepository.findAllWithPagination({
      filters: {
        customerId,
        ...(status ? { status } : {}),
      },
      pagination: { page, limit },
      sort: { field: sortBy, order: order as "asc" | "desc" },
    });

    const requests = result.requests;
    const totalRequests = result.pagination.total;

    const stats = await serviceRequestRepository.getStatusStatistics(
      customerId,
      "customer",
    );

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
    const requestIdValue = Array.isArray(requestId) ? requestId[0] : requestId;

    if (!requestId) {
      res.status(400).json({
        message: "Request ID is required",
        success: false,
      });
      return;
    }

    const serviceRequest =
      await serviceRequestRepository.findByRequestIdAndCustomerId(
        requestIdValue,
        customerId,
      );

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
    const requestIdValue = Array.isArray(requestId) ? requestId[0] : requestId;
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

    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Not Found",
        success: false,
      });
      return;
    }

    const serviceRequest =
      await serviceRequestRepository.findByRequestIdAndCustomerId(
        requestIdValue,
        customerId,
      );

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

    // Get current status history
    const currentHistory = (serviceRequest.statusHistory as any[]) || [];

    // Update the request using repository
    const updatedRequest = await serviceRequestRepository.update(
      requestIdValue,
      {
        status: "cancelled",
        cancellationReason: cancellationReason,
        cancelledBy: "customer",
        cancelledAt: new Date(),
        statusHistory: [
          ...currentHistory,
          {
            status: "cancelled",
            timestamp: new Date(),
            note: `Request cancelled by customer. Reason: ${cancellationReason}`,
            updatedBy: "customer",
          },
        ],
      },
    );

    // sending notification
    const providerId = serviceRequest.serviceProviderId;
    let provider = null;
    if (providerId) {
      provider = await serviceProviderRepository.findById(providerId);
    }

    const notificationResult = await handleCancellationNotifications(
      customer.id,
      customer.name,
      provider?.id || null,
      provider?.name || null,
      serviceRequest.id,
      serviceRequest.serviceTitle,
      cancellationReason,
    );

    res.status(200).json({
      message: "Service Request Cancelled.",
      success: true,
      data: {
        request: {
          id: updatedRequest?.id,
          serviceTitle: updatedRequest?.serviceTitle,
          status: "cancelled",
          cancelledAt: updatedRequest?.cancelledAt,
          cancellationReason: updatedRequest?.cancellationReason,
        },
        provider: {
          wasAssigned: !!serviceRequest.serviceProviderId,
          providerName: provider?.name || null,
          providerEmail: provider?.email || null,
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
      success: true,
    });
    return;
  }
};

export const rescheduleServiceRequest = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const { requestId } = req.params;
    const requestIdValue = Array.isArray(requestId) ? requestId[0] : requestId;
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

    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Not Found",
        success: false,
      });
      return;
    }

    const serviceRequest =
      await serviceRequestRepository.findByRequestIdAndCustomerId(
        requestIdValue,
        customerId,
      );

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
    const oldSchedule = serviceRequest.schedule;

    const updatedRequest = await serviceRequestRepository.update(
      requestIdValue,
      {
        schedule: {
          date: newScheduleDate,
          timeSlot: schedule.timeSlot,
          preferredTime: schedule.preferredTime || oldSchedule.preferredTime,
        },
      },
    );

    await serviceRequestRepository.addStatusHistory(requestIdValue, {
      status: updatedRequest?.status || "requested",
      note: `Request Rescheduled`,
      updatedBy: "customer",
    });

    // sending notification
    const providerId = serviceRequest.serviceProviderId;
    let provider = null;

    if (providerId) {
      provider = await serviceProviderRepository.findById(providerId);
    }

    const notificationResult = await handleReschedulingNotifications(
      customer.id,
      customer.name,
      provider?.id || null,
      provider?.name || null,
      serviceRequest.id,
      serviceRequest.serviceTitle,
    );

    res.status(200).json({
      message: "Service Request Rescheduled Successfully !",
      success: true,
      data: {
        request: {
          id: updatedRequest?.id,
          serviceTitle: updatedRequest?.serviceTitle,
          status: updatedRequest?.status,
        },
        schedule: {
          old: oldSchedule,
          new: {
            date: newScheduleDate,
            timeSlot: schedule.timeSlot,
            preferredTime: schedule.preferredTime || oldSchedule.preferredTime,
          },
        },
        provider: {
          isAssigned: !!serviceRequest.serviceProviderId,
          willBeNotified: !!provider,
        },
        timing: {
          daysUntilService: Math.ceil(
            (newScheduleDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          ),
          isUrgent:
            Math.ceil(
              (newScheduleDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
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

    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";
    const city = (req.query.city as string)?.toLowerCase();
    const skillCategory = req.query.skillCategory as string;

    const provider = await serviceProviderRepository.findById(providerId);
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

    const allCategories = await serviceCategory.findAllCategories({
      isActive: true,
    });

    // filter categories that match provider's skills
    const matchingCategories = allCategories.categories.filter((category: any) => {
      if (!provider.skills || provider.skills.length === 0) return false;
      if (!category.requiredSkills || category.requiredSkills.length === 0)
        return false;

      // check if any provider skill matches category's required skills (case-insensitive)
      const providerSkillsLower = provider.skills.map((s) => s.toLowerCase());
      const categorySkillsLower = category.requiredSkills.map((s: string) => s.toLowerCase());

      return providerSkillsLower.some((skill) =>
        categorySkillsLower.includes(skill),
      );
    });

    const matchingCategoryIds = matchingCategories.map((cat: any) => cat.id);

    if (matchingCategoryIds.length === 0) {
      res.status(400).json({
        message: "No available requests found",
        success: false,
      });
      return;
    }

    // build filter object
    const filters: {
      serviceCategoryIds?: string[];
      cities?: string[];
      status?: string;
    } = {
        serviceCategoryIds: matchingCategoryIds,
        status: "requested"
    };

    // filter by provider's service area (nested structure)
    const providerServiceAreas = provider.serviceArea || [];
    const providerCities = providerServiceAreas.map((area: any) => area.city?.toLowerCase()).filter(Boolean);
    const providerAreas = providerServiceAreas.flatMap((area: any) => area.areas || []).map((area: any) => area.toLowerCase());

    if (providerCities.length > 0 || providerAreas.length > 0) {
        const allserviceAreas = [...new Set([...providerCities, ...providerAreas])]
        filters.cities = allserviceAreas
    }

    // filter by city if provided
    if (city) {
      filters.cities = [city]
    }

    // filter by skill category if provided
    if (skillCategory) {
      const category = await serviceCategory.findAllCategories();
      const filteredCategory = category.categories.find(
        (cat: any) => cat.slug === skillCategory && cat.isActive
      )
      if (filteredCategory) {
        filters.serviceCategoryIds = [filteredCategory.id];
      } else {
        res.status(400).json({
          message: "Invalid Skill Category",
          success: false,
        });
        return;
      }
    }

    const result = await serviceRequestRepository.findUnassignedRequestsWithPagination(
        filters,
        { page, limit },
        { field: sortBy, order: order as "asc" | "desc" }
    )

    // Enrich requests with category and customer details
    const enrichedRequests = await Promise.all(
        result.requests.map(async (request) => {
            // Get category details
            const category = await serviceCategory.findCategoryById(request.serviceCategoryId)

            // Get customer details
            const customer = await customerRepository.findById(request.customerId)

            return {
                ...request,
                customerId: customer ? {
                    id: customer.id,
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                } : null,
                serviceCategoryId: category ? {
                    id: category.id,
                    name: category.name,
                    slug: category.slug,
                    icon: category.icon,
                    requiredSkills: category.requiredSkills,
                } : null,
            }
        })
    )

    res.status(200).json({
      message: "Available service requests retrieved",
      success: true,
      data: enrichedRequests,
      pagination: {
        currentPage: page,
        totalPages: result.totalPages,
        totalRequests: result.total,
        limit,
        hasNext: page < result.totalPages,
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
    const requestIdValue = Array.isArray(requestId) ? requestId[0] : requestId

    if (!requestId) {
      res.status(400).json({
        message: "Request Id is required",
        success: false,
      });
      return;
    }

    const provider = await serviceProviderRepository.findById(providerId);
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

    const serviceRequests = await serviceRequestRepository.findById(requestIdValue)

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
    const updatedRequest = await serviceRequestRepository.assignProvider(
      requestIdValue,
      providerId,
      provider.name,
    );

    // Fetch customer for notification
    const customer = await customerRepository.findById(serviceRequests.customerId);

    const notificationResult = await handleRequestAcceptedNotifications(
      customer?.id || "",
      customer?.name || "",
      provider.id,
      provider.name,
      requestIdValue,
      serviceRequests.serviceTitle,
    );

    res.status(200).json({
      message: "Service Request Accepted Successfully",
      success: true,
      data: {
        request: {
          id: updatedRequest?.id,
          serviceTitle: updatedRequest?.serviceTitle,
          status: "assigned",
          schedule: updatedRequest?.schedule,
          serviceAddress: updatedRequest?.serviceAddress,
        },
        provider: {
          name: provider.name,
          email: provider.email,
          phone: provider.phone,
        },
        customer: {
          name: customer?.name,
          email: customer?.email,
          notified: !!customer,
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
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";

    const provider = await serviceProviderRepository.findById(providerId);
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
    const result = await serviceRequestRepository.findAllWithPagination({
      filters: {
        providerId,
        ...(status ? { status } : {}),
      },
      pagination: { page, limit },
      sort: { field: sortBy, order: order as "asc" | "desc" },
    });

    const stats = await serviceRequestRepository.getStatusStatistics(providerId, "provider");

    res.status(200).json({
      message: "Requests Retrieved: ",
      success: true,
      data: result.requests,
      pagination: {
        currentPage: page,
        totalPages: result.pagination.totalPages,
        totalRequests: result.pagination.total,
        limit,
        hasNext: page < result.pagination.totalPages,
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
    const requestIdValue = Array.isArray(requestId) ? requestId[0] : requestId

    if (!requestId) {
      res.status(400).json({
        message: "Request Id is required.",
        success: false,
      });
      return;
    }

    const provider = await serviceProviderRepository.findById(providerId);
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
    const serviceRequest = await serviceRequestRepository.findById(requestIdValue);

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

    // validate that service can only be started on the scheduled date
    const scheduledDate = new Date(serviceRequest.schedule.date);
    const today = new Date();

    // Reset time to midnight for accurate date comparison
    scheduledDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    // Check if today is the scheduled date
    if (today.getTime() !== scheduledDate.getTime()) {
      const daysDiff = Math.floor((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff < 0) {
        res.status(400).json({
          message: `Cannot start service. The scheduled date was ${Math.abs(daysDiff)} day(s) ago. Service was scheduled for ${scheduledDate.toDateString()}.`,
          success: false,
          scheduledDate: scheduledDate.toISOString(),
          currentDate: today.toISOString(),
          daysPast: Math.abs(daysDiff),
        });
        return;
      } else {
        res.status(400).json({
          message: `Cannot start service. The scheduled date is ${daysDiff} day(s) from now. You can start the service on ${scheduledDate.toDateString()}.`,
          success: false,
          scheduledDate: scheduledDate.toISOString(),
          currentDate: today.toISOString(),
          daysRemaining: daysDiff,
        });
        return;
      }
    }

    // Optional: Check if current time matches the time slot
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    let timeSlotValid = false;

    switch (serviceRequest.schedule.timeSlot) {
      case "morning":
        // Morning: 6 AM to 12 PM
        timeSlotValid = currentHour >= 6 && currentHour < 12;
        break;
      case "afternoon":
        // Afternoon: 12 PM to 5 PM
        timeSlotValid = currentHour >= 12 && currentHour < 17;
        break;
      case "evening":
        // Evening: 5 PM to 9 PM
        timeSlotValid = currentHour >= 17 && currentHour < 21;
        break;
    }

    if (!timeSlotValid) {
      res.status(400).json({
        message: `Cannot start service. The scheduled time slot is "${serviceRequest.schedule.timeSlot}". Current time does not fall within this slot.`,
        success: false,
        scheduledTimeSlot: serviceRequest.schedule.timeSlot,
        currentTime: currentTime.toLocaleTimeString(),
      });
      return;
    }

    // updating the request
    const updatedRequest = await serviceRequestRepository.updateStatus(requestIdValue, "in_progress");

    await serviceRequestRepository.addStatusHistory(requestIdValue, {
      status: "in_progress",
      note: `Service started by ${provider.name}`,
      updatedBy: "service_provider",
    });

    res.status(200).json({
      message: "Service Started Successfully",
      success: true,
      data: {
        request: {
          id: updatedRequest?.id,
          serviceTitle: updatedRequest?.serviceTitle,
          status: "in_progress",
          schedule: updatedRequest?.schedule,
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
    const requestIdValue = Array.isArray(requestId) ? requestId[0] : requestId;
    const { afterImages, finalPrice } = req.body;

    if (!requestId) {
      res.status(400).json({
        message: "Request Id Not Found",
        success: false,
      });
      return;
    }

    const provider = await serviceProviderRepository.findById(providerId);
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
    const serviceRequest = await serviceRequestRepository.findById(requestIdValue);

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

    // Update service request status
    const updatedRequest = await serviceRequestRepository.updateStatus(requestIdValue, "completed");

    // Update after images if provided
    if (afterImages) {
      await serviceRequestRepository.updateAfterImages(requestIdValue, afterImages);
    }

    // Update final price if provided
    if (finalPrice) {
      await serviceRequestRepository.updateFinalPrice(requestIdValue, finalPrice);
    }

    // Add status history
    await serviceRequestRepository.addStatusHistory(requestIdValue, {
      status: "completed",
      note: `Service completed by ${provider.name}. Final price: ${finalPrice || serviceRequest.estimatedPrice}`,
      updatedBy: "service_provider",
    });

    // Increment provider's totalJobsCompleted
    await serviceProviderRepository.incrementJobsCompleted(providerId);

    res.status(200).json({
      message: "Service Completed Successfully.",
      success: true,
      data: {
        request: {
          id: updatedRequest?.id,
          serviceTitle: updatedRequest?.serviceTitle,
          status: "completed",
          finalPrice: finalPrice || updatedRequest?.estimatedPrice,
          estimatedPrice: updatedRequest?.estimatedPrice,
          completedAt: updatedRequest?.completedAt,
          afterImages: afterImages || [],
        },
        provider: {
          name: provider.name,
        },
        pricing: {
          estimated: parseFloat(updatedRequest?.estimatedPrice || "0"),
          final: parseFloat(finalPrice || updatedRequest?.estimatedPrice || "0"),
          difference: parseFloat(finalPrice || updatedRequest?.estimatedPrice || "0") - parseFloat(updatedRequest?.estimatedPrice || "0"),
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

// Helper functions for pricing

/**
 * Get providers who match category requirements (skills and service area)
 */
async function getMatchingProviders(category: any, city: string) {
  try {
    const allProviders = await serviceProviderRepository.findAll();

    return allProviders.filter((provider: any) => {
      // Must be active and not suspended
      if (!provider.isActive || provider.isSuspended) return false;

      // Check skills match
      if (!provider.skills || provider.skills.length === 0) return false;
      if (!category.requiredSkills || category.requiredSkills.length === 0)
        return false;

      const providerSkillsLower = provider.skills.map((s: string) => s.toLowerCase());
      const categorySkillsLower = category.requiredSkills.map((s: string) => s.toLowerCase());

      const hasMatchingSkill = providerSkillsLower.some((skill: string) =>
        categorySkillsLower.includes(skill)
      );

      if (!hasMatchingSkill) return false;

      // Check service area (city must match)
      if (!provider.serviceArea || provider.serviceArea.length === 0) return false;

      const providerCities = provider.serviceArea
        .map((area: any) => area.city?.toLowerCase())
        .filter(Boolean);

      return providerCities.includes(city.toLowerCase());
    });
  } catch (error) {
    console.error('Error getting matching providers:', error);
    return [];
  }
}

/**
 * Calculate admin commission from category settings
 */
function calculateAdminCommissionFromCategory(
  providerRate: number,
  adminCommission: any
): number {
  if (!adminCommission) return 0;

  const type = adminCommission.type || 'fixed';
  let adminCharge = 0;

  switch (type) {
    case 'percentage':
      adminCharge = (providerRate * (adminCommission.percentage || 0)) / 100;
      if (adminCommission.minCommission && adminCharge < adminCommission.minCommission) {
        adminCharge = adminCommission.minCommission;
      }
      if (adminCommission.maxCommission && adminCharge > adminCommission.maxCommission) {
        adminCharge = adminCommission.maxCommission;
      }
      break;

    case 'fixed':
      adminCharge = adminCommission.fixed || 0;
      break;

    case 'hybrid':
      const fixedPart = adminCommission.fixed || 0;
      const percentPart = adminCommission.percentage
        ? (providerRate * adminCommission.percentage) / 100
        : 0;
      adminCharge = fixedPart + percentPart;

      if (adminCommission.minCommission && adminCharge < adminCommission.minCommission) {
        adminCharge = adminCommission.minCommission;
      }
      if (adminCommission.maxCommission && adminCharge > adminCommission.maxCommission) {
        adminCharge = adminCommission.maxCommission;
      }
      break;

    default:
      adminCharge = 0;
  }

  return adminCharge;
}
