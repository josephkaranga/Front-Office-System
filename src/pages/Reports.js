import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { useSettings } from '../context/SettingsContext';
import api from '../utils/api';
import printPdf from '../utils/printPdf';

export default function Reports() {
  const { formatCurrency, getPaymentLabel, settings } = useSettings();
  const [activeTab, setActiveTab] = useState('revenue');
  const [revenueData, setRevenueData] = useState(null);
  const [occupancyData, setOccupancyData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyType, setHistoryType] = useState('checkins');

  useEffect(() => { loadReport(); }, [activeTab, fromDate, toDate, historyType]);

  const loadReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'revenue') setRevenueData(await api.getRevenueReport({ from_date: fromDate, to_date: toDate }));
      else if (activeTab === 'occupancy') setOccupancyData(await api.getOccupancyReport({ from_date: fromDate, to_date: toDate }));
      else if (activeTab === 'history') setHistoryData(await api.getGuestHistory({ type: historyType, from_date: fromDate, to_date: toDate }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fmtD = (s) => { if (!s) return '-'; return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };

  const exportReport = () => {
    const period = `${fmtD(fromDate)} — ${fmtD(toDate)}`;

    if (activeTab === 'revenue' && revenueData) {
      printPdf({
        settings, title: 'Revenue Report', subtitle: period,
        tableHeaders: [{ label: 'Date' }, { label: 'Payment Method' }, { label: 'Transactions', align: 'right' }, { label: 'Amount', align: 'right' }],
        tableRows: (revenueData.data || []).map(d => [d.period, getPaymentLabel(d.payment_method), d.transactions, formatCurrency(d.total)]),
        summaryRows: [
          ...(revenueData.summary || []).map(s => ({ label: `${getPaymentLabel(s.payment_method)} (${s.count} txns)`, value: formatCurrency(s.total) })),
          { label: 'GRAND TOTAL', value: formatCurrency(revenueData.grand_total?.total || 0), total: true },
        ],
        formatCurrency,
      });
    } else if (activeTab === 'occupancy' && occupancyData) {
      printPdf({
        settings, title: 'Occupancy Report', subtitle: period,
        tableHeaders: [{ label: 'Room Type' }, { label: 'Total', align: 'right' }, { label: 'Occupied', align: 'right' }, { label: 'Available', align: 'right' }, { label: 'Occupancy', align: 'right' }],
        tableRows: (occupancyData.by_type || []).map(t => [t.room_type, t.total, t.occupied, t.available, t.total > 0 ? `${Math.round((t.occupied / t.total) * 100)}%` : '0%']),
        summaryRows: [],
        formatCurrency,
      });
    } else if (activeTab === 'history' && historyData.length > 0) {
      printPdf({
        settings, title: 'Guest History Report', subtitle: `${period} | Type: ${historyType}`,
        tableHeaders: [{ label: 'Guest' }, { label: 'Room' }, { label: 'Check-in' }, { label: 'Check-out' }, { label: 'Rate', align: 'right' }, { label: 'Status' }, { label: 'Staff' }],
        tableRows: historyData.map(h => [
          `${h.first_name} ${h.last_name}`, `${h.room_number} - ${h.room_type}`,
          fmtD(h.checkin_date), h.checkout_date ? fmtD(h.checkout_date) : '-',
          formatCurrency(h.rate_per_night), h.status.replace('_', ' '), h.checked_in_by_name || '-',
        ]),
        summaryRows: [{ label: 'Total Records', value: `${historyData.length}`, total: true }],
        formatCurrency,
      });
    }
  };

  return (
    <>
      <Header title="Reports" subtitle="Revenue, occupancy, and guest history" />
      <div className="page-container">
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-white border border-gray-200 rounded p-0.5">
            {[['revenue', 'Revenue'], ['occupancy', 'Occupancy'], ['history', 'Guest History']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === key ? 'bg-blue-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            <input type="date" className="input-field w-auto text-xs" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <span className="text-gray-400 text-xs">to</span>
            <input type="date" className="input-field w-auto text-xs" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            {activeTab === 'history' && (
              <select className="select-field w-auto text-xs" value={historyType} onChange={(e) => setHistoryType(e.target.value)}>
                <option value="checkins">All</option><option value="checkouts">Check-outs</option><option value="active">Active</option>
              </select>
            )}
            <button onClick={exportReport} className="btn-secondary text-[11px] py-1 px-2 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Export PDF
            </button>
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => { const dt = new Date(); dt.setDate(dt.getDate() - d); setFromDate(dt.toISOString().split('T')[0]); setToDate(new Date().toISOString().split('T')[0]); }}
                className="btn-secondary text-[11px] py-1 px-2">{d}d</button>
            ))}
          </div>
        </div>

        {loading ? <p className="text-center py-10 text-gray-400 text-sm">Loading report...</p> : (
          <>
            {activeTab === 'revenue' && revenueData && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  <div className="stat-card">
                    <p className="text-xs text-gray-500 uppercase">Total Revenue</p>
                    <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(revenueData.grand_total?.total || 0)}</p>
                    <p className="text-[11px] text-gray-400">{revenueData.grand_total?.count || 0} transactions</p>
                  </div>
                  {revenueData.summary?.map((s) => (
                    <div key={s.payment_method} className="stat-card">
                      <p className="text-xs text-gray-500 uppercase capitalize">{getPaymentLabel(s.payment_method)}</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">{formatCurrency(s.total)}</p>
                      <p className="text-[11px] text-gray-400">{s.count} txns</p>
                    </div>
                  ))}
                </div>

                <div className="card">
                  <h3 className="section-title">By Payment Method</h3>
                  <div className="space-y-3">
                    {revenueData.summary?.map((s) => {
                      const pct = revenueData.grand_total?.total > 0 ? (s.total / revenueData.grand_total.total) * 100 : 0;
                      return (
                        <div key={s.payment_method}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600 capitalize">{getPaymentLabel(s.payment_method)}</span>
                            <span className="font-medium text-gray-900">{formatCurrency(s.total)} ({pct.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card">
                  <h3 className="section-title">Daily Breakdown</h3>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="table-header">
                          <th className="text-left py-2 px-3">Date</th>
                          <th className="text-left py-2 px-3">Method</th>
                          <th className="text-right py-2 px-3">Txns</th>
                          <th className="text-right py-2 px-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueData.data?.map((d, i) => (
                          <tr key={i} className="table-row">
                            <td className="py-2 px-3 text-gray-900">{d.period}</td>
                            <td className="py-2 px-3 text-gray-600 capitalize">{getPaymentLabel(d.payment_method)}</td>
                            <td className="py-2 px-3 text-right text-gray-600">{d.transactions}</td>
                            <td className="py-2 px-3 text-right font-medium text-gray-900">{formatCurrency(d.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'occupancy' && occupancyData && (
              <div className="space-y-4">
                <div className="card">
                  <h3 className="section-title">By Room Type</h3>
                  <div className="space-y-3">
                    {occupancyData.by_type?.map((t) => {
                      const pct = t.total > 0 ? (t.occupied / t.total) * 100 : 0;
                      return (
                        <div key={t.room_type}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">{t.room_type}</span>
                            <span className="text-gray-500">{t.occupied}/{t.total} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card">
                  <h3 className="section-title">By Floor</h3>
                  <div className="grid grid-cols-5 gap-3">
                    {occupancyData.by_floor?.map((f) => {
                      const pct = f.total > 0 ? (f.occupied / f.total) * 100 : 0;
                      return (
                        <div key={f.floor} className="bg-gray-50 rounded border border-gray-200 p-3 text-center">
                          <p className="text-sm font-semibold text-gray-900">Floor {f.floor}</p>
                          <p className="text-2xl font-bold text-blue-700 my-1">{pct.toFixed(0)}%</p>
                          <p className="text-xs text-gray-500">{f.occupied}/{f.total} rooms</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card">
                  <h3 className="section-title">Daily Check-ins</h3>
                  {occupancyData.checkin_history?.length > 0 ? (
                    <div className="flex items-end gap-0.5 h-32">
                      {[...occupancyData.checkin_history].reverse().map((d, i) => {
                        const max = Math.max(...occupancyData.checkin_history.map(h => h.count), 1);
                        const hPct = (d.count / max) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.count}`}>
                            <span className="text-[9px] text-gray-400">{d.count || ''}</span>
                            <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max(hPct, 2)}%` }}></div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-center py-6 text-gray-400 text-sm">No data</p>}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="card">
                <h3 className="section-title">Records ({historyData.length})</h3>
                {historyData.length > 0 ? (
                  <div className="max-h-[450px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="table-header">
                          <th className="text-left py-2.5 px-3">Guest</th>
                          <th className="text-left py-2.5 px-3">Room</th>
                          <th className="text-left py-2.5 px-3">Check-in</th>
                          <th className="text-left py-2.5 px-3">Check-out</th>
                          <th className="text-left py-2.5 px-3">Rate</th>
                          <th className="text-left py-2.5 px-3">Status</th>
                          <th className="text-left py-2.5 px-3">Staff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((h) => (
                          <tr key={h.id} className="table-row">
                            <td className="py-2.5 px-3">
                              <p className="font-medium text-gray-900">{h.first_name} {h.last_name}</p>
                              <p className="text-xs text-gray-500">{h.phone}</p>
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">{h.room_number} - {h.room_type}</td>
                            <td className="py-2.5 px-3 text-gray-600">{formatDate(h.checkin_date)}</td>
                            <td className="py-2.5 px-3 text-gray-600">{h.checkout_date ? formatDate(h.checkout_date) : '-'}</td>
                            <td className="py-2.5 px-3 text-gray-900 font-medium">{formatCurrency(h.rate_per_night)}</td>
                            <td className="py-2.5 px-3">
                              <span className={h.status === 'checked_in' ? 'badge-green' : 'badge-gray'}>{h.status.replace('_', ' ')}</span>
                            </td>
                            <td className="py-2.5 px-3 text-xs text-gray-500">{h.checked_in_by_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-center py-10 text-gray-400">No records found</p>}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function formatDate(dateStr) { if (!dateStr) return '-'; return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
