import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Payments() {
  const { formatCurrency, settings, getPaymentMethods, getPaymentLabel } = useSettings();
  const { isAdmin } = useAuth();
  const [payments, setPayments] = useState([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [methodFilter, setMethodFilter] = useState('');
  const [guests, setGuests] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [guestSearch, setGuestSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ amount: '', payment_method: 'cash', reference_number: '', description: '' });

  useEffect(() => { loadPayments(); }, [dateFilter, methodFilter]);

  const loadPayments = async () => {
    try {
      const params = {};
      if (dateFilter) params.date = dateFilter;
      if (methodFilter) params.method = methodFilter;
      const data = await api.getPayments(params);
      setPayments(data.payments);
      setTodayTotal(data.today_total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const searchGuests = async (term) => {
    setGuestSearch(term);
    if (term.length < 2) { setGuests([]); return; }
    try { const data = await api.getGuests({ search: term }); setGuests(data.guests); }
    catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedGuest) { setError('Please select a guest.'); return; }
    try {
      await api.createPayment({ guest_id: selectedGuest.id, ...form, amount: Number(form.amount) });
      setSuccess('Payment recorded.');
      setShowModal(false); setSelectedGuest(null);
      setForm({ amount: '', payment_method: 'cash', reference_number: '', description: '' });
      loadPayments();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) { setError(err.message); }
  };

  const exportCSV = () => {
    if (payments.length === 0) return;
    const headers = ['Transaction ID', 'Date', 'Guest', 'Room', 'Method', 'Reference', 'Description', 'Amount', 'Received By'];
    const rows = payments.map(p => [
      p.transaction_id || '-',
      p.payment_date,
      `${p.first_name} ${p.last_name}`,
      p.room_number || '-',
      getPaymentLabel(p.payment_method),
      p.reference_number || '-',
      p.description || '-',
      p.amount,
      p.received_by_name || '-',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile(csv, `payments-${dateFilter || 'all'}.csv`, 'text/csv');
  };

  const paymentMethods = getPaymentMethods();

  // Group summary by actual methods in data
  const methodSummary = {};
  payments.forEach(p => {
    const key = p.payment_method;
    if (!methodSummary[key]) methodSummary[key] = { count: 0, total: 0 };
    methodSummary[key].count++;
    methodSummary[key].total += p.amount;
  });

  return (
    <>
      <Header title="Payments" subtitle={isAdmin ? 'All staff transactions' : 'Your sales transactions'} />
      <div className="page-container">
        {success && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">{success}</div>}

        {/* Summary */}
        <div className="grid grid-cols-5 gap-3">
          <div className="stat-card col-span-1">
            <p className="text-xs text-gray-500 uppercase">Today's Total</p>
            <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(todayTotal)}</p>
          </div>
          {Object.entries(methodSummary).slice(0, 4).map(([key, val]) => (
            <div key={key} className="stat-card">
              <p className="text-xs text-gray-500 uppercase">{getPaymentLabel(key)}</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{formatCurrency(val.total)}</p>
              <p className="text-[11px] text-gray-400">{val.count} txns</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <input type="date" className="input-field w-auto text-xs" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            <select className="select-field w-auto text-xs" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="">All Methods</option>
              {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="btn-secondary text-xs flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export CSV
            </button>
            <button onClick={() => setShowModal(true)} className="btn-primary text-xs">+ Record Payment</button>
          </div>
        </div>

        {/* Table */}
        <div className="card">
          {loading ? <p className="text-center py-8 text-gray-400 text-sm">Loading...</p>
          : payments.length > 0 ? (
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="table-header">
                  <th className="text-left py-2.5 px-3">Transaction ID</th>
                  <th className="text-left py-2.5 px-3">Date</th>
                  <th className="text-left py-2.5 px-3">Guest</th>
                  <th className="text-left py-2.5 px-3">Room</th>
                  <th className="text-left py-2.5 px-3">Method</th>
                  <th className="text-left py-2.5 px-3">Reference</th>
                  <th className="text-right py-2.5 px-3">Amount</th>
                  <th className="text-left py-2.5 px-3">Received By</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="table-row">
                    <td className="py-2.5 px-3 text-xs font-mono text-blue-700">{p.transaction_id || '-'}</td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">{formatDateTime(p.payment_date)}</td>
                    <td className="py-2.5 px-3 font-medium text-gray-900">{p.first_name} {p.last_name}</td>
                    <td className="py-2.5 px-3 text-gray-600">{p.room_number || '-'}</td>
                    <td className="py-2.5 px-3"><span className="badge-blue">{getPaymentLabel(p.payment_method)}</span></td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">{p.reference_number || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">{p.received_by_name}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan="6" className="py-2.5 px-3 text-right text-sm font-semibold text-gray-700">Total</td>
                  <td className="py-2.5 px-3 text-right font-bold text-gray-900">{formatCurrency(payments.reduce((s, p) => s + p.amount, 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          ) : <p className="text-center py-10 text-gray-400">No payments for selected date</p>}
        </div>

        {/* Record Payment Modal */}
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Payment" size="md">
          {error && <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-field">Guest</label>
              {selectedGuest ? (
                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm text-gray-900">{selectedGuest.first_name} {selectedGuest.last_name}</p>
                  <button type="button" onClick={() => setSelectedGuest(null)} className="text-xs text-blue-600 hover:underline">Change</button>
                </div>
              ) : (
                <div>
                  <input type="text" className="input-field" placeholder="Search guest..." value={guestSearch} onChange={(e) => searchGuests(e.target.value)} />
                  {guests.length > 0 && (
                    <div className="mt-1.5 max-h-28 overflow-y-auto bg-white rounded border border-gray-200 p-1">
                      {guests.map((g) => (
                        <button key={g.id} type="button" onClick={() => { setSelectedGuest(g); setGuests([]); setGuestSearch(''); }}
                          className="w-full text-left p-2 rounded hover:bg-gray-50 text-sm text-gray-900">{g.first_name} {g.last_name}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-field">Amount ({settings.currency})</label><input type="number" className="input-field" value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} required /></div>
              <div>
                <label className="label-field">Method</label>
                <select className="select-field" value={form.payment_method} onChange={(e) => setForm(p => ({ ...p, payment_method: e.target.value }))}>
                  {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div><label className="label-field">Reference</label><input type="text" className="input-field" value={form.reference_number} onChange={(e) => setForm(p => ({ ...p, reference_number: e.target.value }))} /></div>
              <div><label className="label-field">Description</label><input type="text" className="input-field" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            </div>
            <p className="text-[11px] text-gray-400">A unique Transaction ID will be auto-generated for audit tracking.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Record Payment</button>
            </div>
          </form>
        </Modal>
      </div>
    </>
  );
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
