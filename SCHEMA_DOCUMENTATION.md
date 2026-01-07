# LIMS Database Schema Documentation

## Overview

This Prisma schema defines a comprehensive Laboratory Information Management System (LIMS) with integrated inventory and billing capabilities. The schema uses UUIDs as primary keys for all tables and implements proper relationships and indexes for optimal performance.

## Schema Architecture

### Clinical Module
Handles patient management, test requests, sample tracking, and lab results.

### Inventory & Billing Module
Manages billable items, orders, and payments with inventory tracking.

---

## Clinical Models

### 1. **Patient**
Stores patient demographic and contact information.

**Key Fields:**
- `patientNumber` - Unique identifier for the patient
- `firstName`, `lastName` - Patient name
- `dateOfBirth`, `gender` - Demographics
- `phone`, `email`, `address` - Contact information
- `emergencyContact`, `emergencyPhone` - Emergency contacts
- `medicalHistory`, `allergies` - Clinical information

**Relations:**
- One-to-many with `TestRequest`
- One-to-many with `Sample`

**Indexes:**
- `patientNumber` (unique)
- `lastName`, `firstName` (composite)
- `phone`
- `email`

---

### 2. **TestRequest**
Represents a clinical test order for a patient.

**Key Fields:**
- `requestNumber` - Unique request identifier
- `patientId` - Reference to patient
- `orderId` - Optional reference to billing order
- `priority` - normal, urgent, stat
- `status` - pending, in_progress, completed, cancelled
- `requestingDoctor` - Name of requesting physician
- `department` - Requesting department

**Relations:**
- Many-to-one with `Patient`
- Many-to-one with `Order` (optional)
- One-to-many with `TestRequestItem`
- One-to-many with `Sample`
- One-to-many with `LabResult`

**Indexes:**
- `requestNumber` (unique)
- `patientId`
- `orderId`
- `requestDate`
- `status`

---

### 3. **TestRequestItem**
**Critical linking table** that explicitly connects clinical test requests to order items (billable items).

**Key Fields:**
- `testRequestId` - Reference to test request
- `orderItemId` - Reference to order item (billable inventory item)
- `status` - pending, collected, processing, completed, cancelled

**Relations:**
- Many-to-one with `TestRequest`
- Many-to-one with `OrderItem`
- One-to-many with `LabResult`

**Business Logic:**
This table ensures that every clinical test is linked to a billable item, maintaining the connection between clinical operations and billing.

**Indexes:**
- `testRequestId`
- `orderItemId`
- `status`

---

### 4. **Sample**
Tracks biological samples collected from patients.

**Key Fields:**
- `sampleNumber` - Unique sample identifier
- `patientId` - Reference to patient
- `testRequestId` - Reference to test request
- `sampleType` - blood, urine, stool, tissue, etc.
- `collectionDate`, `collectionTime` - When sample was collected
- `collectedBy` - Technician who collected sample
- `volume`, `containerType` - Physical properties
- `status` - collected, received, processing, tested, disposed
- `condition` - good, hemolyzed, clotted, insufficient
- `storageLocation` - Where sample is stored

**Relations:**
- Many-to-one with `Patient`
- Many-to-one with `TestRequest`
- One-to-many with `LabResult`

**Indexes:**
- `sampleNumber` (unique)
- `patientId`
- `testRequestId`
- `sampleType`
- `status`
- `collectionDate`

---

### 5. **LabParameter**
Defines individual test parameters with reference ranges.

**Key Fields:**
- `code` - Unique parameter code (e.g., "HGB", "WBC")
- `name` - Parameter name (e.g., "Hemoglobin")
- `testCategory` - hematology, biochemistry, microbiology, etc.
- `unit` - Measurement unit (e.g., "g/dL", "cells/μL")
- `referenceRangeMin`, `referenceRangeMax` - Normal range
- `referenceText` - Text description of reference range
- `method` - Testing methodology
- `isActive` - Whether parameter is currently in use
- `sortOrder` - Display order

