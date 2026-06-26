import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { useSettings } from '../context/SettingsContext';
import api from '../utils/api';

export default function Reservations() {
  const { formatCurrency, nationalities, countries } = useSettings();
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [filter, setFilter] = useState('confirmed');
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [guestSearch, setGuestSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ room_id: '', checkin_date: '', checkout_date: '', num_guests: 1, stay_type: 'night', notes: '', car_registration: '' });
  const [newGuest, setNewGuest] = useState({ first_name: '', last_name: '', phone: '', email: '', nationality: '', id_type: 'passport', id_number: '', vip_status: 'regular' });
  const [duplicates, setDuplicates] = useState([]);
  const [guestError, setGuestError] = useState('');

  useEffect(() => { loadReservations(); loadRooms(); }, [filter]);

  const loadReservations = async () => {
    try { setReservations(await api.getReservations({ status: filter || undefined })); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadRooms = async () => {
    try { const data = await api.getRooms(); setRooms(data.rooms); }
    catch (err) { console.error(err); }
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
      await api.createReservation({ guest_id: selectedGuest.id, ...form });
      setSuccess('Reservation created.');
      setShowModal(false);
      setSelectedGuest(null);
      setForm({ room_id: '', checkin_date: '', checkout_date: '', num_guests: 1, stay_type: 'night', notes: '', car_registration: '' });
      loadReservations();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) { setError(err.message); }
  };

  const handleCancel = async (id) => {
    if (!confirm('Cancel this reservation?')) return;
    try { await api.cancelReservation(id); loadReservations(); }
    catch (err) { console.error(err); }
  };

  const handleCreateGuest = async (e, force = false) => {
    e.preventDefault();
    setGuestError(''); setDuplicates([]);
    try {
      const guest = await api.createGuest({ ...newGuest, force });
      setSelectedGuest(guest);
      setShowGuestModal(false);
      setNewGuest({ first_name: '', last_name: '', phone: '', email: '', nationality: '', id_type: 'passport', id_number: '' });
      setDuplicates([]);
    } catch (err) {
      if (err.duplicates?.length > 0) {
        setDuplicates(err.duplicates);
        setGuestError('A guest with this phone or ID already exists. Select them below or create anyway.');
      } else {
        setGuestError(err.message);
      }
    }
  };

  const statusBadge = { confirmed: 'badge-green', checked_in: 'badge-blue', cancelled: 'badge-red', completed: 'badge-gray' };

  return (
    <>
      <Header title="Reservations" subtitle="Manage bookings" />
      <div className="page-container">
        {success && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">{success}</div>}

        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-white border border-gray-200 rounded p-0.5">
            {['confirmed', 'checked_in', 'cancelled', ''].map((s) => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded text-xs font-medium ${filter === s ? 'bg-blue-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {s === '' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">+ New Reservation</button>
        </div>

        <div className="card">
          {loading ? <p className="text-center py-8 text-gray-400 text-sm">Loading...</p>
          : reservations.length > 0 ? (
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="table-header">
                  <th className="text-left py-2.5 px-3">Guest</th>
                  <th className="text-left py-2.5 px-3">ID Type</th>
                  <th className="text-left py-2.5 px-3">Nationality</th>
                  <th className="text-left py-2.5 px-3">Room</th>
                  <th className="text-left py-2.5 px-3">Check-in</th>
                  <th className="text-left py-2.5 px-3">Check-out</th>
                  <th className="text-left py-2.5 px-3">Rate</th>
                  <th className="text-left py-2.5 px-3">Status</th>
                  <th className="text-right py-2.5 px-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="py-2.5 px-3"><p className="font-medium text-gray-900">{r.first_name} {r.last_name}</p><p className="text-xs text-gray-500">{r.phone}</p></td>
                    <td className="py-2.5 px-3 text-gray-600 text-xs capitalize">{r.id_type?.replace('_', ' ') || '-'}</td>
                    <td className="py-2.5 px-3 text-gray-600 text-xs">{r.nationality || '-'}</td>
                    <td className="py-2.5 px-3 text-gray-600">{r.room_number} - {r.room_type}</td>
                    <td className="py-2.5 px-3 text-gray-600">{formatDate(r.checkin_date)}</td>
                    <td className="py-2.5 px-3 text-gray-600">{formatDate(r.checkout_date)}</td>
                    <td className="py-2.5 px-3 font-medium text-gray-900">{formatCurrency(r.rate_per_night)}</td>
                    <td className="py-2.5 px-3"><span className={statusBadge[r.status] || 'badge-gray'}>{r.status}</span></td>
                    <td className="py-2.5 px-3 text-right">
                      {r.status === 'confirmed' && <button onClick={() => handleCancel(r.id)} className="text-xs text-red-600 hover:underline">Cancel</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-center py-10 text-gray-400">No reservations found</p>}
        </div>

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Reservation" size="lg">
          {error && <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="card-luxury">
              <label className="label-field">Guest</label>
              {selectedGuest ? (
                <div className="flex items-center justify-between p-2.5 bg-white rounded border border-gray-200">
                  <p className="text-sm text-gray-900">{selectedGuest.first_name} {selectedGuest.last_name} &middot; {selectedGuest.phone}</p>
                  <button type="button" onClick={() => setSelectedGuest(null)} className="text-xs text-blue-600">Change</button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input type="text" className="input-field" placeholder="Search guest..." value={guestSearch} onChange={(e) => searchGuests(e.target.value)} />
                  {guests.length > 0 && (
                    <div className="max-h-28 overflow-y-auto bg-white rounded border border-gray-200 p-1">
                      {guests.map((g) => (
                        <button key={g.id} type="button" onClick={() => { setSelectedGuest(g); setGuests([]); setGuestSearch(''); }}
                          className="w-full text-left p-2 rounded hover:bg-gray-50 text-sm text-gray-900">{g.first_name} {g.last_name} &middot; {g.phone}</button>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => setShowGuestModal(true)} className="btn-secondary text-xs py-1.5 w-full">+ New Guest</button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Room</label>
                <select className="select-field" value={form.room_id} onChange={(e) => setForm(p => ({ ...p, room_id: e.target.value }))} required>
                  <option value="">Select...</option>
                  {rooms.filter(r => r.status === 'available').map((r) => (
                    <option key={r.id} value={r.id}>{r.room_number} - {r.room_type} ({formatCurrency(r.rate_per_night)})</option>
                  ))}
                </select>
              </div>
              <div><label className="label-field">Guests</label><input type="number" min="1" className="input-field" value={form.num_guests} onChange={(e) => setForm(p => ({ ...p, num_guests: parseInt(e.target.value) }))} /></div>
              <div><label className="label-field">Check-in</label><input type="date" className="input-field" value={form.checkin_date} onChange={(e) => setForm(p => ({ ...p, checkin_date: e.target.value }))} required /></div>
              <div><label className="label-field">Check-out</label><input type="date" className="input-field" value={form.checkout_date} onChange={(e) => setForm(p => ({ ...p, checkout_date: e.target.value }))} required /></div>
              <div><label className="label-field">Stay Type</label><select className="select-field" value={form.stay_type} onChange={(e) => setForm(p => ({ ...p, stay_type: e.target.value }))}><option value="night">Night</option><option value="day">Day Use</option></select></div>
              <div><label className="label-field">Car Reg.</label><input type="text" className="input-field" value={form.car_registration} onChange={(e) => setForm(p => ({ ...p, car_registration: e.target.value }))} /></div>
            </div>
            <div><label className="label-field">Notes</label><textarea className="input-field" rows="2" value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}></textarea></div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Create Reservation</button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={showGuestModal} onClose={() => { setShowGuestModal(false); setDuplicates([]); setGuestError(''); }} title="Register Guest" size="md">
          {guestError && <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{guestError}</div>}
          {duplicates.length > 0 && (
            <div className="mb-3 border border-amber-200 rounded overflow-hidden">
              <div className="bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 uppercase">Existing guests found — select to use</div>
              {duplicates.map(d => (
                <button key={d.id} type="button" onClick={() => {
                  setSelectedGuest(d); setShowGuestModal(false); setDuplicates([]); setGuestError('');
                }} className="w-full text-left p-3 border-t border-amber-100 hover:bg-amber-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{d.first_name} {d.last_name}</p>
                    <p className="text-xs text-gray-500">{[d.phone, d.id_number, d.nationality].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className="text-xs text-blue-600 font-medium">Select</span>
                </button>
              ))}
            </div>
          )}
          <form onSubmit={(e) => handleCreateGuest(e, duplicates.length > 0)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-field">First Name *</label><input type="text" className="input-field" value={newGuest.first_name} onChange={(e) => setNewGuest(p => ({ ...p, first_name: e.target.value }))} required /></div>
              <div><label className="label-field">Last Name *</label><input type="text" className="input-field" value={newGuest.last_name} onChange={(e) => setNewGuest(p => ({ ...p, last_name: e.target.value }))} required /></div>
              <div><label className="label-field">ID Type</label>
                <select className="select-field" value={newGuest.id_type} onChange={(e) => setNewGuest(p => ({ ...p, id_type: e.target.value }))}>
                  <option value="passport">Passport</option><option value="national_id">National ID</option><option value="driving_license">Driving License</option><option value="military_id">Military ID</option>
                </select>
              </div>
              <div><label className="label-field">ID Number</label><input type="text" className="input-field" value={newGuest.id_number} onChange={(e) => setNewGuest(p => ({ ...p, id_number: e.target.value }))} /></div>
              <div><label className="label-field">Nationality</label>
                <select className="select-field" value={newGuest.nationality} onChange={(e) => setNewGuest(p => ({ ...p, nationality: e.target.value }))}>
                  <option value="">Select...</option>
                  {nationalities.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div><label className="label-field">Phone</label>
                <div className="flex gap-1">
                  <select className="select-field w-24 text-xs" onChange={(e) => { if (e.target.value) setNewGuest(p => ({ ...p, phone: e.target.value })); }}>
                    <option value="">Code</option>
                    {countries.map(c => <option key={c.code} value={c.phone}>{c.phone} {c.name}</option>)}
                  </select>
                  <input type="tel" className="input-field flex-1" placeholder="Phone number" value={newGuest.phone} onChange={(e) => setNewGuest(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div><label className="label-field">Email</label><input type="email" className="input-field" value={newGuest.email} onChange={(e) => setNewGuest(p => ({ ...p, email: e.target.value }))} /></div>
              <div><label className="label-field">VIP</label>
                <select className="select-field" value={newGuest.vip_status} onChange={(e) => setNewGuest(p => ({ ...p, vip_status: e.target.value }))}>
                  <option value="regular">Regular</option><option value="vip">VIP</option><option value="vvip">VVIP</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowGuestModal(false); setDuplicates([]); setGuestError(''); }} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">{duplicates.length > 0 ? 'Create Anyway' : 'Register'}</button>
            </div>
          </form>
        </Modal>
      </div>
    </>
  );
}

function formatDate(dateStr) { if (!dateStr) return '-'; return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
