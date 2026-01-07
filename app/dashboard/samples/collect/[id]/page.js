'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CollectSamplePage({ params }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [testRequest, setTestRequest] = useState(null);
  const [itemsRequiringSamples, setItemsRequiringSamples] = useState([]);
  const [existingSamples, setExistingSamples] = useState([]);

  // Form state
  const [selectedItems, setSelectedItems] = useState([]);
  const [sampleType, setSampleType] = useState('');
  const [volume, setVolume] = useState('');
  const [containerType, setContainerType] = useState('');
  const [condition, setCondition] = useState('good');
  const [storageLocation, setStorageLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchSampleCollectionData();
  }, [unwrappedParams.id]);

  const fetchSampleCollectionData = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/test-requests/${unwrappedParams.id}/sample-collection`);
      const data = await response.json();

      if (response.ok) {
        setTestRequest(data.testRequest);
        setItemsRequiringSamples(data.itemsRequiringSamples || []);
        setExistingSamples(data.existingSamples || []);

        // Pre-select pending items
        const pendingItems = (data.itemsRequiringSamples || []).filter(
          item => item.status === 'pending'
        );
        setSelectedItems(pendingItems.map(item => item.id));

        // Set default sample type if available
        if (pendingItems.length > 0 && pendingItems[0].orderItem.inventoryItem.sampleType) {
          setSampleType(pendingItems[0].orderItem.inventoryItem.sampleType);
        }
      } else {
        setError(data.error || 'Failed to load sample collection data');
      }
    } catch (err) {
      setError('Failed to load sample collection data');
    } finally {
      setLoading(false);
    }
  };

  const handleItemToggle = (itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    // Validate
    if (selectedItems.length === 0) {
      setError('Please select at least one test item');
      setSubmitting(false);
      return;
    }

    if (!sampleType) {
      setError('Sample type is required');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/test-requests/${unwrappedParams.id}/sample-collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sampleType,
          volume,
          containerType,
          condition,
          storageLocation,
          notes,
          testRequestItemIds: selectedItems,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Sample collected successfully');
        setTimeout(() => {
          router.push('/dashboard/samples/pending');
        }, 2000);
      } else {
        setError(data.error || 'Failed to collect sample');
      }
    } catch (err) {
      setError('Failed to collect sample');
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      stat: 'bg-red-100 text-red-800',
      urgent: 'bg-orange-100 text-orange-800',
      normal: 'bg-blue-100 text-blue-800',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const calculateAge = (dob) => {
    if (!dob) return '-';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error && !testRequest) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
        <Link
          href="/dashboard/samples/pending"
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          ← Back to Sample Queue
        </Link>
      </div>
    );
  }

  const pendingItems = itemsRequiringSamples.filter(item => item.status === 'pending');

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/dashboard/samples/pending"
          className="text-blue-600 hover:underline mb-2 inline-block"
        >
          ← Back to Sample Queue
        </Link>
        <h1 className="text-3xl font-bold text-gray-800">Collect Sample</h1>
        <p className="text-gray-600 mt-2">Test Request: {testRequest?.requestNumber}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          {pendingItems.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">All samples for this test request have been collected.</p>
                <Link
                  href="/dashboard/samples/pending"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-block"
                >
                  Back to Sample Queue
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Sample Collection Form</h2>

              {/* Items to Collect */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Items for This Sample <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {pendingItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        id={`item-${item.id}`}
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleItemToggle(item.id)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`item-${item.id}`} className="ml-3 flex-1 cursor-pointer">
                        <div className="font-medium text-gray-900">
                          {item.orderItem.inventoryItem.itemName}
                        </div>
                        <div className="text-sm text-gray-600">
                          Code: {item.orderItem.inventoryItem.itemCode}
                        </div>
                        {item.orderItem.inventoryItem.sampleType && (
                          <div className="text-sm text-blue-600 mt-1">
                            Recommended Sample Type: {item.orderItem.inventoryItem.sampleType}
                          </div>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Select all items that will use this sample collection
                </p>
              </div>

              {/* Sample Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sample Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={sampleType}
                  onChange={(e) => setSampleType(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Sample Type --</option>
                  <option value="blood">Blood</option>
                  <option value="serum">Serum</option>
                  <option value="plasma">Plasma</option>
                  <option value="urine">Urine</option>
                  <option value="stool">Stool</option>
                  <option value="sputum">Sputum</option>
                  <option value="csf">CSF (Cerebrospinal Fluid)</option>
                  <option value="tissue">Tissue</option>
                  <option value="swab">Swab</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Volume and Container */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Volume
                  </label>
                  <input
                    type="text"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    placeholder="e.g., 5ml, 10ml"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Container Type
                  </label>
                  <select
                    value={containerType}
                    onChange={(e) => setContainerType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Container --</option>
                    <option value="edta_tube">EDTA Tube (Purple)</option>
                    <option value="serum_tube">Serum Tube (Red)</option>
                    <option value="sodium_citrate">Sodium Citrate (Blue)</option>
                    <option value="fluoride_tube">Fluoride Tube (Gray)</option>
                    <option value="urine_container">Urine Container</option>
                    <option value="sterile_container">Sterile Container</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Condition */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sample Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="good">Good</option>
                  <option value="hemolyzed">Hemolyzed</option>
                  <option value="clotted">Clotted</option>
                  <option value="insufficient">Insufficient Volume</option>
                  <option value="contaminated">Contaminated</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Storage Location */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Storage Location
                </label>
                <input
                  type="text"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="e.g., Refrigerator A, Rack 3, Position 12"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Collection Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="3"
                  placeholder="Any additional notes about the collection..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3">
                <Link
                  href="/dashboard/samples/pending"
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting || selectedItems.length === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                >
                  {submitting ? 'Collecting...' : 'Collect Sample'}
                </button>
              </div>
            </form>
          )}

          {/* Existing Samples */}
          {existingSamples.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Previously Collected Samples</h3>
              <div className="space-y-3">
                {existingSamples.map((sample) => (
                  <div key={sample.id} className="p-4 border border-gray-200 rounded-md bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-gray-900">{sample.sampleNumber}</div>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {sample.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Type: {sample.sampleType}</p>
                      <p>Collected: {formatDate(sample.collectionDate)}</p>
                      {sample.collectedBy && <p>Collected By: {sample.collectedBy}</p>}
                      {sample.condition && <p>Condition: {sample.condition}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Patient Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Patient Information</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Name:</span>
                <p className="font-medium">
                  {testRequest?.patient?.firstName} {testRequest?.patient?.lastName}
                </p>
              </div>
              <div>
                <span className="text-gray-500">MRN:</span>
                <p className="font-medium">{testRequest?.patient?.patientNumber}</p>
              </div>
              <div>
                <span className="text-gray-500">Age/Gender:</span>
                <p>
                  {calculateAge(testRequest?.patient?.dateOfBirth)} years, {testRequest?.patient?.gender}
                </p>
              </div>
              {testRequest?.patient?.allergies && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <span className="text-red-700 font-medium">⚠️ Allergies:</span>
                  <p className="text-red-900 mt-1">{testRequest.patient.allergies}</p>
                </div>
              )}
            </div>
          </div>

          {/* Request Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Request Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Request Number:</span>
                <p className="font-medium">{testRequest?.requestNumber}</p>
              </div>
              <div>
                <span className="text-gray-500">Priority:</span>
                <div className="mt-1">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getPriorityBadge(testRequest?.priority)}`}>
                    {testRequest?.priority?.toUpperCase()}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <p className="font-medium">{testRequest?.status}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
