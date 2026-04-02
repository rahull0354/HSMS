import { Request, Response } from "express";
import { payoutRepository } from "#db/repositories/payout.repository.js";
import { invoiceRepository } from "#db/repositories/invoice.repository.js";
import { serviceRequestRepository } from "#db/repositories/serviceRequests.repository.js";
import { serviceProviderRepository } from "#db/repositories/serviceProvider.repository.js";
import * as notificationService from "#drizzleServices/notification.service.js";

// Helper function to handle route params that can be string or string array
function getRouteParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

/**
 * Get all pending payouts for all providers
 * GET /api/admin/payouts/pending
 */
export const getPendingPayouts = async (req: Request, res: Response) => {
  try {
    console.log("📊 [PAYOUT] Fetching pending payouts for all providers");

    const pendingPayouts = await payoutRepository.getPendingPayouts();

    res.status(200).json({
      message: "Pending payouts retrieved successfully",
      success: true,
      data: pendingPayouts,
      count: pendingPayouts.length,
    });
    return;
  } catch (error: any) {
    console.error("Error fetching pending payouts:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch pending payouts",
      success: false,
    });
    return;
  }
};

/**
 * Initiate payout for a specific provider
 * POST /api/admin/payouts/initiate/:providerId
 */
export const initiatePayout = async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const providerIdValue = getRouteParam(providerId);

    const adminId = (req as any).user.id;
    const { notes, bankAccount } = req.body;

    console.log(`💰 [PAYOUT] Initiating payout for provider: ${providerId}`);

    // Get pending invoices for this provider
    const allPendingPayouts = await payoutRepository.getPendingPayouts();
    const providerPending = allPendingPayouts.find(
      (p: any) => p.providerId === providerId,
    );

    if (!providerPending) {
      res.status(404).json({
        message: "No pending payouts found for this provider",
        success: false,
      });
      return;
    }

    // Get provider details including bank account
    const provider = await serviceProviderRepository.findById(providerIdValue);
    if (!provider) {
      res.status(404).json({
        message: "Provider not found",
        success: false,
      });
      return;
    }

    // Use provided bank account or get from provider profile
    const payoutBankAccount = bankAccount || (provider as any).bankAccount;

    // Calculate invoice amount (sum of invoice totals)
    const invoiceAmount = providerPending.invoices.reduce(
      (sum: number, inv: any) => sum + parseFloat(inv.totalAmount || 0),
      0,
    );

    // Create payout record
    const payout = await payoutRepository.createPayout({
      providerId: providerIdValue,
      payoutGroupId: `PG-${Date.now()}`,
      totalAmount: providerPending.totalAmount,
      invoiceAmount: invoiceAmount.toString(),
      invoiceIds: providerPending.invoiceIds,
      status: "pending",
      bankAccount: payoutBankAccount,
      notes: notes || `Payout for ${providerPending.invoiceCount} invoices`,
      processedBy: adminId,
    });

    console.log(
      `✅ [PAYOUT] Payout initiated: ${payout.id} for provider ${providerId}`,
    );
    console.log(`   Amount: ₹${providerPending.totalAmount}`);
    console.log(`   Invoices: ${providerPending.invoiceCount}`);

    // Send notification to provider
    try {
      await notificationService.notifyProviderPayoutInitiated(
        providerIdValue,
        payout.id,
        providerPending.totalAmount,
        providerPending.invoiceCount,
      );
    } catch (notifError) {
      console.error(
        "Failed to send payout initiated notification:",
        notifError,
      );
      // Don't fail the payout if notification fails
    }

    res.status(201).json({
      message: "Payout initiated successfully",
      success: true,
      data: {
        payout,
        provider: {
          id: provider.id,
          name: provider.name,
          email: provider.email,
          phone: provider.phone,
        },
        breakdown: {
          invoiceCount: providerPending.invoiceCount,
          totalAmount: providerPending.totalAmount,
          invoiceIds: providerPending.invoiceIds,
        },
      },
    });
    return;
  } catch (error: any) {
    console.error("Error initiating payout:", error);
    res.status(500).json({
      message: error.message || "Failed to initiate payout",
      success: false,
    });
    return;
  }
};

/**
 * Process payout (mark as processing)
 * POST /api/admin/payouts/process/:payoutId
 */
