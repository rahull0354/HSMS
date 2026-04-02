# Phase 6: Notification System - Testing Guide

## ✅ Implementation Complete

All notification functionality for payout and bank account management has been successfully implemented!

### 📁 Files Created/Modified:
1. ✅ `src/db/schema.ts` - **UPDATED** - Added `payout_id` and `metadata` columns to notifications table
2. ✅ `drizzle/0010_curious_colleen_wing.sql` - **GENERATED** - Database migration with idempotency
3. ✅ `src/drizzleServices/notification.service.ts` - **UPDATED** - Added 7 new notification functions
4. ✅ `src/drizzleControllers/payout.controller.ts` - **UPDATED** - Integrated notifications at all payout stages
5. ✅ `src/drizzleControllers/bankAccount.controller.ts` - **UPDATED** - Added bank account notifications
6. ✅ Database migration applied - **VERIFIED** (with idempotent SQL)
7. ✅ All TypeScript errors fixed - **VERIFIED** (0 errors)

---

## 🔔 Notification System Architecture

### **Database Schema Updates:**

| Column | Type | Description |
|--------|------|-------------|
| payout_id | uuid | Foreign key to provider_payouts (cascade delete) |
| metadata | jsonb | Additional notification data (provider name, bank details, etc.) |

### **Notification Types:**

| Type | Recipient | Trigger |
|------|-----------|---------|
| `payout_initiated` | Service Provider | Admin initiates a payout |
| `payout_processed` | Service Provider | Admin marks payout as "processing" |
| `payout_completed` | Service Provider | Payout completed with UTR |
| `payout_failed` | Service Provider | Payout fails with reason |
| `bank_account_added` | Admin | Provider adds a new bank account |
| `bank_account_verified` | Service Provider | Admin verifies bank account |
| `bank_account_verification_failed` | Service Provider | Admin rejects bank account |

---

## 📱 Payout Notifications

### **1. Payout Initiated Notification**

**Trigger:** Admin initiates a payout for a provider

**When:** `POST /api/admin/payouts/initiate/:providerId`

**Notification Sent to Provider:**
```json
{
  "type": "payout_initiated",
  "title": "Payout Initiated",
  "message": "Your payout of ₹2,500.00 for 3 invoice(s) has been initiated. It will be processed soon.",
  "payoutId": "payout-uuid"
}
```

**API Test:**
```bash
# 1. Initiate payout
curl -X POST http://localhost:3000/api/admin/payouts/initiate/PROVIDER_UUID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Weekly payout for completed services"
  }'

# 2. Check provider notifications
curl -X GET "http://localhost:3000/api/service-provider/notifications" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"
```

**Expected:**
- ✅ Notification created in database
- ✅ Type: `payout_initiated`
- ✅ Contains payout amount and invoice count
- ✅ payoutId references the payout record

---

### **2. Payout Processed Notification**

**Trigger:** Admin marks payout as "processing" (initiates bank transfer)

**When:** `PATCH /api/admin/payouts/:payoutId/process`

**Notification Sent to Provider:**
```json
{
  "type": "payout_processed",
  "title": "Payout Being Processed",
  "message": "Your payout of ₹2,500.00 is being processed. Amount will be credited to your bank account shortly.",
  "payoutId": "payout-uuid"
}
```

**API Test:**
```bash
# 1. Process payout
curl -X PATCH http://localhost:3000/api/admin/payouts/PAYOUT_UUID/process \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bankAccount": {
      "accountNumber": "1234567890123",
      "ifsc": "HDFC0001234",
      "accountHolder": "Rahul Kumar",
      "bankName": "HDFC Bank"
    }
  }'

# 2. Check provider notifications
curl -X GET "http://localhost:3000/api/service-provider/notifications?isRead=false" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"
```

**Expected:**
- ✅ Notification created with `payout_processed` type
- ✅ Message indicates processing status
- ✅ References payout record

---

### **3. Payout Completed Notification**

**Trigger:** Admin completes payout with UTR (bank transfer successful)

**When:** `PATCH /api/admin/payouts/:payoutId/complete`

**Notification Sent to Provider:**
```json
{
  "type": "payout_completed",
  "title": "Payout Completed",
  "message": "Your payout of ₹2,500.00 has been completed successfully! Amount credited to HDFC Bank. UTR: 123456789012",
  "payoutId": "payout-uuid"
}
```

**API Test:**
```bash
# 1. Complete payout
curl -X PATCH http://localhost:3000/api/admin/payouts/PAYOUT_UUID/complete \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "utr": "123456789012",
    "transactionId": "TXN123456",
    "notes": "Transfer completed via NEFT"
  }'

# 2. Verify notification
curl -X GET "http://localhost:3000/api/service-provider/notifications" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"
```

