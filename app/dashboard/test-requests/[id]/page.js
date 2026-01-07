'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TestRequestDetailPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [testRequest, setTestRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [urgency, setUrgency] = useState('');

  useEffect(() => {
    fetchTestRequest();
  }, [resolvedParams.id]);

  const fetchTestRequest = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/test-requests/${resolvedParams.id}`);
      const data = await response.json();

      if (response.ok) {
        setTestRequest(data.testRequest);
        setStatus(data.testRequest.status);
        setNotes(data.testRequest.notes || '');
        setUrgency(data.testRequest.urgency);
      } else {
        setError(data.error || 'Failed to load test request');
      }
    } catch (err) {
      setError('Failed to load test request');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setError('');

    try {
      const response = await fetch(`/api/test-requests/${resolvedParams.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          notes,
          urgency,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestRequest(data.testRequest);
        setEditMode(false);
      } else {
        setError(data.error || 'Failed to update test request');
      }
    } catch (err) {
      setError('Failed to update test request');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this test request?')) {
      return;
    }

    setUpdating(true);
    setError('');

    try {
      const response = await fetch(`/api/test-requests/${params.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/dashboard/test-requests');
      } else {
        setError(data.error || 'Failed to cancel test request');
      }
    } catch (err) {
      setError('Failed to cancel test request');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      SAMPLE_COLLECTED: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-purple-100 text-purple-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getUrgencyBadge = (urgency) => {
    const colors = {
      ROUTINE: 'bg-gray-100 text-gray-800',
      URGENT: 'bg-orange-100 text-orange-800',
      STAT: 'bg-red-100 text-red-800',
    };
    return colors[urgency] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryBadge = (category) => {
    const colors = {
      LAB_TEST: 'bg-blue-100 text-blue-800',
      RADIOLOGY: 'bg-purple-100 text-purple-800',
      PROCEDURE: 'bg-green-100 text-green-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <p className="text-gray-500">Loading test request...</p>
      </div>
    );
  }

  if (error && !testRequest) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
        <Link
          href="/dashboard/test-requests"
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          ← Back to Test Requests
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Link
            href="/dashboard/test-requests"
            className="text-blue-600 hover:underline mb-2 inline-block"
          >
            ← Back to Test Requests
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">Test Request Details</h1>
          <p className="text-gray-600 mt-2">{testRequest.requestNumber}</p>
        </div>
        <div className="flex space-x-3">
          {!editMode && testRequest.status === 'PENDING' && (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Edit
              </button>
              <button
                onClick={handleCancel}
                disabled={updating}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
              >
                Cancel Request
              </button>
            </>
          )}
          {editMode && (
            <>
              <button
                onClick={() => setEditMode(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {updating ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Test Request Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Test Request Information</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Request Number</label>
                  <p className="text-gray-900 font-semibold">{testRequest.requestNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Status</label>
                  {editMode ? (
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="SAMPLE_COLLECTED">Sample Collected</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  ) : (
                    <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(testRequest.status)}`}>
                      {testRequest.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Urgency</label>
                  {editMode ? (
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ROUTINE">Routine</option>
                      <option value="URGENT">Urgent</option>
                      <option value="STAT">STAT</option>
                    </select>
                  ) : (
                    <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${getUrgencyBadge(testRequest.urgency)}`}>
                      {testRequest.urgency}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Created</label>
                  <p className="text-gray-900">{formatDate(testRequest.createdAt)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Investigations</label>
                <div className="space-y-2">
                  {testRequest.testRequestItems && testRequest.testRequestItems.length > 0 ? (
                    testRequest.testRequestItems.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                        <p className="text-gray-900 font-semibold">{item.orderItem.inventoryItem.itemName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-block px-2 py-1 text-xs rounded ${getCategoryBadge(item.orderItem.inventoryItem.category)}`}>
                            {item.orderItem.inventoryItem.category.replace('_', ' ')}
                          </span>
                          <span className="text-sm text-gray-500">{item.orderItem.inventoryItem.itemCode}</span>
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(item.status)}`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 italic">No investigations</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">Notes</label>
                {editMode ? (
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows="3"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Add notes..."
                  />
                ) : (
                  <p className="text-gray-900 mt-1">{testRequest.notes || '-'}</p>
                )}
              </div>

              {testRequest.clinicalNotes && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Clinical Notes</label>
                  <p className="text-gray-900 mt-1">{testRequest.clinicalNotes}</p>
                </div>
              )}

              {testRequest.requestedBy && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Requested By</label>
                  <p className="text-gray-900 mt-1">{testRequest.requestedBy}</p>
                </div>
              )}
            </div>
          </div>

          {/* Linked Order */}
          {testRequest.order && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Linked Billing Order</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Order Number</label>
                    <Link
                      href={`/dashboard/orders/${testRequest.order.id}`}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      {testRequest.order.orderNumber}
                    </Link>
                  </div>
                  <div className="text-right">
                    <label className="block text-sm font-medium text-gray-500">Total</label>
                    <p className="text-lg font-bold text-green-600">
                      ${Number(testRequest.order.totalAmount).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Order Status</label>
                  <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${testRequest.order.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {testRequest.order.status}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Order Created</label>
                  <p className="text-gray-900">{formatDate(testRequest.order.createdAt)}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <Link
                  href={`/dashboard/orders/${testRequest.order.id}`}
                  className="text-blue-600 hover:underline text-sm"
                >
                  View Full Order Details →
                </Link>
              </div>
            </div>
          )}

          {/* Results Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Test Results</h2>
            
            {testRequest.results && testRequest.results.length > 0 ? (
              <div className="space-y-4">
                {testRequest.results.map((result) => (
                  <div key={result.id} className="border border-gray-200 rounded-md p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${result.status === 'VERIFIED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {result.status}
                      </span>
                      <span className="text-sm text-gray-500">{formatDate(result.createdAt)}</span>
                    </div>
                    {/* Results would be displayed here */}
                    <p className="text-sm text-gray-600">Result ID: {result.id}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No results available yet</p>
                {testRequest.status === 'COMPLETED' && (
                  <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Enter Results
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Patient Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Patient Information</h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-500">MRN</label>
                <p className="text-gray-900 font-semibold">{testRequest.patient.patientNumber}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Name</label>
                <Link
                  href={`/dashboard/patients/${testRequest.patient.id}`}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  {testRequest.patient.firstName} {testRequest.patient.lastName}
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Gender</label>
                  <p className="text-gray-900">{testRequest.patient.gender}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Age</label>
                  <p className="text-gray-900">{calculateAge(testRequest.patient.dateOfBirth)} years</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Phone</label>
                <p className="text-gray-900">{testRequest.patient.phone || '-'}</p>
              </div>
              {testRequest.patient.allergies && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <label className="block text-sm font-medium text-red-700">⚠️ Allergies</label>
                  <p className="text-red-900 text-sm mt-1">{testRequest.patient.allergies}</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <Link
                href={`/dashboard/patients/${testRequest.patient.id}/history`}
                className="text-blue-600 hover:underline text-sm"
              >
                View Patient History →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
