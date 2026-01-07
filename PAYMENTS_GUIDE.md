# LIMS Payment System Guide

## Overview

The LIMS Payment System provides comprehensive payment tracking for orders with support for multiple payments, partial payments, and detailed payment history. No payment gateway integration is included - this is for internal payment recording only.

## Features

- **Multiple Payments per Order**: Record multiple payments for a single order
- **Partial Payments**: Support for paying orders in installments
- **Payment Methods**: CASH, CARD, BANK_TRANSFER, CHECK, MOBILE_MONEY, OTHER
- **Payment Status**: PENDING, COMPLETED, FAILED, REFUNDED
- **Payment Summary**: Comprehensive payment tracking with order balance calculation
- **Payment History**: Full audit trail of all payments
- **Overpayment Prevention**: Automatic validation to prevent payments exceeding order total
- **Refund Tracking**: Support for recording refunded payments

---

## Database Schema

### Payment Model

```prisma
model Payment {
  id        String   @id @default(cuid())
  orderId   String
  amount    Decimal  @db.Decimal(10, 2)
  method    PaymentMethod
  status    PaymentStatus @default(COMPLETED)
  reference String?
  notes     String?
  paidAt    DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
}

enum PaymentMethod {
  CASH
  CARD
  BANK_TRANSFER
  CHECK
  MOBILE_MONEY
  OTHER
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}
```

---

## API Endpoints

### 1. List Payments for Order

**GET** `/api/orders/[id]/payments`

Lists all payments for a specific order.

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "id": "clx123abc",
      "orderId": "ord123",
      "amount": "150.00",
      "method": "CASH",
      "status": "COMPLETED",
      "reference": "TX123456",
      "notes": "First installment",
      "paidAt": "2026-01-04T10:30:00.000Z",
      "createdAt": "2026-01-04T10:30:00.000Z"
    }
  ]
}
```

### 2. Create Payment

**POST** `/api/orders/[id]/payments`

Records a new payment for an order.

**Request Body:**
```json
{
  "amount": 150.00,
  "method": "CASH",
  "reference": "TX123456",
  "notes": "First installment",
  "paidAt": "2026-01-04T10:30:00.000Z"
}
```

**Validation:**
- `amount` (required): Must be positive, cannot exceed order balance
- `method` (required): One of CASH, CARD, BANK_TRANSFER, CHECK, MOBILE_MONEY, OTHER
- `reference` (optional): Transaction reference number
- `notes` (optional): Additional payment notes
- `paidAt` (optional): Payment date/time, defaults to now

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "clx123abc",
    "orderId": "ord123",
    "amount": "150.00",
    "method": "CASH",
    "status": "COMPLETED",
    "reference": "TX123456",
    "notes": "First installment",
    "paidAt": "2026-01-04T10:30:00.000Z"
  },
  "paymentSummary": {
    "orderTotal": "500.00",
    "totalPaid": "150.00",
    "balance": "350.00",
    "isFullyPaid": false,
    "paymentCount": 1
  }
}
```

**Error Cases:**
- 400: Invalid amount or payment method
- 400: Payment exceeds order balance
- 404: Order not found
- 409: Cannot add payment to cancelled order

### 3. Get Single Payment

**GET** `/api/orders/[id]/payments/[paymentId]`

Retrieves details of a specific payment.

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "clx123abc",
    "orderId": "ord123",
    "amount": "150.00",
    "method": "CASH",
    "status": "COMPLETED",
    "reference": "TX123456",
    "notes": "First installment",
    "paidAt": "2026-01-04T10:30:00.000Z",
    "order": {
      "id": "ord123",
      "orderNumber": "ORD-20260104-0001",
      "total": "500.00",
      "status": "CONFIRMED"
    }
  }
}
```

### 4. Update Payment

**PUT** `/api/orders/[id]/payments/[paymentId]`

Updates payment status or details.

**Request Body:**
```json
{
  "status": "REFUNDED",
  "notes": "Refunded per patient request",
  "reference": "REF123456"
}
```

**Allowed Status Values:**
- `PENDING`: Payment is pending confirmation
- `COMPLETED`: Payment successfully processed
- `FAILED`: Payment failed
- `REFUNDED`: Payment was refunded

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "clx123abc",
    "status": "REFUNDED",
    "notes": "Refunded per patient request",
    "reference": "REF123456"
  }
}
```

### 5. Delete Payment

**DELETE** `/api/orders/[id]/payments/[paymentId]`

Deletes a payment (only PENDING or FAILED payments can be deleted).

**Response:**
```json
{
  "success": true,
  "message": "Payment deleted successfully"
}
```

**Error Cases:**
- 404: Payment not found
- 409: Can only delete PENDING or FAILED payments

### 6. Payment Summary

**GET** `/api/orders/[id]/payment-summary`

Gets comprehensive payment summary for an order.

