'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeReport, setActiveReport] = useState('daily-tests');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  // Report data states
  const [dailyTestsData, setDailyTestsData] = useState(null);
  const [dailyRevenueData, setDailyRevenueData] = useState(null);
  const [pendingResultsData, setPendingResultsData] = useState(null);
  const [paymentsSummaryData, setPaymentsSummaryData] = useState(null);
  const [resultsData, setResultsData] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    status: '',
    method: '',
    testId: '',
    patientMrn: ''
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();

      if (!response.ok || !data.authenticated) {
        router.push('/login');
        return;
      }

      if (data.user.role !== 'ADMIN' && data.user.role !== 'SUPERUSER') {
        router.push('/dashboard');
        return;
      }

      setUser(data.user);
      setAuthChecked(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/login');
    }
  };

  useEffect(() => {
    if (authChecked && user) {
      fetchReportData();
    }
  }, [activeReport, authChecked]);

  const fetchReportData = async () => {
    setLoading(true);
    setError('');

    try {
      let url = '';
      const params = new URLSearchParams();

      // Add date filters if present
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      switch (activeReport) {
        case 'daily-tests':
          url = `/api/reports/daily-tests?${params}`;
          const testsRes = await fetch(url);
          if (!testsRes.ok) throw new Error('Failed to fetch daily tests report');
          const testsData = await testsRes.json();
          setDailyTestsData(testsData);
          break;

        case 'daily-revenue':
          url = `/api/reports/daily-revenue?${params}`;
          const revenueRes = await fetch(url);
          if (!revenueRes.ok) throw new Error('Failed to fetch daily revenue report');
          const revenueData = await revenueRes.json();
          setDailyRevenueData(revenueData);
          break;

        case 'pending-results':
          if (filters.category) params.append('category', filters.category);
          url = `/api/reports/pending-results?${params}`;
          const pendingRes = await fetch(url);
          if (!pendingRes.ok) throw new Error('Failed to fetch pending results report');
          const pendingData = await pendingRes.json();
          setPendingResultsData(pendingData);
          break;

        case 'payments-summary':
          if (filters.status) params.append('status', filters.status);
          if (filters.method) params.append('method', filters.method);
          url = `/api/reports/payments-summary?${params}`;
          const paymentsRes = await fetch(url);
          if (!paymentsRes.ok) throw new Error('Failed to fetch payments summary report');
          const paymentsData = await paymentsRes.json();
          setPaymentsSummaryData(paymentsData);
          break;

        case 'results':
          if (filters.category) params.append('category', filters.category);
          if (filters.status) params.append('status', filters.status);
          if (filters.testId) params.append('testId', filters.testId);
          if (filters.patientMrn) params.append('patientMrn', filters.patientMrn);
          url = `/api/reports/results?${params}`;
          const resultsRes = await fetch(url);
          if (!resultsRes.ok) throw new Error('Failed to fetch results report');
          const resultsDataRes = await resultsRes.json();
          setResultsData(resultsDataRes);
          break;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const applyFilters = () => {
    fetchReportData();
  };

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      category: '',
      status: '',
      method: '',
      testId: '',
      patientMrn: ''
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  const getCategoryBadge = (category) => {
    const badges = {
      lab_test: 'bg-blue-100 text-blue-800',
      radiology: 'bg-purple-100 text-purple-800',
      pathology: 'bg-pink-100 text-pink-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badges[category] || badges.other}`}>
        {category?.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: 'bg-yellow-100 text-yellow-800',
      validated: 'bg-green-100 text-green-800',
      pending: 'bg-orange-100 text-orange-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badges[status] || badges.pending}`}>
        {status?.toUpperCase()}
      </span>
    );
  };

  if (!authChecked) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
              <p className="text-gray-600 mt-1">View system reports and analytics</p>
            </div>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Report Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto">
              {[
                { id: 'daily-tests', label: 'Daily Tests' },
                { id: 'daily-revenue', label: 'Daily Revenue' },
                { id: 'pending-results', label: 'Pending Results' },
                { id: 'payments-summary', label: 'Payments Summary' },
                { id: 'results', label: 'Results Report' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveReport(tab.id)}
                  className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${
                    activeReport === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Filters */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Date filters - show for most reports */}
              {['daily-tests', 'daily-revenue', 'payments-summary', 'results'].includes(activeReport) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={filters.startDate}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={filters.endDate}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </>
              )}

              {/* Category filter */}
              {['pending-results', 'results'].includes(activeReport) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    name="category"
                    value={filters.category}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Categories</option>
                    <option value="lab_test">Lab Test</option>
                    <option value="radiology">Radiology</option>
                    <option value="pathology">Pathology</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}

              {/* Status filter */}
              {['payments-summary', 'results'].includes(activeReport) && activeReport === 'payments-summary' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Status</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
              )}

              {activeReport === 'results' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Result Status</label>
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="validated">Validated</option>
                  </select>
                </div>
              )}

              {/* Payment method filter */}
              {activeReport === 'payments-summary' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    name="method"
                    value={filters.method}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Methods</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="insurance">Insurance</option>
                  </select>
                </div>
              )}

              {/* Patient MRN filter */}
              {activeReport === 'results' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient MRN</label>
                  <input
                    type="text"
                    name="patientMrn"
                    value={filters.patientMrn}
                    onChange={handleFilterChange}
                    placeholder="Enter MRN"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-4">
              <button
                onClick={applyFilters}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Loading...' : 'Apply Filters'}
              </button>
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
                {error}
              </div>
            )}

            {loading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading report...</p>
              </div>
            )}

            {/* Daily Tests Report */}
            {activeReport === 'daily-tests' && dailyTestsData && !loading && (
              <div>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Total Requests</div>
                    <div className="text-2xl font-bold text-blue-600">{dailyTestsData.totals.totalRequests}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Total Tests</div>
                    <div className="text-2xl font-bold text-green-600">{dailyTestsData.totals.totalTests}</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Urgent Tests</div>
                    <div className="text-2xl font-bold text-orange-600">{dailyTestsData.totals.urgentTests}</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Lab Tests</div>
                    <div className="text-2xl font-bold text-purple-600">{dailyTestsData.totals.labTests}</div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Tests</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Urgent</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Routine</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lab</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Radiology</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pathology</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dailyTestsData.report.map((day, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatDate(day.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{day.totalRequests}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{day.totalTests}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">{day.urgentTests}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{day.routineTests}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{day.labTests}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">{day.radiologyTests}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-600">{day.pathologyTests}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Daily Revenue Report */}
            {activeReport === 'daily-revenue' && dailyRevenueData && !loading && (
              <div>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Total Collected</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(dailyRevenueData.totals.totalAmount)}
                    </div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Cash</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(dailyRevenueData.totals.cashAmount)}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Card</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(dailyRevenueData.totals.cardAmount)}
                    </div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Mobile Money</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(dailyRevenueData.totals.mobileMoneyAmount)}
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payments</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cash</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Card</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mobile Money</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insurance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dailyRevenueData.report.map((day, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatDate(day.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{day.totalPayments}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            {formatCurrency(day.totalAmount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatCurrency(day.cashAmount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatCurrency(day.cardAmount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatCurrency(day.mobileMoneyAmount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatCurrency(day.insuranceAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pending Results Report */}
            {activeReport === 'pending-results' && pendingResultsData && !loading && (
              <div>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Total Pending</div>
                    <div className="text-2xl font-bold text-orange-600">{pendingResultsData.summary.totalPending}</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Overdue</div>
                    <div className="text-2xl font-bold text-red-600">{pendingResultsData.summary.overdue}</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Urgent</div>
                    <div className="text-2xl font-bold text-yellow-600">{pendingResultsData.summary.urgent}</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Lab Tests</div>
                    <div className="text-2xl font-bold text-blue-600">{pendingResultsData.summary.labTests}</div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request#</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Collection Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Pending</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pendingResultsData.report.map((item, index) => (
                        <tr key={index} className={item.daysPending > (item.priority === 'urgent' ? 1 : 3) ? 'bg-red-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                            {item.requestId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{item.patientName}</div>
                            <div className="text-xs text-gray-500">{item.patientMrn}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{item.testName}</div>
                            <div className="text-xs text-gray-500">{item.testCode}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getCategoryBadge(item.category)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              item.priority === 'urgent' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {item.priority?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(item.collectionDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${
                              item.daysPending > (item.priority === 'urgent' ? 1 : 3) ? 'text-red-600' : 'text-gray-900'
                            }`}>
                              {item.daysPending} days
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payments Summary Report */}
            {activeReport === 'payments-summary' && paymentsSummaryData && !loading && (
              <div>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Total Billed</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(paymentsSummaryData.summary.totalBilled)}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Total Collected</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(paymentsSummaryData.summary.totalCollected)}
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Outstanding</div>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(paymentsSummaryData.summary.totalOutstanding)}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Paid Count</div>
                    <div className="text-2xl font-bold text-purple-600">{paymentsSummaryData.summary.paidCount}</div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request#</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount Paid</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paymentsSummaryData.report.map((payment, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                            {payment.requestNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{payment.patientName}</div>
                            <div className="text-xs text-gray-500">{payment.patientMrn}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(payment.paymentDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(payment.totalAmount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                            {formatCurrency(payment.amountPaid)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={payment.balance > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                              {formatCurrency(payment.balance)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {payment.paymentMethod?.replace('_', ' ').toUpperCase()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(payment.paymentStatus)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Results Report */}
            {activeReport === 'results' && resultsData && !loading && (
              <div>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Total Results</div>
                    <div className="text-2xl font-bold text-blue-600">{resultsData.summary.totalResults}</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Lab Results</div>
                    <div className="text-2xl font-bold text-purple-600">{resultsData.summary.labResults}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Validated</div>
                    <div className="text-2xl font-bold text-green-600">{resultsData.summary.validatedResults}</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">With Abnormals</div>
                    <div className="text-2xl font-bold text-orange-600">{resultsData.summary.resultsWithAbnormals}</div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request#</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tested Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tested By</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {resultsData.report.map((result, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                            {result.requestNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{result.patientName}</div>
                            <div className="text-xs text-gray-500">{result.patientMrn}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{result.testName}</div>
                            <div className="text-xs text-gray-500">{result.testCode}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getCategoryBadge(result.category)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(result.testedDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {result.testedBy}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(result.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <Link
                              href={result.type === 'lab' 
                                ? `/dashboard/lab-results/print/${result.id}`
                                : `/dashboard/investigation-results/print/${result.id}`
                              }
                              target="_blank"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              🖨️ Print
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No data message */}
            {!loading && (
              (activeReport === 'daily-tests' && dailyTestsData?.report?.length === 0) ||
              (activeReport === 'daily-revenue' && dailyRevenueData?.report?.length === 0) ||
              (activeReport === 'pending-results' && pendingResultsData?.report?.length === 0) ||
              (activeReport === 'payments-summary' && paymentsSummaryData?.report?.length === 0) ||
              (activeReport === 'results' && resultsData?.report?.length === 0)
            ) && (
              <div className="text-center py-8 text-gray-500">
                No data available for the selected filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
