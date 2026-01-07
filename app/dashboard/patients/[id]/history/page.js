'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function PatientHistoryPage() {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const params = useParams();
  const patientId = params.id;

  useEffect(() => {
    if (patientId) {
      fetchHistory();
    }
  }, [patientId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/patients/${patientId}/history`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch patient history');
      }

      setHistory(data.history);
      setError('');
    } catch (err) {
      console.error('Error fetching patient history:', err);
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
      SAMPLE_COLLECTED: 'bg-purple-100 text-purple-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Loading patient history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <Link href="/dashboard/patients" className="text-blue-600 hover:text-blue-800">
          ← Back to Patients
        </Link>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8 text-gray-500">No history found</div>
      </div>
    );
  }

  const { patient, orders, testRequests, statistics } = history;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Patient History</h1>
          <p className="text-gray-600 mt-2">
            {patient.firstName} {patient.lastName} - MRN: {patient.patientNumber}
          </p>
        </div>
        <Link
          href={`/dashboard/patients/${patientId}`}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Back to Patient
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Total Orders</p>
          <p className="text-3xl font-bold text-blue-700">{statistics.orders.total}</p>
          <p className="text-xs text-gray-500 mt-1">
            {statistics.orders.completed} completed
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Test Requests</p>
          <p className="text-3xl font-bold text-green-700">{statistics.testRequests.total}</p>
          <p className="text-xs text-gray-500 mt-1">
            {statistics.testRequests.completed} completed
          </p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Total Spent</p>
          <p className="text-2xl font-bold text-purple-700">
            {formatCurrency(statistics.financial.totalSpent)}
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Outstanding Balance</p>
          <p className="text-2xl font-bold text-yellow-700">
            {formatCurrency(statistics.financial.outstandingBalance)}
          </p>
        </div>
      </div>

      {/* Patient Alerts */}
      {patient.allergies && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">⚠️ Known Allergies</h3>
          <p className="text-red-700 whitespace-pre-wrap">{patient.allergies}</p>
        </div>
      )}

      {/* Orders History */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Orders History ({orders.length})</h2>
        {orders.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No orders found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => {
                  const totalPaid = order.payments.reduce(
                    (sum, p) => sum + (p.status === 'COMPLETED' ? Number(p.amount) : 0),
                    0
                  );
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {order.orderItems.length} item(s)
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">
                        {formatCurrency(totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Test Requests History */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Test Requests History ({testRequests.length})</h2>
        {testRequests.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No test requests found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {testRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(request.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {request.testRequestItems && request.testRequestItems.length > 0 
                        ? request.testRequestItems[0].orderItem.inventoryItem.itemName
                        : 'N/A'}
                      {request.testRequestItems && request.testRequestItems.length > 1 && (
                        <span className="text-xs text-gray-500 ml-1">
                          +{request.testRequestItems.length - 1} more
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {request.testRequestItems && request.testRequestItems.length > 0
                        ? request.testRequestItems[0].orderItem.inventoryItem.category.replace('_', ' ')
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {request.results.length > 0 ? (
                        <span>
                          {request.results[0].status}
                          {request.results[0].verifiedAt && ' (Verified)'}
                        </span>
                      ) : (
                        'No results'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {request.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Medical Information */}
      {patient.medicalHistory && (
        <div className="bg-white shadow-md rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Medical History</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{patient.medicalHistory}</p>
        </div>
      )}
    </div>
  );
}
