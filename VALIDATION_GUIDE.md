# Lab Result Validation Guide

## Overview

The validation workflow adds a quality control layer where SUPERUSER reviews and validates completed lab results before they become final. Once validated, results are read-only and cannot be modified.

## Key Features

- **SUPERUSER Only**: Only users with SUPERUSER role can validate results
- **Read-Only After Validation**: Validated results cannot be edited or deleted
- **Audit Trail**: Tracks who validated and when
- **Status Progression**: completed → validated

## Database Schema

### LabResult Table Fields

```javascript
{
  id: Int,
  status: String,              // "pending", "completed", "validated"
  testedBy: String,            // Lab staff who entered results
  testedDate: DateTime,        // When results were entered
  validatedBy: String,         // SUPERUSER who validated
  validatedDate: DateTime,     // When results were validated
  // ... other fields
}
```

## API Endpoints

### 1. Validate a Lab Result

**Endpoint**: `POST /api/lab-results/:id/validate`

**Access**: SUPERUSER only

**Description**: Validates a completed lab result, making it read-only.

**Request**:
```bash
POST /api/lab-results/123/validate
```

**Response** (Success):
```json
{
  "message": "Lab result validated successfully",
  "result": {
    "id": 123,
    "status": "validated",
    "validatedBy": "Dr. Smith",
    "validatedDate": "2026-01-04T10:30:00Z",
    "testedBy": "Jane Lab Tech",
    "testedDate": "2026-01-04T09:15:00Z",
    // ... full result data
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Not logged in
- `403 Forbidden`: Not a SUPERUSER
- `404 Not Found`: Result doesn't exist
- `400 Bad Request`: Already validated or not completed

**Example**:
```javascript
const response = await fetch('/api/lab-results/123/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});
const data = await response.json();
```

---

### 2. Get Validation Status

**Endpoint**: `GET /api/lab-results/:id/validate`

**Access**: Authenticated users

**Description**: Retrieves validation status of a lab result.

**Response**:
```json
{
  "isValidated": true,
  "validationInfo": {
    "status": "validated",
    "validatedBy": "Dr. Smith",
    "validatedDate": "2026-01-04T10:30:00Z",
    "testedBy": "Jane Lab Tech",
    "testedDate": "2026-01-04T09:15:00Z"
  }
}
```

---

### 3. Validation Queue

**Endpoint**: `GET /api/lab-results/validation-queue`

**Access**: SUPERUSER only

**Description**: Lists lab results awaiting validation.

**Query Parameters**:
- `status` (default: "completed") - Filter by status
  - `completed` - Results awaiting validation
  - `validated` - Already validated results
  - `all` - All results
- `priority` - Filter by priority (stat, urgent, normal)
- `search` - Search by request number, patient name, or MRN
- `page` (default: 1) - Page number
- `limit` (default: 50) - Results per page

**Response**:
```json
{
  "results": [
    {
      "id": 123,
      "requestNumber": "TR-20260104-0001",
      "requestId": 456,
      "testRequestItemId": 789,
      "patient": {
        "id": 1,
        "mrn": "MRN-20260101-0001",
        "name": "John Doe",
        "age": 35,
        "gender": "Male"
      },
      "test": {
        "id": 10,
        "name": "Complete Blood Count",
        "code": "CBC"
      },
      "sample": {
        "id": 50,
        "sampleNumber": "SAM-20260104-0001",
        "sampleType": "Blood",
        "collectionDate": "2026-01-04T08:00:00Z"
      },
      "priority": "STAT",
      "status": "completed",
      "testedBy": "Jane Lab Tech",
      "testedDate": "2026-01-04T09:15:00Z",
      "abnormalCount": 2,
      "totalValues": 8,
      "hasAbnormalValues": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 15,
    "totalPages": 1
  }
}
```

---

## Workflow

### 1. Lab Staff Enters Results

```
1. Lab staff logs in (LAB_STAFF, ADMIN, or SUPERUSER)
2. Navigates to Results Queue (/dashboard/lab-results/pending)
3. Clicks "Enter Results" on a test item
4. Enters parameter values
5. Saves result → Status becomes "completed"
```

### 2. SUPERUSER Validates Results

```
1. SUPERUSER logs in
2. Navigates to Validation Queue (/dashboard/lab-results/validation-queue)
3. Reviews completed results
4. Clicks "Review & Validate" on a result
5. Reviews all parameter values and abnormal flags
6. Clicks "Validate Result" button
7. Confirms validation
8. Result status changes to "validated"
9. Result becomes read-only
```

### 3. Status Flow

```
pending → completed → validated
          (LAB_STAFF)  (SUPERUSER)
```

---

## Frontend Pages

### 1. Validation Queue Page

**Path**: `/dashboard/lab-results/validation-queue`

**Access**: SUPERUSER only

**Features**:
- Lists results by status (completed, validated, all)
- Filter by priority (STAT, urgent, normal)
- Search by request #, patient name, MRN
- Shows abnormal value count (e.g., "2 / 8" means 2 abnormal out of 8 values)
- "Review & Validate" button for completed results
- "View" link for already validated results
- Pagination for large result sets

**Dashboard Link**: Added to dashboard for SUPERUSER users only

---

### 2. Result Entry Page (Enhanced)

**Path**: `/dashboard/lab-results/enter/:testRequestId/:itemId`

**New Features**:
- **Validation Status Banner**: Shows if result is validated
  - Purple banner with validation info
  - Displays validator name and date
  - "Read-only" notice
- **Read-Only Mode**: All inputs disabled when validated
  - Numeric value inputs
  - Text value inputs
  - General notes
- **Validate Button**: Shows for SUPERUSER on completed results
  - Purple button "Validate Result"
  - Confirmation dialog before validation
  - Only visible if not already validated
- **Conditional Actions**:
  - LAB_STAFF: Can save/update unvalidated results
  - SUPERUSER: Can save/update unvalidated results + validate

---

## Read-Only Enforcement

### API Level Protection

The lab results API prevents editing validated results:

```javascript
// In POST /api/test-requests/:id/items/:itemId/lab-results
const existingResult = await prisma.labResult.findFirst({
  where: { testRequestItemId: itemId }
});

if (existingResult && existingResult.status === 'validated') {
  return NextResponse.json(
    { error: 'Cannot modify validated results. This result has been validated and is read-only.' },
    { status: 403 }
  );
}
```

**Error Response**:
```json
{
  "error": "Cannot modify validated results. This result has been validated and is read-only."
}
```

### Frontend Enforcement

1. **Form Inputs**: Disabled when `isValidated === true`
2. **Save Button**: Hidden for validated results
3. **Visual Indicator**: Purple banner showing validation status
4. **Submit Handler**: Checks validation status before submission

---

## Usage Examples

### Example 1: SUPERUSER Validates a Result

```javascript
// Frontend code
const handleValidate = async () => {
  if (confirm('Are you sure you want to validate this result? Once validated, it cannot be modified.')) {
    try {
      const response = await fetch(`/api/lab-results/${resultId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Result validated successfully');
        setIsValidated(true);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Failed to validate result');
    }
  }
};
```

### Example 2: Check Validation Queue

```bash
# Get completed results awaiting validation
curl -X GET "http://localhost:3000/api/lab-results/validation-queue?status=completed&priority=stat" \
  -H "Cookie: session=..."

# Get all validated results
curl -X GET "http://localhost:3000/api/lab-results/validation-queue?status=validated" \
  -H "Cookie: session=..."
```

### Example 3: Try to Edit Validated Result (Fails)

```bash
curl -X POST "http://localhost:3000/api/test-requests/123/items/456/lab-results" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "resultValues": [...],
    "notes": "Updated notes"
  }'

# Response:
# {
#   "error": "Cannot modify validated results. This result has been validated and is read-only."
# }
```

---

## Security & Permissions

### Role Requirements

| Action | Required Role | Function Check |
|--------|--------------|----------------|
| Enter results | LAB_STAFF, ADMIN, SUPERUSER | `canModifyLabResults()` |
| View results | LAB_STAFF, ADMIN, SUPERUSER | `canModifyLabResults()` |
| Validate results | SUPERUSER only | Direct role check |
| View validation queue | SUPERUSER only | Direct role check |

### Permission Checks

```javascript
// Validation endpoint checks
if (session.user.role !== 'SUPERUSER') {
  return NextResponse.json(
    { error: 'Forbidden. Only SUPERUSER can validate results.' },
    { status: 403 }
  );
}

// Frontend check
{userRole === 'SUPERUSER' && !isValidated && (
  <button onClick={handleValidate}>
    Validate Result
  </button>
)}
```

---

## Best Practices

### 1. Validation Workflow

- **Review Carefully**: SUPERUSER should review all parameter values before validating
- **Check Abnormal Flags**: Pay special attention to L/H/LL/HH flags
- **Verify Reference Ranges**: Ensure values make clinical sense
- **Read Notes**: Check general notes for context
- **Confirm Understanding**: Only validate if you understand all values

### 2. When to Validate

✅ **Validate When**:
- All parameter values are correct
- Abnormal flags are appropriate
- Result quality is acceptable
- Ready for clinical use

❌ **Don't Validate When**:
- Values seem incorrect or suspicious
- Missing critical parameters
- Quality control issues
- Awaiting repeat testing

### 3. Error Prevention

- **Double Check**: Review result twice before validating
- **Use Confirmation Dialog**: Don't skip the "Are you sure?" prompt
- **Communicate Issues**: If result needs correction, notify lab staff before validating
- **Document Concerns**: Use notes field for any observations

### 4. Priority Handling

- **STAT Results**: Validate immediately after review
- **Urgent Results**: Validate within 1 hour
- **Normal Results**: Validate within same day

---

## Troubleshooting

### Issue: Cannot See Validation Queue Link

**Cause**: User is not SUPERUSER

**Solution**: 
- Only SUPERUSER role can access validation queue
- Check user role: `SELECT role FROM users WHERE username = 'youruser';`
- Contact admin to upgrade role if needed

---

### Issue: "Only SUPERUSER can validate results" Error

**Cause**: User doesn't have SUPERUSER role

**Solution**: Log in with SUPERUSER account (e.g., admin/admin123)

---

### Issue: "Result is already validated" Error

**Cause**: Result was already validated by someone else

**Solution**: Result is now read-only. View it but cannot re-validate.

---

### Issue: "Only completed results can be validated" Error

**Cause**: Result status is not "completed"

**Solution**: 
- Lab staff must enter result values first
- Result must be saved before validation
- Check result status in database

---

### Issue: Validation Button Not Showing

**Possible Causes**:
1. User is not SUPERUSER
2. Result is already validated
3. Result is not saved yet (no existingResult)

**Solution**: 
- Check user role
- Check result status
- Save result first if new

---

### Issue: Cannot Edit Result After Validation

**Cause**: This is expected behavior - validated results are read-only

**Solution**: 
- If correction needed, SUPERUSER must invalidate first (future feature)
- Or create new result entry with corrected values
- Contact system admin if urgent correction needed

---

## Integration with Existing Workflow

### Complete LIMS Flow

```
1. Test Request Creation
   ↓
2. Sample Collection (LAB_STAFF)
   ↓
3. Lab Result Entry (LAB_STAFF)
   ↓ Status: completed
4. Result Validation (SUPERUSER) ← NEW
   ↓ Status: validated
5. Result Release (future)
   ↓
6. Report Generation (future)
```

### Dashboard Cards

For SUPERUSER, the Lab Results card now shows two links:
```
Lab Results
Enter and manage lab test results (LAB_STAFF)
[Results Queue →]  [Validation Queue →]
```

For other roles, only Results Queue is visible.

---

## Testing Commands

### 1. Create Test User with SUPERUSER Role

```sql
-- Create SUPERUSER
INSERT INTO users (username, password, role, firstName, lastName, isActive)
VALUES ('validator', '$2a$10$...', 'SUPERUSER', 'Validation', 'User', true);
```

### 2. Check Result Status

```sql
SELECT id, status, testedBy, testedDate, validatedBy, validatedDate
FROM lab_results
WHERE id = 123;
```

### 3. Manually Set Result to Completed

```sql
UPDATE lab_results
SET status = 'completed'
WHERE id = 123;
```

### 4. View Validation Audit Trail

```sql
SELECT 
  lr.id,
  lr.status,
  tr.requestNumber,
  p.firstName || ' ' || p.lastName AS patient,
  lr.testedBy,
  lr.testedDate,
  lr.validatedBy,
  lr.validatedDate
FROM lab_results lr
JOIN test_request_items tri ON lr.testRequestItemId = tri.id
JOIN test_requests tr ON tri.testRequestId = tr.id
JOIN patients p ON tr.patientId = p.id
WHERE lr.status = 'validated'
ORDER BY lr.validatedDate DESC;
```

---

## Future Enhancements

### 1. Invalidation Workflow
- Allow SUPERUSER to "un-validate" results if needed
- Add invalidation reason field
- Track invalidation in audit log

### 2. Electronic Signature
- Require password confirmation for validation
- Digital signature capture
- Regulatory compliance (CLIA, CAP)

### 3. Batch Validation
- Validate multiple results at once
- Select multiple results in queue
- Bulk validation action

### 4. Validation Comments
- Add comments during validation
- Require comments for abnormal results
- Show comments in audit trail

### 5. Notification System
- Notify clinicians when results validated
- Alert lab manager of pending validations
- Email/SMS notifications

---

## Summary

The validation workflow adds a critical quality control step:

- ✅ SUPERUSER-only validation
- ✅ Read-only after validation
- ✅ Complete audit trail
- ✅ Validation queue for review
- ✅ Visual indicators and status banners
- ✅ API-level protection
- ✅ Integration with existing workflow

This ensures lab results are reviewed and approved before clinical use, maintaining data integrity and quality standards.