**Relations:**
- One-to-many with `LabResultValue`

**Indexes:**
- `code` (unique)
- `testCategory`
- `isActive`

---

### 6. **LabResult**
Main container for test results.

**Key Fields:**
- `testRequestId` - Reference to test request
- `testRequestItemId` - Optional reference to specific test item
- `sampleId` - Optional reference to sample
- `resultType` - "structured" (quantitative) or "investigation" (free-text)
- `status` - pending, in_progress, completed, verified, released
- `testedDate`, `testedBy` - When and who performed test
- `verifiedDate`, `verifiedBy` - When and who verified results
- `releasedDate`, `releasedBy` - When and who released to patient

**Relations:**
- Many-to-one with `TestRequest`
- Many-to-one with `TestRequestItem` (optional)
- Many-to-one with `Sample` (optional)
- One-to-many with `LabResultValue` (for structured results)
- One-to-one with `InvestigationResult` (for free-text results)

**Business Logic:**
- `resultType = "structured"` → Has multiple `LabResultValue` entries
- `resultType = "investigation"` → Has one `InvestigationResult` entry

**Indexes:**
- `testRequestId`
- `testRequestItemId`
- `sampleId`
- `resultType`
- `status`
- `testedDate`

---

### 7. **LabResultValue**
Individual parameter values for structured lab results.

**Key Fields:**
- `labResultId` - Reference to parent result
- `labParameterId` - Reference to parameter definition
- `value` - Raw value as string
- `numericValue` - Parsed numeric value for calculations
- `textValue` - Text results (e.g., "Positive", "Negative")
- `isAbnormal` - Whether value is outside normal range
- `flag` - H (high), L (low), HH (critically high), LL (critically low)

**Relations:**
- Many-to-one with `LabResult`
- Many-to-one with `LabParameter`

**Usage Example:**
For a Complete Blood Count (CBC), you would have multiple `LabResultValue` entries:
- One for Hemoglobin
- One for White Blood Cells
- One for Platelets
- etc.

**Indexes:**
- `labResultId`
- `labParameterId`
- `isAbnormal`

---

### 8. **InvestigationResult**
Free-text results for radiology, pathology, and special tests.

**Key Fields:**
- `labResultId` - Unique reference to parent result (one-to-one)
- `investigationType` - radiology, pathology, special_tests
- `title` - Investigation title
- `findings` - Main findings (free text)
- `impression` - Clinical impression/diagnosis
- `recommendations` - Follow-up recommendations
- `images` - JSON array of image URLs
- `attachments` - JSON array of attachment URLs

**Relations:**
- One-to-one with `LabResult`

**Usage Example:**
For an X-Ray:
- `investigationType` = "radiology"
- `title` = "Chest X-Ray PA View"
- `findings` = "Clear lung fields. No infiltrates..."
- `impression` = "Normal chest radiograph"

**Indexes:**
- `labResultId` (unique)
- `investigationType`

---

## Inventory & Billing Models

### 9. **InventoryItem**
**Single source of truth** for all billable items in the system.

**Key Fields:**
- `itemCode` - Unique item code
- `itemName` - Item name
- `category` - lab_test, radiology, procedure, medication, supply
- `subCategory` - Further categorization
- `unitPrice` - Selling price
- `cost` - Cost price
- `unit` - Unit of measure
- `taxable` - Whether item is taxable
- `taxRate` - Tax rate percentage
- `stockQuantity` - Current stock level
- `reorderLevel` - Minimum stock level
- `isActive` - Whether item is available for ordering
- `requiresSample` - Whether test requires a sample
- `sampleType` - Required sample type
- `turnaroundTime` - Expected result time (in hours)
- `department` - Responsible department

**Relations:**
- One-to-many with `OrderItem`

**Business Logic:**
- All tests, procedures, and supplies must be defined here first
- Pricing is centralized in this table
- Stock management for physical items

