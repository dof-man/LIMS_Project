# Inventory Management Documentation

## Overview

The Inventory Management module allows ADMIN users to create, read, update, and delete inventory items including laboratory tests, procedures, supplies, and other billable items. This is the master catalog that serves as the single source of truth for all billable services in the LIMS system.

## Features

- ✅ Full CRUD operations (Create, Read, Update, Delete)
- ✅ RBAC protection (ADMIN users only)
- ✅ Search and filtering (by name, code, category, status)
- ✅ Multiple categories (Lab Test, Radiology, Consultation, Procedure, Supplies, Other)
- ✅ Result mode configuration (Lab Parameter, Free Text, None)
- ✅ Sample requirement tracking
- ✅ Active/Inactive status management
- ✅ Prevent deletion of items used in orders or test requests

## Database Schema

### InventoryItem Model

```prisma
model InventoryItem {
  id              String   @id @default(uuid())
  name            String
  code            String   @unique
  category        ItemCategory
  description     String?
  price           Decimal  @db.Decimal(10, 2)
  resultMode      ResultMode @default(NONE)
  requiresSample  Boolean  @default(false)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  orderItems         OrderItem[]
  testRequestItems   TestRequestItem[]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Unique identifier |
| `name` | String | Yes | Display name (e.g., "Complete Blood Count") |
| `code` | String | Yes | Unique code (e.g., "CBC") |
| `category` | Enum | Yes | Item category |
| `description` | String | No | Detailed description |
| `price` | Decimal | Yes | Price in dollars |
| `resultMode` | Enum | Yes | How results are recorded |
| `requiresSample` | Boolean | Yes | Whether physical sample needed |
| `isActive` | Boolean | Yes | Whether item is available for new orders |

### Enums

#### ItemCategory
- `LAB_TEST` - Laboratory tests (CBC, Chemistry, etc.)
- `RADIOLOGY` - Imaging procedures (X-Ray, CT, MRI, etc.)
- `CONSULTATION` - Doctor consultations
- `PROCEDURE` - Medical procedures
- `SUPPLIES` - Medical supplies
- `OTHER` - Other billable items

#### ResultMode
- `LAB_PARAMETER` - Structured results with parameters (e.g., lab tests)
- `FREE_TEXT` - Narrative/text results (e.g., radiology reports)
- `NONE` - No results (e.g., consultations, supplies)

## API Endpoints

### 1. List Inventory Items

```http
GET /api/inventory
```

**Authentication:** Required (all authenticated users can view)

**Query Parameters:**
- `search` (optional) - Search by name, code, or description
- `category` (optional) - Filter by category
- `isActive` (optional) - Filter by active status (true/false)

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "id": "uuid",
      "name": "Complete Blood Count",
      "code": "CBC",
      "category": "LAB_TEST",
      "description": "Full blood panel",
      "price": "45.00",
      "resultMode": "LAB_PARAMETER",
      "requiresSample": true,
      "isActive": true,
      "createdAt": "2025-01-04T10:00:00Z",
      "updatedAt": "2025-01-04T10:00:00Z"
    }
  ],
  "count": 1
}
```

**Example:**
```bash
curl -H "Cookie: session_token=xxx" \
  "http://localhost:3000/api/inventory?category=LAB_TEST&search=blood"
```

### 2. Get Single Inventory Item

```http
GET /api/inventory/:id
```

**Authentication:** Required (all authenticated users can view)

**Response:**
```json
{
  "success": true,
  "item": {
    "id": "uuid",
    "name": "Complete Blood Count",
    "code": "CBC",
    "category": "LAB_TEST",
    "description": "Full blood panel",
    "price": "45.00",
    "resultMode": "LAB_PARAMETER",
    "requiresSample": true,
    "isActive": true,
    "_count": {
      "orderItems": 5,
      "testRequestItems": 3
    }
  }
}
```

### 3. Create Inventory Item

```http
POST /api/inventory
```

**Authentication:** ADMIN only

**Request Body:**
```json
{
  "name": "Complete Blood Count",
  "code": "CBC",
  "category": "LAB_TEST",
  "description": "Full blood panel including RBC, WBC, platelets",
  "price": 45.00,
  "resultMode": "LAB_PARAMETER",
  "requiresSample": true,
  "isActive": true
}
```