export const processPayout = async (req: Request, res: Response) => {
  try {
    const { payoutId } = req.params;
    const payoutIdValue = getRouteParam(payoutId);
    const adminId = (req as any).user.id;
    const { bankAccount } = req.body;

    console.log(`⏳ [PAYOUT] Processing payout: ${payoutIdValue}`);

    // Get payout details
    const payout = await payoutRepository.getPayoutById(payoutIdValue);
    if (!payout) {
      res.status(404).json({
        message: "Payout not found",
        success: false,
      });
      return;
    }

    // Check if payout can be processed
    if (payout.status !== "pending") {
      res.status(400).json({
        message: `Cannot process payout with status: ${payout.status}`,
        success: false,
      });
      return;
    }

    // Update payout to processing
    const updatedPayout = await payoutRepository.updatePayoutStatus(
      payoutIdValue,
      "processing",
      {
        processedAt: new Date(),
        bankAccount: bankAccount || payout.bankAccount,
      },
    );

    // Get provider details
    const provider = await serviceProviderRepository.findById(
      payout.providerId,
    );

    console.log(`✅ [PAYOUT] Payout ${payoutId} marked as processing`);

    // Send notification to provider
    try {
      await notificationService.notifyProviderPayoutProcessed(
        payout.providerId,
        payout.id,
        payout.totalAmount,
      );
    } catch (notifError) {
      console.error(
        "Failed to send payout processed notification:",
        notifError,
      );
      // Don't fail the payout if notification fails
    }

    res.status(200).json({
      message: "Payout processed successfully. Please initiate bank transfer.",
      success: true,
      data: {
        payout: updatedPayout,
        provider: provider
          ? {
              id: provider.id,
              name: provider.name,
              email: provider.email,
              phone: provider.phone,
            }
          : null,
        bankAccount: updatedPayout.bankAccount,
        instructions:
          "Transfer the amount via NEFT/IMPS/UPI and complete with UTR",
      },
    });
    return;
  } catch (error: any) {
    console.error("Error processing payout:", error);
    res.status(500).json({
      message: error.message || "Failed to process payout",
      success: false,
    });
    return;
  }
};

export const completePayout = async (req: Request, res: Response) => {
  try {
    const { payoutId } = req.params;
    const payoutIdValue = getRouteParam(payoutId);

    const { utr, transactionId, notes } = req.body;

    if (!utr) {
      res.status(400).json({
        message: "UTR (Unified Payment Reference) is required",
        success: false,
      });
      return;
    }

    console.log(
      `✅ [PAYOUT] Completing payout: ${payoutIdValue} with UTR: ${utr}`,
    );

    // Get payout details
    const payout = await payoutRepository.getPayoutById(payoutIdValue);
    if (!payout) {
      res.status(404).json({
        message: "Payout not found",
        success: false,
      });
      return;
    }

    // Check if payout can be completed
    if (payout.status !== "processing") {
      res.status(400).json({
        message: `Cannot complete payout with status: ${payout.status}`,
        success: false,
      });
      return;
    }

    // Update payout to completed
    const updatedPayout = await payoutRepository.updatePayoutStatus(
      payoutIdValue,
      "completed",
      {
        utr,
        transactionId: transactionId || utr,
        completedAt: new Date(),
        notes: notes || payout.notes,
      },
    );

    // Get provider details
    const provider = await serviceProviderRepository.findById(
      payout.providerId,
    );

    console.log(`💰 [PAYOUT] Payout ${payoutId} completed successfully`);
    console.log(`   Provider: ${provider?.name}`);
    console.log(`   Amount: ₹${payout.totalAmount}`);
    console.log(`   UTR: ${utr}`);

    // Send notification to provider
    try {
      const bankName = (payout.bankAccount as any)?.bankName;
      await notificationService.notifyProviderPayoutCompleted(
        payout.providerId,
        payout.id,
        payout.totalAmount,
        utr,
        bankName,
      );
    } catch (notifError) {
      console.error(
        "Failed to send payout completed notification:",
        notifError,
      );
      // Don't fail the payout if notification fails
    }

    res.status(200).json({
      message: "Payout completed successfully",
      success: true,
      data: {
        payout: updatedPayout,
        provider: provider
          ? {
              id: provider.id,
              name: provider.name,
              email: provider.email,
              phone: provider.phone,
            }
          : null,
      },
    });
    return;
  } catch (error: any) {
    console.error("Error completing payout:", error);
    res.status(500).json({
      message: error.message || "Failed to complete payout",
      success: false,
    });
    return;
  }
};

