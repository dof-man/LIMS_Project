# Lab Result Entry System Guide

## Overview

The Lab Result Entry system provides structured data entry for laboratory test results. Results are organized by **lab parameters** (e.g., WBC, RBC, Hemoglobin) and automatically flag abnormal values based on reference ranges. This system is **restricted to LAB_STAFF** and maintains complete audit trails.

## Key Features

- ✅ **Structured Data Entry**: Results organized by lab parameters
- ✅ **Automatic Flagging**: Abnormal values flagged automatically (L, H, LL, HH)
- ✅ **Reference Ranges**: Display and validate against normal ranges
- ✅ **LAB_STAFF Only**: Restricted access for data integrity
- ✅ **Audit Trail**: Tracks who entered results and when
- ✅ **Multiple Value Types**: Numeric, text, and mixed results
- ✅ **Status Management**: Tracks result completion and verification

## Database Schema

### LabParameter Model
```prisma
model LabParameter {
  id                String   @id @default(uuid())
  code              String   @unique           // e.g., "WBC", "RBC", "HGB"
  name              String                     // e.g., "White Blood Cell Count"
  testCategory      String                     // hematology, biochemistry, etc.
  unit              String?                    // e.g., "x10^9/L", "g/dL"
  referenceRangeMin Float?                     // Minimum normal value
  referenceRangeMax Float?                     // Maximum normal value
  referenceText     String?                    // Text-based reference range
  method            String?                    // Testing method
  isActive          Boolean  @default(true)
  sortOrder         Int?                       // Display order
}
```

### LabResult Model
```prisma
model LabResult {
  id                String    @id @default(uuid())
  testRequestId     String
  testRequestItemId String?
  sampleId          String?
  resultType        String                     // "structured" or "investigation"
  status            String    @default("pending")  // pending, in_progress, completed, verified, released
  testedDate        DateTime?
  testedBy          String?                    // Auto-captured from user
  verifiedDate      DateTime?
  verifiedBy        String?
  releasedDate      DateTime?
  releasedBy        String?
  notes             String?
  
  labResultValues   LabResultValue[]
}
```

### LabResultValue Model
```prisma
model LabResultValue {
  id             String   @id @default(uuid())
  labResultId    String
  labParameterId String
  value          String?                       // General value field
  numericValue   Float?                        // For numeric results
  textValue      String?                       // For text results
  isAbnormal     Boolean  @default(false)      // Auto-calculated
  flag           String?                       // H, L, HH, LL
}
```

## RBAC Permissions

Lab result entry uses:

```javascript
canModifyLabResults(user)
// Returns true for: LAB_STAFF, ADMIN, SUPERUSER
```

**Access Control:**
- ✅ **LAB_STAFF**: Can view queue and enter results
- ✅ **ADMIN**: Can view queue and enter results
- ✅ **SUPERUSER**: Can view queue and enter results
- ❌ **RECEPTION**: Cannot access lab result entry

## API Endpoints

### 1. Get Lab Results Queue
**GET** `/api/lab-results/pending`

List test request items ready for result entry.

Query Parameters:
- `status` (optional): Filter by status (collected, processing, completed, all). Default: "collected"
- `priority` (optional): Filter by priority (normal, urgent, stat)
- `search` (optional): Search by request number, patient name, or MRN
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

