'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LabResultsQueuePage() {
  const [testRequestItems, setTestRequestItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('collected');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTestRequestItems();
  }, [statusFilter, priorityFilter, searchQuery]);

  const fetchTestRequestItems = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/lab-results/pending?${params}`);
      const data = await response.json();

      if (response.ok) {
        setTestRequestItems(data.testRequestItems || []);
      } else {
        setError(data.error || 'Failed to load test items');
      }
    } catch (err) {
      setError('Failed to load test items');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      stat: 'bg-red-100 text-red-800 border-red-300',
      urgent: 'bg-orange-100 text-orange-800 border-orange-300',
      normal: 'bg-blue-100 text-blue-800 border-blue-300',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      collected: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Lab Results Queue</h1>
        <p className="text-gray-600 mt-2">Enter and manage laboratory test results (LAB_STAFF only)</p>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by request number, patient name, or MRN..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="collected">Collected (Ready for Entry)</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="all">All Statuses</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Priorities</option>
              <option value="stat">STAT</option>
              <option value="urgent">Urgent</option>
              <option value="normal">Normal</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Test Items Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <p>Loading test items...</p>
          </div>
        ) : testRequestItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No test items found</p>
            <p className="text-sm mt-2">All results have been entered!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Request / Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sample
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {testRequestItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <Link
                          href={`/dashboard/test-requests/${item.testRequest.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {item.testRequest.requestNumber}
                        </Link>
                        <div className="text-gray-900 mt-1">
                          {item.testRequest.patient.firstName} {item.testRequest.patient.lastName}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {item.testRequest.patient.patientNumber} • {calculateAge(item.testRequest.patient.dateOfBirth)}y, {item.testRequest.patient.gender}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {item.orderItem.inventoryItem.itemName}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {item.orderItem.inventoryItem.itemCode}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.testRequest.samples && item.testRequest.samples.length > 0 ? (
                        <div>
                          <div className="font-medium text-gray-900">
                            {item.testRequest.samples[0].sampleNumber}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {item.testRequest.samples[0].sampleType}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">No sample</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${getPriorityBadge(item.testRequest.priority)}`}>
                        {item.testRequest.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.labResults && item.labResults.length > 0 ? (
                        <Link
                          href={`/dashboard/lab-results/view/${item.testRequest.id}/${item.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          View Results
                        </Link>
                      ) : (
                        <Link
                          href={`/dashboard/lab-results/enter/${item.testRequest.id}/${item.id}`}
                          className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 inline-block"
                        >
                          Enter Results
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
