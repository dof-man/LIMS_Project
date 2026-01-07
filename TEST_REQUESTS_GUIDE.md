# Test Request System Guide

## Overview

The Test Request system bridges clinical workflow (test ordering) with financial workflow (billing) in the LIMS. When a test request is created, the system automatically:

1. Creates **Clinical Records** (test_requests) for laboratory tracking
2. Creates **Billing Records** (orders) for financial tracking
3. Links them together via `orderId` foreign key

This ensures complete integration between clinical operations and billing operations.

## Database Schema

### TestRequest Model
```prisma
model TestRequest {
  id                String          @id @default(cuid())
  requestNumber     String          @unique
  patientId         String
  inventoryItemId   String
  orderId           String?
  status            TestRequestStatus @default(PENDING)
  urgency           TestUrgency     @default(ROUTINE)
  notes             String?
  clinicalNotes     String?
  requestedBy       String?
  sampleCollectedAt DateTime?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  patient           Patient         @relation(fields: [patientId], references: [id])
  inventoryItem     InventoryItem   @relation(fields: [inventoryItemId], references: [id])
  order             Order?          @relation(fields: [orderId], references: [id])
  results           TestResult[]
}

enum TestRequestStatus {
  PENDING
  SAMPLE_COLLECTED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum TestUrgency {
  ROUTINE
  URGENT
  STAT
}
```

### Linked Order
When a test request is created, an Order is automatically created with:
- `orderNumber`: Auto-generated (ORD-YYYYMMDD-XXXX)
- `total`: Calculated from investigation prices
- `status`: Set to "CONFIRMED"
- `items`: Order items matching test request investigations

## API Endpoints

### 1. List Test Requests
**GET** `/api/test-requests`

Query Parameters:
- `patientId` (optional): Filter by patient
- `status` (optional): Filter by status (PENDING, SAMPLE_COLLECTED, IN_PROGRESS, COMPLETED, CANCELLED)
- `search` (optional): Search by request number, patient MRN, or name
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

Response:
```json
{
  "success": true,
  "testRequests": [
    {
      "id": "...",
      "requestNumber": "TR-20240115-0001",
      "status": "PENDING",
      "urgency": "ROUTINE",
      "patient": {
        "id": "...",
        "mrn": "MRN-20240115-0001",
        "firstName": "John",
        "lastName": "Doe"
      },
      "inventoryItem": {
        "id": "...",
        "name": "Complete Blood Count",
        "code": "CBC",
        "category": "LAB_TEST"
      },
      "order": {
        "id": "...",
        "orderNumber": "ORD-20240115-0001",
        "total": 50.00,
        "status": "CONFIRMED"
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

### 2. Create Test Request
**POST** `/api/test-requests`

Request Body:
```json
{
  "patientId": "patient-id",
  "items": [
    {
      "inventoryItemId": "inventory-item-id",
      "quantity": 1,
      "urgency": "ROUTINE",
      "notes": "Optional notes for this test"
    }
  ],
  "clinicalNotes": "Clinical indication or diagnosis",
  "requestedBy": "Dr. Smith"
}
```

**Validation Rules:**
- `patientId`: Required, must exist
- `items`: Required array with at least one item
- `inventoryItemId`: Must be an active inventory item
- Category must be: LAB_TEST, RADIOLOGY, or PROCEDURE
- `urgency`: Optional (ROUTINE, URGENT, STAT), defaults to ROUTINE

**What Happens:**
1. Validates patient exists
2. Validates all inventory items exist and are active
3. Checks all items are investigation categories (LAB_TEST, RADIOLOGY, PROCEDURE)
4. Generates unique test request number (TR-YYYYMMDD-XXXX)
5. Generates unique order number (ORD-YYYYMMDD-XXXX)
6. **Transaction:**
   - Creates individual test requests for each item
   - Creates order with calculated total
   - Creates order items matching test request items
   - Links test requests to order via `orderId`

Response:
```json
{
  "success": true,
  "message": "Test request TR-20240115-0001 created successfully with 2 test(s)",
  "testRequests": [...],
  "order": {
    "id": "...",
    "orderNumber": "ORD-20240115-0001",
    "total": 150.00,
    "items": [...]
  },
  "summary": {
    "testRequestNumber": "TR-20240115-0001",
    "orderNumber": "ORD-20240115-0001",
    "patientMRN": "MRN-20240115-0001",
    "patientName": "John Doe",
    "totalTests": 2,
    "orderTotal": 150.00
  }
}
```

### 3. Get Test Request Details
**GET** `/api/test-requests/:id`

Returns full test request with:
- Patient information (with allergies alert)
- Investigation details
- Linked order information
- Test results (if any)

### 4. Update Test Request
**PUT** `/api/test-requests/:id`

Update status, notes, or urgency.

Request Body:
```json
{
  "status": "SAMPLE_COLLECTED",
  "notes": "Sample collected at 10:30 AM",
  "urgency": "URGENT",
  "sampleCollectedAt": "2024-01-15T10:30:00Z"
}
```

All fields are optional. Only provided fields are updated.

### 5. Cancel Test Request
**DELETE** `/api/test-requests/:id`

- Only PENDING requests can be cancelled
- Sets status to CANCELLED (doesn't delete)
- Maintains audit trail

## RBAC Permissions

Test requests use the following permissions:

```javascript
// View test requests
canAccessPatients(user)