Response:
```json
{
  "success": true,
  "testRequestItems": [
    {
      "id": "item-id",
      "status": "collected",
      "testRequest": {
        "id": "tr-id",
        "requestNumber": "TR-20260104-0001",
        "priority": "urgent",
        "patient": {
          "patientNumber": "MRN-20260104-0001",
          "firstName": "John",
          "lastName": "Doe",
          "dateOfBirth": "1980-05-15",
          "gender": "Male"
        },
        "samples": [
          {
            "sampleNumber": "SAM-20260104-0001",
            "sampleType": "blood"
          }
        ]
      },
      "orderItem": {
        "inventoryItem": {
          "itemCode": "CBC",
          "itemName": "Complete Blood Count",
          "category": "lab_test",
          "subCategory": "hematology"
        }
      }
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

### 2. Get Lab Parameters for Test
**GET** `/api/test-requests/:testRequestId/items/:itemId/lab-parameters`

Get lab parameters for a specific test request item.

**Matching Logic:**
1. First tries to match by inventory item's `subCategory` (e.g., "hematology")
2. If no match, tries general `category` mapping
3. Returns empty array if no parameters found

Response:
```json
{
  "success": true,
  "testRequestItem": {
    "id": "item-id",
    "testRequestId": "tr-id",
    "inventoryItem": {
      "itemCode": "CBC",
      "itemName": "Complete Blood Count",
      "category": "lab_test",
      "subCategory": "hematology"
    }
  },
  "parameters": [
    {
      "id": "param-wbc-id",
      "code": "WBC",
      "name": "White Blood Cell Count",
      "testCategory": "hematology",
      "unit": "x10^9/L",
      "referenceRangeMin": 4.0,
      "referenceRangeMax": 11.0,
      "method": "Automated Cell Counter",
      "sortOrder": 1
    },
    {
      "id": "param-rbc-id",
      "code": "RBC",
      "name": "Red Blood Cell Count",
      "testCategory": "hematology",
      "unit": "x10^12/L",
      "referenceRangeMin": 4.5,
      "referenceRangeMax": 6.0,
      "sortOrder": 2
    }
  ],
  "existingResult": null
}
```

### 3. Save Lab Results
**POST** `/api/test-requests/:testRequestId/items/:itemId/lab-results`

Save or update lab results for a test request item.

Request Body:
```json
{
  "resultValues": [
    {
      "labParameterId": "param-wbc-id",
      "numericValue": 12.5,
      "textValue": null
    },
    {
      "labParameterId": "param-rbc-id",
      "numericValue": 4.8,
      "textValue": "Normal morphology"
    }
  ],
  "notes": "Sample processed without issues",
  "status": "completed",
  "sampleId": "sample-id"
}
```

**Required Fields:**
- `resultValues`: Array of result values (at least one)
  - `labParameterId`: ID of the lab parameter
  - At least one of: `numericValue`, `textValue`, or `value`

**Optional Fields:**
- `notes`: General notes about the test
- `status`: Result status (default: "completed")
- `sampleId`: Link to sample record

**Automatic Processing:**
1. Validates all lab parameters exist
2. Calculates `isAbnormal` flag based on reference ranges
3. Sets flag value:
   - **L** (Low): Below reference range
   - **H** (High): Above reference range
   - **LL** (Critically Low): < 50% of minimum
   - **HH** (Critically High): > 200% of maximum
4. Captures `testedBy` from authenticated user
5. Records `testedDate` timestamp
6. Updates test request item status to "completed"
7. Updates test request status to "completed" if all items done

Response:
```json
{
  "success": true,
  "message": "Lab results saved successfully",
  "labResult": {
    "id": "result-id",
    "status": "completed",
    "testedDate": "2026-01-04T14:30:00Z",
    "testedBy": "Jane Smith",
    "labResultValues": [
      {
        "id": "value-id",
        "labParameter": {
          "code": "WBC",
          "name": "White Blood Cell Count",
          "unit": "x10^9/L",
          "referenceRangeMin": 4.0,
          "referenceRangeMax": 11.0
        },
        "numericValue": 12.5,
        "isAbnormal": true,
        "flag": "H"
      }
    ]
  },
  "testedBy": "Jane Smith",
  "testedDate": "2026-01-04T14:30:00Z"
}
```

### 4. Get Lab Result
**GET** `/api/test-requests/:testRequestId/items/:itemId/lab-results`

Retrieve existing lab result for a test request item.

Response:
```json
{
  "success": true,
  "labResult": {
    "id": "result-id",
    "status": "completed",
    "testedDate": "2026-01-04T14:30:00Z",
    "testedBy": "Jane Smith",
    "notes": "Sample processed without issues",
    "testRequest": {
      "requestNumber": "TR-20260104-0001"
    },
    "testRequestItem": {
      "orderItem": {
        "inventoryItem": {
          "itemCode": "CBC",
          "itemName": "Complete Blood Count"
        }
      }
    },
    "labResultValues": [...],
    "sample": {
      "sampleNumber": "SAM-20260104-0001",
      "sampleType": "blood"
    }
  }
}
```

## Frontend Pages

### 1. Lab Results Queue (`/dashboard/lab-results/pending`)

**Features:**
- Lists test request items ready for result entry
- Default filter: Status = "collected" (samples collected, ready for processing)
- Additional filters: Status, Priority, Search
- Shows patient demographics and test details
- Sample information display
- Priority badges (STAT, Urgent, Normal)
- Quick "Enter Results" button
- View existing results link

**Access:** LAB_STAFF only

### 2. Lab Result Entry Form (`/dashboard/lab-results/enter/:testRequestId/:itemId`)

**Features:**
- Loads lab parameters for the test
- For each parameter:
  - Parameter name and code
  - Unit of measurement
  - Reference range display
  - Numeric value input
  - Text value/comments input
  - Method information (if available)
  - **Real-time abnormal flagging** (changes color as you type)
- Status indicators:
  - ✓ Normal (green)
  - L - Low (orange)
  - H - High (orange)
  - LL - Critically Low (red, bold)
  - HH - Critically High (red, bold)
- General notes field
- Edit existing results (pre-fills form)

**Access:** LAB_STAFF only

## Abnormal Value Flagging

### Automatic Calculation
The system automatically determines if a value is abnormal:

```javascript
// Low values
if (numericValue < referenceRangeMin) {
  isAbnormal = true;
  flag = numericValue < (referenceRangeMin * 0.5) ? 'LL' : 'L';
}

