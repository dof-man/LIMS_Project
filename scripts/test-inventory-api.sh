#!/bin/bash

# Test script for Inventory CRUD API
# Run this after logging in as admin user

echo "=== Testing Inventory CRUD API ==="
echo ""

# Configuration
BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api"

# Test 1: Login as admin to get session cookie
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

echo "$LOGIN_RESPONSE" | jq '.'
echo ""

# Test 2: Create a new inventory item
echo "2. Creating new inventory item (Complete Blood Count)..."
CREATE_RESPONSE=$(curl -s -b cookies.txt -X POST "$API_URL/inventory" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Complete Blood Count",
    "code": "CBC",
    "category": "LAB_TEST",
    "description": "Full blood panel including RBC, WBC, platelets",
    "price": 45.00,
    "resultMode": "LAB_PARAMETER",
    "requiresSample": true,
    "isActive": true
  }')

echo "$CREATE_RESPONSE" | jq '.'
ITEM_ID=$(echo "$CREATE_RESPONSE" | jq -r '.item.id')
echo "Created item ID: $ITEM_ID"
echo ""

# Test 3: Get all inventory items
echo "3. Fetching all inventory items..."
curl -s -b cookies.txt "$API_URL/inventory" | jq '.'
echo ""

# Test 4: Get single inventory item
echo "4. Fetching single inventory item (ID: $ITEM_ID)..."
curl -s -b cookies.txt "$API_URL/inventory/$ITEM_ID" | jq '.'
echo ""

# Test 5: Update inventory item
echo "5. Updating inventory item..."
UPDATE_RESPONSE=$(curl -s -b cookies.txt -X PUT "$API_URL/inventory/$ITEM_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Complete Blood Count (Updated)",
    "price": 50.00,
    "isActive": true
  }')

echo "$UPDATE_RESPONSE" | jq '.'
echo ""

# Test 6: Search inventory items
echo "6. Searching inventory items (search=blood)..."
curl -s -b cookies.txt "$API_URL/inventory?search=blood" | jq '.'
echo ""

# Test 7: Filter by category
echo "7. Filtering by category (LAB_TEST)..."
curl -s -b cookies.txt "$API_URL/inventory?category=LAB_TEST" | jq '.'
echo ""

# Test 8: Create another item
echo "8. Creating second inventory item (X-Ray Chest)..."
CREATE2_RESPONSE=$(curl -s -b cookies.txt -X POST "$API_URL/inventory" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "X-Ray Chest",
    "code": "XRAY-CHEST",
    "category": "RADIOLOGY",
    "description": "Chest X-ray examination",
    "price": 75.00,
    "resultMode": "FREE_TEXT",
    "requiresSample": false,
    "isActive": true
  }')

echo "$CREATE2_RESPONSE" | jq '.'
echo ""

# Test 9: Get all items again
echo "9. Fetching all inventory items (should have 2)..."
curl -s -b cookies.txt "$API_URL/inventory" | jq '.count, .items[].name'
echo ""

# Test 10: Delete inventory item (cleanup)
echo "10. Deleting inventory item (ID: $ITEM_ID)..."
DELETE_RESPONSE=$(curl -s -b cookies.txt -X DELETE "$API_URL/inventory/$ITEM_ID")
echo "$DELETE_RESPONSE" | jq '.'
echo ""

# Clean up
rm -f cookies.txt

echo "=== All tests completed ==="