export const failPayout = async (req: Request, res: Response) => {
  try {
    const { payoutId } = req.params;
    const payoutIdValue = getRouteParam(payoutId);
    const { failureReason } = req.body;

    if (!failureReason) {
      res.status(400).json({
        message: "Failure reason is required",
        success: false,
      });
      return;
    }

    console.log(`❌ [PAYOUT] Failing payout: ${payoutId}`);
    console.log(`   Reason: ${failureReason}`);

    // Get payout details
    const payout = await payoutRepository.getPayoutById(payoutIdValue);
    if (!payout) {
      res.status(404).json({
        message: "Payout not found",
        success: false,
      });
      return;
    }

    // Mark payout as failed
    const updatedPayout = await payoutRepository.markPayoutAsFailed(
      payoutIdValue,
      failureReason,
    );

    // Get provider details
    const provider = await serviceProviderRepository.findById(
      payout.providerId,
    );

    console.log(`❌ [PAYOUT] Payout ${payoutId} marked as failed`);

    // Send notification to provider
    try {
      await notificationService.notifyProviderPayoutFailed(
        payout.providerId,
        payout.id,
        payout.totalAmount,
        failureReason,
      );
    } catch (notifError) {
      console.error("Failed to send payout failed notification:", notifError);
      // Don't fail the payout if notification fails
    }

    res.status(200).json({
      message: "Payout marked as failed",
      success: true,
      data: {
        payout: updatedPayout,
        provider: provider
          ? {
              id: provider.id,
              name: provider.name,
              email: provider.email,
            }
          : null,
      },
    });
    return;
  } catch (error: any) {
    console.error("Error failing payout:", error);
    res.status(500).json({
      message: error.message || "Failed to mark payout as failed",
      success: false,
    });
    return;
  }
};

export const getPayoutStats = async (req: Request, res: Response) => {
  try {
    console.log("📊 [PAYOUT] Fetching payout statistics");

    // Get date filters from query
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const stats = await payoutRepository.getPayoutStats({
      startDate,
      endDate,
    });

    res.status(200).json({
      message: "Payout statistics retrieved successfully",
      success: true,
      data: stats,
    });
    return;
  } catch (error: any) {
    console.error("Error fetching payout statistics:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch payout statistics",
      success: false,
    });
    return;
  }
};

export const getAllPayouts = async (req: Request, res: Response) => {
  try {
    console.log("📋 [PAYOUT] Fetching all payouts");

    // Build filters from query params
    const filters: any = {};

    if (req.query.providerId) {
      filters.providerId = req.query.providerId;
    }

    if (req.query.status) {
      filters.status = req.query.status;
    }

    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }

    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
    }

    // Build pagination from query params
    const pagination: any = {};
    if (req.query.page) {
      pagination.page = parseInt(req.query.page as string);
    }
    if (req.query.limit) {
      pagination.limit = parseInt(req.query.limit as string);
    }

    const result = await payoutRepository.getAllPayouts(
      Object.keys(filters).length > 0 ? filters : undefined,
      Object.keys(pagination).length > 0 ? pagination : undefined,
    );

    // Enrich with provider details
    const enrichedPayouts = await Promise.all(
      result.payouts.map(async (payout: any) => {
        const provider = await serviceProviderRepository.findById(
          payout.providerId,
        );
        return {
          ...payout,
          provider: provider
            ? {
                id: provider.id,
                name: provider.name,
                email: provider.email,
                phone: provider.phone,
              }
            : null,
        };
      }),
    );

    res.status(200).json({
      message: "Payouts retrieved successfully",
      success: true,
      data: enrichedPayouts,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
    return;
  } catch (error: any) {
    console.error("Error fetching payouts:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch payouts",
      success: false,
    });
    return;
  }
};

export const getPayoutById = async (req: Request, res: Response) => {
  try {
    const { payoutId } = req.params;
    const payoutIdValue = getRouteParam(payoutId);

    console.log(`🔍 [PAYOUT] Fetching payout: ${payoutId}`);

    const payout = await payoutRepository.getPayoutById(payoutIdValue);

    if (!payout) {
      res.status(404).json({
        message: "Payout not found",
        success: false,
      });
      return;
    }

    // Get provider details
    const provider = await serviceProviderRepository.findById(
      payout.providerId,
    );

    // Get invoice details
    const invoices = await Promise.all(
      (payout.invoiceIds as string[]).map((invoiceId) =>
        invoiceRepository.getInvoiceById(invoiceId),
      ),
    );

    res.status(200).json({
      message: "Payout retrieved successfully",
      success: true,
      data: {
        ...payout,
        provider: provider
          ? {
              id: provider.id,
              name: provider.name,
              email: provider.email,
              phone: provider.phone,
            }
          : null,
        invoices: invoices.filter((inv) => inv !== null),
      },
    });
    return;
  } catch (error: any) {
    console.error("Error fetching payout:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch payout",
      success: false,
    });
    return;
  }
};