// High values
if (numericValue > referenceRangeMax) {
  isAbnormal = true;
  flag = numericValue > (referenceRangeMax * 2) ? 'HH' : 'H';
}
```

### Flag Meanings
- **Normal**: Value within reference range
- **L (Low)**: Below minimum reference range
- **H (High)**: Above maximum reference range
- **LL (Critically Low)**: Less than 50% of minimum
- **HH (Critically High)**: More than 200% of maximum

### Example
```
WBC Reference Range: 4.0 - 11.0 x10^9/L

Value: 3.8  → L (Low)
Value: 1.5  → LL (Critically Low, < 2.0)
Value: 6.5  → Normal
Value: 12.5 → H (High)
Value: 25.0 → HH (Critically High, > 22.0)
```

## Lab Parameter Configuration

### Test Categories
Common categories:
- **hematology**: Blood cell counts (CBC)
- **biochemistry**: Blood chemistry (glucose, electrolytes)
- **immunology**: Immune markers
- **microbiology**: Cultures, sensitivities
- **coagulation**: Clotting studies
- **urinalysis**: Urine tests

### Matching Inventory to Parameters
Parameters are loaded based on:
1. **SubCategory match**: If inventory item has `subCategory = "hematology"`, loads all parameters where `testCategory = "hematology"`
2. **Category mapping**: Falls back to general category if needed

### Creating Lab Parameters
Lab parameters should be created in advance:

```sql
INSERT INTO lab_parameters (
  code, name, test_category, unit,
  reference_range_min, reference_range_max,
  is_active, sort_order
) VALUES
  ('WBC', 'White Blood Cell Count', 'hematology', 'x10^9/L', 4.0, 11.0, true, 1),
  ('RBC', 'Red Blood Cell Count', 'hematology', 'x10^12/L', 4.5, 6.0, true, 2),
  ('HGB', 'Hemoglobin', 'hematology', 'g/dL', 13.0, 17.0, true, 3),
  ('HCT', 'Hematocrit', 'hematology', '%', 40.0, 50.0, true, 4);
```

## Workflow Examples

### Example 1: Entering CBC Results

```javascript
// 1. Lab staff views results queue
GET /api/lab-results/pending?status=collected

// 2. Selects CBC test to enter results
// System loads parameters
GET /api/test-requests/tr-123/items/item-456/lab-parameters

// Response includes WBC, RBC, HGB, HCT parameters

// 3. Lab staff enters values:
// WBC: 12.5 (HIGH - shows orange flag)
// RBC: 4.8 (Normal)
// HGB: 15.2 (Normal)
// HCT: 45.0 (Normal)

// 4. Saves results
POST /api/test-requests/tr-123/items/item-456/lab-results
{
  "resultValues": [
    { "labParameterId": "wbc-id", "numericValue": 12.5 },
    { "labParameterId": "rbc-id", "numericValue": 4.8 },
    { "labParameterId": "hgb-id", "numericValue": 15.2 },
    { "labParameterId": "hct-id", "numericValue": 45.0 }
  ],
  "notes": "Sample processed on automated analyzer"
}

