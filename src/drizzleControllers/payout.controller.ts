import { Request, Response } from "express";
import { payoutRepository } from "#db/repositories/payout.repository.js";
import { invoiceRepository } from "#db/repositories/invoice.repository.js";
import { serviceRequestRepository } from "#db/repositories/serviceRequests.repository.js";
import { serviceProviderRepository } from "#db/repositories/serviceProvider.repository.js";
import { bankAccountRepository } from "#db/repositories/bankAccount.repository.js";
import * as notificationService from "#drizzleServices/notification.service.js";

// Helper function to handle route params that can be string or string array
function getRouteParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

// Helper function to generate payment instructions
function getPaymentInstructions(paymentMethod: string, paymentDetails: string, amount: string): string {
  if (paymentMethod === 'upi') {
    return `Transfer ₹${amount} to UPI ID: ${paymentDetails}. Open your UPI app (GPay, PhonePe, Paytm) and enter the UPI ID to make the payment.`;
  } else {
    return `Transfer ₹${amount} to bank account: ${paymentDetails}. Use NEFT, RTGS, IMPS, or your bank's online transfer service.`;
  }
}

export const getPendingPayouts = async (req: Request, res: Response) => {
  try {
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
 * Prepare payout for a specific provider (show all details before payout)
 * GET /api/admin/payouts/prepare/:providerId
 */
export const preparePayout = async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const providerIdValue = getRouteParam(providerId);

    console.log(`📋 [PAYOUT] Preparing payout for provider: ${providerId}`);

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

    // Get provider details
    const provider = await serviceProviderRepository.findById(providerIdValue);
    if (!provider) {
      res.status(404).json({
        message: "Provider not found",
        success: false,
      });
      return;
    }

    // Check for duplicate invoices (invoices already in existing payouts)
    const existingPayoutsData = await payoutRepository.getPayoutsByProvider(providerIdValue);
    const existingInvoiceIds = new Set<string>();

    existingPayoutsData.payouts.forEach((payout: any) => {
      if (payout.invoiceIds && Array.isArray(payout.invoiceIds)) {
        payout.invoiceIds.forEach((id: string) => existingInvoiceIds.add(id));
      }
    });

    const duplicateInvoices = providerPending.invoiceIds.filter((id: string) =>
      existingInvoiceIds.has(id)
    );

    // Get provider's payment details
    const bankAccounts = await bankAccountRepository.getProviderBankAccounts(providerIdValue);
    const primaryAccount = await bankAccountRepository.getPrimaryBankAccount(providerIdValue);

    // Filter to show only verified and active accounts
    const availableAccounts = bankAccounts.filter(
      (account: any) => account.isVerified && account.isActive
    );

    console.log(`✅ [PAYOUT] Payout preparation complete for provider ${providerId}`);
    console.log(`   Amount: ₹${providerPending.totalAmount}`);
    console.log(`   Invoices: ${providerPending.invoiceCount}`);
    console.log(`   Bank Accounts: ${availableAccounts.length}`);

    res.status(200).json({
      message: "Payout details prepared successfully",
      success: true,
      data: {
        provider: {
          id: provider.id,
          name: provider.name,
          email: provider.email,
          phone: provider.phone,
        },
        payout: {
          totalAmount: providerPending.totalAmount,
          invoiceCount: providerPending.invoiceCount,
          invoiceIds: providerPending.invoiceIds,
          invoices: providerPending.invoices,
          notes: `Payout for ${providerPending.invoiceCount} invoices`,
        },
        paymentDetails: {
          // Separate bank transfer and UPI options for clearer UX
          bankTransferOptions: availableAccounts
            .filter((a: any) => a.accountNumber && a.ifsc)
            .map((account: any) => ({
              id: account.id,
              type: 'bank_account',
              bankName: account.bankName,
              accountNumberLast4: account.accountNumberLast4,
              ifsc: account.ifsc,
              accountHolder: account.accountHolder,
              accountType: account.accountType,
              isPrimary: account.isPrimary,
            })),
          upiOptions: availableAccounts
            .filter((a: any) => a.upiId)
            .map((account: any) => ({
              id: `${account.id}-upi`,
              bankAccountId: account.id,
              type: 'upi',
              upiId: account.upiId,
              accountHolder: account.accountHolder,
              isPrimary: account.isPrimary,
            })),
          // Primary accounts (auto-selected if admin doesn't choose)
          primaryBankAccount: primaryAccount && primaryAccount.accountNumber ? {
            id: primaryAccount.id,
            bankName: primaryAccount.bankName,
            accountNumberLast4: primaryAccount.accountNumberLast4,
            ifsc: primaryAccount.ifsc,
            accountHolder: primaryAccount.accountHolder,
          } : null,
          primaryUpiId: primaryAccount && primaryAccount.upiId ? {
            id: `${primaryAccount.id}-upi`,
            upiId: primaryAccount.upiId,
          } : null,
          // Quick checks
          hasBankAccount: availableAccounts.some((a: any) => a.accountNumber),
          hasUpiId: availableAccounts.some((a: any) => a.upiId),
          bankAccountCount: availableAccounts.filter((a: any) => a.accountNumber).length,
          upiIdCount: availableAccounts.filter((a: any) => a.upiId).length,
        },
        warnings: {
          hasDuplicateInvoices: duplicateInvoices.length > 0,
          duplicateInvoiceIds: duplicateInvoices,
          duplicateInvoiceCount: duplicateInvoices.length,
          message: duplicateInvoices.length > 0
            ? `Warning: ${duplicateInvoices.length} invoice(s) are already included in existing payouts`
            : null,
        },
      },
    });
    return;
  } catch (error: any) {
    console.error("Error preparing payout:", error);
    res.status(500).json({
      message: error.message || "Failed to prepare payout",
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
    const { notes, bankAccount, paymentAccountId, paymentMethod } = req.body;

    console.log(`💰 [PAYOUT] Initiating payout for provider: ${providerId}`);
    console.log(`   Payment Method: ${paymentMethod || 'auto'}`);
    console.log(`   Payment Account ID: ${paymentAccountId || 'auto'}`);

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

    // Get bank account details based on payment method selection
    let payoutBankAccount = bankAccount || (provider as any).bankAccount;
    let selectedPaymentType = 'bank_account'; // Default
    let selectedPaymentDetails = '';

    if (paymentAccountId) {
      // Check if it's a UPI ID selection (format: "account-id-upi")
      if (paymentAccountId.endsWith('-upi')) {
        // Extract actual bank account ID
        const actualBankAccountId = paymentAccountId.replace('-upi', '');

        const selectedAccount = await bankAccountRepository.getBankAccountById(actualBankAccountId);
        if (!selectedAccount) {
          res.status(404).json({
            message: "Selected bank account not found",
            success: false,
          });
          return;
        }

        // Verify account belongs to this provider
        if (selectedAccount.providerId !== providerIdValue) {
          res.status(403).json({
            message: "Bank account does not belong to this provider",
            success: false,
          });
          return;
        }

        // Verify account is verified and active
        if (!selectedAccount.isVerified || !selectedAccount.isActive) {
          res.status(400).json({
            message: "Selected bank account is not verified or active",
            success: false,
          });
          return;
        }

        // Verify it has a UPI ID
        if (!selectedAccount.upiId) {
          res.status(400).json({
            message: "Selected bank account does not have a UPI ID",
            success: false,
          });
          return;
        }

        // Create bank account object for payout (UPI payment)
        payoutBankAccount = {
          accountNumberLast4: selectedAccount.accountNumberLast4,
          ifsc: selectedAccount.ifsc,
          accountHolder: selectedAccount.accountHolder,
          bankName: selectedAccount.bankName,
          upiId: selectedAccount.upiId,
          accountType: selectedAccount.accountType,
        };

        selectedPaymentType = 'upi';
        selectedPaymentDetails = selectedAccount.upiId;

        console.log(`✅ [PAYOUT] Using UPI ID: ${selectedAccount.upiId} (${selectedAccount.accountHolder})`);
      } else {
        // It's a bank account selection
        const selectedAccount = await bankAccountRepository.getBankAccountById(paymentAccountId);
        if (!selectedAccount) {
          res.status(404).json({
            message: "Selected bank account not found",
            success: false,
          });
          return;
        }

        // Verify account belongs to this provider
        if (selectedAccount.providerId !== providerIdValue) {
          res.status(403).json({
            message: "Bank account does not belong to this provider",
            success: false,
          });
          return;
        }

        // Verify account is verified and active
        if (!selectedAccount.isVerified || !selectedAccount.isActive) {
          res.status(400).json({
            message: "Selected bank account is not verified or active",
            success: false,
          });
          return;
        }

        // Create bank account object for payout (Bank transfer)
        payoutBankAccount = {
          accountNumberLast4: selectedAccount.accountNumberLast4,
          ifsc: selectedAccount.ifsc,
          accountHolder: selectedAccount.accountHolder,
          bankName: selectedAccount.bankName,
          upiId: selectedAccount.upiId,
          accountType: selectedAccount.accountType,
        };

        selectedPaymentType = 'bank_account';
        selectedPaymentDetails = `${selectedAccount.bankName} - XXXX-XXXX-XXXX-${selectedAccount.accountNumberLast4}`;

        console.log(`✅ [PAYOUT] Using bank account: ${selectedAccount.bankName} - XXXX-XXXX-XXXX-${selectedAccount.accountNumberLast4}`);
      }
    } else if (paymentMethod) {
      // Use payment method to select primary account of that type
      const allAccounts = await bankAccountRepository.getProviderBankAccounts(providerIdValue);
      const verifiedAccounts = allAccounts.filter((a: any) => a.isVerified && a.isActive);

      if (paymentMethod === 'upi') {
        // Find primary UPI ID
        const primaryUpiAccount = verifiedAccounts.find((a: any) => a.upiId && a.isPrimary);

        if (!primaryUpiAccount) {
          // Try to find any UPI ID
          const anyUpiAccount = verifiedAccounts.find((a: any) => a.upiId);

          if (!anyUpiAccount) {
            res.status(404).json({
              message: "No UPI ID found for this provider",
              success: false,
            });
            return;
          }

          // Use this UPI ID
          payoutBankAccount = {
            accountNumberLast4: anyUpiAccount.accountNumberLast4,
            ifsc: anyUpiAccount.ifsc,
            accountHolder: anyUpiAccount.accountHolder,
            bankName: anyUpiAccount.bankName,
            upiId: anyUpiAccount.upiId,
            accountType: anyUpiAccount.accountType,
          };

          selectedPaymentType = 'upi';
          selectedPaymentDetails = anyUpiAccount.upiId;

          console.log(`✅ [PAYOUT] Using UPI ID: ${anyUpiAccount.upiId} (${anyUpiAccount.accountHolder})`);
        } else {
          payoutBankAccount = {
            accountNumberLast4: primaryUpiAccount.accountNumberLast4,
            ifsc: primaryUpiAccount.ifsc,
            accountHolder: primaryUpiAccount.accountHolder,
            bankName: primaryUpiAccount.bankName,
            upiId: primaryUpiAccount.upiId,
            accountType: primaryUpiAccount.accountType,
          };

          selectedPaymentType = 'upi';
          selectedPaymentDetails = primaryUpiAccount.upiId;

          console.log(`✅ [PAYOUT] Using primary UPI ID: ${primaryUpiAccount.upiId} (${primaryUpiAccount.accountHolder})`);
        }
      } else {
        // Default to bank transfer
        const primaryBankAccount = await bankAccountRepository.getPrimaryBankAccount(providerIdValue);

        if (!primaryBankAccount) {
          res.status(404).json({
            message: "No bank account found for this provider",
            success: false,
          });
          return;
        }

        payoutBankAccount = {
          accountNumberLast4: primaryBankAccount.accountNumberLast4,
          ifsc: primaryBankAccount.ifsc,
          accountHolder: primaryBankAccount.accountHolder,
          bankName: primaryBankAccount.bankName,
          upiId: primaryBankAccount.upiId,
          accountType: primaryBankAccount.accountType,
        };

        selectedPaymentType = 'bank_account';
        selectedPaymentDetails = `${primaryBankAccount.bankName} - XXXX-XXXX-XXXX-${primaryBankAccount.accountNumberLast4}`;

        console.log(`✅ [PAYOUT] Using primary bank account: ${primaryBankAccount.bankName} - XXXX-XXXX-XXXX-${primaryBankAccount.accountNumberLast4}`);
      }
    } else {
      // Auto-select: Use primary bank account
      const primaryAccount = await bankAccountRepository.getPrimaryBankAccount(providerIdValue);
      if (primaryAccount) {
        payoutBankAccount = {
          accountNumberLast4: primaryAccount.accountNumberLast4,
          ifsc: primaryAccount.ifsc,
          accountHolder: primaryAccount.accountHolder,
          bankName: primaryAccount.bankName,
          upiId: primaryAccount.upiId,
          accountType: primaryAccount.accountType,
        };

        selectedPaymentType = primaryAccount.upiId ? 'upi' : 'bank_account';
        selectedPaymentDetails = primaryAccount.upiId || `${primaryAccount.bankName} - XXXX-XXXX-XXXX-${primaryAccount.accountNumberLast4}`;

        console.log(`✅ [PAYOUT] Auto-selected primary payment method: ${selectedPaymentType}`);
        console.log(`   Details: ${selectedPaymentDetails}`);
      }
    }

    // 🔍 DUPLICATE CHECK: Check if any invoices are already in existing payouts
    const existingPayoutsData = await payoutRepository.getPayoutsByProvider(providerIdValue);
    const existingInvoiceIds = new Set<string>();

    existingPayoutsData.payouts.forEach((payout: any) => {
      if (payout.invoiceIds && Array.isArray(payout.invoiceIds)) {
        payout.invoiceIds.forEach((id: string) => existingInvoiceIds.add(id));
      }
    });

    const duplicateInvoices = providerPending.invoiceIds.filter((id: string) =>
      existingInvoiceIds.has(id)
    );

    if (duplicateInvoices.length > 0) {
      console.warn(`⚠️ [PAYOUT] Duplicate invoice(s) detected: ${duplicateInvoices.length}`);
      console.warn(`   Duplicate Invoice IDs:`, duplicateInvoices);

      // Return error with details
      res.status(400).json({
        message: "Cannot create payout: Some invoices are already included in existing payouts",
        success: false,
        data: {
          duplicateInvoiceIds: duplicateInvoices,
          duplicateInvoiceCount: duplicateInvoices.length,
          message: `${duplicateInvoices.length} invoice(s) are already in existing payouts`,
        },
      });
      return;
    }

    // Calculate invoice amount (sum of invoice totals)
    const invoiceAmount = providerPending.invoices.reduce(
      (sum: number, inv: any) => sum + parseFloat(inv.totalAmount || 0),
      0,
    );

    // Create payout record with payment method details
    const payout = await payoutRepository.createPayout({
      providerId: providerIdValue,
      payoutGroupId: `PG-${Date.now()}`,
      totalAmount: providerPending.totalAmount,
      invoiceAmount: invoiceAmount.toString(),
      invoiceIds: providerPending.invoiceIds,
      status: "pending",
      bankAccount: payoutBankAccount,
      notes: notes || `Payout for ${providerPending.invoiceCount} invoices via ${selectedPaymentType === 'upi' ? 'UPI' : 'Bank Transfer'}`,
      processedBy: adminId,
    });

    console.log(
      `✅ [PAYOUT] Payout initiated: ${payout.id} for provider ${providerId}`,
    );
    console.log(`   Amount: ₹${providerPending.totalAmount}`);
    console.log(`   Invoices: ${providerPending.invoiceCount}`);
    console.log(`   Payment Method: ${selectedPaymentType}`);
    console.log(`   Payment Details: ${selectedPaymentDetails}`);

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
        payment: {
          method: selectedPaymentType,
          details: selectedPaymentDetails,
          instructions: getPaymentInstructions(selectedPaymentType, selectedPaymentDetails, providerPending.totalAmount),
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

    // Extract payment details
    const payoutBankAccount = updatedPayout.bankAccount as any;
    const amount = parseFloat(payout.totalAmount);

    // Determine payment method and create detailed instructions
    let paymentDetails: any = {
      method: 'unknown',
      instructions: '',
      quickActions: [],
    };

    if (payoutBankAccount?.upiId) {
      // UPI Payment
      const upiId = payoutBankAccount.upiId;
      const providerName = payoutBankAccount.accountHolder || provider?.name || 'Service Provider';
      const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(providerName)}&am=${amount}&cu=INR`;
      const upiDeepLink = `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent(providerName)}&am=${amount}&cu=INR`;
      const phonePeLink = `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(providerName)}&am=${amount}&cu=INR`;
      const paytmLink = `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(providerName)}&am=${amount}&cu=INR`;

      paymentDetails = {
        method: 'upi',
        upiId: upiId,
        accountHolder: payoutBankAccount.accountHolder,
        amount: amount,
        instructions: `Transfer ₹${amount} to UPI ID: ${upiId}`,
        quickActions: [
          {
            label: 'Open GPay',
            url: upiDeepLink,
            icon: '📱',
          },
          {
            label: 'Open PhonePe',
            url: phonePeLink,
            icon: '📱',
          },
          {
            label: 'Open Paytm',
            url: paytmLink,
            icon: '📱',
          },
          {
            label: 'Copy UPI ID',
            action: 'copy',
            value: upiId,
            icon: '📋',
          },
        ],
        upiLink: upiLink,
        copyText: upiId,
      };
    } else if (payoutBankAccount?.accountNumberLast4 && payoutBankAccount?.ifsc) {
      // Bank Transfer
      paymentDetails = {
        method: 'bank_transfer',
        bankName: payoutBankAccount.bankName,
        accountNumberLast4: payoutBankAccount.accountNumberLast4,
        accountHolder: payoutBankAccount.accountHolder,
        ifsc: payoutBankAccount.ifsc,
        amount: amount,
        instructions: `Transfer ₹${amount} to ${payoutBankAccount.bankName} account ending in ${payoutBankAccount.accountNumberLast4}`,
        quickActions: [
          {
            label: 'Copy Account Number',
            action: 'copy_account',
            icon: '📋',
            note: '(Full account number will be shown after clicking)',
          },
          {
            label: 'Copy IFSC',
            action: 'copy',
            value: payoutBankAccount.ifsc,
            icon: '📋',
          },
        ],
      };
    }

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
      message: "Payout processed successfully. Please complete the payment using the details below.",
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
        paymentDetails: paymentDetails,
        bankAccount: updatedPayout.bankAccount,
        nextSteps: [
          `1. ${paymentDetails.instructions}`,
          '2. Complete the payment using your preferred method',
          '3. Copy the UTR/reference number from your payment confirmation',
          '4. Click "Complete Payout" and enter the UTR to finish',
        ],
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

/**
 * Get payout payment details (full account details for admin to make payment)
 * GET /api/admin/payouts/:payoutId/payment-details
 */
export const getPayoutPaymentDetails = async (req: Request, res: Response) => {
  try {
    const { payoutId } = req.params;
    const payoutIdValue = getRouteParam(payoutId);

    console.log(`💰 [PAYOUT] Getting payment details for: ${payoutIdValue}`);

    // Get payout details
    const payout = await payoutRepository.getPayoutById(payoutIdValue);
    if (!payout) {
      res.status(404).json({
        message: "Payout not found",
        success: false,
      });
      return;
    }

    // Get provider's bank account details
    const bankAccount = payout.bankAccount as any;
    const amount = parseFloat(payout.totalAmount);

    // Get full bank account details from repository if we have an account ID
    let fullBankAccountDetails = null;

    if (bankAccount?.upiId || (bankAccount?.accountNumberLast4 && bankAccount?.ifsc)) {
      // Try to get the full bank account details
      const allAccounts = await bankAccountRepository.getProviderBankAccounts(payout.providerId);

      // Find matching account
      const matchingAccount = allAccounts.find((account: any) => {
        if (bankAccount.upiId) {
          return account.upiId === bankAccount.upiId;
        }
        if (bankAccount.accountNumberLast4 && bankAccount.ifsc) {
          return account.accountNumberLast4 === bankAccount.accountNumberLast4 &&
                 account.ifsc === bankAccount.ifsc;
        }
        return false;
      });

      if (matchingAccount) {
        fullBankAccountDetails = {
          bankName: matchingAccount.bankName,
          accountNumber: matchingAccount.accountNumber, // Full account number
          accountNumberLast4: matchingAccount.accountNumberLast4,
          ifsc: matchingAccount.ifsc,
          accountHolder: matchingAccount.accountHolder,
          accountType: matchingAccount.accountType,
          upiId: matchingAccount.upiId,
          branch: matchingAccount.branch,
        };
      }
    }

    // Create payment details
    let paymentDetails: any = {
      amount: amount,
      currency: 'INR',
      method: 'unknown',
    };

    if (fullBankAccountDetails?.upiId) {
      // UPI Payment Details
      const providerName = fullBankAccountDetails.accountHolder || 'Service Provider';

      paymentDetails = {
        method: 'upi',
        amount: amount,
        currency: 'INR',
        upiId: fullBankAccountDetails.upiId,
        accountHolder: fullBankAccountDetails.accountHolder,
        // UPI Deep Links
        upiLink: `upi://pay?pa=${fullBankAccountDetails.upiId}&pn=${encodeURIComponent(providerName)}&am=${amount}&cu=INR`,
        gpayLink: `tez://upi/pay?pa=${fullBankAccountDetails.upiId}&pn=${encodeURIComponent(providerName)}&am=${amount}&cu=INR`,
        phonePeLink: `phonepe://pay?pa=${fullBankAccountDetails.upiId}&pn=${encodeURIComponent(providerName)}&am=${amount}&cu=INR`,
        paytmLink: `paytmmp://pay?pa=${fullBankAccountDetails.upiId}&pn=${encodeURIComponent(providerName)}&am=${amount}&cu=INR`,
        // Copy options
        copyText: fullBankAccountDetails.upiId,
        instructions: `Pay ₹${amount} to UPI ID: ${fullBankAccountDetails.upiId}`,
      };
    } else if (fullBankAccountDetails?.accountNumber) {
      // Bank Transfer Details
      paymentDetails = {
        method: 'bank_transfer',
        amount: amount,
        currency: 'INR',
        bankName: fullBankAccountDetails.bankName,
        accountNumber: fullBankAccountDetails.accountNumber, // Full account number
        accountNumberLast4: fullBankAccountDetails.accountNumberLast4,
        accountNumberMasked: `XXXX-XXXX-XXXX-${fullBankAccountDetails.accountNumberLast4}`,
        ifsc: fullBankAccountDetails.ifsc,
        accountHolder: fullBankAccountDetails.accountHolder,
        accountType: fullBankAccountDetails.accountType,
        branch: fullBankAccountDetails.branch,
        // Copy options
        copyAccountNumber: fullBankAccountDetails.accountNumber,
        copyIfsc: fullBankAccountDetails.ifsc,
        instructions: `Transfer ₹${amount} to ${fullBankAccountDetails.bankName} account`,
        // NEFT/RTGS/IMPS details
        neftEnabled: true,
        rtgsEnabled: true,
        impsEnabled: true,
      };
    }

    console.log(`✅ [PAYOUT] Payment details retrieved for ${payoutIdValue}`);
    console.log(`   Method: ${paymentDetails.method}`);
    console.log(`   Amount: ₹${amount}`);

    res.status(200).json({
      message: "Payment details retrieved successfully",
      success: true,
      data: {
        payout: {
          id: payout.id,
          totalAmount: payout.totalAmount,
          status: payout.status,
        },
        paymentDetails: paymentDetails,
        warning: "This information is sensitive. Only share it with authorized personnel.",
      },
    });
    return;
  } catch (error: any) {
    console.error("Error getting payout payment details:", error);
    res.status(500).json({
      message: error.message || "Failed to get payment details",
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
