import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { useSettings } from '../context/SettingsContext';
import api from '../utils/api';

export default function CheckIn() {
  const { formatCurrency, nationalities, countries, settings, getPaymentMethods } = useSettings();
  const [rooms, setRooms] = useState([]);
  const [guests, setGuests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [guestSearch, setGuestSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1); // 1=guest+room, 2=payment
  const [checkinForm, setCheckinForm] = useState({
    expected_checkout: '', num_guests: 1, stay_type: 'night',
    car_registration: '', purpose: '', special_requests: '',
  });
  const [discount, setDiscount] = useState({ type: 'amount', value: '', reason: '' });
  const [paymentType, setPaymentType] = useState('not_paid');
  const [paymentForm, setPaymentForm] = useState({
    amount: '', payment_method: 'cash', reference_number: '',
  });
  const [newGuest, setNewGuest] = useState({
    first_name: '', last_name: '', id_type: 'passport', id_number: '',
    nationality: '', phone: '', email: '', address: '', vip_status: 'regular',
  });

  useEffect(() => { loadRooms(); }, []);

  const loadRooms = async () => {
    try { const data = await api.getRooms({ status: 'available' }); setRooms(data.rooms); }
    catch (err) { console.error(err); }
  };

  const searchGuests = async (term) => {
    setGuestSearch(term);
    if (term.length < 2) { setGuests([]); return; }
    try { const data = await api.getGuests({ search: term }); setGuests(data.guests); }
    catch (err) { console.error(err); }
  };

  const goToPayment = () => {
    setError('');
    if (!selectedGuest || !selectedRoom) { setError('Select a guest and room.'); return; }
    if (!checkinForm.expected_checkout) { setError('Set expected checkout date.'); return; }
    setPaymentType('not_paid');
    setPaymentForm(p => ({ ...p, amount: '' }));
    setStep(2);
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    setError('');
    if (paymentType !== 'not_paid' && (!paymentForm.amount || Number(paymentForm.amount) <= 0)) {
      setError('Enter a payment amount or select "No Payment".'); return;
    }
    try {
      const checkin = await api.checkIn({
        guest_id: selectedGuest.id, room_id: selectedRoom.id, ...checkinForm,
        original_rate: activeRate,
        charged_rate: effectiveRate,
        discount_per_night: discountPerNight,
        discount_reason: discount.reason || null,
      });

      if (paymentType !== 'not_paid' && Number(paymentForm.amount) > 0) {
        await api.createPayment({
          checkin_id: checkin.id, guest_id: selectedGuest.id,
          amount: Number(paymentForm.amount), payment_method: paymentForm.payment_method,
          reference_number: paymentForm.reference_number || null,
          description: `Room ${selectedRoom.room_number} (${nights}n × ${formatCurrency(effectiveRate)})`,
        });
      }

      const payMsg = paymentType === 'not_paid' ? 'No payment' : `Paid: ${formatCurrency(paymentForm.amount)}`;
      setSuccess(`${selectedGuest.first_name} ${selectedGuest.last_name} checked into Room ${selectedRoom.room_number}. ${payMsg}`);
      setShowModal(false); setSelectedGuest(null); setSelectedRoom(null); setStep(1);
      setCheckinForm({ expected_checkout: '', num_guests: 1, stay_type: 'night', car_registration: '', purpose: '', special_requests: '' });
      setPaymentForm({ amount: '', payment_method: 'cash', reference_number: '' });
      setPaymentType('not_paid');
      setDiscount({ type: 'amount', value: '', reason: '' });
      loadRooms();
      setTimeout(() => setSuccess(''), 6000);
    } catch (err) { setError(err.message); }
  };

  const handleCreateGuest = async (e) => {
    e.preventDefault();
    try {
      const guest = await api.createGuest(newGuest);
      setSelectedGuest(guest); setShowGuestModal(false);
      setNewGuest({ first_name: '', last_name: '', id_type: 'passport', id_number: '', nationality: '', phone: '', email: '', address: '', vip_status: 'regular' });
    } catch (err) { setError(err.message); }
  };

  const selectRoomAndOpen = (room) => {
    setSelectedRoom(room);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    setCheckinForm(prev => ({ ...prev, expected_checkout: tomorrow.toISOString().split('T')[0] }));
    setStep(1); setShowModal(true);
  };

  const calcNights = (from, to) => Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000));

  const nights = selectedRoom && checkinForm.expected_checkout
    ? calcNights(new Date().toISOString(), checkinForm.expected_checkout) : 0;

  const activeRate = (() => {
    if (!selectedRoom) return 0;
    const pax = Number(checkinForm.num_guests) || 1;
    if (pax >= 2 && selectedRoom.rate_double) return Number(selectedRoom.rate_double);
    return Number(selectedRoom.rate_per_night);
  })();

  const discountPerNight = (() => {
    if (!discount.value || Number(discount.value) <= 0) return 0;
    if (discount.type === 'percent') return Math.round(activeRate * (Number(discount.value) / 100));
    return Math.min(Number(discount.value), activeRate);
  })();
  const effectiveRate = activeRate - discountPerNight;
  const discountAmount = discountPerNight * nights;
  const finalTotal = effectiveRate * nights;

  return (
    <>
      <Header title="Guest Check-In" subtitle="Register arrivals and collect payment" />
      <div className="page-container">
        {success && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">{success}</div>}

        <div>
          <h3 className="section-title">Available Rooms ({rooms.length})</h3>
          <div className="grid grid-cols-4 gap-3">
            {rooms.map((room) => (
              <div key={room.id} onClick={() => selectRoomAndOpen(room)}
                className="bg-white border border-gray-200 rounded overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all">
                <div className="h-28 bg-gray-100 relative">
                  {room.image_url ? <img src={room.image_url} alt={room.room_type} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg></div>}
                  <span className="absolute top-2 left-2 badge-green text-[10px]">Available</span>
                </div>
                <div className="p-3">
                  <div className="mb-1">
                    <h4 className="text-sm font-semibold text-gray-900">Room {room.room_number}</h4>
                    <p className="text-[11px] text-gray-500">{room.room_type}</p>
                  </div>
                  <div className="space-y-0.5 text-[11px]">
                    <div className="flex justify-between"><span className="text-gray-500">1 pax BB</span><span className="font-medium text-gray-800">{formatCurrency(room.rate_per_night)}</span></div>
                    {room.rate_double && <div className="flex justify-between"><span className="text-gray-500">2 pax BB</span><span className="font-medium text-gray-800">{formatCurrency(room.rate_double)}</span></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {rooms.length === 0 && <div className="card text-center py-10"><p className="text-gray-400">No rooms available</p></div>}
        </div>

        {/* ── Check-In Modal ── */}
        <Modal isOpen={showModal} onClose={() => { setShowModal(false); setStep(1); }} title={`Check-In — Room ${selectedRoom?.room_number}`} size="lg">
          {error && <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-5">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${step === 1 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
              {step > 1 ? <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : '1.'} Guest & Room
            </div>
            <div className="w-8 h-px bg-gray-300"></div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${step === 2 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>2. Payment</div>
          </div>

          {/* ── Step 1: Guest & Stay Details ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="card-luxury">
                <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Guest</h4>
                {selectedGuest ? (
                  <div className="flex items-center justify-between p-2.5 bg-white rounded border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedGuest.first_name} {selectedGuest.last_name}</p>
                      <p className="text-xs text-gray-500">{selectedGuest.phone} {selectedGuest.nationality ? `· ${selectedGuest.nationality}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedGuest(null)} className="text-xs text-blue-600 hover:underline">Change</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input type="text" className="input-field" placeholder="Search by name, phone, or ID..." value={guestSearch} onChange={(e) => searchGuests(e.target.value)} />
                    {guests.length > 0 && (
                      <div className="max-h-32 overflow-y-auto space-y-1 bg-white rounded border border-gray-200 p-1.5">
                        {guests.map((g) => (
                          <button key={g.id} type="button" onClick={() => { setSelectedGuest(g); setGuests([]); setGuestSearch(''); }}
                            className="w-full text-left p-2 rounded hover:bg-gray-50">
                            <p className="text-sm text-gray-900">{g.first_name} {g.last_name}</p>
                            <p className="text-xs text-gray-500">{g.phone || 'No phone'}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => setShowGuestModal(true)} className="btn-secondary text-xs py-1.5 w-full">+ Register New Guest</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-field">Check-out Date *</label><input type="date" className="input-field" value={checkinForm.expected_checkout} onChange={(e) => setCheckinForm(p => ({ ...p, expected_checkout: e.target.value }))} required /></div>
                <div><label className="label-field">Guests</label><input type="number" min="1" max="10" className="input-field" value={checkinForm.num_guests} onChange={(e) => setCheckinForm(p => ({ ...p, num_guests: parseInt(e.target.value) }))} /></div>
                <div><label className="label-field">Stay Type</label>
                  <select className="select-field" value={checkinForm.stay_type} onChange={(e) => setCheckinForm(p => ({ ...p, stay_type: e.target.value }))}>
                    <option value="night">Night Stay</option><option value="day">Day Use</option><option value="hourly">Hourly</option>
                  </select>
                </div>
                <div><label className="label-field">Car Registration</label><input type="text" className="input-field" placeholder="e.g. KAA 123B" value={checkinForm.car_registration} onChange={(e) => setCheckinForm(p => ({ ...p, car_registration: e.target.value }))} /></div>
                <div><label className="label-field">Purpose</label>
                  <select className="select-field" value={checkinForm.purpose} onChange={(e) => setCheckinForm(p => ({ ...p, purpose: e.target.value }))}>
                    <option value="">Select...</option><option value="business">Business</option><option value="leisure">Leisure</option><option value="conference">Conference</option><option value="transit">Transit</option>
                  </select>
                </div>
                <div><label className="label-field">Special Requests</label><input type="text" className="input-field" placeholder="Extra pillows, late checkout..." value={checkinForm.special_requests} onChange={(e) => setCheckinForm(p => ({ ...p, special_requests: e.target.value }))} /></div>
              </div>

              {selectedRoom && (
                <div className="bg-gray-50 rounded border border-gray-200 p-3 space-y-2">
                  {/* Rate Info */}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Room {selectedRoom.room_number} · {selectedRoom.room_type}</span>
                    <span className="font-medium text-gray-900">
                      {Number(checkinForm.num_guests) >= 2 ? '2 pax' : '1 pax'} BB
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Rack rate per night</span>
                    <span className="font-medium text-gray-900">{formatCurrency(activeRate)}</span>
                  </div>

                  {/* Discount Section — per night */}
                  <div className="border-t border-gray-200 pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-medium text-gray-600 uppercase tracking-wide">Discount (per night)</label>
                      <div className="flex bg-white border border-gray-300 rounded overflow-hidden">
                        <button type="button" onClick={() => setDiscount(p => ({ ...p, type: 'amount' }))}
                          className={`px-2 py-0.5 text-[11px] ${discount.type === 'amount' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>{settings.currency}</button>
                        <button type="button" onClick={() => setDiscount(p => ({ ...p, type: 'percent' }))}
                          className={`px-2 py-0.5 text-[11px] ${discount.type === 'percent' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>%</button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input type="number" min="0" className="input-field w-28 text-sm"
                        placeholder={discount.type === 'percent' ? 'e.g. 10' : 'Per night'}
                        value={discount.value} onChange={(e) => setDiscount(p => ({ ...p, value: e.target.value }))} />
                      <input type="text" className="input-field flex-1 text-sm" placeholder="Reason (e.g. Corporate, Long stay, Promo)"
                        value={discount.reason} onChange={(e) => setDiscount(p => ({ ...p, reason: e.target.value }))} />
                    </div>
                    {discountPerNight > 0 && (
                      <div className="mt-1.5 text-[11px] text-green-700 space-y-0.5">
                        <p>-{formatCurrency(discountPerNight)}/night{discount.type === 'percent' ? ` (${discount.value}%)` : ''}{discount.reason ? ` — ${discount.reason}` : ''}</p>
                        <p className="font-medium">Effective rate: {formatCurrency(effectiveRate)}/night</p>
                      </div>
                    )}
                  </div>

                  {/* Totals */}
                  {nights > 0 && (
                    <div className="border-t border-gray-200 pt-2 space-y-1 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>{nights} night(s) × {formatCurrency(activeRate)}</span>
                        <span>{formatCurrency(nights * activeRate)}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>Discount ({nights}n × -{formatCurrency(discountPerNight)})</span>
                          <span>-{formatCurrency(discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
                        <span>Total Due</span>
                        <span>{formatCurrency(finalTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="button" onClick={goToPayment} className="btn-primary">Next: Payment</button>
              </div>
            </div>
          )}

          {/* ── Step 2: Payment ── */}
          {step === 2 && (
            <form onSubmit={handleCheckIn} className="space-y-4">
              <div className="bg-gray-50 rounded border border-gray-200 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Guest</span><span className="font-medium text-gray-900">{selectedGuest?.first_name} {selectedGuest?.last_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Room</span><span>{selectedRoom?.room_number} — {selectedRoom?.room_type}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Rate</span><span>{formatCurrency(effectiveRate)}/night{discountPerNight > 0 ? ` (${formatCurrency(discountPerNight)} off)` : ''}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Duration</span><span>{nights} night(s)</span></div>
                <div className="flex justify-between pt-2 border-t border-gray-200 font-bold"><span>Total Due</span><span className="text-lg">{formatCurrency(finalTotal)}</span></div>
              </div>

              <div>
                <label className="label-field">Initial Payment</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'paid_full', label: 'Paid in Full', desc: formatCurrency(finalTotal), color: 'green' },
                    { value: 'paid_partial', label: 'Partial Payment', desc: 'Enter amount', color: 'amber' },
                    { value: 'not_paid', label: 'No Payment', desc: 'Pay later', color: 'gray' },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => {
                      setPaymentType(opt.value);
                      if (opt.value === 'paid_full') setPaymentForm(p => ({ ...p, amount: finalTotal }));
                      else if (opt.value === 'not_paid') setPaymentForm(p => ({ ...p, amount: '' }));
                      else setPaymentForm(p => ({ ...p, amount: '' }));
                    }}
                      className={`p-3 rounded border-2 text-left transition-all ${paymentType === opt.value
                        ? `border-${opt.color}-500 bg-${opt.color}-50`
                        : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      <p className={`text-sm font-semibold ${paymentType === opt.value ? `text-${opt.color}-700` : 'text-gray-700'}`}>{opt.label}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {paymentType !== 'not_paid' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-field">Amount ({settings.currency})</label>
                    <input type="number" min="1" className="input-field" value={paymentForm.amount}
                      onChange={(e) => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                      readOnly={paymentType === 'paid_full'} required />
                  </div>
                  <div>
                    <label className="label-field">Payment Method</label>
                    <select className="select-field" value={paymentForm.payment_method} onChange={(e) => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))}>
                      {getPaymentMethods().map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="label-field">Reference No.</label>
                    <input type="text" className="input-field" placeholder="Transaction reference (optional)" value={paymentForm.reference_number} onChange={(e) => setPaymentForm(p => ({ ...p, reference_number: e.target.value }))} />
                  </div>
                </div>
              )}

              {paymentType === 'paid_partial' && Number(paymentForm.amount) > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-700 text-xs">
                  Paying {formatCurrency(paymentForm.amount)} of {formatCurrency(finalTotal)}. Balance: {formatCurrency(finalTotal - Number(paymentForm.amount))}
                </div>
              )}

              {paymentType === 'not_paid' && (
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded text-gray-600 text-xs">
                  Guest will check in without payment. Payment can be collected later from the folio.
                </div>
              )}

              <div className="flex gap-2 justify-between">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary">Back</button>
                <button type="submit" className="btn-success">Confirm Check-In</button>
              </div>
            </form>
          )}
        </Modal>

        {/* ── New Guest Modal ── */}
        <Modal isOpen={showGuestModal} onClose={() => setShowGuestModal(false)} title="Register New Guest" size="md">
          <form onSubmit={handleCreateGuest} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-field">First Name *</label><input type="text" className="input-field" value={newGuest.first_name} onChange={(e) => setNewGuest(p => ({ ...p, first_name: e.target.value }))} required /></div>
              <div><label className="label-field">Last Name *</label><input type="text" className="input-field" value={newGuest.last_name} onChange={(e) => setNewGuest(p => ({ ...p, last_name: e.target.value }))} required /></div>
              <div><label className="label-field">ID Type</label>
                <select className="select-field" value={newGuest.id_type} onChange={(e) => setNewGuest(p => ({ ...p, id_type: e.target.value }))}>
                  <option value="passport">Passport</option><option value="national_id">National ID</option><option value="driving_license">Driving License</option>
                </select>
              </div>
              <div><label className="label-field">ID Number</label><input type="text" className="input-field" value={newGuest.id_number} onChange={(e) => setNewGuest(p => ({ ...p, id_number: e.target.value }))} /></div>
              <div><label className="label-field">Nationality</label>
                <select className="select-field" value={newGuest.nationality} onChange={(e) => setNewGuest(p => ({ ...p, nationality: e.target.value }))}>
                  <option value="">Select...</option>{nationalities.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div><label className="label-field">Phone</label>
                <div className="flex gap-1">
                  <select className="select-field w-24 text-xs" onChange={(e) => { if (e.target.value) setNewGuest(p => ({ ...p, phone: e.target.value })); }}>
                    <option value="">Code</option>{countries.map(c => <option key={c.code} value={c.phone}>{c.phone} {c.name}</option>)}
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
              <button type="button" onClick={() => setShowGuestModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Register Guest</button>
            </div>
          </form>
        </Modal>
      </div>
    </>
  );
}
