'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function OrderDetailPage() {
  const [order, setOrder] = useState(null);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const router = useRouter();
  const params = useParams();
  const orderId = params.id;

  useEffect(() => {
    if (orderId) {
      fetchOrder();
      fetchPaymentSummary();
    }
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch order');
      }

      setOrder(data.order);
      setError('');
    } catch (err) {
      console.error('Error fetching order:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentSummary = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/payment-summary`);
      const data = await res.json();

      if (res.ok) {
        setPaymentSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching payment summary:', err);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!confirm(`Change order status to ${newStatus}?`)) {
      return;
    }

    try {
      setUpdating(true);
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update order');
      }

      alert('Order status updated successfully');
      fetchOrder();
    } catch (err) {
      console.error('Error updating order:', err);
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete order ${order.orderNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete order');
      }

      alert('Order deleted successfully');
      router.push('/dashboard/orders');
    } catch (err) {
      console.error('Error deleting order:', err);
      alert(err.message);
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'REFUNDED':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Loading order details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <Link
          href="/dashboard/orders"
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Orders
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8 text-gray-500">Order not found</div>
        <Link
          href="/dashboard/orders"
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Order Details</h1>
        <Link
          href="/dashboard/orders"
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Back to Orders
        </Link>
      </div>

      {/* Order Header */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-semibold mb-2">{order.orderNumber}</h2>
            <span
              className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                order.status
              )}`}
            >
              {order.status}
            </span>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 mb-1">
              Created: {formatDate(order.createdAt)}
            </div>
            {order.updatedAt !== order.createdAt && (
              <div className="text-sm text-gray-500">
                Updated: {formatDate(order.updatedAt)}
              </div>
            )}
          </div>
        </div>

        {/* Patient Information */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-lg font-semibold mb-2">Patient Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-medium">
                {order.patient.firstName} {order.patient.lastName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">MRN</p>
              <p className="font-medium">{order.patient.patientNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date of Birth</p>
              <p className="font-medium">
                {new Date(order.patient.dateOfBirth).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Gender</p>
              <p className="font-medium">{order.patient.gender}</p>
            </div>
            {order.patient.phone && (
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{order.patient.phone}</p>
              </div>
            )}
            {order.patient.email && (
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{order.patient.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Order Notes */}
        {order.notes && (
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-2">Order Notes</h3>
            <p className="text-gray-700">{order.notes}</p>
          </div>
        )}
      </div>

      {/* Order Items */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Order Items</h3>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {order.orderItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {item.inventoryItem.itemName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {item.inventoryItem.itemCode}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {item.inventoryItem.category.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td
                  colSpan="5"
                  className="px-6 py-4 text-sm font-bold text-gray-900 text-right"
                >
                  Order Total:
                </td>
                <td className="px-6 py-4 text-lg font-bold text-gray-900 text-right">
                  {formatCurrency(order.totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Summary */}
      {paymentSummary && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Payment Summary</h3>
            {!paymentSummary.isFullyPaid && order.status !== 'CANCELLED' && (
              <button
                onClick={() => setShowPaymentForm(!showPaymentForm)}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                {showPaymentForm ? 'Cancel' : 'Record Payment'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded">
              <p className="text-sm text-gray-600">Order Total</p>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(paymentSummary.orderTotal)}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <p className="text-sm text-gray-600">Total Paid</p>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(paymentSummary.netPaid)}
              </p>
              {paymentSummary.totalRefunded > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  (Refunded: {formatCurrency(paymentSummary.totalRefunded)})
                </p>
              )}
            </div>
            <div className={`p-4 rounded ${paymentSummary.balance > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
              <p className="text-sm text-gray-600">Balance</p>
              <p className={`text-2xl font-bold ${paymentSummary.balance > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                {formatCurrency(paymentSummary.balance)}
              </p>
              {paymentSummary.isFullyPaid && (
                <p className="text-xs text-green-600 mt-1 font-semibold">✓ Fully Paid</p>
              )}
              {paymentSummary.isPartiallyPaid && !paymentSummary.isFullyPaid && (
                <p className="text-xs text-yellow-600 mt-1 font-semibold">Partially Paid</p>
              )}
            </div>
          </div>

          {/* Payment Form */}
          {showPaymentForm && <PaymentForm orderId={orderId} balance={paymentSummary.balance} onSuccess={() => { fetchPaymentSummary(); setShowPaymentForm(false); }} />}

          {/* Payment History */}
          {paymentSummary.payments.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Payment History ({paymentSummary.totalPayments})</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paymentSummary.payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDate(payment.paidAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {payment.method.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {payment.reference || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(payment.status)}`}>
                            {payment.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {order.status === 'PENDING' && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Order Actions</h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleStatusChange('CONFIRMED')}
              disabled={updating}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
            >
              Confirm Order
            </button>
            <button
              onClick={() => handleStatusChange('CANCELLED')}
              disabled={updating}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:bg-yellow-300"
            >
              Cancel Order
            </button>
            <button
              onClick={handleDelete}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Delete Order
            </button>
          </div>
        </div>
      )}

      {order.status === 'CONFIRMED' && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Order Actions</h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleStatusChange('COMPLETED')}
              disabled={updating}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-green-300"
            >
              Mark as Completed
            </button>
            <button
              onClick={() => handleStatusChange('CANCELLED')}
              disabled={updating}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:bg-yellow-300"
            >
              Cancel Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Payment Form Component
function PaymentForm({ orderId, balance, onSuccess }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    amount: balance > 0 ? balance : '',
    method: 'CASH',
    reference: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || formData.amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const res = await fetch(`/api/orders/${orderId}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          method: formData.method,
          reference: formData.reference || null,
          notes: formData.notes || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }

      // Redirect to receipt page
      router.push(`/dashboard/orders/${orderId}/payments/${data.payment.id}/receipt`);
    } catch (err) {
      console.error('Error recording payment:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg mb-4">
      <h4 className="font-semibold mb-3">Record New Payment</h4>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={balance}
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Maximum: ${balance.toFixed(2)}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Method <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.method}
            onChange={(e) => setFormData({ ...formData, method: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          >
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CHECK">Check</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reference Number
          </label>
          <input
            type="text"
            value={formData.reference}
            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="Transaction reference (optional)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <input
            type="text"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="Additional notes (optional)"
          />
        </div>

        <div className="md:col-span-2 flex justify-end gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:bg-green-300"
          >
            {submitting ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
