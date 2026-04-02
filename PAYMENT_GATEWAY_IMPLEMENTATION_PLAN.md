# Payment Gateway Implementation Plan
## Home Service Management System

---

## 📋 Table of Contents
1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [Database Schema](#database-schema)
4. [Payment Gateway Options](#payment-gateway-options)
5. [Architecture Design](#architecture-design)
6. [Implementation Phases](#implementation-phases)
7. [API Endpoints](#api-endpoints)
8. [Security Considerations](#security-considerations)
9. [Testing Strategy](#testing-strategy)

---

## 🎯 Overview

### Objectives
- Integrate a payment gateway for customer invoice payments
- Support multiple payment methods (UPI, Cards, Netbanking, Wallets)
- Handle payment webhooks and status updates
- Implement refund functionality
- Track all payment transactions
- Split payments automatically (admin commission vs provider earning)

### Key Features
- ✅ Multi-payment method support
- ✅ Secure payment processing
- ✅ Real-time payment status updates via webhooks
- ✅ Automatic payment reconciliation
- ✅ Refund processing
- ✅ Payment history and audit trail
- ✅ Provider payout management

---

## 🔍 Current State Analysis

### Existing Infrastructure
✅ **Already Implemented:**
- Invoice table with payment fields:
  - `status` (pending/paid/overdue/cancelled)
  - `paidAt`
  - `paymentMethod`
  - `paymentId`
  - `transactionId`
- Invoice creation workflow
- Basic payment endpoint: `POST /api/invoices/:id/pay`
- Invoice status management

❌ **Missing:**
- Dedicated payments table
- Payment gateway integration
- Webhook handling
- Refund system
- Payment reconciliation
- Provider payout system
- Payment retry logic
- Failed payment tracking

---

## 🗄️ Database Schema

### 1. **payments** Table
Track all payment attempts and transactions

```typescript
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "restrict" }),

  // Payment Gateway Details
  gateway: varchar("gateway", { length: 50 }).notNull(), // razorpay, stripe, phonepe
  gatewayPaymentId: varchar("gateway_payment_id", { length: 255 }).unique(),
  gatewayOrderId: varchar("gateway_order_id", { length: 255 }),

  // Payment Details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("INR").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }), // upi, card, netbanking, wallet

  // Status Tracking
  status: varchar("status", { length: 50 }).notNull(), // created, initiated, processing, completed, failed, refunded, cancelled
  failureReason: text("failure_reason"),

  // Gateway Response
  gatewayResponse: jsonb("gateway_response").$type<{
    status?: string;
    method?: string;
    acquirer?: string;
    bank?: string;
    wallet?: string;
    vpa?: string;
    cardId?: string;
    // Add more fields as needed
  }>(),

  // Metadata
  clientIp: varchar("client_ip", { length: 50 }),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").$type<{
    source?: string;
    device?: string;
    [key: string]: any;
  }>(),

  // Timestamps
  initiatedAt: timestamp("initiated_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  invoiceIdIdx: index("payments_invoice_id_idx").on(table.invoiceId),
  gatewayPaymentIdIdx: index("payments_gateway_payment_id_idx").on(table.gatewayPaymentId),
  statusIdx: index("payments_status_idx").on(table.status),
  createdAtIdx: index("payments_created_at_idx").on(table.createdAt),
}));
```

### 2. **refunds** Table
Track all refund transactions

```typescript
export const refunds = pgTable("refunds", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id")
    .notNull()
    .references(() => payments.id, { onDelete: "restrict" }),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "restrict" }),

  // Refund Details
  refundId: varchar("refund_id", { length: 255 }).unique(), // Gateway refund ID
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 255 }),
  notes: text("notes"),

  // Status
  status: varchar("status", { length: 50 }).notNull(), // initiated, processing, completed, failed

  // Gateway Response
  gatewayResponse: jsonb("gateway_response"),

  // Processing Details
  processedBy: uuid("processed_by").references(() => admins.id),
  approvedBy: uuid("approved_by").references(() => admins.id),

  // Timestamps
  initiatedAt: timestamp("initiated_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  paymentIdIdx: index("refunds_payment_id_idx").on(table.paymentId),
  invoiceIdIdx: index("refunds_invoice_id_idx").on(table.invoiceId),
  statusIdx: index("refunds_status_idx").on(table.status),
}));
```

### 3. **provider_payouts** Table
Track payouts to service providers

```typescript
export const providerPayouts = pgTable("provider_payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => serviceProviders.id, { onDelete: "restrict" }),

  // Payout Details
  payoutGroupId: varchar("payout_group_id", { length: 255 }), // Group multiple payouts
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  invoiceCount: integer("invoice_count").notNull(),

  // Breakdown
  invoiceIds: jsonb("invoice_ids").$type<string[]>(), // List of invoice IDs in this payout

  // Status
  status: varchar("status", { length: 50 }).notNull(), // pending, processing, completed, failed, cancelled

  // Transaction Details
  utr: varchar("utr", { length: 255 }), // UPI Transaction Reference
  bankAccount: jsonb("bank_account").$type<{
    accountNumber?: string;
    ifsc?: string;
    accountHolder?: string;
    bankName?: string;
  }>(),
  transactionId: varchar("transaction_id", { length: 255 }),
  notes: text("notes"),

  // Processing Details
  processedBy: uuid("processed_by").references(() => admins.id),
  failureReason: text("failure_reason"),

  // Timestamps
  initiatedAt: timestamp("initiated_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  providerIdIdx: index("provider_payouts_provider_id_idx").on(table.providerId),
  statusIdx: index("provider_payouts_status_idx").on(table.status),
  createdAtIdx: index("provider_payouts_created_at_idx").on(table.createdAt),
}));
```

### 4. **payment_gateway_config** Table
Store payment gateway configuration

```typescript
export const paymentGatewayConfig = pgTable("payment_gateway_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  gateway: varchar("gateway", { length: 50 }).notNull().unique(), // razorpay, stripe

  // Credentials (encrypted)
  apiKey: varchar("api_key", { length: 255 }).notNull(),
  apiSecret: varchar("api_secret", { length: 255 }).notNull(),
  webhookSecret: varchar("webhook_secret", { length: 255 }),

  // Configuration
  isActive: boolean("is_active").default(true).notNull(),
  environment: varchar("environment", { length: 20 }).default("test").notNull(), // test, live

  // Settings
  settings: jsonb("settings").$type<{
    supportedMethods?: string[];
    minAmount?: number;
    maxAmount?: number;
    refundEnabled?: boolean;
    autoPayoutEnabled?: boolean;
  }>(),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  gatewayIdx: index("payment_gateway_config_gateway_idx").on(table.gateway),
}));
```

---

## 💳 Payment Gateway Options

### Recommended for India:

#### 1. **Razorpay** ⭐ (RECOMMENDED)
**Pros:**
- Best for Indian market
- Supports UPI, cards, netbanking, wallets (Paytm, PhonePe, Amazon Pay)
- Excellent documentation and SDK
- Strong webhook support
- Competitive pricing (2% per transaction)
- Built-in refund system
- Dashboard for reconciliation

**Cons:**
- India-focused (limited international)
- Settlement time: 2-3 business days

**Pricing:**
- UPI: 0% (sometimes)
- Cards: 2%
- Netbanking: 2.5%
- Wallets: 2%

#### 2. **Stripe**
**Pros:**
- Global support
- Excellent documentation
- Advanced features
- Strong security

**Cons:**
- Not optimized for India
- Higher fees (~2.9% + ₹3)
- Settlement takes longer

#### 3. **PhonePe/Paytm Integration**
**Pros:**
- Direct UPI integration
- Lower fees
- Faster settlements

**Cons:**
- Limited payment methods
- Less flexible

---

## 🏗️ Architecture Design

### Payment Flow

```
┌─────────────┐
│   Customer  │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  1. Customer clicks "Pay Now" on invoice                 │
│  2. Backend creates payment order with gateway           │
│  3. Backend returns payment link/method                   │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  Payment Gateway     │
          │  (Razorpay UI)       │
          └──────────┬───────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│  4. Customer completes payment                           │
│  5. Gateway processes payment                            │
│  6. Gateway sends webhook to backend                      │
│  7. Backend updates payment status                       │
│  8. Backend updates invoice status                       │
│  9. Backend triggers provider payout calculation          │
└──────────────────────────────────────────────────────────┘
```

### Key Components

```
src/
├── db/
│   ├── schema.ts                    # Add payment tables
│   └── repositories/
│       ├── payment.repository.ts   # Payment CRUD operations
│       ├── refund.repository.ts    # Refund operations
│       └── payout.repository.ts    # Provider payout operations
│
├── drizzleControllers/
│   └── payment.controller.ts       # Payment endpoints
│
├── drizzleRoutes/
│   └── payment.routes.ts           # Payment routes
│
├── services/
│   ├── payment/
│   │   ├── razorpay.service.ts     # Razorpay integration
│   │   ├── stripe.service.ts       # Stripe integration (optional)
│   │   └── payment.factory.ts      # Payment gateway factory
│   └── payout.service.ts           # Provider payout logic
│
├── middlewares/
│   └── webhook.middleware.ts       # Webhook verification
│
└── utils/
    ├── payment.util.ts             # Payment utilities
    └── pricing.util.ts             # Already exists
```

---

## 📅 Implementation Phases

### Phase 1: Database Setup (1-2 days)
- [ ] Create `payments` table
- [ ] Create `refunds` table
- [ ] Create `provider_payouts` table
- [ ] Create `payment_gateway_config` table
- [ ] Generate and run migration
- [ ] Update schema exports

### Phase 2: Repository Layer (1-2 days)
- [ ] Create `payment.repository.ts`
  - [ ] `createPayment()`
  - [ ] `getPaymentById()`
  - [ ] `getPaymentsByInvoice()`
  - [ ] `updatePaymentStatus()`
  - [ ] `getPaymentStats()`
- [ ] Create `refund.repository.ts`
  - [ ] `createRefund()`
  - [ ] `getRefundById()`
  - [ ] `updateRefundStatus()`
  - [ ] `getRefundsByPayment()`
- [ ] Create `payout.repository.ts`
  - [ ] `createPayout()`
  - [ ] `getPayoutById()`
  - [ ] `getPayoutsByProvider()`
  - [ ] `updatePayoutStatus()`
  - [ ] `calculatePendingPayouts()`

### Phase 3: Payment Gateway Integration (2-3 days)
- [ ] Install Razorpay SDK: `npm install razorpay`
- [ ] Create `razorpay.service.ts`
  - [ ] `createOrder()` - Create payment order
  - [ ] `verifyPayment()` - Verify payment signature
  - [ ] `processRefund()` - Process refund
  - [ ] `fetchPaymentDetails()` - Get payment details
- [ ] Create `payment.factory.ts` - Support multiple gateways
- [ ] Add environment variables for API keys

### Phase 4: Controller & Routes (1-2 days)
- [ ] Create `payment.controller.ts`
  - [ ] `createPaymentOrder()`
  - [ ] `verifyPayment()`
  - [ ] `getPaymentStatus()`
  - [ ] `getPaymentHistory()`
- [ ] Create `refund.controller.ts`
  - [ ] `initiateRefund()` - Admin only
  - [ ] `getRefundStatus()`
- [ ] Create `payout.controller.ts`
  - [ ] `getPendingPayouts()` - Admin only
  - [ ] `createPayout()` - Admin only
  - [ ] `getProviderPayouts()`
- [ ] Create `payment.routes.ts`
- [ ] Update `invoice.routes.ts` - Link payment flow

### Phase 5: Webhook Handling (1-2 days)
- [ ] Create `webhook.middleware.ts`
  - [ ] Verify Razorpay webhook signature
  - [ ] Validate webhook payload
- [ ] Create webhook controller
  - [ ] `handlePaymentWebhook()` - Payment success/failure
  - [ ] `handleRefundWebhook()` - Refund updates
- [ ] Add webhook route: `POST /api/payments/webhook`

### Phase 6: Provider Payout System (2-3 days)
- [ ] Create `payout.service.ts`
  - [ ] Calculate provider earnings
  - [ ] Group invoices for batch payout
  - [ ] Generate payout reports
  - [ ] Validate bank details
- [ ] Admin payout dashboard
  - [ ] View pending payouts
  - [ ] Process payouts
  - [ ] Track payout status
  - [ ] Download payout reports

### Phase 7: Testing & Validation (2-3 days)
- [ ] Unit tests for payment flow
- [ ] Integration tests with Razorpay test mode
- [ ] Webhook testing
- [ ] Refund testing
- [ ] Payout testing
- [ ] Error handling validation
- [ ] Security testing

### Phase 8: Frontend Integration (3-4 days)
- [ ] Payment UI component
- [ ] Payment method selection
- [ ] Payment status display
- [ ] Refund request UI (if needed)
- [ ] Payout dashboard for admin

---

## 🔌 API Endpoints

### Payment Endpoints

#### Create Payment Order
```http
POST /api/payments/create-order
Authentication: Bearer {token}
Content-Type: application/json

{
  "invoiceId": "uuid",
  "paymentMethod": "upi|card|netbanking|wallet"
}

Response:
{
  "success": true,
  "data": {
    "orderId": "order_123",
    "amount": 1000,
    "currency": "INR",
    "key": "rzp_test_...",
    "callbackUrl": "https://...",
    "notes": {...}
  }
}
```

#### Verify Payment
```http
POST /api/payments/verify
Authentication: Bearer {token}
Content-Type: application/json

{
  "orderId": "order_123",
  "paymentId": "pay_123",
  "signature": "checksum_signature",
  "invoiceId": "uuid"
}

Response:
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "payment": {...},
    "invoice": {...}
  }
}
```

#### Get Payment Status
```http
GET /api/payments/:paymentId/status
Authentication: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "status": "completed",
    "amount": 1000,
    "paidAt": "2024-03-31T10:00:00Z"
  }
}
```

#### Get Payment History
```http
GET /api/payments/history?page=1&limit=10
Authentication: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "payments": [...],
    "pagination": {...}
  }
}
```

### Refund Endpoints (Admin Only)

#### Initiate Refund
```http
POST /api/payments/refunds/initiate
Authentication: Bearer {admin_token}
Content-Type: application/json

{
  "paymentId": "uuid",
  "amount": 500,
  "reason": "Service not completed",
  "notes": "Optional notes"
}

Response:
{
  "success": true,
  "data": {
    "refundId": "rfnd_123",
    "status": "initiated",
    "amount": 500
  }
}
```

#### Get Refund Status
```http
GET /api/payments/refunds/:refundId
Authentication: Bearer {admin_token}

Response:
{
  "success": true,
  "data": {
    "refundId": "uuid",
    "status": "completed",
    "amount": 500,
    "processedAt": "2024-03-31T11:00:00Z"
  }
}
```

### Payout Endpoints (Admin)

#### Get Pending Payouts
```http
GET /api/payouts/pending?providerId=uuid
Authentication: Bearer {admin_token}

Response:
{
  "success": true,
  "data": {
    "pendingPayouts": [
      {
        "providerId": "uuid",
        "providerName": "John Doe",
        "pendingAmount": 15000,
        "invoiceCount": 5,
        "invoiceIds": [...]
      }
    ]
  }
}
```

#### Create Payout
```http
POST /api/payouts/create
Authentication: Bearer {admin_token}
Content-Type: application/json

{
  "providerId": "uuid",
  "invoiceIds": ["inv1", "inv2", "inv3"],
  "totalAmount": 15000,
  "utr": "123456789012",
  "notes": "Weekly payout"
}

Response:
{
  "success": true,
  "data": {
    "payoutId": "uuid",
    "status": "processing",
    "amount": 15000
  }
}
```

#### Get Provider Payouts
```http
GET /api/payouts/provider/:providerId
Authentication: Bearer {provider_token}

Response:
{
  "success": true,
  "data": {
    "payouts": [...],
    "totalPaid": 45000,
    "pendingAmount": 5000
  }
}
```

### Webhook Endpoint

#### Handle Razorpay Webhook
```http
POST /api/payments/webhook/razorpay
Headers:
  X-Razorpay-Signature: {signature}
  X-Webhook-Secret: {secret}

Body: (Razorpay webhook payload)

Response:
{
  "success": true,
  "message": "Webhook processed"
}
```

---

## 🔒 Security Considerations

### 1. API Key Management
```bash
# .env file
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

### 2. Webhook Verification
- Always verify webhook signature
- Use HTTPS only
- Implement rate limiting
- Log all webhook events

### 3. Payment Verification
- Never trust client-side payment data
- Always verify with payment gateway
- Use server-to-server API calls
- Implement idempotency keys

### 4. Data Protection
- Encrypt sensitive data in database
- Never log full payment details
- Mask card numbers/UPI IDs
- Implement audit logs

### 5. Access Control
- Admin-only endpoints for refunds
- Provider-specific payout data
- Customer can only see their payments
- Role-based access control

---

## 🧪 Testing Strategy

### Test Environment Setup
1. Use Razorpay Test Mode
2. Get test API keys
3. Use test card numbers:
   - Success: 4242 4242 4242 4242
   - Failure: 4000 0000 0000 0002
   - Requires 3DS: 4000 0025 0000 3155

### Test Cases

#### Payment Flow
- ✅ Create order successfully
- ✅ Handle payment success
- ✅ Handle payment failure
- ✅ Handle payment pending
- ✅ Verify payment signature
- ✅ Update invoice status
- ✅ Create payment record

#### Webhook Handling
- ✅ Verify webhook signature
- ✅ Handle payment.captured webhook
- ✅ Handle payment.failed webhook
- ✅ Handle refund.processed webhook
- ✅ Handle duplicate webhooks (idempotency)

#### Refund Flow
- ✅ Initiate refund
- ✅ Full refund
- ✅ Partial refund
- ✅ Refund status update
- ✅ Update invoice status

#### Payout Flow
- ✅ Calculate pending payouts
- ✅ Create payout batch
- ✅ Process payout
- ✅ Payout status tracking
- ✅ Provider payout view

#### Edge Cases
- ✅ Network timeout during payment
- ✅ Duplicate payment requests
- ✅ Invalid payment signature
- ✅ Webhook received before client response
- ✅ Refund after payout
- ✅ Cancelled payment

---

## 📊 Reports & Analytics

### Payment Reports
1. Daily payment collection
2. Payment method distribution
3. Success vs failure rate
4. Average payment processing time
5. Refund rate and reasons

### Payout Reports
1. Pending payouts by provider
2. Payout processing time
3. Monthly payout totals
4. Payout failure analysis

### Revenue Reports
1. Daily revenue collection
2. Commission collected
3. Provider earnings
4. Payment gateway fees

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Webhook endpoints accessible publicly
- [ ] SSL certificates configured
- [ ] Database migrations run
- [ ] Backup strategy in place

### Go-Live
- [ ] Switch to live API keys
- [ ] Verify webhook URL in Razorpay dashboard
- [ ] Test with small amount (₹1)
- [ ] Monitor payment logs
- [ ] Set up alerts for failures
- [ ] Configure auto-refund rules
- [ ] Set up payout schedule

### Post-Deployment
- [ ] Monitor payment success rate
- [ ] Track webhook delivery
- [ ] Reconcile payments daily
- [ ] Process provider payouts
- [ ] Handle customer queries
- [ ] Optimize based on analytics

---

## 💰 Cost Estimation

### Payment Gateway Fees (Razorpay)
- UPI: 0% - 0.5%
- Cards: 2.0%
- Netbanking: 2.5%
- Wallets: 2.0%

### Example Calculation
```
Invoice Amount: ₹1,000
Payment Gateway Fee: ₹20 (2%)
Platform Commission (15%): ₹150
Provider Earning: ₹830

Actual Revenue: ₹150 - ₹20 = ₹130
```

---

## 📝 Next Steps

1. **Review this plan** with your team
2. **Choose payment gateway** (Recommended: Razorpay)
3. **Set up test account** with chosen gateway
4. **Create GitHub issues** from this plan
5. **Start with Phase 1** (Database setup)
6. **Test thoroughly** before going live

---

## 🆘 Support & Resources

### Razorpay Documentation
- Docs: https://razorpay.com/docs/
- API Reference: https://razorpay.com/docs/api/
- Webhooks: https://razorpay.com/docs/webhooks/
- Test Mode: https://razorpay.com/docs/payment-gateway/test-mode/

### SDK Installation
```bash
npm install razorpay
```

### Quick Start
```typescript
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
```

---

**Document Version:** 1.0
**Last Updated:** 2026-03-31
**Author:** Claude Code
**Status:** Ready for Implementation