**Indexes:**
- `itemCode` (unique)
- `category`
- `isActive`
- `itemName`

---

### 10. **Order**
Represents a billing order (can contain multiple items).

**Key Fields:**
- `orderNumber` - Unique order identifier
- `orderDate` - When order was created
- `orderType` - lab, radiology, pharmacy, outpatient, inpatient
- `customerType` - patient, corporate, insurance, walk_in
- `customerId` - Reference to customer (flexible, can be patient ID)
- `customerName` - Customer name
- `status` - pending, confirmed, in_progress, completed, cancelled
- `subtotal` - Sum of item prices
- `discount` - Total discount
- `tax` - Total tax
- `totalAmount` - Final amount
- `amountPaid` - Amount paid so far
- `balance` - Outstanding balance
- `createdBy` - User who created order

**Relations:**
- One-to-many with `OrderItem`
- One-to-many with `Payment`
- One-to-many with `TestRequest`

**Business Logic:**
Financial calculations:
```
subtotal = sum(orderItems.totalPrice)
totalAmount = subtotal - discount + tax
balance = totalAmount - amountPaid
```

**Indexes:**
- `orderNumber` (unique)
- `orderDate`
- `customerId`
- `status`
- `orderType`

---

### 11. **OrderItem**
Individual line items in an order.

**Key Fields:**
- `orderId` - Reference to parent order
- `inventoryItemId` - Reference to inventory item (source of truth)
- `quantity` - Number of units
- `unitPrice` - Price per unit (copied from inventory at time of order)
- `discount` - Discount on this item
- `tax` - Tax on this item
- `totalPrice` - Final price for this line item
- `status` - pending, processing, completed, cancelled

**Relations:**
- Many-to-one with `Order`
- Many-to-one with `InventoryItem`
- One-to-many with `TestRequestItem`

**Business Logic:**
```
totalPrice = (unitPrice * quantity) - discount + tax
```

**Data Flow:**
```
InventoryItem → OrderItem → TestRequestItem → LabResult
     ↓              ↓              ↓              ↓
  (Catalog)    (Billing)    (Clinical Link)  (Results)
```

**Indexes:**
- `orderId`
- `inventoryItemId`
- `status`

---

### 12. **Payment**
Tracks payments against orders.

**Key Fields:**
- `orderId` - Reference to order being paid
- `paymentNumber` - Unique payment identifier
- `paymentDate` - When payment was made
- `paymentMethod` - cash, card, bank_transfer, insurance, mobile_money
- `amount` - Payment amount
- `reference` - External reference number
- `transactionId` - Transaction ID from payment gateway
- `status` - pending, completed, failed, refunded
- `receivedBy` - User who received payment

**Relations:**
- Many-to-one with `Order`

**Business Logic:**
An order can have multiple payments (partial payments, installments).
Total payments update the `Order.amountPaid` and `Order.balance`.

**Indexes:**
- `orderId`
- `paymentNumber` (unique)
- `paymentDate`
- `paymentMethod`
- `status`

---

## Key Relationships and Data Flow

### Clinical-Billing Integration

```
Patient requests test
    ↓
Order created with OrderItems (from InventoryItem)
    ↓
TestRequest created
    ↓
TestRequestItems link TestRequest to OrderItems
    ↓
Sample collected (if required)
    ↓
LabResult created (linked to TestRequest)
    ↓
LabResultValues created (for structured results)
    OR
InvestigationResult created (for free-text results)
    ↓
Results verified and released
```

### Billing Flow

```
InventoryItem (master catalog)
    ↓
OrderItem (what was ordered)
    ↓
Payment (how it was paid)
    ↓
Order.balance updated
```

---

## Design Decisions

### 1. **UUID Primary Keys**
All models use UUID (`@default(uuid())`) for globally unique identifiers, better for distributed systems and merging data.

