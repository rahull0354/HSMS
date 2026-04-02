import { Request, Response } from "express";
import { bankAccountRepository } from "#db/repositories/bankAccount.repository.js";
import { serviceProviderRepository } from "#db/repositories/serviceProvider.repository.js";
import * as notificationService from "#drizzleServices/notification.service.js";

/**
 * Add a new bank account
 * POST /api/service-provider/bank-accounts
 */
export const addBankAccount = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;
    const {
      accountNumber,
      ifsc,
      accountHolder,
      bankName,
      accountType,
      upiId,
      branch,
      notes,
      isPrimary,
    } = req.body;

    // Validation
    if (!accountNumber || !ifsc || !accountHolder || !bankName) {
      res.status(400).json({
        message:
          "Account number, IFSC, account holder, and bank name are required",
        success: false,
      });
      return;
    }

    // IFSC validation (11 characters alphanumeric)
    if (!/^[A-Z0-9]{11}$/.test(ifsc)) {
      res.status(400).json({
        message: "Invalid IFSC code. Must be 11 characters alphanumeric.",
        success: false,
      });
      return;
    }

    // Account number validation (only digits, 9-18 digits)
    if (!/^\d{9,18}$/.test(accountNumber)) {
      res.status(400).json({
        message: "Invalid account number. Must be 9-18 digits.",
        success: false,
      });
      return;
    }

    console.log(`🏦 [BANK] Adding bank account for provider ${providerId}`);

    const bankAccount = await bankAccountRepository.addBankAccount({
      providerId,
      accountNumber,
      ifsc,
      accountHolder,
      bankName,
      accountType: accountType || "savings",
      upiId,
      branch,
      notes,
      isPrimary,
    });

    console.log(`✅ [BANK] Bank account added: ${bankAccount.id}`);

    // Send notification to admin for verification
    try {
      const provider = await serviceProviderRepository.findById(providerId);
      await notificationService.notifyAdminBankAccountAdded(
        providerId,
        provider?.name || 'Unknown',
        bankName,
        bankAccount.accountNumberLast4,
        ifsc
      );
    } catch (notifError) {
      console.error("Failed to send bank account added notification to admin:", notifError);
      // Don't fail the operation if notification fails
    }

    // Return masked account number
    const responseAccount = {
      ...bankAccount,
      accountNumber: `XXXX-XXXX-XXXX-${bankAccount.accountNumberLast4}`,
    };

    res.status(201).json({
      message: "Bank account added successfully",
      success: true,
      data: responseAccount,
    });
    return;
  } catch (error: any) {
    console.error("Error adding bank account:", error);

    if (error.message === "Cannot delete primary bank account. You must add another account first.") {
      res.status(400).json({
        message: error.message,
        success: false,
      });
      return;
    }

    res.status(500).json({
      message: error.message || "Failed to add bank account",
      success: false,
    });
    return;
  }
};

/**
 * Get all my bank accounts
 * GET /api/service-provider/bank-accounts
 */
export const getMyBankAccounts = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;

    console.log(`🏦 [BANK] Fetching bank accounts for provider ${providerId}`);

    const accounts = await bankAccountRepository.getProviderBankAccounts(
      providerId
    );

    res.status(200).json({
      message: "Bank accounts retrieved successfully",
      success: true,
      data: accounts,
      count: accounts.length,
    });
    return;
  } catch (error: any) {
    console.error("Error fetching bank accounts:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch bank accounts",
      success: false,
    });
    return;
  }
};

/**
 * Get primary bank account
 * GET /api/service-provider/bank-accounts/primary
 */
export const getMyPrimaryBankAccount = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;

    console.log(`🏦 [BANK] Fetching primary bank account for provider ${providerId}`);

    const account = await bankAccountRepository.getPrimaryBankAccount(providerId);

    if (!account) {
      res.status(404).json({
        message: "No primary bank account found",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: "Primary bank account retrieved successfully",
      success: true,
      data: account,
    });
    return;
  } catch (error: any) {
    console.error("Error fetching primary bank account:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch primary bank account",
      success: false,
    });
    return;
  }
};

/**
 * Get single bank account by ID
 * GET /api/service-provider/bank-accounts/:bankAccountId
 */
export const getBankAccountById = async (req: Request, res: Response) => {
  try {
    const { bankAccountId } = req.params;
    const providerId = (req as any).user.id;
    const bankAccountIdValue = Array.isArray(bankAccountId)
      ? bankAccountId[0]
      : bankAccountId;

    console.log(`🏦 [BANK] Fetching bank account ${bankAccountIdValue}`);

    const account = await bankAccountRepository.getBankAccountById(
      bankAccountIdValue
    );

    if (!account) {
      res.status(404).json({
        message: "Bank account not found",
        success: false,
      });
      return;
    }

    // Verify account belongs to this provider
    if (account.providerId !== providerId) {
      res.status(403).json({
        message: "Access denied. This bank account does not belong to you.",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: "Bank account retrieved successfully",
      success: true,
      data: account,
    });
    return;
  } catch (error: any) {
    console.error("Error fetching bank account:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch bank account",
      success: false,
    });
    return;
  }
};