**Expected:**
- ✅ Notification shows completion with bank name
- ✅ Includes UTR for tracking
- ✅ Links to payout record
- ✅ Provider can verify with their bank

---

### **4. Payout Failed Notification**

**Trigger:** Payout fails (bank transfer fails, account issues, etc.)

**When:** `PATCH /api/admin/payouts/:payoutId/fail`

**Notification Sent to Provider:**
```json
{
  "type": "payout_failed",
  "title": "Payout Failed",
  "message": "Your payout of ₹2,500.00 could not be processed. Reason: Account number does not match IFSC. Please contact support.",
  "payoutId": "payout-uuid"
}
```

**API Test:**
```bash
# 1. Mark payout as failed
curl -X PATCH http://localhost:3000/api/admin/payouts/PAYOUT_UUID/fail \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "failureReason": "Bank account verification failed. Please update account details."
  }'

# 2. Check notification
curl -X GET "http://localhost:3000/api/service-provider/notifications" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"
```

**Expected:**
- ✅ Clear failure reason provided
- ✅ Links to payout record
- ✅ Indicates next steps (contact support)

---

## 🏦 Bank Account Notifications

### **5. Bank Account Added (Admin)**

**Trigger:** Provider adds a new bank account

**When:** `POST /api/service-provider/bank-accounts`

**Notification Sent to Admin:**
```json
{
  "type": "bank_account_added",
  "title": "New Bank Account Added",
  "message": "Provider Rahul Kumar has added a new bank account: HDFC Bank - XXXX-XXXX-XXXX-7890 (IFSC: HDFC0001234). Please verify.",
  "metadata": {
    "providerId": "provider-uuid",
    "providerName": "Rahul Kumar",
    "bankName": "HDFC Bank",
    "accountNumberLast4": "7890",
    "ifsc": "HDFC0001234"
  }
}
```

**API Test:**
```bash
# 1. Provider adds bank account
curl -X POST http://localhost:3000/api/service-provider/bank-accounts \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "12345678907890",
    "ifsc": "HDFC0001234",
    "accountHolder": "Rahul Kumar",
    "bankName": "HDFC Bank",
    "isPrimary": true
  }'

# 2. Admin checks notifications
curl -X GET "http://localhost:3000/api/admin/notifications?recipientType=admin" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected:**
- ✅ Admin receives notification immediately
- ✅ Masked account number (only last 4 digits)
- ✅ Includes provider details and IFSC
- ✅ Metadata stores full details for reference
- ✅ Clear call-to-action: "Please verify"

---

### **6. Bank Account Verified**

**Trigger:** Admin verifies provider's bank account

**When:** `PATCH /api/admin/bank-accounts/:bankAccountId/verify`

**Notification Sent to Provider (Success):**
```json
{
  "type": "bank_account_verified",
  "title": "Bank Account Verified",
  "message": "Your bank account HDFC Bank (XXXX-XXXX-XXXX-7890) has been verified successfully. You can now receive payouts.",
  "metadata": {
    "bankName": "HDFC Bank",
    "accountNumberLast4": "7890",
    "verificationStatus": "verified",
    "reference": "Verified via bank statement"
  }
}
```

**Notification Sent to Provider (Failure):**
```json
{
  "type": "bank_account_verification_failed",
  "title": "Bank Account Verification Failed",
  "message": "Your bank account HDFC Bank (XXXX-XXXX-XXXX-7890) verification failed. Reference: Account name mismatch. Please update details and try again.",
  "metadata": {
    "bankName": "HDFC Bank",
    "accountNumberLast4": "7890",
    "verificationStatus": "failed",
    "reference": "Account name mismatch"
  }
}
```

**API Test:**
```bash
# 1. Verify bank account (success case)
curl -X PATCH http://localhost:3000/api/admin/bank-accounts/BANK_ACCOUNT_UUID/verify \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verified": true,
    "reference": "Verified via penny drop"
  }'

# 2. Reject bank account (failure case)
curl -X PATCH http://localhost:3000/api/admin/bank-accounts/BANK_ACCOUNT_UUID/verify \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verified": false,
    "reference": "Account holder name does not match"
  }'

# 3. Provider checks notifications
curl -X GET "http://localhost:3000/api/service-provider/notifications" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"
```

**Expected:**
- ✅ Provider notified of verification result
- ✅ Success message indicates they can receive payouts
- ✅ Failure message includes reference/reason
- ✅ Clear next steps provided

---

## 🧪 Complete End-to-End Testing Workflow

### **Scenario 1: Full Payout Lifecycle with Notifications**

```bash
# Step 1: Provider adds bank account
curl -X POST http://localhost:3000/api/service-provider/bank-accounts \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "1234567890123",
    "ifsc": "HDFC0001234",
    "accountHolder": "Rahul Kumar",
    "bankName": "HDFC Bank",
    "isPrimary": true
  }'

