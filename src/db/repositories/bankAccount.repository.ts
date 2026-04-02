import db from "#db/index.js";
import { provider_bank_accounts, serviceProviders } from "#db/schema.js";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

// Helper function to encrypt account number (simple XOR encryption - replace with proper encryption in production)
function encryptAccountNumber(accountNumber: string): string {
  // In production, use AES-256 encryption
  // For now, we'll use base64 encoding (not secure, only for demo)
  return Buffer.from(accountNumber).toString('base64');
}

// Helper function to decrypt account number
function decryptAccountNumber(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

// Helper to get last 4 digits
function getLast4Digits(accountNumber: string): string {
  return accountNumber.slice(-4);
}

export class BankAccountRepository {
  /**
   * Add a new bank account for a provider
   */
  async addBankAccount(data: {
    providerId: string;
    accountNumber: string;
    ifsc: string;
    accountHolder: string;
    bankName: string;
    accountType?: string;
    upiId?: string;
    branch?: string;
    notes?: string;
    isPrimary?: boolean;
  }) {
    // Encrypt account number
    const encryptedAccountNumber = encryptAccountNumber(data.accountNumber);
    const last4 = getLast4Digits(data.accountNumber);

    // If this is the first account or explicitly set as primary, make it primary
    const existingAccounts = await this.getProviderBankAccounts(data.providerId);
    const shouldBePrimary = data.isPrimary || existingAccounts.length === 0;

    // If setting as primary, unset other primary accounts
    if (shouldBePrimary && existingAccounts.length > 0) {
      await db
        .update(provider_bank_accounts)
        .set({ isPrimary: false })
        .where(
          and(
            eq(provider_bank_accounts.providerId, data.providerId),
            eq(provider_bank_accounts.isPrimary, true)
          )
        );
    }

    const [bankAccount] = await db
      .insert(provider_bank_accounts)
      .values({
        providerId: data.providerId,
        accountNumber: encryptedAccountNumber,
        accountNumberLast4: last4,
        ifsc: data.ifsc,
        accountHolder: data.accountHolder,
        bankName: data.bankName,
        accountType: data.accountType || "savings",
        upiId: data.upiId || null,
        branch: data.branch || null,
        notes: data.notes || null,
        isPrimary: shouldBePrimary,
      })
      .returning();

    return bankAccount;
  }

  /**
   * Get all bank accounts for a provider
   */
  async getProviderBankAccounts(providerId: string) {
    const accounts = await db
      .select()
      .from(provider_bank_accounts)
      .where(
        and(
          eq(provider_bank_accounts.providerId, providerId),
          eq(provider_bank_accounts.isActive, true)
        )
      )
      .orderBy(desc(provider_bank_accounts.isPrimary), desc(provider_bank_accounts.createdAt));

    // Decrypt account numbers for response (exclude full account number)
    return accounts.map((account: any) => ({
      ...account,
      accountNumber: `XXXX-XXXX-XXXX-${account.accountNumberLast4}`, // Masked
    }));
  }

  /**
   * Get primary bank account for a provider
   */
  async getPrimaryBankAccount(providerId: string) {
    const [account] = await db
      .select()
      .from(provider_bank_accounts)
      .where(
        and(
          eq(provider_bank_accounts.providerId, providerId),
          eq(provider_bank_accounts.isPrimary, true),
          eq(provider_bank_accounts.isActive, true)
        )
      )
      .limit(1);

    if (!account) {
      return null;
    }

    // Return masked account number
    return {
      ...account,
      accountNumber: `XXXX-XXXX-XXXX-${account.accountNumberLast4}`,
    };
  }

  /**
   * Get bank account by ID (with full decrypted account number for internal use)
   */
  async getBankAccountById(bankAccountId: string, includeFullNumber = false) {
    const [account] = await db
      .select()
      .from(provider_bank_accounts)
      .where(eq(provider_bank_accounts.id, bankAccountId))
      .limit(1);

    if (!account) {
      return null;
    }

    if (includeFullNumber) {
      // Decrypt for internal operations (like payout)
      return {
        ...account,
        accountNumber: decryptAccountNumber(account.accountNumber),
      };
    }

    // Return masked for display
    return {
      ...account,
      accountNumber: `XXXX-XXXX-XXXX-${account.accountNumberLast4}`,
    };
  }

  /**
   * Update bank account
   */
  async updateBankAccount(
    bankAccountId: string,
    providerId: string,
    data: {
      accountNumber?: string;
      ifsc?: string;
      accountHolder?: string;
      bankName?: string;
      accountType?: string;
      upiId?: string;
      branch?: string;
      notes?: string;
      isPrimary?: boolean;
    }
  ) {
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Handle account number update
    if (data.accountNumber) {
      const encryptedAccountNumber = encryptAccountNumber(data.accountNumber);
      updateData.accountNumber = encryptedAccountNumber;
      updateData.accountNumberLast4 = getLast4Digits(data.accountNumber);
    }

    if (data.ifsc) {
      updateData.ifsc = data.ifsc;
    }

    if (data.accountHolder) {
      updateData.accountHolder = data.accountHolder;
    }

    if (data.bankName) {
      updateData.bankName = data.bankName;
    }

    if (data.accountType) {
      updateData.accountType = data.accountType;
    }

    if (data.upiId !== undefined) {
      updateData.upiId = data.upiId || null;
    }

    if (data.branch !== undefined) {
      updateData.branch = data.branch || null;
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes || null;
    }

    // Handle primary account change
    if (data.isPrimary) {
      // Unset other primary accounts
      await db
        .update(provider_bank_accounts)
        .set({ isPrimary: false })
        .where(
          and(
            eq(provider_bank_accounts.providerId, providerId),
            eq(provider_bank_accounts.isPrimary, true)
          )
        );
      updateData.isPrimary = true;
    }

    const [updated] = await db
      .update(provider_bank_accounts)
      .set(updateData)
      .where(eq(provider_bank_accounts.id, bankAccountId))
      .returning();

    return updated;
  }

  /**
   * Delete/deactivate bank account
   */
  async deleteBankAccount(bankAccountId: string, providerId: string) {
    const account = await this.getBankAccountById(bankAccountId);

    if (!account) {
      return null;
    }

    // Don't allow deleting primary account if it's the only one
    if (account.isPrimary) {
      const allAccounts = await this.getProviderBankAccounts(providerId);
      if (allAccounts.length === 1) {
        throw new Error("Cannot delete primary bank account. You must add another account first.");
      }
    }

    // Soft delete (deactivate)
    const [deleted] = await db
      .update(provider_bank_accounts)
      .set({
        isActive: false,
        updatedAt: new Date(),
        deactivationReason: "Deleted by provider",
      })
      .where(eq(provider_bank_accounts.id, bankAccountId))
      .returning();

    return deleted;
  }

  /**
   * Set bank account as primary
   */
  async setAsPrimary(bankAccountId: string, providerId: string) {
    // Unset all primary accounts for this provider
    await db
      .update(provider_bank_accounts)
      .set({ isPrimary: false })
      .where(
        and(
          eq(provider_bank_accounts.providerId, providerId),
          eq(provider_bank_accounts.isPrimary, true)
        )
      );

    // Set this account as primary
    const [updated] = await db
      .update(provider_bank_accounts)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(provider_bank_accounts.id, bankAccountId))
      .returning();

    return updated;
  }

  /**
   * Verify bank account (admin function)
   */
  async verifyBankAccount(bankAccountId: string, verified: boolean, reference?: string) {
    const [updated] = await db
      .update(provider_bank_accounts)
      .set({
        isVerified: verified,
        verificationStatus: verified ? "verified" : "failed",
        verifiedAt: verified ? new Date() : null,
        verificationReference: reference || null,
        updatedAt: new Date(),
      })
      .where(eq(provider_bank_accounts.id, bankAccountId))
      .returning();

    return updated;
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(bankAccountId: string) {
    await db
      .update(provider_bank_accounts)
      .set({ lastUsedAt: new Date() })
      .where(eq(provider_bank_accounts.id, bankAccountId));
  }

  /**
   * Get bank account with full details (for payout processing)
   */
  async getBankAccountForPayout(providerId: string) {
    // Get primary active account
    const [account] = await db
      .select()
      .from(provider_bank_accounts)
      .where(
        and(
          eq(provider_bank_accounts.providerId, providerId),
          eq(provider_bank_accounts.isPrimary, true),
          eq(provider_bank_accounts.isActive, true)
        )
      )
      .limit(1);

    if (!account) {
      return null;
    }

    // Return with decrypted account number for payout processing
    return {
      id: account.id,
      providerId: account.providerId,
      accountNumber: decryptAccountNumber(account.accountNumber),
      accountNumberLast4: account.accountNumberLast4,
      ifsc: account.ifsc,
      accountHolder: account.accountHolder,
      bankName: account.bankName,
      accountType: account.accountType,
      upiId: account.upiId,
      branch: account.branch,
    };
  }

  /**
   * Get all bank accounts (admin view)
   */
  async getAllBankAccounts(
    filters?: {
      providerId?: string;
      verificationStatus?: string;
      isActive?: boolean;
    },
    pagination?: {
      page?: number;
      limit?: number;
    }
  ) {
    const conditions = [];

    if (filters?.providerId) {
      conditions.push(eq(provider_bank_accounts.providerId, filters.providerId));
    }

    if (filters?.verificationStatus) {
      conditions.push(
        eq(provider_bank_accounts.verificationStatus, filters.verificationStatus)
      );
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(provider_bank_accounts.isActive, filters.isActive));
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const accounts = await db
      .select({
        id: provider_bank_accounts.id,
        providerId: provider_bank_accounts.providerId,
        accountNumberLast4: provider_bank_accounts.accountNumberLast4,
        ifsc: provider_bank_accounts.ifsc,
        accountHolder: provider_bank_accounts.accountHolder,
        bankName: provider_bank_accounts.bankName,
        accountType: provider_bank_accounts.accountType,
        isPrimary: provider_bank_accounts.isPrimary,
        isVerified: provider_bank_accounts.isVerified,
        verificationStatus: provider_bank_accounts.verificationStatus,
        verifiedAt: provider_bank_accounts.verifiedAt,
        upiId: provider_bank_accounts.upiId,
        branch: provider_bank_accounts.branch,
        isActive: provider_bank_accounts.isActive,
        createdAt: provider_bank_accounts.createdAt,
        updatedAt: provider_bank_accounts.updatedAt,
      })
      .from(provider_bank_accounts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(provider_bank_accounts.createdAt))
      .limit(limit)
      .offset(offset);

    // Get provider details for each account
    const enrichedAccounts = await Promise.all(
      accounts.map(async (account) => {
        const [provider] = await db
          .select({
            id: serviceProviders.id,
            name: serviceProviders.name,
            email: serviceProviders.email,
            phone: serviceProviders.phone,
          })
          .from(serviceProviders)
          .where(eq(serviceProviders.id, account.providerId))
          .limit(1);

        return {
          ...account,
          accountNumber: `XXXX-XXXX-XXXX-${account.accountNumberLast4}`, // Masked
          provider: provider || null,
        };
      })
    );

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(provider_bank_accounts)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      bankAccounts: enrichedAccounts,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }
}

export const bankAccountRepository = new BankAccountRepository();