/**
 * Update bank account
 * PUT /api/service-provider/bank-accounts/:bankAccountId
 */
export const updateBankAccount = async (req: Request, res: Response) => {
  try {
    const { bankAccountId } = req.params;
    const providerId = (req as any).user.id;
    const bankAccountIdValue = Array.isArray(bankAccountId)
      ? bankAccountId[0]
      : bankAccountId;

    const {
      accountNumber,
      ifsc,
      accountHolder,
      bankName,
      accountType,
      upiId,
      branch,
      notes,
      isPrimary,
    } = req.body;

    console.log(`🏦 [BANK] Updating bank account ${bankAccountIdValue}`);

    // Verify account belongs to this provider
    const existingAccount = await bankAccountRepository.getBankAccountById(
      bankAccountIdValue
    );

    if (!existingAccount) {
      res.status(404).json({
        message: "Bank account not found",
        success: false,
      });
      return;
    }

    if (existingAccount.providerId !== providerId) {
      res.status(403).json({
        message: "Access denied. This bank account does not belong to you.",
        success: false,
      });
      return;
    }

    // Validate IFSC if provided
    if (ifsc && !/^[A-Z0-9]{11}$/.test(ifsc)) {
      res.status(400).json({
        message: "Invalid IFSC code. Must be 11 characters alphanumeric.",
        success: false,
      });
      return;
    }

    // Validate account number if provided
    if (accountNumber && !/^\d{9,18}$/.test(accountNumber)) {
      res.status(400).json({
        message: "Invalid account number. Must be 9-18 digits.",
        success: false,
      });
      return;
    }

    const updatedAccount = await bankAccountRepository.updateBankAccount(
      bankAccountIdValue,
      providerId,
      {
        accountNumber,
        ifsc,
        accountHolder,
        bankName,
        accountType,
        upiId,
        branch,
        notes,
        isPrimary,
      }
    );

    console.log(`✅ [BANK] Bank account ${bankAccountIdValue} updated`);

    // Return masked account number
    const responseAccount = {
      ...updatedAccount,
      accountNumber: `XXXX-XXXX-XXXX-${updatedAccount.accountNumberLast4}`,
    };

    res.status(200).json({
      message: "Bank account updated successfully",
      success: true,
      data: responseAccount,
    });
    return;
  } catch (error: any) {
    console.error("Error updating bank account:", error);
    res.status(500).json({
      message: error.message || "Failed to update bank account",
      success: false,
    });
    return;
  }
};

/**
 * Delete bank account
 * DELETE /api/service-provider/bank-accounts/:bankAccountId
 */
export const deleteBankAccount = async (req: Request, res: Response) => {
  try {
    const { bankAccountId } = req.params;
    const providerId = (req as any).user.id;
    const bankAccountIdValue = Array.isArray(bankAccountId)
      ? bankAccountId[0]
      : bankAccountId;

    console.log(`🏦 [BANK] Deleting bank account ${bankAccountIdValue}`);

    // Verify account belongs to this provider
    const existingAccount = await bankAccountRepository.getBankAccountById(
      bankAccountIdValue
    );

    if (!existingAccount) {
      res.status(404).json({
        message: "Bank account not found",
        success: false,
      });
      return;
    }

    if (existingAccount.providerId !== providerId) {
      res.status(403).json({
        message: "Access denied. This bank account does not belong to you.",
        success: false,
      });
      return;
    }

    const deletedAccount = await bankAccountRepository.deleteBankAccount(
      bankAccountIdValue,
      providerId
    );

    if (!deletedAccount) {
      res.status(404).json({
        message: "Bank account not found",
        success: false,
      });
      return;
    }

    console.log(`✅ [BANK] Bank account ${bankAccountIdValue} deleted`);

    res.status(200).json({
      message: "Bank account deleted successfully",
      success: true,
      data: {
        id: deletedAccount.id,
        accountNumberLast4: deletedAccount.accountNumberLast4,
        bankName: deletedAccount.bankName,
      },
    });
    return;
  } catch (error: any) {
    console.error("Error deleting bank account:", error);

    if (error.message === "Cannot delete primary bank account. You must add another account first.") {
      res.status(400).json({
        message: error.message,
        success: false,
      });
      return;
    }

    res.status(500).json({
      message: error.message || "Failed to delete bank account",
      success: false,
    });
    return;
  }
};