# Admin should receive notification to verify account
# Check: GET /api/admin/notifications?recipientType=admin

# Step 2: Admin verifies bank account
curl -X PATCH http://localhost:3000/api/admin/bank-accounts/BANK_ACCOUNT_UUID/verify \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verified": true,
    "reference": "Verified via bank statement"
  }'

# Provider should receive verified notification
# Check: GET /api/service-provider/notifications

# Step 3: Admin initiates payout
curl -X POST http://localhost:3000/api/admin/payouts/initiate/PROVIDER_UUID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Provider should receive payout initiated notification
# Check: GET /api/service-provider/notifications?isRead=false

# Step 4: Admin processes payout
curl -X PATCH http://localhost:3000/api/admin/payouts/PAYOUT_UUID/process \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Provider should receive payout processed notification
# Check: GET /api/service-provider/notifications

# Step 5: Admin completes payout
curl -X PATCH http://localhost:3000/api/admin/payouts/PAYOUT_UUID/complete \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "utr": "123456789012"
  }'

# Provider should receive payout completed notification
# Check: GET /api/service-provider/notifications

# Step 6: Mark notification as read
curl -X PATCH http://localhost:3000/api/service-provider/notifications/NOTIFICATION_UUID/read \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"
```

**Expected Notifications Created:**
1. ✅ Admin: Bank account added (for verification)
2. ✅ Provider: Bank account verified
3. ✅ Provider: Payout initiated
4. ✅ Provider: Payout processed
5. ✅ Provider: Payout completed (with UTR)

---

### **Scenario 2: Payout Failure Notifications**

```bash
# Step 1: Initiate payout (same as above)
curl -X POST http://localhost:3000/api/admin/payouts/initiate/PROVIDER_UUID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Step 2: Process payout
curl -X PATCH http://localhost:3000/api/admin/payouts/PAYOUT_UUID/process \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Step 3: Mark as failed (bank transfer failed)
curl -X PATCH http://localhost:3000/api/admin/payouts/PAYOUT_UUID/fail \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "failureReason": "Bank transfer failed: Account closed"
  }'

# Provider should receive payout failed notification
curl -X GET "http://localhost:3000/api/service-provider/notifications?type=payout_failed" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"
```

**Expected:**
- ✅ Provider sees failure notification
- ✅ Clear reason provided
- ✅ Can update bank account and retry

---

## 📊 Database Verification

### **Check All Notifications:**
```sql
SELECT
  id,
  recipient_id,
  recipient_type,
  type,
  title,
  message,
  payout_id,
  is_read,
  created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 20;
```

### **Check Payout Notifications:**
```sql
SELECT
  n.id,
  n.type,
  n.message,
  n.payout_id,
  pp.total_amount,
  pp.status,
  sp.name as provider_name
FROM notifications n
LEFT JOIN provider_payouts pp ON n.payout_id = pp.id
LEFT JOIN service_providers sp ON pp.provider_id = sp.id
WHERE n.type LIKE 'payout_%'
ORDER BY n.created_at DESC;
```

### **Check Bank Account Notifications:**
```sql
SELECT
  n.id,
  n.type,
  n.message,
  n.metadata->>'providerName' as provider_name,
  n.metadata->>'bankName' as bank_name,
  n.created_at
FROM notifications n
WHERE n.type LIKE 'bank_account_%'
ORDER BY n.created_at DESC;
```

### **Count Notifications by Type:**
```sql
SELECT
  type,
  COUNT(*) as count,
  COUNT(CASE WHEN is_read = false THEN 1 END) as unread
FROM notifications
GROUP BY type
ORDER BY count DESC;
```

---

## 🔍 Notification Filtering

### **Filter by Type:**
```bash
# Get only payout notifications
curl -X GET "http://localhost:3000/api/service-provider/notifications?type=payout_initiated" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"

# Get only failed notifications
curl -X GET "http://localhost:3000/api/service-provider/notifications?type=payout_failed" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"
```

### **Filter by Read Status:**
```bash
# Get unread notifications
curl -X GET "http://localhost:3000/api/service-provider/notifications?isRead=false" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"