**Validation:**
- `name` - Required, string
- `code` - Required, unique, string
- `category` - Required, must be valid category
- `price` - Required, must be positive number
- `resultMode` - Optional, must be valid result mode (defaults to NONE)
- `requiresSample` - Optional, boolean (defaults to false)
- `isActive` - Optional, boolean (defaults to true)

**Response:**
```json
{
  "success": true,
  "item": {
    "id": "uuid",
    "name": "Complete Blood Count",
    "code": "CBC",
    ...
  }
}
```

**Error Responses:**
- `400` - Validation error
- `403` - Not authorized (not ADMIN)
- `409` - Code already exists

### 4. Update Inventory Item

```http
PUT /api/inventory/:id
```

**Authentication:** ADMIN only

**Request Body:** (all fields optional, only send what needs updating)
```json
{
  "name": "Complete Blood Count (Updated)",
  "price": 50.00,
  "isActive": false
}
```

**Response:**
```json
{
  "success": true,
  "item": {
    "id": "uuid",
    "name": "Complete Blood Count (Updated)",
    "price": "50.00",
    ...
  }
}
```

**Error Responses:**
- `400` - Validation error
- `403` - Not authorized
- `404` - Item not found
- `409` - Code conflict (if changing code to existing one)

### 5. Delete Inventory Item

```http
DELETE /api/inventory/:id
```

**Authentication:** ADMIN only

**Response:**
```json
{
  "success": true,
  "message": "Inventory item deleted successfully"
}
```

**Error Responses:**
- `403` - Not authorized
- `404` - Item not found
- `409` - Item is used in orders or test requests (cannot delete)

**Safety Check:**
Items that are referenced in `OrderItem` or `TestRequestItem` records cannot be deleted to maintain data integrity.

## User Interface

### Pages

1. **Inventory List** (`/dashboard/inventory`)
   - View all inventory items in a table
   - Search by name, code, or description
   - Filter by category and active status
   - Edit or delete items
   - Navigate to create new item

2. **Create Inventory Item** (`/dashboard/inventory/new`)
   - Form to add new inventory item
   - All fields with validation
   - Category and result mode dropdowns
   - Checkbox for sample requirement and active status

3. **Edit Inventory Item** (`/dashboard/inventory/:id/edit`)
   - Pre-populated form with existing data
   - Update any field
   - Same validation as create

### Access Control

Only users with `canManageInventory()` permission (ADMIN or SUPERUSER) can:
- Access inventory management pages
- Create new inventory items
- Update existing items
- Delete items

All authenticated users with `canViewInventory()` permission can:
- View inventory list via API
- View individual item details via API

## Usage Examples

### Creating a Lab Test

```javascript
// Client-side form submission
const createLabTest = async () => {
  const response = await fetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Liver Function Test',
      code: 'LFT',
      category: 'LAB_TEST',
      description: 'Panel of tests to assess liver function',
      price: 65.00,
      resultMode: 'LAB_PARAMETER',
      requiresSample: true,
      isActive: true
    })
  });
  
  const data = await response.json();
  if (data.success) {
    console.log('Created:', data.item);
  }
};
```

### Creating a Radiology Procedure

```javascript
const createXRay = async () => {
  const response = await fetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Chest X-Ray',
      code: 'XRAY-CHEST',
      category: 'RADIOLOGY',
      description: 'Two-view chest radiograph',
      price: 75.00,
      resultMode: 'FREE_TEXT', // Radiologist will write narrative report
      requiresSample: false,    // No physical sample needed
      isActive: true
    })
  });
  
  const data = await response.json();
  if (data.success) {
    console.log('Created:', data.item);
  }
};
```

### Creating a Consultation

```javascript
const createConsultation = async () => {
  const response = await fetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'General Consultation',
      code: 'CONSULT-GEN',
      category: 'CONSULTATION',
      description: 'General medical consultation',
      price: 100.00,
      resultMode: 'NONE',       // Consultations don't have lab results
      requiresSample: false,
      isActive: true
    })
  });
  
  const data = await response.json();
  if (data.success) {
    console.log('Created:', data.item);
  }
};
```

### Searching Inventory

```javascript
// Search for blood-related tests
const searchTests = async () => {
  const response = await fetch('/api/inventory?search=blood&category=LAB_TEST');
  const data = await response.json();
  
  console.log(`Found ${data.count} items:`, data.items);
};
```

### Filtering Active Items

```javascript
// Get only active lab tests
const getActiveLabTests = async () => {
  const response = await fetch('/api/inventory?category=LAB_TEST&isActive=true');
  const data = await response.json();
  
  return data.items; // Use for dropdown in test request form
};
```