// System automatically:
// - Flags WBC as abnormal (H)
// - Records testedBy = "Jane Smith"
// - Records testedDate = current timestamp
// - Updates item status to "completed"
```

### Example 2: Mixed Numeric and Text Results

```javascript
POST /api/test-requests/tr-456/items/item-789/lab-results
{
  "resultValues": [
    {
      "labParameterId": "glucose-id",
      "numericValue": 95.0,
      "textValue": "Fasting sample"
    },
    {
      "labParameterId": "appearance-id",
      "textValue": "Clear, yellow"
    },
    {
      "labParameterId": "bacteria-id",
      "textValue": "None seen"
    }
  ],
  "notes": "Urinalysis completed"
}
```

### Example 3: Editing Existing Results

```javascript
// 1. Load existing results
GET /api/test-requests/tr-123/items/item-456/lab-results

// Form pre-fills with existing values

// 2. User updates values
POST /api/test-requests/tr-123/items/item-456/lab-results
{
  "resultValues": [
    { "labParameterId": "wbc-id", "numericValue": 11.8 },  // Updated
    { "labParameterId": "rbc-id", "numericValue": 4.8 },   // Same
    { "labParameterId": "hgb-id", "numericValue": 15.5 },  // Updated
    { "labParameterId": "hct-id", "numericValue": 45.0 }   // Same
  ],
  "notes": "Repeat test - corrected values"
}

// Old values are deleted, new values saved
```

## Status Flow

### Test Request Item Status
```
pending → collected → processing → completed
```

### Lab Result Status
```
pending → in_progress → completed → verified → released
```

Currently implemented: **completed** status when saving results.

Future: Add verification and release workflows.

## Integration with Other Systems

### Sample Collection
- Lab results queue shows items with status "collected"
- Links to sample records
- Displays sample type and collection info

### Test Requests
- Results automatically update test request item status
- When all items completed, test request status → "completed"

### Audit Trail
Every result entry records:
```javascript
{
  "testedBy": "Jane Smith",      // From authenticated user
  "testedDate": "2026-01-04T14:30:00Z",
  "createdAt": "2026-01-04T14:30:00Z",
  "updatedAt": "2026-01-04T14:30:00Z"
}
```

## Best Practices

### 1. Parameter Organization
- Use consistent `testCategory` names
- Set `sortOrder` for logical display order
- Keep parameter codes short and standard (e.g., "WBC" not "White_Blood_Cell_Count")

### 2. Reference Ranges
- Always provide reference ranges for numeric parameters
- Use `referenceText` for non-numeric ranges (e.g., "Negative", "Positive")
- Adjust ranges for age/gender if needed

### 3. Data Entry
- Enter numeric values when possible (enables automatic flagging)
- Use text fields for qualitative results
- Add comments for abnormal values
- Review flags before saving

### 4. Quality Control
- Double-check critically abnormal values (LL, HH)
- Verify units match reference ranges
- Add notes for unusual findings

## Troubleshooting

### Issue 1: "No parameters found"
**Cause**: No lab parameters match the test's category/subcategory  
**Solution**: 
1. Check inventory item's `subCategory` field
2. Ensure lab parameters exist with matching `testCategory`
3. Add missing parameters to database

### Issue 2: Values not flagging as abnormal
**Cause**: Reference ranges not set on lab parameters  
**Solution**: Update lab parameters with `referenceRangeMin` and `referenceRangeMax`

### Issue 3: Wrong parameters loading
**Cause**: Test category mismatch  
**Solution**: Update inventory item's `subCategory` to match parameter `testCategory`

### Issue 4: Cannot save results
**Cause**: Missing required fields  
**Solution**: Ensure at least one result value has `numericValue` or `textValue`

## Testing

```bash
# Get results queue
curl http://localhost:3000/api/lab-results/pending?status=collected

# Get lab parameters for a test
curl http://localhost:3000/api/test-requests/tr-id/items/item-id/lab-parameters

# Save lab results
curl -X POST http://localhost:3000/api/test-requests/tr-id/items/item-id/lab-results \
  -H "Content-Type: application/json" \
  -d '{
    "resultValues": [
      {
        "labParameterId": "param-id",
        "numericValue": 12.5,
        "textValue": "Normal morphology"
      }
    ],
    "notes": "Sample processed"
  }'
```

## Related Documentation

- [RBAC Guide](./RBAC_GUIDE.md) - User permissions
- [Sample Collection Guide](./SAMPLE_COLLECTION_GUIDE.md) - Sample workflow before result entry
- [Test Requests Guide](./TEST_REQUESTS_GUIDE.md) - Creating test requests