**Response:**
```json
{
  "success": true,
  "summary": {
    "orderId": "ord123",
    "orderNumber": "ORD-20260104-0001",
    "orderStatus": "CONFIRMED",
    "orderTotal": "500.00",
    
    "totalPaid": "350.00",
    "totalPending": "0.00",
    "totalCompleted": "350.00",
    "totalRefunded": "0.00",
    "netPaid": "350.00",
    "balance": "150.00",
    
    "isFullyPaid": false,
    "isPartiallyPaid": true,
    "isOverpaid": false,
    
    "totalPayments": 2,
    "completedPayments": 2,
    "pendingPayments": 0,
    "failedPayments": 0,
    "refundedPayments": 0,
    
    "paymentsByMethod": {
      "CASH": {
        "count": 1,
        "total": "200.00"
      },
      "CARD": {
        "count": 1,
        "total": "150.00"
      }
    },
    
    "payments": [
      {
        "id": "pay1",
        "amount": "200.00",
        "method": "CASH",
        "status": "COMPLETED",
        "reference": "TX123",
        "notes": null,
        "paidAt": "2026-01-04T10:00:00.000Z"
      },
      {
        "id": "pay2",
        "amount": "150.00",
        "method": "CARD",
        "status": "COMPLETED",
        "reference": "TX456",
        "notes": null,
        "paidAt": "2026-01-04T14:00:00.000Z"
      }
    ],
    
    "patient": {
      "id": "pat123",
      "firstName": "John",
      "lastName": "Doe",
      "mrn": "MRN001"
    }
  }
}
```

**Summary Calculations:**
- `totalPaid`: Sum of COMPLETED and PENDING payments
- `netPaid`: totalPaid minus totalRefunded
- `balance`: orderTotal minus netPaid
- `isFullyPaid`: balance equals zero
- `isPartiallyPaid`: netPaid > 0 and netPaid < orderTotal
- `isOverpaid`: balance < 0 (should not happen with validation)

---

## Frontend Integration

### Order Detail Page with Payments

The order detail page (`/dashboard/orders/[id]`) now includes:

1. **Payment Summary Card**
   - Order total, total paid, and balance displayed prominently
   - Visual indicators for payment status (fully paid, partially paid)
   - Refund information if applicable

2. **Record Payment Button**
   - Visible when order is not fully paid and not cancelled
   - Opens inline payment form

3. **Payment Form**
   - Amount input (pre-filled with remaining balance)
   - Payment method dropdown
   - Optional reference number and notes
   - Validation to prevent overpayment
   - Auto-closes after successful payment

4. **Payment History Table**
   - Lists all payments with date, method, reference, amount, status
   - Color-coded status badges
   - Sorted by payment date (newest first)
   - Shows payment count

### Payment Status Badges

Color coding:
- **COMPLETED**: Green - Payment successfully processed
- **PENDING**: Yellow - Payment awaiting confirmation
- **FAILED**: Red - Payment failed
- **REFUNDED**: Purple - Payment was refunded

---

## Usage Examples

### Example 1: Recording Full Payment

```javascript
// Record full payment for $500 order
const response = await fetch('/api/orders/ord123/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 500.00,
    method: 'CARD',
    reference: 'TX789012'
  })
});

// Response shows fully paid
{
  "paymentSummary": {
    "orderTotal": "500.00",
    "totalPaid": "500.00",
    "balance": "0.00",
    "isFullyPaid": true
  }
}
```

### Example 2: Multiple Partial Payments

```javascript
// First payment: $200
await fetch('/api/orders/ord123/payments', {
  method: 'POST',
  body: JSON.stringify({
    amount: 200.00,
    method: 'CASH',
    notes: 'First installment'
  })
});

// Second payment: $150
await fetch('/api/orders/ord123/payments', {
  method: 'POST',
  body: JSON.stringify({
    amount: 150.00,
    method: 'CARD',
    reference: 'TX456789',
    notes: 'Second installment'
  })
});

// Third payment: $150 (completes the $500 order)
await fetch('/api/orders/ord123/payments', {
  method: 'POST',
  body: JSON.stringify({
    amount: 150.00,
    method: 'MOBILE_MONEY',
    reference: 'MM123456',
    notes: 'Final payment'
  })
});
```

### Example 3: Recording a Refund

```javascript
// Update existing payment to refunded status
await fetch('/api/orders/ord123/payments/pay123', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'REFUNDED',
    notes: 'Refunded due to order cancellation'
  })
});

// Payment summary now shows refund
{
  "totalCompleted": "500.00",
  "totalRefunded": "500.00",
  "netPaid": "0.00",
  "balance": "500.00"
}
```

### Example 4: Checking Payment Summary

```javascript
// Get comprehensive payment summary
const response = await fetch('/api/orders/ord123/payment-summary');
const { summary } = await response.json();

console.log(`Order Total: $${summary.orderTotal}`);
console.log(`Amount Paid: $${summary.netPaid}`);
console.log(`Balance Due: $${summary.balance}`);
console.log(`Payment Status: ${summary.isFullyPaid ? 'Fully Paid' : 'Pending'}`);
console.log(`Number of Payments: ${summary.totalPayments}`);

// Check by payment method
Object.entries(summary.paymentsByMethod).forEach(([method, data]) => {
  console.log(`${method}: ${data.count} payments totaling $${data.total}`);
});
```

---

## RBAC Integration