export const bulkInitiatePayouts = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const { providerIds, notes } = req.body;

    if (
      !providerIds ||
      !Array.isArray(providerIds) ||
      providerIds.length === 0
    ) {
      res.status(400).json({
        message: "Provider IDs array is required",
        success: false,
      });
      return;
    }

    console.log(
      `💰 [PAYOUT] Bulk initiating payouts for ${providerIds.length} providers`,
    );

    // Get all pending payouts
    const allPendingPayouts = await payoutRepository.getPendingPayouts();

    // Filter for requested providers
    const selectedPendingPayouts = allPendingPayouts.filter((p: any) =>
      providerIds.includes(p.providerId),
    );

    if (selectedPendingPayouts.length === 0) {
      res.status(404).json({
        message: "No pending payouts found for selected providers",
        success: false,
      });
      return;
    }

    // Create payout records for each provider
    const payouts = [];
    const errors = [];

    for (const providerPending of selectedPendingPayouts) {
      try {
        // Get provider details
        const provider = await serviceProviderRepository.findById(
          providerPending.providerId,
        );

        if (!provider) {
          errors.push({
            providerId: providerPending.providerId,
            error: "Provider not found",
          });
          continue;
        }

        // Calculate invoice amount
        const invoiceAmount = providerPending.invoices.reduce(
          (sum: number, inv: any) => sum + parseFloat(inv.totalAmount || 0),
          0,
        );

        // Create payout
        const payout = await payoutRepository.createPayout({
          providerId: providerPending.providerId,
          payoutGroupId: `BULK-${Date.now()}`,
          totalAmount: providerPending.totalAmount,
          invoiceAmount: invoiceAmount.toString(),
          invoiceIds: providerPending.invoiceIds,
          status: "pending",
          bankAccount: (provider as any).bankAccount,
          notes:
            notes || `Bulk payout for ${providerPending.invoiceCount} invoices`,
          processedBy: adminId,
        });

        payouts.push({
          payout,
          provider: {
            id: provider.id,
            name: provider.name,
            email: provider.email,
          },
        });
      } catch (error: any) {
        errors.push({
          providerId: providerPending.providerId,
          error: error.message,
        });
      }
    }

    console.log(`✅ [PAYOUT] Bulk payout initiation completed`);
    console.log(`   Successful: ${payouts.length}`);
    console.log(`   Failed: ${errors.length}`);

    res.status(201).json({
      message: `Bulk payout initiation completed. ${payouts.length} successful, ${errors.length} failed`,
      success: true,
      data: {
        payouts,
        errors,
        summary: {
          total: providerIds.length,
          successful: payouts.length,
          failed: errors.length,
        },
      },
    });
    return;
  } catch (error: any) {
    console.error("Error in bulk payout initiation:", error);
    res.status(500).json({
      message: error.message || "Failed to initiate bulk payouts",
      success: false,
    });
    return;
  }
};

export const getProviderPayoutSummary = async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const providerIdValue = getRouteParam(providerId);

    console.log(
      `📊 [PAYOUT] Fetching payout summary for provider: ${providerId}`,
    );

    const summary =
      await payoutRepository.getProviderPayoutSummary(providerIdValue);

    // Get provider details
    const provider = await serviceProviderRepository.findById(providerIdValue);

    if (!provider) {
      res.status(404).json({
        message: "Provider not found",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: "Provider payout summary retrieved successfully",
      success: true,
      data: {
        provider: {
          id: provider.id,
          name: provider.name,
          email: provider.email,
          phone: provider.phone,
        },
        summary,
      },
    });
    return;
  } catch (error: any) {
    console.error("Error fetching provider payout summary:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch provider payout summary",
      success: false,
    });
    return;
  }
};

/**
 * Get my payouts (Provider view)
 * GET /api/service-provider/payouts
 */