### 2. **Dual Result Types**
- **Structured results** (quantitative): Use `LabParameter` + `LabResultValue` for lab tests with measurable values
- **Investigation results** (qualitative): Use `InvestigationResult` for free-text reports (radiology, pathology)

### 3. **Explicit Clinical-Billing Link**
`TestRequestItem` explicitly connects clinical requests to billing via `orderItemId`, ensuring every test is properly billed.

### 4. **Single Source of Truth**
`InventoryItem` is the master catalog. All pricing, categorization, and test definitions originate here.

### 5. **Flexible Customer Model**
`Order.customerId` can reference patients, corporate clients, or other entities. The system doesn't enforce a specific customer model.

### 6. **Audit Trail**
Most models include:
- `createdAt`, `updatedAt` timestamps
- User fields (e.g., `testedBy`, `verifiedBy`, `releasedBy`)
- Status fields for workflow tracking

### 7. **Comprehensive Indexing**
Indexes on:
- Foreign keys (for join performance)
- Status fields (for filtering)
- Date fields (for date-range queries)
- Search fields (names, numbers, codes)

---

## Usage Examples

### Creating a Test Request with Billing

```javascript
// 1. Create order with items
const order = await prisma.order.create({
  data: {
    orderNumber: "ORD-2026-0001",
    customerName: "John Doe",
    customerId: patientId,
    orderType: "lab",
    orderItems: {
      create: [
        {
          inventoryItemId: cbcTestId,
          quantity: 1,
          unitPrice: 50.00,
          totalPrice: 50.00
        }
      ]
    }
  },
  include: { orderItems: true }
});

// 2. Create test request
const testRequest = await prisma.testRequest.create({
  data: {
    requestNumber: "REQ-2026-0001",
    patientId: patientId,
    orderId: order.id,
    priority: "normal",
    testRequestItems: {
      create: order.orderItems.map(item => ({
        orderItemId: item.id
      }))
    }
  }
});

// 3. Collect sample
const sample = await prisma.sample.create({
  data: {
    sampleNumber: "SMP-2026-0001",
    patientId: patientId,
    testRequestId: testRequest.id,
    sampleType: "blood",
    collectionDate: new Date()
  }
});

// 4. Enter results
const labResult = await prisma.labResult.create({
  data: {
    testRequestId: testRequest.id,
    sampleId: sample.id,
    resultType: "structured",
    status: "completed",
    labResultValues: {
      create: [
        {
          labParameterId: hemoglobinParamId,
          numericValue: 14.5,
          value: "14.5",
          isAbnormal: false
        }
      ]
    }
  }
});
```

### Recording a Radiology Result

```javascript
const labResult = await prisma.labResult.create({
  data: {
    testRequestId: testRequest.id,
    resultType: "investigation",
    status: "completed",
    investigationResult: {
      create: {
        investigationType: "radiology",
        title: "Chest X-Ray",
        findings: "Lungs are clear. Heart size normal. No acute findings.",
        impression: "Normal chest radiograph",
        images: JSON.stringify(["/images/xray-001.jpg"])
      }
    }
  }
});
```

---

## Next Steps

### To Initialize Database

```bash
# Create a migration
npx prisma migrate dev --name init_lims_schema

# Generate Prisma Client
npx prisma generate

# Open Prisma Studio to view/edit data
npx prisma studio
```

### Future Enhancements

Consider adding:
- User/staff management models
- Role-based access control
- Equipment/instrument tracking
- Quality control results
- Audit logs
- Document management
- Appointment scheduling
- Insurance claims
- Reference lab integration
- Reporting templates

---

## Schema Statistics

- **Total Models**: 12
- **Clinical Models**: 8
- **Billing Models**: 4
- **Total Indexes**: 60+
- **Primary Key Type**: UUID
- **Timestamp Tracking**: All models

---

This schema provides a robust foundation for a full-featured Laboratory Information Management System with integrated billing and inventory management.