All payment endpoints require the `canCreateOrders` permission:

```javascript
// lib/rbac.js
export function canCreateOrders(user) {
  if (!user) return false;
  
  const { role } = user;
  
  // RECEPTION and above can create orders and record payments
  return ['RECEPTION', 'LAB_STAFF', 'ADMIN', 'SUPERUSER'].includes(role);
}
```

**Roles with Payment Access:**
- ✅ RECEPTION: Can record payments
- ✅ LAB_STAFF: Can record payments
- ✅ ADMIN: Can record payments
- ✅ SUPERUSER: Can record payments

---

## Business Rules

1. **Payment Validation**
   - Payment amount must be positive
   - Payment cannot exceed order balance
   - Payment method must be valid
   - Cannot add payments to cancelled orders

2. **Partial Payments**
   - Multiple payments allowed per order
   - Total of all COMPLETED + PENDING payments cannot exceed order total
   - Balance automatically calculated as: orderTotal - (totalCompleted + totalPending - totalRefunded)

3. **Payment Deletion**
   - Only PENDING or FAILED payments can be deleted
   - COMPLETED payments cannot be deleted (use REFUNDED status instead)
   - REFUNDED payments cannot be deleted

4. **Payment Status**
   - New payments default to COMPLETED status
   - PENDING payments count toward total paid
   - FAILED payments do not count toward total paid
   - REFUNDED payments reduce net paid amount

5. **Order Status**
   - Payment recording does not automatically change order status
   - Order can be PENDING, CONFIRMED, or COMPLETED regardless of payment status
   - Cancelled orders cannot receive new payments

---

## Testing Payment System

### Test Scenarios

1. **Full Payment in One Transaction**
   - Create order for $500
   - Record single payment of $500
   - Verify isFullyPaid = true, balance = 0

2. **Multiple Partial Payments**
   - Create order for $500
   - Record payment of $200 (balance should be $300)
   - Record payment of $150 (balance should be $150)
   - Record payment of $150 (balance should be $0)

3. **Overpayment Prevention**
   - Create order for $500
   - Record payment of $300
   - Attempt to record payment of $300
   - Should fail with error about exceeding balance

4. **Refund Handling**
   - Create order for $500
   - Record payment of $500
   - Update payment status to REFUNDED
   - Verify balance returns to $500

5. **Payment Methods**
   - Test each payment method: CASH, CARD, BANK_TRANSFER, CHECK, MOBILE_MONEY, OTHER
   - Verify paymentsByMethod summary groups correctly

6. **Payment Deletion**
   - Create PENDING payment - can be deleted
   - Create COMPLETED payment - cannot be deleted
   - Verify error handling

---

## Best Practices

1. **Always Use Payment Summary Endpoint**
   - Don't calculate payment totals client-side
   - Always fetch `/payment-summary` for accurate balance
   - Use summary data to show payment status to users

2. **Record Reference Numbers**
   - Always include payment reference when available
   - Helps with reconciliation and dispute resolution
   - Especially important for electronic payments

3. **Use Appropriate Payment Status**
   - Use PENDING for payments awaiting confirmation (e.g., checks, bank transfers)
   - Use COMPLETED for confirmed payments (e.g., cash, card)
   - Use FAILED for declined transactions
   - Use REFUNDED for returned payments

4. **Handle Partial Payments**
   - Check `isPartiallyPaid` flag to show outstanding balance
   - Allow multiple payment recording until `isFullyPaid` is true
   - Display clear payment history for transparency

5. **Audit Trail**
   - All payments include `paidAt` and `createdAt` timestamps
   - Update payment `notes` field for important changes
   - Never delete COMPLETED payments - use REFUNDED status

---

## Common Issues and Solutions

### Issue: "Payment exceeds order balance"

**Cause**: Attempting to record payment that would exceed order total

**Solution**: 
- Fetch payment summary first to get current balance
- Ensure payment amount ≤ balance
- Consider if there are pending payments already counted

### Issue: Cannot delete payment

**Cause**: Trying to delete COMPLETED or REFUNDED payment

**Solution**:
- Use PUT endpoint to update status to REFUNDED instead
- Only delete PENDING or FAILED payments
- REFUNDED payments maintain audit trail

### Issue: Balance doesn't match expected value

**Cause**: Not accounting for PENDING or REFUNDED payments

**Solution**:
- Check payment summary for all payment statuses
- PENDING payments count toward totalPaid
- REFUNDED payments reduce netPaid
- Use netPaid for actual received amount

### Issue: Can't record payment on cancelled order

**Cause**: Order status is CANCELLED

**Solution**:
- Payments cannot be added to cancelled orders
- Change order status first if payment is valid
- Or record refund on existing payment if order truly cancelled

---

## Summary

The Payment System provides:
- ✅ Multiple payments per order
- ✅ Partial payment support
- ✅ 6 payment methods
- ✅ 4 payment statuses
- ✅ Overpayment prevention
- ✅ Refund tracking
- ✅ Comprehensive payment summary
- ✅ Full payment history
- ✅ RBAC protection
- ✅ Frontend integration

No payment gateway integration - this is for internal payment recording only.
