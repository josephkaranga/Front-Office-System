import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Modal from '../components/Modal';
import Receipt from '../components/Receipt';
import { useSettings } from '../context/SettingsContext';
import api from '../utils/api';

const EXTRA_CATEGORIES = [
  { value: 'food', label: 'Food & Dining', icon: '🍽' },
  { value: 'drinks', label: 'Drinks', icon: '🥤' },
  { value: 'minibar', label: 'Mini Bar', icon: '🍷' },
  { value: 'laundry', label: 'Laundry', icon: '👔' },
  { value: 'spa', label: 'Spa', icon: '💆' },
  { value: 'transport', label: 'Transport', icon: '🚗' },
  { value: 'room_service', label: 'Room Service', icon: '🛎' },
  { value: 'telephone', label: 'Telephone', icon: '📞' },
  { value: 'damage', label: 'Damage', icon: '⚠' },
  { value: 'other', label: 'Other', icon: '📋' },
];

export default function GuestFolio() {
  const { formatCurrency, settings, getPaymentMethods } = useSettings();
  const [checkins, setCheckins] = useState([]);
  const [selectedCheckin, setSelectedCheckin] = useState(null);
  const [folio, setFolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [folioLoading, setFolioLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ category: 'food', item_name: '', quantity: 1, unit_price: '', notes: '' });
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'cash', reference_number: '' });

  useEffect(() => {
    loadCheckins();
    const msUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return midnight - now + 1000;
    };
    let timer = setTimeout(function refresh() {
      loadCheckins();
      timer = setTimeout(refresh, msUntilMidnight());
    }, msUntilMidnight());
    return () => clearTimeout(timer);
  }, []);

  const loadCheckins = async () => {
    try { setCheckins(await api.getCheckins({ status: 'checked_in', limit: 100 })); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadFolio = async (checkinId) => {
    setFolioLoading(true);
    try { setFolio(await api.getFolio(checkinId)); }
    catch (err) { console.error(err); }
    finally { setFolioLoading(false); }
  };

  const selectGuest = (c) => { setSelectedCheckin(c); loadFolio(c.id); };

  const handleAddExtra = async (e) => {
    e.preventDefault(); setError('');
    try {
      await api.addExtra({ checkin_id: selectedCheckin.id, category: form.category, item_name: form.item_name, quantity: Number(form.quantity), unit_price: Number(form.unit_price), notes: form.notes });
      setShowAddModal(false); setForm({ category: 'food', item_name: '', quantity: 1, unit_price: '', notes: '' });
      loadFolio(selectedCheckin.id);
      flash('Charge added.');
    } catch (err) { setError(err.message); }
  };

  const handleDeleteExtra = async (id) => {
    if (!confirm('Remove this charge?')) return;
    try { await api.deleteExtra(id); loadFolio(selectedCheckin.id); } catch (err) { console.error(err); }
  };

  const openPayment = () => {
    if (!folio) return;
    setPayForm({ amount: folio.balance > 0 ? folio.balance : '', payment_method: 'cash', reference_number: '' });
    setError('');
    setShowPaymentModal(true);
  };

  const recordPayment = async (e) => {
    e.preventDefault(); setError('');
    if (Number(payForm.amount) <= 0) { setError('Enter a valid amount.'); return; }
    try {
      await api.createPayment({
        checkin_id: selectedCheckin.id, guest_id: selectedCheckin.guest_id,
        amount: Number(payForm.amount), payment_method: payForm.payment_method,
        reference_number: payForm.reference_number || null,
        description: `Room ${selectedCheckin.room_number} payment`,
      });
      setShowPaymentModal(false);
      loadFolio(selectedCheckin.id);
      flash('Payment recorded.');
    } catch (err) { setError(err.message); }
  };

  const processCheckout = async () => {
    setError('');
    try {
      const checkinId = selectedCheckin.id;
      const roomNum = selectedCheckin.room_number;
      await api.checkOut(checkinId);
      setShowCheckoutModal(false);

      try {
        const rData = await api.getReceipt(checkinId);
        setReceiptData(rData);
        setShowReceiptModal(true);
      } catch (e) { console.error(e); }

      setSelectedCheckin(null); setFolio(null);
      loadCheckins();
      flash(`Guest checked out from Room ${roomNum}.`);
    } catch (err) { setError(err.message); }
  };

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };
  const getCatLabel = (v) => EXTRA_CATEGORIES.find(c => c.value === v)?.label || v;
  const getCatIcon = (v) => EXTRA_CATEGORIES.find(c => c.value === v)?.icon || '📋';
  const calcNights = (from) => Math.max(1, Math.ceil((new Date() - new Date(from)) / 86400000));

  return (
    <>
      <Header title="In-House Guests" subtitle="Folios, extras, billing & check-out" />
      <div className="page-container flex flex-col">
        {success && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm flex-shrink-0">{success}</div>}

        <div className="flex gap-4 flex-1 min-h-0">
          {/* ─── Left: Guest List with Running Totals ─── */}
          <div className="w-80 flex-shrink-0 bg-white rounded border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">In-House — {checkins.length} Guests</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? <p className="text-center py-8 text-gray-400 text-sm">Loading...</p> :
                checkins.length > 0 ? checkins.map(c => {
                  const nights = calcNights(c.checkin_date);
                  const roomTotal = nights * Number(c.rate_per_night);
                  const isOverdue = new Date(c.expected_checkout) < new Date();
                  const isSelected = selectedCheckin?.id === c.id;
                  return (
                    <button key={c.id} onClick={() => selectGuest(c)}
                      className={`w-full text-left p-3 border-b border-gray-100 hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.first_name} {c.last_name}</p>
                          <p className="text-[11px] text-gray-500">Room {c.room_number} &middot; {nights}N</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(roomTotal)}</p>
                          {isOverdue && <span className="text-[10px] text-red-600 font-medium">OVERDUE</span>}
                        </div>
                      </div>
                    </button>
                  );
                }) : <p className="text-center py-8 text-gray-400 text-sm">No guests in-house</p>
              }
            </div>
          </div>

          {/* ─── Right: Folio Detail ─── */}
          <div className="flex-1 overflow-y-auto">
            {!selectedCheckin ? (
              <div className="bg-white rounded border border-gray-200 shadow-sm flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
                  <p>Select a guest to view their bill</p>
                </div>
              </div>
            ) : folioLoading ? (
              <div className="bg-white rounded border border-gray-200 shadow-sm flex items-center justify-center h-full"><p className="text-gray-400 text-sm">Loading folio...</p></div>
            ) : folio ? (
              <div className="space-y-4">
                {/* Guest Header + Actions */}
                <div className="bg-white rounded border border-gray-200 shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {folio.room?.image_url && <div className="w-16 h-12 rounded overflow-hidden flex-shrink-0"><img src={folio.room.image_url} alt="" className="w-full h-full object-cover" /></div>}
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{folio.guest?.first_name} {folio.guest?.last_name}</h3>
                        <p className="text-xs text-gray-500">Room {folio.room?.room_number} &middot; {folio.room?.room_type} &middot; {folio.nights} night(s)</p>
                        <p className="text-[11px] text-gray-400">Since {fmtDate(folio.checkin?.checkin_date)} &middot; Expected out {fmtDate(folio.checkin?.expected_checkout)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddModal(true)} className="btn-secondary text-xs">+ Add Charge</button>
                      <button onClick={openPayment} className="btn-primary text-xs">Record Payment</button>
                      <button onClick={() => setShowCheckoutModal(true)} className="btn-success text-xs">Check-Out</button>
                    </div>
                  </div>
                </div>

                {/* Bill Summary */}
                <div className="grid grid-cols-4 gap-3">
                  <BillCard label="Accommodation" value={formatCurrency(folio.room_total)} sub={`${folio.nights}n × ${formatCurrency(folio.charged_rate || folio.room?.rate_per_night)}`} color="blue" />
                  <BillCard label="Extras" value={formatCurrency(folio.extras_total)} sub={`${folio.extras?.length || 0} charges`} color="amber" />
                  <BillCard label="Paid" value={formatCurrency(folio.paid_total || 0)} sub={folio.is_fully_paid ? 'Fully paid' : `${folio.payments?.length || 0} payment(s)`} color={folio.is_fully_paid ? 'green' : 'red'} />
                  <BillCard label="Balance" value={formatCurrency(folio.balance || 0)} sub={folio.is_fully_paid ? 'No balance' : 'Outstanding'} color={folio.is_fully_paid ? 'green' : 'red'} large />
                </div>

                {/* Daily Breakdown */}
                <div className="bg-white rounded border border-gray-200 shadow-sm">
                  <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Daily Breakdown</h4>
                    <span className="text-xs text-gray-400">{folio.nights} day(s)</span>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {folio.daily_breakdown?.map((day) => {
                      const runningTotal = folio.daily_breakdown.slice(0, day.day).reduce((s, d) => s + d.day_total, 0);
                      return (
                        <div key={day.day} className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[11px] font-bold">{day.day}</span>
                              <span className="text-sm text-gray-700">{fmtDate(day.date)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-gray-900">{formatCurrency(day.day_total)}</span>
                              <span className="text-[10px] text-gray-400 ml-2">Running: {formatCurrency(runningTotal)}</span>
                            </div>
                          </div>
                          <div className="ml-8 space-y-0.5">
                            <div className="flex justify-between text-xs text-gray-500"><span>Room charge</span><span>{formatCurrency(day.room_charge)}</span></div>
                            {day.extras.map((e, i) => (
                              <div key={i} className="flex justify-between text-xs text-gray-500"><span>{getCatIcon(e.category)} {e.item_name} x{e.quantity}</span><span>{formatCurrency(e.total_price)}</span></div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Grand Total</span>
                    <span className="text-lg font-bold text-green-700">{formatCurrency(folio.grand_total)}</span>
                  </div>
                </div>

                {/* Category Summary */}
                {folio.category_summary?.length > 0 && (
                  <div className="bg-white rounded border border-gray-200 shadow-sm p-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Extras Summary</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {folio.category_summary.map((cat) => (
                        <div key={cat.category} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                          <span>{getCatIcon(cat.category)} {getCatLabel(cat.category)} <span className="text-xs text-gray-400">({cat.count})</span></span>
                          <span className="font-semibold text-gray-900">{formatCurrency(cat.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Charges Table */}
                {folio.extras?.length > 0 && (
                  <div className="bg-white rounded border border-gray-200 shadow-sm">
                    <div className="p-3 border-b border-gray-200 bg-gray-50">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">All Extra Charges ({folio.extras.length})</h4>
                    </div>
                    <table className="w-full text-sm">
                      <thead><tr className="table-header">
                        <th className="text-left py-2 px-3">Time</th><th className="text-left py-2 px-3">Category</th><th className="text-left py-2 px-3">Item</th>
                        <th className="text-center py-2 px-3">Qty</th><th className="text-right py-2 px-3">Price</th><th className="text-right py-2 px-3">Total</th>
                        <th className="text-left py-2 px-3">By</th><th className="text-right py-2 px-3"></th>
                      </tr></thead>
                      <tbody>
                        {folio.extras.map(e => (
                          <tr key={e.id} className="table-row">
                            <td className="py-2 px-3 text-gray-500 text-xs">{fmtDateTime(e.added_at)}</td>
                            <td className="py-2 px-3 text-xs">{getCatIcon(e.category)} {getCatLabel(e.category)}</td>
                            <td className="py-2 px-3 text-gray-900">{e.item_name}{e.notes ? <span className="text-[10px] text-gray-400 ml-1">({e.notes})</span> : ''}</td>
                            <td className="py-2 px-3 text-center text-gray-600">{e.quantity}</td>
                            <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(e.unit_price)}</td>
                            <td className="py-2 px-3 text-right font-semibold text-gray-900">{formatCurrency(e.total_price)}</td>
                            <td className="py-2 px-3 text-xs text-gray-500">{e.added_by_name || '-'}</td>
                            <td className="py-2 px-3 text-right"><button onClick={() => handleDeleteExtra(e.id)} className="text-xs text-red-500 hover:underline">Remove</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* ─── Add Charge Modal ─── */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={`Add Charge — Room ${selectedCheckin?.room_number}`} size="md">
          {error && <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}
          <form onSubmit={handleAddExtra} className="space-y-4">
            <div>
              <label className="label-field">Category</label>
              <div className="grid grid-cols-5 gap-2">
                {EXTRA_CATEGORIES.map(cat => (
                  <button key={cat.value} type="button" onClick={() => setForm(p => ({ ...p, category: cat.value }))}
                    className={`p-2 rounded border text-center text-[11px] transition-colors ${form.category === cat.value ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                    <div className="text-base mb-0.5">{cat.icon}</div>{cat.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="label-field">Item *</label><input type="text" className="input-field" placeholder="e.g. Club Sandwich, Heineken, Taxi..." value={form.item_name} onChange={(e) => setForm(p => ({ ...p, item_name: e.target.value }))} required /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label-field">Qty</label><input type="number" min="1" className="input-field" value={form.quantity} onChange={(e) => setForm(p => ({ ...p, quantity: e.target.value }))} /></div>
              <div><label className="label-field">Price ({settings.currency})</label><input type="number" min="0" step="0.01" className="input-field" value={form.unit_price} onChange={(e) => setForm(p => ({ ...p, unit_price: e.target.value }))} required /></div>
              <div><label className="label-field">Total</label><div className="input-field bg-gray-100 font-semibold">{formatCurrency((Number(form.quantity) || 1) * (Number(form.unit_price) || 0))}</div></div>
            </div>
            <div><label className="label-field">Notes</label><input type="text" className="input-field" placeholder="Optional" value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Add Charge</button></div>
          </form>
        </Modal>

        {/* ─── Record Payment Modal (standalone) ─── */}
        <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title={`Record Payment — Room ${selectedCheckin?.room_number}`} size="md">
          {error && <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}
          {folio && (
            <form onSubmit={recordPayment} className="space-y-4">
              <div className="bg-gray-50 rounded border border-gray-200 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Guest</span><span className="font-medium">{folio.guest?.first_name} {folio.guest?.last_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total Charges</span><span>{formatCurrency(folio.grand_total)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total Paid</span><span>{formatCurrency(folio.paid_total || 0)}</span></div>
                <div className="flex justify-between font-bold border-t border-gray-200 pt-1">
                  <span className={folio.balance > 0 ? 'text-red-700' : 'text-green-700'}>Balance</span>
                  <span className={folio.balance > 0 ? 'text-red-700' : 'text-green-700'}>{formatCurrency(folio.balance || 0)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Amount ({settings.currency})</label>
                  <input type="number" min="1" className="input-field" value={payForm.amount} onChange={(e) => setPayForm(p => ({ ...p, amount: e.target.value }))} required autoFocus />
                </div>
                <div>
                  <label className="label-field">Payment Method</label>
                  <select className="select-field" value={payForm.payment_method} onChange={(e) => setPayForm(p => ({ ...p, payment_method: e.target.value }))}>
                    {getPaymentMethods().map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label-field">Reference No.</label>
                  <input type="text" className="input-field" placeholder="Transaction ID (optional)" value={payForm.reference_number} onChange={(e) => setPayForm(p => ({ ...p, reference_number: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Record Payment</button>
              </div>
            </form>
          )}
        </Modal>

        {/* ─── Check-Out Modal (closure only) ─── */}
        <Modal isOpen={showCheckoutModal} onClose={() => setShowCheckoutModal(false)} title={`Check-Out — Room ${selectedCheckin?.room_number}`} size="md">
          {folio && (() => {
            const balance = folio.balance || 0;
            return (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded border border-gray-200 p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Guest</span><span className="font-medium text-gray-900">{folio.guest?.first_name} {folio.guest?.last_name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Room</span><span>{folio.room?.room_number} — {folio.room?.room_type}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Nights</span><span>{folio.nights}</span></div>
                  <div className="border-t border-gray-200 pt-2 space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Total Charges</span><span>{formatCurrency(folio.grand_total)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Total Paid</span><span>{formatCurrency(folio.paid_total || 0)}</span></div>
                    <div className="flex justify-between font-bold border-t border-gray-200 pt-1">
                      <span className={balance > 0 ? 'text-red-700' : 'text-green-700'}>
                        {balance > 0 ? 'Outstanding Balance' : 'Status'}
                      </span>
                      <span className={balance > 0 ? 'text-red-700' : 'text-green-700'}>
                        {balance > 0 ? formatCurrency(balance) : 'PAID IN FULL'}
                      </span>
                    </div>
                  </div>
                </div>

                {balance > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                    <p className="text-sm text-amber-800 font-medium">Guest has an outstanding balance of {formatCurrency(balance)}.</p>
                    <p className="text-xs text-amber-600 mt-1">You can still check out. Use "Record Payment" to collect payment separately.</p>
                  </div>
                )}

                <p className="text-sm text-gray-600">This will free the room and end the guest's stay. A receipt will be generated.</p>

                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowCheckoutModal(false)} className="btn-secondary">Cancel</button>
                  <button onClick={processCheckout} className="btn-success">Confirm Check-Out</button>
                </div>
              </div>
            );
          })()}
        </Modal>

        {/* Receipt Modal */}
        <Modal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} title="Guest Receipt" size="md">
          <Receipt data={receiptData} formatCurrency={formatCurrency} onClose={() => setShowReceiptModal(false)} />
        </Modal>
      </div>
    </>
  );
}

function BillCard({ label, value, sub, color, large }) {
  const colors = { blue: 'border-l-blue-500', amber: 'border-l-amber-500', green: 'border-l-green-600', red: 'border-l-red-500' };
  return (
    <div className={`bg-white rounded border border-gray-200 shadow-sm p-4 border-l-4 ${colors[color]}`}>
      <p className="text-[11px] text-gray-500 uppercase">{label}</p>
      <p className={`${large ? 'text-2xl text-green-700' : 'text-xl text-gray-900'} font-bold mt-1`}>{value}</p>
      <p className="text-[11px] text-gray-400">{sub}</p>
    </div>
  );
}

function fmtDate(s) { if (!s) return '-'; return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtDateTime(s) { if (!s) return '-'; const d = new Date(s); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
