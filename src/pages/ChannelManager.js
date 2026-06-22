import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { useSettings } from '../context/SettingsContext';
import api from '../utils/api';

const CHANNELS = [
  { id: 'booking', name: 'Booking.com', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Booking.com_logo.svg/1280px-Booking.com_logo.svg.png', color: 'bg-blue-600', status: 'Connect', region: 'Global + Rwanda' },
  { id: 'expedia', name: 'Expedia', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Expedia_2012_logo.svg/1280px-Expedia_2012_logo.svg.png', color: 'bg-yellow-500', status: 'Connect', region: 'Global + Rwanda' },
  { id: 'airbnb', name: 'Airbnb', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Airbnb_Logo_B%C3%A9lo.svg/1280px-Airbnb_Logo_B%C3%A9lo.svg.png', color: 'bg-red-500', status: 'Connect', region: 'Global + Rwanda' },
  { id: 'tripadvisor', name: 'TripAdvisor', logo: '', color: 'bg-green-600', status: 'Connect', region: 'Global' },
  { id: 'jumia', name: 'Jumia Travel', logo: '', color: 'bg-orange-500', status: 'Connect', region: 'East Africa' },
  { id: 'rdb', name: 'Visit Rwanda (RDB)', logo: '', color: 'bg-blue-800', status: 'Connect', region: 'Rwanda' },
];

export default function ChannelManager() {
  const { formatCurrency, settings } = useSettings();
  const [rooms, setRooms] = useState([]);
  const [channels, setChannels] = useState(CHANNELS);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncForm, setSyncForm] = useState({ api_key: '', property_id: '', sync_rates: true, sync_availability: true, sync_restrictions: false });
  const [connectedChannels, setConnectedChannels] = useState(() => {
    try { return JSON.parse(localStorage.getItem('connected_channels') || '{}'); } catch { return {}; }
  });

  useEffect(() => { loadRooms(); }, []);

  const loadRooms = async () => {
    try { const data = await api.getRooms(); setRooms(data.rooms); } catch (err) { console.error(err); }
  };

  const connectChannel = (channel) => {
    setSelectedChannel(channel);
    setShowSetupModal(true);
  };

  const handleConnect = (e) => {
    e.preventDefault();
    const updated = { ...connectedChannels, [selectedChannel.id]: { ...syncForm, connected_at: new Date().toISOString(), channel: selectedChannel.name } };
    setConnectedChannels(updated);
    localStorage.setItem('connected_channels', JSON.stringify(updated));
    setShowSetupModal(false);
    setSyncForm({ api_key: '', property_id: '', sync_rates: true, sync_availability: true, sync_restrictions: false });
  };

  const disconnectChannel = (channelId) => {
    if (!confirm('Disconnect this channel?')) return;
    const updated = { ...connectedChannels };
    delete updated[channelId];
    setConnectedChannels(updated);
    localStorage.setItem('connected_channels', JSON.stringify(updated));
  };

  const syncNow = (channel) => {
    setSelectedChannel(channel);
    setShowSyncModal(true);
    setTimeout(() => setShowSyncModal(false), 3000);
  };

  const totalConnected = Object.keys(connectedChannels).length;
  const availableRooms = rooms.filter(r => r.status === 'available').length;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;

  return (
    <>
      <Header title="Channel Manager" subtitle="OTA integrations — Booking.com, Expedia & more" />
      <div className="page-container">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="stat-card border-l-4 border-l-blue-500">
            <p className="text-[11px] text-gray-500 uppercase">Connected Channels</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalConnected}</p>
            <p className="text-[11px] text-gray-400">of {CHANNELS.length} available</p>
          </div>
          <div className="stat-card border-l-4 border-l-green-500">
            <p className="text-[11px] text-gray-500 uppercase">Rooms to Sync</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{availableRooms}</p>
            <p className="text-[11px] text-gray-400">available for booking</p>
          </div>
          <div className="stat-card border-l-4 border-l-red-500">
            <p className="text-[11px] text-gray-500 uppercase">Occupied</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{occupiedRooms}</p>
            <p className="text-[11px] text-gray-400">blocked on channels</p>
          </div>
          <div className="stat-card border-l-4 border-l-amber-500">
            <p className="text-[11px] text-gray-500 uppercase">Market</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{settings.country}</p>
            <p className="text-[11px] text-gray-400">{settings.currency} pricing</p>
          </div>
        </div>

        {/* Channel Cards */}
        <div className="grid grid-cols-3 gap-4">
          {CHANNELS.map(ch => {
            const isConnected = !!connectedChannels[ch.id];
            const conn = connectedChannels[ch.id];
            return (
              <div key={ch.id} className={`bg-white rounded border shadow-sm overflow-hidden ${isConnected ? 'border-green-300' : 'border-gray-200'}`}>
                <div className={`${ch.color} h-2`}></div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{ch.name}</h3>
                      <p className="text-[11px] text-gray-500">{ch.region}</p>
                    </div>
                    {isConnected ? <span className="badge-green">Connected</span> : <span className="badge-gray">Not Connected</span>}
                  </div>

                  {isConnected ? (
                    <div className="space-y-2 mb-3">
                      <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 space-y-1">
                        <div className="flex justify-between"><span>Property ID:</span><span className="text-gray-900">{conn.property_id || '—'}</span></div>
                        <div className="flex justify-between"><span>Sync Rates:</span><span className={conn.sync_rates ? 'text-green-600' : 'text-gray-400'}>{conn.sync_rates ? 'Yes' : 'No'}</span></div>
                        <div className="flex justify-between"><span>Sync Availability:</span><span className={conn.sync_availability ? 'text-green-600' : 'text-gray-400'}>{conn.sync_availability ? 'Yes' : 'No'}</span></div>
                        <div className="flex justify-between"><span>Connected:</span><span className="text-gray-400">{fmtDate(conn.connected_at)}</span></div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => syncNow(ch)} className="flex-1 btn-primary text-[11px] py-1">Sync Now</button>
                        <button onClick={() => disconnectChannel(ch.id)} className="px-2 py-1 text-[11px] rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">Disconnect</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-3">Connect to push room rates and availability to {ch.name}.</p>
                      <button onClick={() => connectChannel(ch)} className="w-full btn-primary text-xs">Connect {ch.name}</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Room Rate Matrix */}
        <div className="card">
          <h3 className="section-title">Room Rates — Synced to Channels</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="text-left py-2 px-3">Room Type</th>
                <th className="text-center py-2 px-3">Rooms</th>
                <th className="text-center py-2 px-3">Available</th>
                <th className="text-right py-2 px-3">Rate ({settings.currency})</th>
                <th className="text-center py-2 px-3">Channels</th>
              </tr>
            </thead>
            <tbody>
              {[...new Set(rooms.map(r => r.room_type))].map(type => {
                const typeRooms = rooms.filter(r => r.room_type === type);
                const avail = typeRooms.filter(r => r.status === 'available').length;
                const rate = typeRooms[0]?.rate_per_night || 0;
                return (
                  <tr key={type} className="table-row">
                    <td className="py-2 px-3 font-medium text-gray-900">{type}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{typeRooms.length}</td>
                    <td className="py-2 px-3 text-center"><span className={avail > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>{avail}</span></td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900">{formatCurrency(rate)}</td>
                    <td className="py-2 px-3 text-center text-gray-400">{totalConnected > 0 ? `${totalConnected} channels` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Setup Modal */}
        <Modal isOpen={showSetupModal} onClose={() => setShowSetupModal(false)} title={`Connect ${selectedChannel?.name}`} size="md">
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700">
              To connect, you need your {selectedChannel?.name} Connectivity Partner API credentials. Contact your {selectedChannel?.name} market manager or visit their extranet.
            </div>
            <div>
              <label className="label-field">API Key / Token</label>
              <input type="text" className="input-field" placeholder={`Your ${selectedChannel?.name} API key`} value={syncForm.api_key} onChange={(e) => setSyncForm(p => ({ ...p, api_key: e.target.value }))} required />
            </div>
            <div>
              <label className="label-field">Property / Hotel ID</label>
              <input type="text" className="input-field" placeholder="e.g. 12345678" value={syncForm.property_id} onChange={(e) => setSyncForm(p => ({ ...p, property_id: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <label className="label-field">Sync Options</label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={syncForm.sync_rates} onChange={(e) => setSyncForm(p => ({ ...p, sync_rates: e.target.checked }))} className="rounded" /> Sync Room Rates
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={syncForm.sync_availability} onChange={(e) => setSyncForm(p => ({ ...p, sync_availability: e.target.checked }))} className="rounded" /> Sync Availability
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={syncForm.sync_restrictions} onChange={(e) => setSyncForm(p => ({ ...p, sync_restrictions: e.target.checked }))} className="rounded" /> Sync Min Stay Restrictions
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowSetupModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Connect</button>
            </div>
          </form>
        </Modal>

        {/* Sync Modal */}
        <Modal isOpen={showSyncModal} onClose={() => setShowSyncModal(false)} title={`Syncing ${selectedChannel?.name}`} size="sm">
          <div className="text-center py-6">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-gray-700">Pushing {availableRooms} available rooms and rates to {selectedChannel?.name}...</p>
            <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
          </div>
        </Modal>
      </div>
    </>
  );
}

function fmtDate(s) { if (!s) return '-'; return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