// Create test requests
canAccessPatients(user)

// Update/cancel test requests
canAccessPatients(user)
```

All authenticated users with patient access can manage test requests.

## Investigation Categories

Only these inventory categories can be used for test requests:

1. **LAB_TEST**: Laboratory investigations (CBC, Chemistry panels, etc.)
2. **RADIOLOGY**: Imaging studies (X-ray, CT, MRI, Ultrasound)
3. **PROCEDURE**: Clinical procedures (Biopsy, ECG, etc.)

Other categories (CONSULTATION, SUPPLIES, OTHER) cannot be used for test requests.

## Frontend Pages

### 1. Test Request List (`/dashboard/test-requests`)
- View all test requests
- Filter by status
- Search by request number, patient MRN, or name
- Pagination support
- Shows linked order number

### 2. Create Test Request (`/dashboard/test-requests/new`)
Features:
- Patient search and selection with allergy alerts
- Multiple investigation selection
- Per-item urgency and notes
- Clinical notes and requesting physician
- Real-time price calculation
- Shows total cost before submission

### 3. Test Request Detail (`/dashboard/test-requests/:id`)
Displays:
- Test request information with status
- Investigation details
- Patient information (with allergy alerts)
- Linked billing order with link
- Test results (if available)
- Edit mode for updating status/notes (PENDING only)
- Cancel button (PENDING only)

## Workflow Examples

### Example 1: Basic Lab Test Request

```javascript
// 1. Create test request
POST /api/test-requests
{
  "patientId": "patient-123",
  "items": [
    {
      "inventoryItemId": "inv-cbc",
      "urgency": "ROUTINE"
    }
  ],
  "clinicalNotes": "Annual physical examination",
  "requestedBy": "Dr. Johnson"
}

// Response includes:
// - Test Request: TR-20240115-0001
// - Order: ORD-20240115-0001
// - Total: $50.00

// 2. Update status when sample collected
PUT /api/test-requests/tr-123
{
  "status": "SAMPLE_COLLECTED",
  "sampleCollectedAt": "2024-01-15T10:30:00Z"
}

// 3. Update to in progress
PUT /api/test-requests/tr-123
{
  "status": "IN_PROGRESS"
}

// 4. Complete and add results
PUT /api/test-requests/tr-123
{
  "status": "COMPLETED"
}
```

### Example 2: Urgent Multiple Tests

```javascript
POST /api/test-requests
{
  "patientId": "patient-456",
  "items": [
    {
      "inventoryItemId": "inv-cbc",
      "urgency": "STAT",
      "notes": "Suspected anemia"
    },
    {
      "inventoryItemId": "inv-chemistry",
      "urgency": "STAT",
      "notes": "Check electrolytes"
    },
    {
      "inventoryItemId": "inv-chest-xray",
      "urgency": "URGENT",
      "notes": "Rule out pneumonia"
    }
  ],
  "clinicalNotes": "Patient admitted with fever and SOB",
  "requestedBy": "Dr. Williams"
}

