'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BackToDashboard from '../../components/BackToDashboard';

export default function SampleCollectionQueuePage() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPendingRequests();
  }, [priorityFilter, searchQuery]);

  const fetchPendingRequests = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (priorityFilter) params.append('priority', priorityFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/samples/pending?${params}`);
      const data = await response.json();

      if (response.ok) {
        setPendingRequests(data.pendingTestRequests || []);
      } else {
        setError(data.error || 'Failed to load pending samples');
      }
    } catch (err) {
      setError('Failed to load pending samples');
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
      <BackToDashboard />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Sample Collection Queue</h1>
        <p className="text-gray-600 mt-2">Manage pending sample collections (LAB_STAFF only)</p>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Pending Requests */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <p>Loading pending sample collections...</p>
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No pending sample collections</p>
            <p className="text-sm mt-2">All samples have been collected!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingRequests.map(({ testRequest, pendingItems }) => (
              <div key={testRequest.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Link
                        href={`/dashboard/samples/collect/${testRequest.id}`}
                        className="text-lg font-semibold text-blue-600 hover:underline"
                      >
                        {testRequest.requestNumber}
                      </Link>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getPriorityBadge(testRequest.priority)}`}>
                        {testRequest.priority.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Patient:</span>
                        <Link
                          href={`/dashboard/patients/${testRequest.patient.id}`}
                          className="ml-2 text-blue-600 hover:underline font-medium"
                        >
                          {testRequest.patient.firstName} {testRequest.patient.lastName}
                        </Link>
                      </div>
                      <div>
                        <span className="text-gray-500">MRN:</span>
                        <span className="ml-2 font-medium">{testRequest.patient.patientNumber}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Age/Gender:</span>
                        <span className="ml-2">
                          {calculateAge(testRequest.patient.dateOfBirth)} years, {testRequest.patient.gender}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Request Date:</span>
                        <span className="ml-2">{formatDate(testRequest.requestDate)}</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/dashboard/samples/collect/${testRequest.id}`}
                    className="ml-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 whitespace-nowrap"
                  >
                    Collect Sample
                  </Link>
                </div>

                {/* Pending Items */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Pending Items ({pendingItems.length}):
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {pendingItems.map((item) => (
                      <div
                        key={item.id}
                        className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm"
                      >
                        <div className="font-medium text-gray-800">
                          {item.inventoryItem.itemName}
                        </div>
                        {item.inventoryItem.sampleType && (
                          <div className="text-xs text-gray-600 mt-1">
                            Sample Type: {item.inventoryItem.sampleType}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
