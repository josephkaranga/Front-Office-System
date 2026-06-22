import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function Dashboard() {
  const { formatCurrency, settings, getPaymentLabel } = useSettings();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [allRooms, setAllRooms] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAll = async () => {
    try {
      const [dash, roomData, payData] = await Promise.all([
        api.getDashboard(),
        api.getRooms(),
        isAdmin ? api.getPayments({ limit: 200 }) : Promise.resolve({ payments: [], today_total: 0 }),
      ]);
      setData(dash);
      setAllRooms(roomData.rooms);
      setPayments(payData.payments);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (<><Header title="Dashboard" /><div className="flex-1 flex items-center justify-center"><p className="text-gray-400 text-sm">Loading...</p></div></>);
  }

  const { rooms, today, revenue, occupancy_rate, recent_checkins, expected_checkouts } = data || {};

  // Revenue by method
  const methodTotals = {};
  payments.forEach(p => {
    const label = getPaymentLabel(p.payment_method);
    methodTotals[label] = (methodTotals[label] || 0) + p.amount;
  });
  const maxRevenue = Math.max(...Object.values(methodTotals), 1);

  // Recent activity from checkins
  const activities = (recent_checkins || []).slice(0, 6).map(c => ({
    name: `${c.first_name} ${c.last_name?.charAt(0)}.`,
    room: c.room_number,
    type: 'Checked In',
    vip: c.vip_status !== 'regular',
  }));

  // Room status for donut
  const vacant = rooms?.available || 0;
  const occupied = rooms?.occupied || 0;
  const reserved = rooms?.reserved || 0;
  const maintenance = rooms?.maintenance || 0;
  const total = rooms?.total || 1;

  const donutSegments = [
    { value: vacant, color: '#22c55e', label: 'Vacant' },
    { value: occupied, color: '#3b82f6', label: 'Occupied' },
    { value: reserved, color: '#a855f7', label: 'Reserved' },
    { value: maintenance, color: '#f59e0b', label: 'Maintenance' },
  ].filter(s => s.value > 0);

  let donutOffset = 0;
  const donutArcs = donutSegments.map(s => {
    const pct = (s.value / total) * 100;
    const arc = { ...s, pct, offset: donutOffset };
    donutOffset += pct;
    return arc;
  });

  // Room status colors for grid
  const roomColor = {
    available: 'bg-green-50 border-green-300 text-green-700',
    occupied: 'bg-blue-50 border-blue-300 text-blue-700',
    reserved: 'bg-purple-50 border-purple-300 text-purple-700',
    maintenance: 'bg-amber-50 border-amber-300 text-amber-700',
    cleaning: 'bg-orange-50 border-orange-300 text-orange-700',
  };

  return (
    <>
      <Header title="Dashboard" subtitle={`${settings.hotel_name} — ${settings.country}`} />
      <div className="page-container">
        {/* Hotel Banner */}
        <div className="relative rounded-lg overflow-hidden h-28">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1400&q=80')` }}>
            <div className="absolute inset-0 bg-gradient-to-r from-[#1e293b]/80 to-[#1e293b]/30"></div>
          </div>
          <div className="relative z-10 h-full flex items-center justify-between px-8">
            <div>
              <h2 className="text-xl font-bold text-white">{settings.hotel_name}</h2>
              <p className="text-xs text-white/60 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon={<BedIcon />} label="Occupancy" value={`${occupancy_rate || 0}%`} sub={`${occupied} of ${total} rooms`} />
          <StatCard icon={<GuestsIcon />} label="In-House" value={today?.current_guests || 0} sub={`${today?.current_guests || 0} total guests`} />
          <StatCard icon={<CalendarIcon />} label="Today's Arrivals" value={today?.checkins || 0} sub={`${today?.checkouts || 0} departures`} />
          {isAdmin
            ? <StatCard icon={<WalletIcon />} label="Revenue" value={formatCurrency(revenue?.today || 0)} sub="Total collected" highlight />
            : <StatCard icon={<WalletIcon />} label="Departures" value={expected_checkouts?.length || 0} sub="pending today" />
          }
        </div>

        {/* Middle Row: Donut + Revenue Bar */}
        <div className="grid grid-cols-2 gap-4">
          {/* Room Status Donut */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Room Status</h3>
            <div className="flex items-center gap-8">
              {/* SVG Donut */}
              <div className="relative w-36 h-36 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  {donutArcs.map((arc, i) => (
                    <circle key={i} cx="18" cy="18" r="14" fill="none"
                      stroke={arc.color} strokeWidth="4"
                      strokeDasharray={`${arc.pct * 0.88} ${100 - arc.pct * 0.88}`}
                      strokeDashoffset={`${-arc.offset * 0.88}`}
                      strokeLinecap="round" />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{total}</span>
                  <span className="text-[10px] text-gray-400">rooms</span>
                </div>
              </div>
              {/* Legend */}
              <div className="space-y-2.5">
                {[
                  { color: 'bg-green-500', label: 'Vacant', val: vacant },
                  { color: 'bg-blue-500', label: 'Occupied', val: occupied },
                  { color: 'bg-purple-500', label: 'Reserved', val: reserved },
                  { color: 'bg-amber-500', label: 'Maintenance', val: maintenance },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${s.color}`}></span>
                    <span className="text-sm text-gray-600 w-24">{s.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Revenue by Method (admin) / Departures (reception) */}
          {isAdmin ? (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue by Method</h3>
              {Object.keys(methodTotals).length > 0 ? (
                <div className="flex items-end gap-3 h-40">
                  {/* Y-axis labels */}
                  <div className="flex flex-col justify-between h-full text-[10px] text-gray-400 text-right pr-1 py-1">
                    {[maxRevenue, Math.round(maxRevenue * 0.75), Math.round(maxRevenue * 0.5), Math.round(maxRevenue * 0.25), 0].map((v, i) => (
                      <span key={i}>{v >= 1000 ? `${Math.round(v / 1000)}k` : v}</span>
                    ))}
                  </div>
                  {/* Bars */}
                  <div className="flex-1 flex items-end gap-2 h-full border-l border-b border-gray-200 pl-2 pb-1">
                    {Object.entries(methodTotals).map(([label, amount]) => {
                      const hPct = (amount / maxRevenue) * 100;
                      return (
                        <div key={label} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] text-gray-500 font-medium">{formatCurrency(amount)}</span>
                          <div className="w-full bg-[#c9a84c] rounded-t" style={{ height: `${Math.max(hPct, 3)}%` }}></div>
                          <span className="text-[11px] text-gray-600">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No payments recorded yet</div>
              )}
            </div>
          ) : (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Pending Departures</h3>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {expected_checkouts?.length > 0 ? expected_checkouts.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{c.first_name} {c.last_name?.charAt(0)}.</p>
                      <p className="text-[11px] text-gray-500">Room {c.room_number}</p>
                    </div>
                    <p className="text-xs text-red-600 font-medium">{fmtDate(c.expected_checkout)}</p>
                  </div>
                )) : <p className="text-sm text-gray-400 text-center py-8">No pending departures</p>}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Row: Room Overview + Recent Activity */}
        <div className="grid grid-cols-3 gap-4">
          {/* Room Overview Grid */}
          <div className="card col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Room Overview</h3>
              <button onClick={() => navigate('/rooms')} className="text-xs text-blue-600 hover:underline font-medium">View all &rarr;</button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {allRooms.slice(0, 18).map(r => (
                <div key={r.id}
                  className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center text-sm font-semibold cursor-default ${roomColor[r.status] || roomColor.available}`}
                  title={`Room ${r.room_number} — ${r.status}`}>
                  {r.room_number}
                </div>
              ))}
            </div>
            <div className="flex gap-4 text-[11px] text-gray-500 border-t border-gray-100 pt-3">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-50 border-2 border-green-300"></span>Vacant</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-50 border-2 border-blue-300"></span>Occupied</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-50 border-2 border-orange-300"></span>Cleaning</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border-2 border-amber-300"></span>Maintenance</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-50 border-2 border-purple-300"></span>Reserved</span>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {activities.length > 0 ? activities.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.name}</p>
                    <p className="text-[11px] text-gray-500">Room {a.room} &middot; {a.type}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center py-6">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ icon, label, value, sub, highlight }) {
  return (
    <div className={`bg-white rounded-lg border ${highlight ? 'border-[#c9a84c]/40' : 'border-gray-200'} p-4 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${highlight ? 'text-[#a08030]' : 'text-gray-900'}`}>{value}</p>
          <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg ${highlight ? 'bg-[#f5f0e0]' : 'bg-gray-50'} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function BedIcon() {
  return <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2 17V7a2 2 0 012-2h16a2 2 0 012 2v10m-2 0v3m-16-3v3m0-3h16m-8-7h.01M8 10h.01" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 14h16V10a1 1 0 00-1-1H5a1 1 0 00-1 1v4z" /></svg>;
}

function GuestsIcon() {
  return <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
}

function CalendarIcon() {
  return <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>;
}

function WalletIcon() {
  return <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>;
}
