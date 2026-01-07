# Sample Collection Workflow Guide

## Overview

The Sample Collection workflow manages the collection of biological samples (blood, urine, tissue, etc.) required for laboratory tests. This workflow is **restricted to LAB_STAFF** and tracks who collected each sample and when.

## Key Features

- ✅ **Restricted Access**: Only LAB_STAFF can collect samples
- ✅ **Smart Filtering**: Only shows tests that require samples (`requiresSample = true`)
- ✅ **Automated Tracking**: Records `collected_by` and `collected_at` timestamps
- ✅ **Status Updates**: Automatically updates test request status when samples are collected
- ✅ **Sample Numbering**: Generates unique sample numbers (SAM-YYYYMMDD-XXXX)
- ✅ **Patient Safety**: Displays allergy alerts during collection

## Database Schema

### Sample Model
```prisma
model Sample {
  id              String    @id @default(uuid())
  sampleNumber    String    @unique          // Auto-generated: SAM-YYYYMMDD-XXXX
  patientId       String
  testRequestId   String
  sampleType      String                     // blood, urine, stool, tissue, etc.
  collectionDate  DateTime  @default(now())
  collectionTime  DateTime?
  collectedBy     String?                    // Tracked automatically
  volume          String?
  containerType   String?
  status          String    @default("collected")
  condition       String?                    // good, hemolyzed, clotted, etc.
  storageLocation String?
  notes           String?   @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### InventoryItem Fields
```prisma
requiresSample Boolean  @default(false)   // Whether this test needs a sample
sampleType     String?                    // Recommended sample type
```

### TestRequestItem Status Flow
```
pending → collected → processing → completed
```

## RBAC Permissions

Sample collection uses the following permission:

```javascript
canModifyLabResults(user)
// Returns true for: LAB_STAFF, ADMIN, SUPERUSER
```

**Access Control:**
- ✅ **LAB_STAFF**: Can view queue and collect samples
- ✅ **ADMIN**: Can view queue and collect samples
- ✅ **SUPERUSER**: Can view queue and collect samples
- ❌ **RECEPTION**: Cannot access sample collection

## API Endpoints

### 1. Get Pending Sample Collections
**GET** `/api/samples/pending`

List all test requests with pending sample collections.

Query Parameters:
- `priority` (optional): Filter by priority (normal, urgent, stat)
- `search` (optional): Search by request number, patient name, or MRN
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

Response:
```json
{
  "success": true,
  "pendingTestRequests": [
    {
      "testRequest": {
        "id": "...",
        "requestNumber": "TR-20260104-0001",
        "status": "pending",
        "priority": "urgent",
        "requestDate": "2026-01-04T10:00:00Z",
        "patient": {
          "id": "...",
          "patientNumber": "MRN-20260104-0001",
          "firstName": "John",
          "lastName": "Doe",
          "dateOfBirth": "1980-05-15",
          "gender": "Male"
        }
      },
      "pendingItems": [
        {
          "id": "item-id",
          "inventoryItem": {
            "itemCode": "CBC",
            "itemName": "Complete Blood Count",
            "sampleType": "blood",
            "requiresSample": true
          },
          "status": "pending"
        }
      ]
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

### 2. Get Sample Collection Details
**GET** `/api/test-requests/:id/sample-collection`

Get detailed information for collecting samples for a specific test request.

Response:
```json
{
  "success": true,
  "testRequest": {
    "id": "...",
    "requestNumber": "TR-20260104-0001",
    "status": "pending",
    "priority": "urgent",
    "patient": {
      "id": "...",
      "patientNumber": "MRN-20260104-0001",
      "firstName": "John",
      "lastName": "Doe",
      "allergies": "Penicillin"
    }
  },
  "itemsRequiringSamples": [
    {
      "id": "item-id",
      "status": "pending",
      "orderItem": {
        "inventoryItem": {
          "itemName": "Complete Blood Count",
          "sampleType": "blood",
          "requiresSample": true
        }
      }
    }
  ],
  "existingSamples": [],
  "summary": {
    "totalItems": 3,
    "itemsRequiringSamples": 2,
    "samplesCollected": 0
  }
}
```

### 3. Collect Sample
**POST** `/api/test-requests/:id/sample-collection`

Collect a sample for one or more test request items.

Request Body:
```json
{
  "sampleType": "blood",
  "volume": "5ml",
  "containerType": "edta_tube",
  "condition": "good",
  "storageLocation": "Refrigerator A, Rack 3",
  "notes": "Sample collected without issues",
  "testRequestItemIds": ["item-id-1", "item-id-2"]
}
```

**Required Fields:**
- `sampleType`: Type of sample (blood, urine, stool, etc.)
- `testRequestItemIds`: Array of test request item IDs (must require samples)

**Optional Fields:**
- `volume`: Sample volume (e.g., "5ml", "10ml")
- `containerType`: Type of container used
- `condition`: Sample condition (default: "good")
- `storageLocation`: Where sample is stored
- `notes`: Additional collection notes

**Validation:**
- All selected items must exist in the test request
- All selected items must have `requiresSample = true`
- Sample type is required

**What Happens:**
1. Validates selected items require samples
2. Generates unique sample number (SAM-YYYYMMDD-XXXX)
3. Captures `collectedBy` from authenticated user
4. Records `collectionDate` and `collectionTime`
5. Creates sample record
6. Updates test request items to "collected" status
7. Auto-updates test request status to "in_progress" if all samples collected

Response:
```json
{
  "success": true,
  "message": "Sample collected successfully",
  "sample": {
    "id": "...",
    "sampleNumber": "SAM-20260104-0001",
    "sampleType": "blood",
    "collectionDate": "2026-01-04T11:30:00Z",
    "collectedBy": "Jane Smith",
    "status": "collected"
  },
  "collectedBy": "Jane Smith",
  "collectionTime": "2026-01-04T11:30:00Z"
}
```

## Frontend Pages

### 1. Sample Collection Queue (`/dashboard/samples/pending`)

**Features:**
- Lists all test requests with pending sample collections
- Filter by priority (STAT, Urgent, Normal)
- Search by request number, patient name, or MRN
- Shows patient demographics
- Displays pending items for each request
- Quick "Collect Sample" button
- Priority badges (color-coded)

**Access:** LAB_STAFF only

### 2. Sample Collection Form (`/dashboard/samples/collect/:id`)

**Features:**
- Patient information sidebar with allergy alerts
- Test request details (number, priority, status)
- Checkboxes to select which items use this sample
- Sample type dropdown (blood, urine, stool, etc.)
- Volume input (e.g., "5ml")
- Container type selection (EDTA tube, serum tube, etc.)
- Sample condition (good, hemolyzed, clotted, insufficient)
- Storage location tracking
- Collection notes
- Shows previously collected samples
- Auto-fills recommended sample type from inventory

**Access:** LAB_STAFF only

## Sample Types

### Common Sample Types
- **blood**: Whole blood
- **serum**: Blood serum
- **plasma**: Blood plasma
- **urine**: Urine specimen
- **stool**: Stool specimen
- **sputum**: Respiratory sample
- **csf**: Cerebrospinal fluid
- **tissue**: Tissue biopsy
- **swab**: Swab samples (throat, nasal, etc.)
- **other**: Other sample types

### Container Types
- **edta_tube**: EDTA Tube (Purple) - for CBC
- **serum_tube**: Serum Tube (Red) - for chemistry
- **sodium_citrate**: Sodium Citrate (Blue) - for coagulation
- **fluoride_tube**: Fluoride Tube (Gray) - for glucose
- **urine_container**: Urine Container
- **sterile_container**: Sterile Container
- **other**: Other containers

### Sample Conditions
- **good**: Sample in good condition
- **hemolyzed**: Blood sample with hemolysis
- **clotted**: Sample has clotted
- **insufficient**: Insufficient sample volume
- **contaminated**: Sample contaminated
- **other**: Other conditions

## Workflow Examples

### Example 1: Collecting Blood Sample for CBC

```javascript
// 1. Lab staff views pending queue
GET /api/samples/pending

// 2. Select test request to collect
GET /api/test-requests/tr-123/sample-collection

// 3. Collect blood sample
POST /api/test-requests/tr-123/sample-collection
{
  "sampleType": "blood",
  "volume": "5ml",
  "containerType": "edta_tube",
  "condition": "good",
  "storageLocation": "Refrigerator A, Rack 2, Position 5",
  "notes": "Collected via venipuncture from left arm",
  "testRequestItemIds": ["item-cbc-id"]
}

// Response includes:
// - Sample Number: SAM-20260104-0001
// - Collected By: John Smith (from session)
// - Collection Time: 2026-01-04T11:30:00Z
// - Test request item status updated to "collected"
```

### Example 2: Multiple Tests Using Same Sample

```javascript
// Collect one blood sample for multiple tests (CBC + Chemistry)
POST /api/test-requests/tr-456/sample-collection
{
  "sampleType": "blood",
  "volume": "10ml",
  "containerType": "serum_tube",
  "condition": "good",
  "storageLocation": "Refrigerator B, Rack 1",
  "testRequestItemIds": [
    "item-cbc-id",
    "item-chemistry-id",
    "item-lipid-id"
  ]
}

// One sample record created
// All three test request items marked as "collected"
```

### Example 3: Urgent/STAT Sample Collection

```javascript
// STAT test request - priority collection
GET /api/samples/pending?priority=stat

// Collect with urgent notes
POST /api/test-requests/tr-789/sample-collection
{
  "sampleType": "blood",
  "volume": "5ml",
  "containerType": "edta_tube",
  "condition": "good",
  "notes": "STAT - Patient in ER, critical condition",
  "testRequestItemIds": ["item-stat-id"]
}
```

## Status Flow

### Test Request Status Updates

```
Test Request Created (status: "pending")
         ↓
All Required Samples Collected
         ↓
Test Request Status → "in_progress"
         ↓
Lab Processing
         ↓
Test Request Status → "completed"
```

### Test Request Item Status

```
pending → collected → processing → completed
```

When a sample is collected:
- Item status changes from "pending" to "collected"
- If all items requiring samples are collected, test request status changes to "in_progress"

## Integration with Other Systems

### Test Request System
Sample collection is tightly integrated with test requests:
- Only items with `requiresSample = true` appear in collection queue
- Collection automatically updates test request item status
- Test request status auto-updates when all samples collected

### Inventory System
Sample types and requirements are defined in inventory items:
```javascript
{
  "itemName": "Complete Blood Count",
  "requiresSample": true,
  "sampleType": "blood"  // Recommended sample type
}
```

## Best Practices

### 1. Patient Safety
- **Always check allergies** before collection
- Display allergy alerts prominently
- Verify patient identity (MRN, name, DOB)

### 2. Sample Quality
- Use appropriate container type for test
- Record actual volume collected
- Note any quality issues (hemolysis, clotting)
- Store samples properly (refrigeration if needed)

### 3. Priority Handling
- **STAT**: Process immediately (critical patients)
- **Urgent**: Within 4 hours
- **Normal**: Regular workflow

### 4. Documentation
- Always include collection notes
- Record exact storage location
- Note any difficulties during collection
- Document volume if insufficient

### 5. Multiple Tests
- When possible, collect one sample for multiple tests
- Check compatibility of tests with sample type
- Ensure sufficient volume for all tests

## Troubleshooting

### Issue 1: "Only LAB_STAFF can collect samples"
**Cause**: User role is not LAB_STAFF, ADMIN, or SUPERUSER  
**Solution**: Contact admin to update user role

### Issue 2: "Some selected items do not require samples"
**Cause**: Trying to collect samples for items where `requiresSample = false`  
**Solution**: Only select items that actually need samples (filtered automatically in UI)

### Issue 3: Test request not appearing in queue
**Cause**: All samples already collected OR no items require samples  
**Solution**: Check test request detail page for current status

### Issue 4: Cannot find storage location
**Cause**: Not entered during collection  
**Solution**: Storage location is optional but recommended for sample tracking

## Security & Audit Trail

### Automatic Tracking
Every sample collection records:
- **Who**: `collectedBy` field captures user's name
- **When**: `collectionDate` and `collectionTime` capture exact time
- **What**: Full sample details (type, volume, condition)
- **Where**: Storage location for retrieval

### Audit Information
```javascript
{
  "sampleNumber": "SAM-20260104-0001",
  "collectedBy": "Jane Smith",  // From authenticated user
  "collectionDate": "2026-01-04T11:30:00Z",
  "collectionTime": "2026-01-04T11:30:00Z",
  "createdAt": "2026-01-04T11:30:00Z",
  "updatedAt": "2026-01-04T11:30:00Z"
}
```

## Testing

```bash
# View pending samples (requires LAB_STAFF role)
curl http://localhost:3000/api/samples/pending

# Get collection details for a test request
curl http://localhost:3000/api/test-requests/tr-id/sample-collection

# Collect a sample
curl -X POST http://localhost:3000/api/test-requests/tr-id/sample-collection \
  -H "Content-Type: application/json" \
  -d '{
    "sampleType": "blood",
    "volume": "5ml",
    "containerType": "edta_tube",
    "condition": "good",
    "storageLocation": "Refrigerator A",
    "testRequestItemIds": ["item-id"]
  }'
```

## Related Documentation

- [RBAC Guide](./RBAC_GUIDE.md) - User permissions and roles
- [Test Requests Guide](./TEST_REQUESTS_GUIDE.md) - Creating and managing test requests
- [Inventory Guide](./INVENTORY_GUIDE.md) - Configuring test requirements