/**
 * Set bank account as primary
 * PATCH /api/service-provider/bank-accounts/:bankAccountId/set-primary
 */
export const setAsPrimary = async (req: Request, res: Response) => {
  try {
    const { bankAccountId } = req.params;
    const providerId = (req as any).user.id;
    const bankAccountIdValue = Array.isArray(bankAccountId)
      ? bankAccountId[0]
      : bankAccountId;

    console.log(`🏦 [BANK] Setting bank account ${bankAccountIdValue} as primary`);

    // Verify account belongs to this provider
    const existingAccount = await bankAccountRepository.getBankAccountById(
      bankAccountIdValue
    );

    if (!existingAccount) {
      res.status(404).json({
        message: "Bank account not found",
        success: false,
      });
      return;
    }

    if (existingAccount.providerId !== providerId) {
      res.status(403).json({
        message: "Access denied. This bank account does not belong to you.",
        success: false,
      });
      return;
    }

    const updatedAccount = await bankAccountRepository.setAsPrimary(
      bankAccountIdValue,
      providerId
    );

    console.log(`✅ [BANK] Bank account ${bankAccountIdValue} set as primary`);

    res.status(200).json({
      message: "Bank account set as primary successfully",
      success: true,
      data: {
        id: updatedAccount.id,
        accountNumberLast4: updatedAccount.accountNumberLast4,
        bankName: updatedAccount.bankName,
        isPrimary: true,
      },
    });
    return;
  } catch (error: any) {
    console.error("Error setting bank account as primary:", error);
    res.status(500).json({
      message: error.message || "Failed to set bank account as primary",
      success: false,
    });
    return;
  }
};

/**
 * Admin: Get all bank accounts
 * GET /api/admin/bank-accounts
 */
export const getAllBankAccounts = async (req: Request, res: Response) => {
  try {
    console.log("🏦 [BANK] Admin fetching all bank accounts");

    // Build filters from query params
    const filters: any = {};

    if (req.query.providerId) {
      filters.providerId = req.query.providerId;
    }

    if (req.query.verificationStatus) {
      filters.verificationStatus = req.query.verificationStatus;
    }

    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === "true";
    }

    // Build pagination from query params
    const pagination: any = {};
    if (req.query.page) {
      pagination.page = parseInt(req.query.page as string);
    }
    if (req.query.limit) {
      pagination.limit = parseInt(req.query.limit as string);
    }

    const result = await bankAccountRepository.getAllBankAccounts(
      Object.keys(filters).length > 0 ? filters : undefined,
      Object.keys(pagination).length > 0 ? pagination : undefined
    );

    res.status(200).json({
      message: "Bank accounts retrieved successfully",
      success: true,
      data: result.bankAccounts,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
    return;
  } catch (error: any) {
    console.error("Error fetching all bank accounts:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch bank accounts",
      success: false,
    });
    return;
  }
};

/**
 * Admin: Verify bank account
 * PATCH /api/admin/bank-accounts/:bankAccountId/verify
 */
export const verifyBankAccount = async (req: Request, res: Response) => {
  try {
    const { bankAccountId } = req.params;
    const { verified, reference } = req.body;
    const bankAccountIdValue = Array.isArray(bankAccountId)
      ? bankAccountId[0]
      : bankAccountId;

    console.log(
      `🏦 [BANK] Admin verifying bank account ${bankAccountIdValue}: ${verified}`
    );

    if (typeof verified !== "boolean") {
      res.status(400).json({
        message: "verified field must be a boolean",
        success: false,
      });
      return;
    }

    const updatedAccount = await bankAccountRepository.verifyBankAccount(
      bankAccountIdValue,
      verified,
      reference
    );

    console.log(
      `✅ [BANK] Bank account ${bankAccountIdValue} verification updated: ${verified ? "verified" : "failed"}`
    );

    // Send notification to provider about verification result
    try {
      const account = await bankAccountRepository.getBankAccountById(bankAccountIdValue);
      if (account) {
        await notificationService.notifyProviderBankAccountVerified(
          account.providerId,
          account.bankName,
          account.accountNumberLast4,
          verified ? 'verified' : 'failed',
          reference
        );
      }
    } catch (notifError) {
      console.error("Failed to send bank account verification notification:", notifError);
      // Don't fail the operation if notification fails
    }

    res.status(200).json({
      message: `Bank account ${verified ? "verified" : "verification failed"} successfully`,
      success: true,
      data: {
        ...updatedAccount,
        accountNumber: `XXXX-XXXX-XXXX-${updatedAccount.accountNumberLast4}`,
      },
    });
    return;
  } catch (error: any) {
    console.error("Error verifying bank account:", error);
    res.status(500).json({
      message: error.message || "Failed to verify bank account",
      success: false,
    });
    return;
  }
};