# Get read notifications
curl -X GET "http://localhost:3000/api/service-provider/notifications?isRead=true" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"
```

### **Filter by Date Range:**
```bash
# Get notifications from last 7 days
curl -X GET "http://localhost:3000/api/service-provider/notifications?startDate=2026-03-26&endDate=2026-04-02" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"
```

---

## ✅ Verification Checklist

### **Payout Notifications:**
- [ ] Provider receives notification when payout initiated
- [ ] Provider receives notification when payout processed
- [ ] Provider receives notification when payout completed
- [ ] Provider receives notification when payout failed
- [ ] All notifications reference correct payout_id
- [ ] Notifications contain accurate amounts and details
- [ ] UTR included in completion notification
- [ ] Failure reason included in failed notification

### **Bank Account Notifications:**
- [ ] Admin receives notification when provider adds account
- [ ] Notification contains masked account number (last 4 only)
- [ ] Notification includes IFSC for verification
- [ ] Provider receives notification when account verified
- [ ] Provider receives notification when verification fails
- [ ] Metadata stores all relevant details
- [ ] Notifications don't fail main operations

### **Error Handling:**
- [ ] Notifications don't fail payout operations
- [ ] Notifications don't fail bank account operations
- [ ] Errors logged correctly
- [ ] Try-catch blocks around all notification calls
- [ ] Clear error messages in logs

### **Database:**
- [ ] payout_id column added to notifications
- [ ] metadata column added to notifications
- [ ] Foreign key constraint works (cascade delete)
- [ ] Notifications can be filtered by payout_id
- [ ] JSONB metadata stores additional data

---

## 🚨 Error Handling & Safety Features

### **1. Non-Blocking Notifications**
All notification calls are wrapped in try-catch blocks:

```typescript
try {
  await notificationService.notifyProviderPayoutCompleted(...);
} catch (notifError) {
  console.error("Failed to send notification:", notifError);
  // Don't fail the payout if notification fails
}
```

**Benefit:** Payout operations complete successfully even if notifications fail.

### **2. Idempotent Migrations**
Migration files use `IF NOT EXISTS` checks:

```sql
IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'payout_id'
) THEN
    ALTER TABLE "notifications" ADD COLUMN "payout_id" uuid;
END IF;
```

**Benefit:** Migrations can be run multiple times without errors.

### **3. Account Number Masking**
Bank account numbers are masked in notifications:

```json
{
  "message": "XXXX-XXXX-XXXX-7890"
}
```

**Benefit:** Sensitive data protected in logs and notifications.

---

## 🎯 Next Steps Options

### **Option A: Email Notifications**
- Send email notifications alongside in-app notifications
- Configure email templates for each notification type
- Add email preferences for providers

### **Option B: SMS Notifications**
- Add SMS for critical payout notifications
- Use service like Twilio or AWS SNS
- Add phone number verification

### **Option C: Push Notifications**
- Implement real-time push notifications
- Use WebSocket or service like Firebase
- Add mobile app support

### **Option D: Notification Preferences**
- Allow providers to manage notification preferences
- Choose which notifications to receive
- Configure notification frequency

### **Option E: Notification Dashboard**
- Create admin dashboard for all notifications
- Bulk operations (mark all as read, delete old)
- Analytics on notification engagement

---

## 📚 Notification Functions Reference

### **Payout Notifications:**

```typescript
// Payout Initiated
notifyProviderPayoutInitiated(
  providerId: string,
  payoutId: string,
  amount: string,
  invoiceCount: number
)

// Payout Processed
notifyProviderPayoutProcessed(
  providerId: string,
  payoutId: string,
  amount: string
)

// Payout Completed
notifyProviderPayoutCompleted(
  providerId: string,
  payoutId: string,
  amount: string,
  utr: string,
  bankName?: string
)

// Payout Failed
notifyProviderPayoutFailed(
  providerId: string,
  payoutId: string,
  amount: string,
  failureReason: string
)
```

### **Bank Account Notifications:**

```typescript
// Admin: Bank Account Added
notifyAdminBankAccountAdded(
  providerId: string,
  providerName: string,
  bankName: string,
  accountNumberLast4: string,
  ifsc: string
)

// Provider: Bank Account Verified
notifyProviderBankAccountVerified(
  providerId: string,
  bankName: string,
  accountNumberLast4: string,
  verificationStatus: 'verified' | 'failed',
  reference?: string
)
```

---

## ✅ Phase 6 Complete!

**What's Implemented:**
1. ✅ Complete notification system for payout lifecycle
2. ✅ Bank account management notifications
3. ✅ Admin verification workflow notifications
4. ✅ Non-blocking notification architecture
5. ✅ Idempotent database migrations
6. ✅ Account number masking for security
7. ✅ Metadata support for additional context
8. ✅ Full TypeScript type safety
9. ✅ Comprehensive error handling

**Database:** Notifications table enhanced with payout_id and metadata
**Security:** Account numbers masked, non-blocking notifications
**Flexibility:** JSONB metadata for extensibility
**Reliability:** Idempotent migrations, error-tolerant notifications

---

**Ready for production! 🎉**
