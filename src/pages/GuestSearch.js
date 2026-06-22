import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

function maskValue(val) {
  if (!val || val.length < 4) return '****';
  return val.slice(0, 2) + '*'.repeat(val.length - 4) + val.slice(-2);
}

export default function GuestSearch() {
  const { formatCurrency, getPaymentLabel } = useSettings();
  const { isAdmin } = useAuth();
  const [guests, setGuests] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [vipFilter, setVipFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (search.length >= 2 || search.length === 0) loadGuests();
  }, [search, vipFilter]);

  const loadGuests = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (search) params.search = search;
      if (vipFilter) params.vip = vipFilter;
      const data = await api.getGuests(params);
      setGuests(data.guests);
      setTotal(data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const viewGuest = async (guest) => {
    setProfileLoading(true);
    try {
      const data = await api.getGuest(guest.id);
      setSelectedGuest(data);
    } catch (err) { console.error(err); }
    finally { setProfileLoading(false); }
  };

  const exportGuests = () => {
    if (guests.length === 0) return;
    const headers = ['Name', 'ID Type', 'ID Number', 'Nationality', 'Phone', 'Email', 'VIP', 'Registered'];
    const rows = guests.map(g => [`${g.first_name} ${g.last_name}`, g.id_type || '', isAdmin ? (g.id_number || '') : '***', g.nationality || '', g.phone || '', g.email || '', g.vip_status, fmtDate(g.created_at)]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `guests-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const vipCount = guests.filter(g => g.vip_status === 'vip' || g.vip_status === 'vvip').length;
  const nationalities = [...new Set(guests.map(g => g.nationality).filter(Boolean))];

  return (
    <>
      <Header title="Guest Directory" subtitle={`${total} registered guests`} />
      <div className="page-container flex flex-col">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          <div className="stat-card border-l-4 border-l-blue-500">
            <p className="text-[11px] text-gray-500 uppercase">Total Guests</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{total}</p>
          </div>
          <div className="stat-card border-l-4 border-l-amber-500 cursor-pointer" onClick={() => setVipFilter(vipFilter === 'vip' ? '' : 'vip')}>
            <p className="text-[11px] text-gray-500 uppercase">VIP Guests</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{vipCount}</p>
          </div>
          <div className="stat-card border-l-4 border-l-green-500">
            <p className="text-[11px] text-gray-500 uppercase">Nationalities</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{nationalities.length}</p>
          </div>
          <div className="stat-card border-l-4 border-l-purple-500">
            <p className="text-[11px] text-gray-500 uppercase">Showing</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{guests.length}</p>
            <p className="text-[11px] text-gray-400">results</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex gap-3 items-center flex-shrink-0">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" className="input-field pl-9" placeholder="Search by name, phone, email, or ID number..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          </div>
          <select className="select-field w-auto text-xs" value={vipFilter} onChange={(e) => setVipFilter(e.target.value)}>
            <option value="">All Guests</option>
            <option value="vip">VIP Only</option>
            <option value="vvip">VVIP Only</option>
            <option value="regular">Regular Only</option>
          </select>
          <button onClick={exportGuests} className="btn-secondary text-xs flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
        </div>

        {/* Split Panel: Guest List + Profile */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left: Guest List */}
          <div className="flex-1 bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto">
              {loading ? <p className="text-center py-10 text-gray-400 text-sm">Searching...</p>
              : guests.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {guests.map(g => (
                    <button key={g.id} onClick={() => viewGuest(g)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 ${selectedGuest?.id === g.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${g.vip_status !== 'regular' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        <span className="text-xs font-semibold">{g.first_name[0]}{g.last_name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{g.first_name} {g.last_name}</p>
                          {g.vip_status === 'vip' && <span className="badge-gold text-[9px]">VIP</span>}
                          {g.vip_status === 'vvip' && <span className="badge-gold text-[9px]">VVIP</span>}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{g.nationality || 'Unknown'} &middot; {g.phone || 'No phone'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-gray-400">{fmtDate(g.created_at)}</p>
                        {isAdmin && g.registered_by_name && <p className="text-[10px] text-gray-400">by {g.registered_by_name}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <svg className="w-12 h-12 mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
                  <p className="text-sm">{search ? 'No guests match your search' : 'No guests registered'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Guest Profile Panel */}
          <div className="w-[420px] flex-shrink-0 overflow-y-auto">
            {profileLoading ? (
              <div className="bg-white rounded border border-gray-200 shadow-sm h-full flex items-center justify-center"><p className="text-gray-400 text-sm">Loading profile...</p></div>
            ) : selectedGuest ? (
              <div className="space-y-3">
                {/* Profile Card */}
                <div className="bg-white rounded border border-gray-200 shadow-sm p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedGuest.vip_status !== 'regular' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      <span className="text-base font-bold">{selectedGuest.first_name[0]}{selectedGuest.last_name[0]}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{selectedGuest.first_name} {selectedGuest.last_name}</h3>
                      <div className="flex items-center gap-1.5">
                        {selectedGuest.vip_status !== 'regular' && <span className="badge-gold text-[10px]">{selectedGuest.vip_status.toUpperCase()}</span>}
                        <span className="text-xs text-gray-500">{selectedGuest.nationality || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Cell icon={<IdCardIcon />} label="ID Type" value={selectedGuest.id_type?.replace('_', ' ')} capitalize />
                    <Cell icon={<HashIcon />} label="ID Number" value={isAdmin ? selectedGuest.id_number : maskValue(selectedGuest.id_number)} />
                    <Cell icon={<GlobeIcon />} label="Nationality" value={selectedGuest.nationality} />
                    <Cell icon={<PhoneIcon />} label="Phone" value={selectedGuest.phone} />
                    {isAdmin && <Cell icon={<EmailIcon />} label="Email" value={selectedGuest.email} />}
                    {isAdmin && <Cell icon={<MapPinIcon />} label="Address" value={selectedGuest.address} />}
                  </div>
                </div>

                {/* Registered By */}
                {isAdmin && (
                  <div className="bg-white rounded border border-gray-200 shadow-sm p-3 flex items-center justify-between">
                    <div><p className="text-[10px] text-gray-500 uppercase">Registered By</p><p className="text-sm font-medium text-gray-900">{selectedGuest.registered_by_name || 'System'}</p></div>
                    <div className="text-right"><p className="text-[10px] text-gray-500 uppercase">Date</p><p className="text-sm text-gray-700">{fmtDT(selectedGuest.created_at)}</p></div>
                  </div>
                )}

                {/* Quick Stats */}
                {isAdmin && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white rounded border border-gray-200 shadow-sm p-3 text-center">
                      <p className="text-xl font-bold text-gray-900">{selectedGuest.checkins?.length || 0}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Stays</p>
                    </div>
                    <div className="bg-white rounded border border-gray-200 shadow-sm p-3 text-center">
                      <p className="text-xl font-bold text-gray-900">{selectedGuest.reservations?.length || 0}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Bookings</p>
                    </div>
                    <div className="bg-white rounded border border-gray-200 shadow-sm p-3 text-center">
                      <p className="text-xl font-bold text-green-700">{formatCurrency(selectedGuest.payments?.reduce((s, p) => s + Number(p.amount), 0) || 0)}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Total Spent</p>
                    </div>
                  </div>
                )}

                {/* Stay History */}
                {isAdmin && selectedGuest.checkins?.length > 0 && (
                  <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200"><h4 className="text-[11px] font-semibold text-gray-500 uppercase">Stay History</h4></div>
                    <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                      {selectedGuest.checkins.map(c => (
                        <div key={c.id} className="px-3 py-2 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-900">Room {c.room_number} <span className="text-gray-500">· {c.room_type}</span></p>
                            <p className="text-[11px] text-gray-500">{fmtDate(c.checkin_date)} → {c.checkout_date ? fmtDate(c.checkout_date) : 'Current'}</p>
                            <p className="text-[10px] text-gray-400">In: {c.checked_in_by_name || '-'}{c.checked_out_by_name ? ` · Out: ${c.checked_out_by_name}` : ''}</p>
                          </div>
                          <span className={c.status === 'checked_in' ? 'badge-green' : 'badge-gray'}>{c.status.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transactions */}
                {isAdmin && selectedGuest.payments?.length > 0 && (
                  <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200"><h4 className="text-[11px] font-semibold text-gray-500 uppercase">Transactions ({selectedGuest.payments.length})</h4></div>
                    <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                      {selectedGuest.payments.map(p => (
                        <div key={p.id} className="px-3 py-2 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-mono text-blue-700">{p.transaction_id || '-'}</p>
                            <p className="text-[11px] text-gray-500">{fmtDate(p.payment_date)} · {getPaymentLabel(p.payment_method)} · {p.received_by_name || '-'}</p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex justify-between">
                      <span className="text-xs font-semibold text-gray-700">Total</span>
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(selectedGuest.payments.reduce((s, p) => s + Number(p.amount), 0))}</span>
                    </div>
                  </div>
                )}

                {!isAdmin && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-500 text-center">
                    Stay history and payment details are restricted to admin. Sensitive data is masked.
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded border border-gray-200 shadow-sm h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                  <p className="text-sm">Select a guest to view profile</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Cell({ icon, label, value, capitalize }) {
  return (
    <div className="bg-gray-50 rounded border border-gray-100 p-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-gray-400">{icon}</span>
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-sm text-gray-900 ${capitalize ? 'capitalize' : ''}`}>{value || '-'}</p>
    </div>
  );
}

function IdCardIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg>;
}
function HashIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" /></svg>;
}
function GlobeIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>;
}
function PhoneIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>;
}
function EmailIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>;
}
function MapPinIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>;
}

function fmtDate(s) { if (!s) return '-'; return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtDT(s) { if (!s) return '-'; const d = new Date(s); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