## Integration Points

### Clinical Workflow

While this implementation doesn't connect inventory to clinical workflows yet, the design supports future integration:

1. **Test Requests** - `TestRequestItem` will reference `InventoryItem`
   - When creating a test request, select from active inventory items
   - Links clinical orders to billing items

2. **Lab Results** - Result mode determines result entry method
   - `LAB_PARAMETER`: Use structured result entry with parameters
   - `FREE_TEXT`: Use text editor for narrative reports
   - `NONE`: No result entry needed

3. **Sample Collection** - `requiresSample` flag determines workflow
   - If true: Sample collection step is required
   - If false: Skip directly to result entry or completion

### Billing Integration

Inventory items are the foundation for billing:

1. **Orders** - `OrderItem` references `InventoryItem`
   - Price from inventory item
   - Quantity can vary
   - Total = price × quantity

2. **Payments** - Track which items have been paid for
   - Link payments to orders containing inventory items

## Testing

### Manual Testing

1. **Test with Admin User:**
   ```bash
   # Run the test script
   ./scripts/test-inventory-api.sh
   ```

2. **Test UI:**
   - Login as admin (username: admin, password: admin123)
   - Navigate to Dashboard → Manage Inventory
   - Create a few test items with different categories
   - Test search and filtering
   - Edit an item
   - Try to delete an item

### Test Data

Sample inventory items for testing:

```sql
-- Lab Tests
INSERT INTO "InventoryItem" (id, name, code, category, description, price, "resultMode", "requiresSample", "isActive")
VALUES 
  (gen_random_uuid(), 'Complete Blood Count', 'CBC', 'LAB_TEST', 'Full blood panel', 45.00, 'LAB_PARAMETER', true, true),
  (gen_random_uuid(), 'Lipid Panel', 'LIPID', 'LAB_TEST', 'Cholesterol and triglycerides', 55.00, 'LAB_PARAMETER', true, true),
  (gen_random_uuid(), 'Thyroid Function', 'TSH', 'LAB_TEST', 'TSH, T3, T4 levels', 65.00, 'LAB_PARAMETER', true, true);

-- Radiology
INSERT INTO "InventoryItem" (id, name, code, category, description, price, "resultMode", "requiresSample", "isActive")
VALUES 
  (gen_random_uuid(), 'Chest X-Ray', 'XRAY-CHEST', 'RADIOLOGY', 'Two-view chest radiograph', 75.00, 'FREE_TEXT', false, true),
  (gen_random_uuid(), 'CT Scan Head', 'CT-HEAD', 'RADIOLOGY', 'CT scan of head without contrast', 350.00, 'FREE_TEXT', false, true);

-- Other
INSERT INTO "InventoryItem" (id, name, code, category, description, price, "resultMode", "requiresSample", "isActive")
VALUES 
  (gen_random_uuid(), 'General Consultation', 'CONSULT', 'CONSULTATION', 'General medical consultation', 100.00, 'NONE', false, true);
```

## Troubleshooting

### Common Issues

1. **403 Forbidden when accessing inventory**
   - Ensure user has ADMIN or SUPERUSER role
   - Check session is valid
   - Verify RBAC utilities are working

2. **Cannot delete inventory item**
   - Item may be used in orders or test requests
   - Check `_count` in GET response
   - Consider marking as inactive instead

3. **Code already exists error**
   - Inventory codes must be unique
   - Choose a different code or update existing item

4. **Price validation error**
   - Price must be a positive number
   - Use decimal format (e.g., 45.00, not "45" or "45.00")

## Future Enhancements

- [ ] Bulk import/export via CSV
- [ ] Item templates for quick setup
- [ ] Inventory item groups/panels
- [ ] Price history tracking
- [ ] Multi-currency support
- [ ] Tax configuration per item
- [ ] Insurance code mappings
- [ ] Item usage analytics
- [ ] Low stock alerts (for supplies)
- [ ] Automatic reordering (for supplies)

## Related Documentation

- [RBAC_GUIDE.md](./RBAC_GUIDE.md) - Role-based access control
- [SCHEMA_DOCUMENTATION.md](./SCHEMA_DOCUMENTATION.md) - Database schema
- [AUTHENTICATION.md](./AUTHENTICATION.md) - Authentication system

---

Last Updated: January 4, 2025
