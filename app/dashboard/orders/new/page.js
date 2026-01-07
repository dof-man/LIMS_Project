'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BackToDashboard from '../../components/BackToDashboard';

export default function NewOrderPage() {
  const [patients, setPatients] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [formData, setFormData] = useState({
    patientId: '',
    notes: '',
    items: [],
  });

  const [currentItem, setCurrentItem] = useState({
    inventoryItemId: '',
    quantity: 1,
    unitPrice: '',
  });

  useEffect(() => {
    fetchPatients();
    fetchInventoryItems();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await fetch('/api/patients');
      const data = await res.json();
      if (res.ok) {
        setPatients(data.patients || []);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const res = await fetch('/api/inventory?status=ACTIVE');
      const data = await res.json();
      if (res.ok) {
        setInventoryItems(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching inventory items:', err);
    }
  };

  const handleInventoryItemChange = (itemId) => {
    const item = inventoryItems.find((i) => i.id === itemId);
    if (item) {
      setCurrentItem({
        inventoryItemId: itemId,
        quantity: 1,
        unitPrice: Number(item.unitPrice),
      });
    }
  };

  const addItemToOrder = () => {
    if (!currentItem.inventoryItemId) {
      alert('Please select an inventory item');
      return;
    }

    if (currentItem.quantity < 1) {
      alert('Quantity must be at least 1');
      return;
    }

    // Check if item already added
    const exists = formData.items.some(
      (item) => item.inventoryItemId === currentItem.inventoryItemId
    );

    if (exists) {
      alert('This item has already been added to the order');
      return;
    }

    const item = inventoryItems.find((i) => i.id === currentItem.inventoryItemId);
    const lineTotal = currentItem.quantity * currentItem.unitPrice;

    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          ...currentItem,
          itemName: item.itemName,
          itemCode: item.itemCode,
          lineTotal,
        },
      ],
    });

    // Reset current item
    setCurrentItem({
      inventoryItemId: '',
      quantity: 1,
      unitPrice: '',
    });
  };

  const removeItemFromOrder = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      items: newItems,
    });
  };

  const calculateOrderTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.lineTotal, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.patientId) {
      setError('Please select a patient');
      return;
    }

    if (formData.items.length === 0) {
      setError('Please add at least one item to the order');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        patientId: formData.patientId,
        notes: formData.notes,
        items: formData.items.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      alert(`Order ${data.order.orderNumber} created successfully!`);
      router.push(`/dashboard/orders/${data.order.id}`);
    } catch (err) {
      console.error('Error creating order:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Create New Order</h1>
        <Link
          href="/dashboard/orders"
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Back to Orders
        </Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        {/* Patient Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Patient <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.patientId}
            onChange={(e) =>
              setFormData({ ...formData, patientId: e.target.value })
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          >
            <option value="">Select a patient</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.firstName} {patient.lastName} - MRN: {patient.patientNumber}
              </option>
            ))}
          </select>
        </div>

        {/* Order Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Order Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            placeholder="Optional notes about this order"
          />
        </div>

        {/* Add Items Section */}
        <div className="mb-6 border-t pt-6">
          <h2 className="text-xl font-semibold mb-4">Add Order Items</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Inventory Item
              </label>
              <select
                value={currentItem.inventoryItemId}
                onChange={(e) => handleInventoryItemChange(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Select an item</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemName} - {item.itemCode} ({formatCurrency(item.unitPrice)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={currentItem.quantity}
                onChange={(e) =>
                  setCurrentItem({
                    ...currentItem,
                    quantity: parseInt(e.target.value) || 1,
                  })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit Price
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={currentItem.unitPrice}
                onChange={(e) =>
                  setCurrentItem({
                    ...currentItem,
                    unitPrice: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={addItemToOrder}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Add Item to Order
          </button>
        </div>

        {/* Order Items Table */}
        {formData.items.length > 0 && (
          <div className="mb-6 border-t pt-6">
            <h2 className="text-xl font-semibold mb-4">Order Items</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Code
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Unit Price
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Line Total
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formData.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.itemName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.itemCode}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(item.lineTotal)}
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <button
                          type="button"
                          onClick={() => removeItemFromOrder(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td
                      colSpan="4"
                      className="px-6 py-4 text-sm font-bold text-gray-900 text-right"
                    >
                      Order Total:
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                      {formatCurrency(calculateOrderTotal())}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Link
            href="/dashboard/orders"
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {loading ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