export const getMyPayouts = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    console.log(`📋 [PAYOUT] Provider ${providerId} fetching their payouts`);

    const result = await payoutRepository.getPayoutsByProvider(providerId, {
      page,
      limit,
    });

    res.status(200).json({
      message: "Payouts retrieved successfully",
      success: true,
      data: result.payouts,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
    return;
  } catch (error: any) {
    console.error("Error fetching provider payouts:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch payouts",
      success: false,
    });
    return;
  }
};

/**
 * Get my payout summary (Provider view)
 * GET /api/service-provider/payouts/summary
 */
export const getMyPayoutSummary = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;

    console.log(`📊 [PAYOUT] Provider ${providerId} fetching payout summary`);

    const summary = await payoutRepository.getProviderPayoutSummary(providerId);

    res.status(200).json({
      message: "Payout summary retrieved successfully",
      success: true,
      data: summary,
    });
    return;
  } catch (error: any) {
    console.error("Error fetching payout summary:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch payout summary",
      success: false,
    });
    return;
  }
};

/**
 * Get my pending invoices (Provider view)
 * GET /api/service-provider/payouts/pending
 */
export const getMyPendingInvoices = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;

    console.log(`📋 [PAYOUT] Provider ${providerId} fetching pending invoices`);

    // Get all pending payouts
    const allPendingPayouts = await payoutRepository.getPendingPayouts();

    // Find this provider's pending invoices
    const providerPending = allPendingPayouts.find(
      (p: any) => p.providerId === providerId,
    );

    if (!providerPending) {
      res.status(200).json({
        message: "No pending invoices found",
        success: true,
        data: {
          invoiceCount: 0,
          totalAmount: "0",
          invoices: [],
        },
      });
      return;
    }

    // Fetch full invoice details for each pending invoice
    const invoiceDetails = await Promise.all(
      providerPending.invoiceIds.map((invoiceId: string) =>
        invoiceRepository.getInvoiceById(invoiceId),
      ),
    );

    // Fetch service request details for each invoice
    const enrichedInvoices = await Promise.all(
      invoiceDetails
        .filter((inv) => inv !== null)
        .map(async (invoice: any) => {
          // Get service request details
          const serviceRequest = await serviceRequestRepository.findById(
            invoice.requestId,
          );

          return {
            ...invoice,
            serviceRequest: serviceRequest
              ? {
                  id: serviceRequest.id,
                  serviceTitle: serviceRequest.serviceTitle,
                  serviceType: serviceRequest.serviceType,
                  completedAt: serviceRequest.completedAt,
                }
              : null,
          };
        }),
    );

    res.status(200).json({
      message: "Pending invoices retrieved successfully",
      success: true,
      data: {
        invoiceCount: enrichedInvoices.length,
        totalAmount: providerPending.totalAmount,
        invoices: enrichedInvoices,
        summary: {
          totalEarning: providerPending.totalAmount,
          invoiceCount: enrichedInvoices.length,
          awaitingPayout: true,
        },
      },
    });
    return;
  } catch (error: any) {
    console.error("Error fetching pending invoices:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch pending invoices",
      success: false,
    });
    return;
  }
};

/**
 * Get single payout details (Provider view)
 * GET /api/service-provider/payouts/:payoutId
 */
export const getMyPayoutById = async (req: Request, res: Response) => {
  try {
    const { payoutId } = req.params;
    const providerId = (req as any).user.id;
    const payoutIdValue = Array.isArray(payoutId) ? payoutId[0] : payoutId;

    console.log(
      `🔍 [PAYOUT] Provider ${providerId} fetching payout ${payoutIdValue}`,
    );

    const payout = await payoutRepository.getPayoutById(payoutIdValue);

    if (!payout) {
      res.status(404).json({
        message: "Payout not found",
        success: false,
      });
      return;
    }

    // Verify payout belongs to this provider
    if (payout.providerId !== providerId) {
      res.status(403).json({
        message: "Access denied. This payout does not belong to you.",
        success: false,
      });
      return;
    }

    // Get invoice details
    const invoices = await Promise.all(
      (payout.invoiceIds as string[]).map((invoiceId) =>
        invoiceRepository.getInvoiceById(invoiceId),
      ),
    );

    res.status(200).json({
      message: "Payout retrieved successfully",
      success: true,
      data: {
        ...payout,
        invoices: invoices.filter((inv) => inv !== null),
      },
    });
    return;
  } catch (error: any) {
    console.error("Error fetching payout:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch payout",
      success: false,
    });
    return;
  }
};
