import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Rooms() {
  const { formatCurrency } = useSettings();
  const { isAdmin } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => { loadRooms(); }, [filter, floorFilter]);

  const loadRooms = async () => {
    try {
      const params = {};
      if (filter) params.status = filter;
      if (floorFilter) params.floor = floorFilter;
      const data = await api.getRooms(params);
      setRooms(data.rooms);
      setStats(data.stats);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const viewRoom = async (room) => {
    try {
      const data = await api.getRoom(room.id);
      setSelectedRoom(data);
      setShowDetail(true);
    } catch (err) { console.error(err); }
  };

  const updateStatus = async (roomId, status) => {
    try {
      await api.updateRoomStatus(roomId, status);
      loadRooms();
      if (selectedRoom?.id === roomId) {
        const data = await api.getRoom(roomId);
        setSelectedRoom(data);
      }
    } catch (err) { console.error(err); }
  };

  const statusStyles = {
    available: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-500' },
    occupied: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-500' },
    reserved: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', dot: 'bg-blue-500' },
    maintenance: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    cleaning: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', dot: 'bg-purple-500' },
  };

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a,b) => a - b);
  const floorLabels = { 0: 'Ground Floor', 1: '1st Floor', 2: '2nd Floor', 3: '3rd Floor', 4: '4th Floor', 5: '5th Floor' };

  return (
    <>
      <Header title="Room Management" subtitle={isAdmin ? 'Floor plan and room status' : 'Available rooms overview'} />
      <div className="page-container">
        <div className="grid grid-cols-5 gap-3">
          {[
            { key: 'available', label: 'Available' },
            { key: 'occupied', label: 'Occupied' },
            { key: 'reserved', label: 'Reserved' },
            { key: 'maintenance', label: 'Maintenance' },
            { key: '', label: 'Total', statKey: 'total' },
          ].map(({ key, label, statKey }) => (
            <button key={label} onClick={() => setFilter(key)}
              className={`stat-card text-left ${filter === key ? 'ring-2 ring-blue-500' : ''}`}>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${statusStyles[key]?.dot || 'bg-gray-400'}`}></div>
                <span className="text-lg font-semibold text-gray-900">{stats[statKey || key] || 0}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 items-center">
          <span className="text-xs text-gray-500 mr-1">Floor:</span>
          <button onClick={() => setFloorFilter('')} className={`px-2.5 py-1 rounded text-xs ${!floorFilter ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>All</button>
          {floors.map(f => (
            <button key={f} onClick={() => setFloorFilter(String(f))}
              className={`px-2.5 py-1 rounded text-xs ${floorFilter === String(f) ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {floorLabels[f] || `Floor ${f}`}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center py-10 text-gray-400 text-sm">Loading...</p>
        ) : (
          (floorFilter ? [Number(floorFilter)] : floors).map(floor => (
            <div key={floor} className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Floor {floor} — {floorLabels[floor]}</h3>
              <div className="grid grid-cols-4 gap-3">
                {rooms.filter(r => r.floor === floor).map(room => {
                  const s = statusStyles[room.status] || statusStyles.available;
                  return (
                    <div key={room.id} onClick={() => viewRoom(room)}
                      className={`rounded border overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${s.border}`}>
                      {/* Room Image */}
                      <div className="h-28 bg-gray-200 relative overflow-hidden">
                        {room.image_url ? (
                          <img src={room.image_url} alt={room.room_type} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                          </div>
                        )}
                        <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg} ${s.text} border ${s.border}`}>
                          {room.status}
                        </div>
                      </div>
                      {/* Room Info */}
                      <div className={`p-3 ${s.bg}`}>
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="text-sm font-semibold text-gray-900">{room.room_number}</h4>
                        </div>
                        <p className="text-[11px] text-gray-500">{room.room_type}</p>
                        <div className="mt-1.5 space-y-0.5 text-[11px]">
                          <div className="flex justify-between"><span className="text-gray-500">1 pax BB</span><span className="font-medium text-gray-800">{formatCurrency(room.rate_per_night)}</span></div>
                          {room.rate_double && <div className="flex justify-between"><span className="text-gray-500">2 pax BB</span><span className="font-medium text-gray-800">{formatCurrency(room.rate_double)}</span></div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={`Room ${selectedRoom?.room_number}`} size="md">
          {selectedRoom && (
            <div className="space-y-4">
              {/* Room Image */}
              {selectedRoom.image_url && (
                <div className="rounded-lg overflow-hidden h-48">
                  <img src={selectedRoom.image_url} alt={selectedRoom.room_type} className="w-full h-full object-cover" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded border border-gray-200 p-3">
                  <p className="text-[11px] text-gray-500">Type</p>
                  <p className="text-sm font-medium text-gray-900">{selectedRoom.room_type}</p>
                </div>
                <div className="bg-gray-50 rounded border border-gray-200 p-3">
                  <p className="text-[11px] text-gray-500">Floor</p>
                  <p className="text-sm text-gray-900">{floorLabels[selectedRoom.floor] || `Floor ${selectedRoom.floor}`}</p>
                </div>
                <div className="bg-gray-50 rounded border border-gray-200 p-3">
                  <p className="text-[11px] text-gray-500">1 Pax BB</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(selectedRoom.rate_per_night)}</p>
                </div>
                <div className="bg-gray-50 rounded border border-gray-200 p-3">
                  <p className="text-[11px] text-gray-500">2 Pax BB</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(selectedRoom.rate_double || selectedRoom.rate_per_night)}</p>
                </div>
                <div className="bg-gray-50 rounded border border-gray-200 p-3 col-span-2">
                  <p className="text-[11px] text-gray-500">Status</p>
                  <p className={`text-sm font-medium capitalize ${statusStyles[selectedRoom.status]?.text}`}>{selectedRoom.status}</p>
                </div>
              </div>
              {selectedRoom.description && <p className="text-sm text-gray-600">{selectedRoom.description}</p>}
              {selectedRoom.amenities && (
                <div>
                  <p className="text-[11px] text-gray-500 mb-1.5">Amenities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRoom.amenities.split(',').map((a, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{a.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedRoom.current_guest && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-[11px] text-blue-600 font-medium mb-1">Current Guest</p>
                  <p className="text-sm font-medium text-gray-900">{selectedRoom.current_guest.first_name} {selectedRoom.current_guest.last_name}</p>
                  <p className="text-xs text-gray-500">{selectedRoom.current_guest.phone}</p>
                </div>
              )}

              <div>
                <p className="text-[11px] text-gray-500 mb-1.5">Change Status</p>
                <div className="flex gap-2">
                  {['available', 'maintenance', 'cleaning'].filter(s => s !== selectedRoom.status).map(s => (
                    <button key={s} onClick={() => updateStatus(selectedRoom.id, s)}
                      className={`px-3 py-1.5 rounded text-xs capitalize border ${statusStyles[s]?.bg} ${statusStyles[s]?.border} ${statusStyles[s]?.text}`}>
                      Set {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </>
  );
}