// Creates:
// - 3 test requests (TR-20240115-0002-1, TR-20240115-0002-2, TR-20240115-0002-3)
// - 1 order with 3 items (ORD-20240115-0002)
// - Total: $200.00 (automatic calculation)
```

## Integration with Billing

### Order Creation
When a test request is created:
1. Order is created with status "CONFIRMED"
2. Order items match test request items
3. Order total is calculated automatically
4. Order is linked to test requests

### Payment Processing
Use the Payments API to process payments for the order:

```javascript
// Get order from test request
GET /api/test-requests/tr-123
// Returns: { order: { id: "order-123", orderNumber: "ORD-..." } }

// Create payment
POST /api/orders/order-123/payments
{
  "amount": 50.00,
  "paymentMethod": "CASH",
  "receivedBy": "Reception Staff"
}

// Check payment status
GET /api/orders/order-123/payment-summary
```

## Status Workflow

```
PENDING
  ↓
SAMPLE_COLLECTED
  ↓
IN_PROGRESS
  ↓
COMPLETED

(CANCELLED - can only happen from PENDING)
```

### Status Meanings

- **PENDING**: Test ordered, awaiting sample collection
- **SAMPLE_COLLECTED**: Sample collected, ready for processing
- **IN_PROGRESS**: Lab is processing the sample
- **COMPLETED**: Results available
- **CANCELLED**: Request cancelled before processing

## Best Practices

1. **Always use urgency levels appropriately:**
   - ROUTINE: Normal processing (24-48 hours)
   - URGENT: Priority processing (4-8 hours)
   - STAT: Immediate processing (1-2 hours)

2. **Include clinical notes:**
   - Helps lab staff understand context
   - Important for result interpretation
   - Required for insurance claims

3. **Check allergies:**
   - Frontend displays patient allergies
   - Important for contrast media (radiology)
   - Consider drug allergies for procedures

4. **Update status promptly:**
   - Improves workflow tracking
   - Enables accurate reporting
   - Helps manage turnaround times

5. **Link to requesting physician:**
   - Required for result distribution
   - Important for follow-up
   - Needed for billing in some cases

## Common Issues

### Issue 1: "Only LAB_TEST, RADIOLOGY, and PROCEDURE items can be used"
**Solution**: Check inventory item category. CONSULTATION, SUPPLIES, and OTHER cannot be used for test requests.

### Issue 2: Order not created
**Solution**: Check that transaction completed successfully. All test requests should have an `orderId`.

### Issue 3: Can't cancel test request
**Solution**: Only PENDING test requests can be cancelled. Once sample is collected or processing started, cancellation is not allowed.

## Testing

```bash
# Create a test request
curl -X POST http://localhost:3000/api/test-requests \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-id",
    "items": [
      {
        "inventoryItemId": "inventory-id",
        "urgency": "ROUTINE"
      }
    ],
    "clinicalNotes": "Test request",
    "requestedBy": "Dr. Test"
  }'

# List test requests
curl http://localhost:3000/api/test-requests?status=PENDING

# Get test request
curl http://localhost:3000/api/test-requests/tr-id

# Update status
curl -X PUT http://localhost:3000/api/test-requests/tr-id \
  -H "Content-Type: application/json" \
  -d '{"status": "SAMPLE_COLLECTED"}'
```

## Related Documentation

- [RBAC Guide](./RBAC_GUIDE.md) - User permissions
- [Inventory Guide](./INVENTORY_GUIDE.md) - Managing investigation items
- [Payments Guide](./PAYMENTS_GUIDE.md) - Processing payments for test orders
- [Patient Management](./README.md) - Patient registration and history
