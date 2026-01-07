'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { canManageInventory } from '@/lib/rbac';

export default function EditInventoryItemPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'LAB_TEST',
    description: '',
    price: '',
    resultMode: 'NONE',
    requiresSample: false,
    isActive: true,
  });

  const categories = [
    { value: 'LAB_TEST', label: 'Lab Test' },
    { value: 'RADIOLOGY', label: 'Radiology' },
    { value: 'CONSULTATION', label: 'Consultation' },
    { value: 'PROCEDURE', label: 'Procedure' },
    { value: 'SUPPLIES', label: 'Supplies' },
    { value: 'OTHER', label: 'Other' },
  ];

  const resultModes = [
    { value: 'LAB_PARAMETER', label: 'Lab Parameter (structured results)' },
    { value: 'FREE_TEXT', label: 'Free Text (narrative results)' },
    { value: 'NONE', label: 'None (no results)' },
  ];

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user && params.id) {
      fetchItem();
    }
  }, [user, params.id]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();

      if (!data.user) {
        router.push('/login');
        return;
      }

      if (!canManageInventory(data.user)) {
        router.push('/dashboard');
        return;
      }

      setUser(data.user);
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchItem = async () => {
    try {
      const response = await fetch(`/api/inventory/${params.id}`);
      const data = await response.json();

      if (data.success) {
        setFormData({
          name: data.item.itemName,
          code: data.item.itemCode,
          category: data.item.category,
          description: data.item.description || '',
          price: data.item.unitPrice.toString(),
          resultMode: data.item.resultMode,
          requiresSample: data.item.requiresSample,
          isActive: data.item.isActive,
        });
      } else {
        setError(data.error || 'Failed to load item');
      }
    } catch (error) {
      console.error('Error fetching item:', error);
      setError('Failed to load item');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Validate
      if (!formData.name || !formData.code || !formData.price) {
        setError('Name, code, and price are required');
        setSubmitting(false);
        return;
      }

      const price = parseFloat(formData.price);
      if (isNaN(price) || price < 0) {
        setError('Price must be a positive number');
        setSubmitting(false);
        return;
      }

      const response = await fetch(`/api/inventory/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          price,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/dashboard/inventory');
      } else {
        setError(data.error || 'Failed to update inventory item');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      setError('Failed to update inventory item');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Edit Inventory Item</h1>
          <p className="text-gray-600 mt-1">Update laboratory test, procedure, or supply details</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          {/* Basic Information */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Complete Blood Count"
                />
              </div>

              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., CBC"
                />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional description of the item..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                  Price ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Clinical Configuration */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Clinical Configuration</h2>

            <div className="mb-4">
              <label htmlFor="resultMode" className="block text-sm font-medium text-gray-700 mb-1">
                Result Mode
              </label>
              <select
                id="resultMode"
                name="resultMode"
                value={formData.resultMode}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {resultModes.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                How results will be recorded for this item
              </p>
            </div>

            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="requiresSample"
                  checked={formData.requiresSample}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Requires Sample Collection
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Check if this item requires a physical sample (blood, urine, etc.)
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">
                Active
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Only active items can be used in new orders
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push('/dashboard/inventory')}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
            >
              {submitting ? 'Updating...' : 'Update Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
