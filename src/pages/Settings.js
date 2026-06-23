import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Settings() {
  const { settings, updateSettings, currencies, countries } = useSettings();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [form, setForm] = useState({});
  const [users, setUsers] = useState([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userShifts, setUserShifts] = useState([]);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'receptionist' });
  const [modalError, setModalError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setForm({ ...settings });
    if (isAdmin) loadUsers();
  }, [settings]);

  const loadUsers = async () => {
    try { setUsers(await api.getUsers()); }
    catch (err) { console.error(err); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await updateSettings(form);
      flash('Settings saved.');
    } catch (err) { setError(err.message); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setModalError('');
    setCreating(true);
    try {
      await api.createUser(newUser);
      setShowUserModal(false);
      setModalError('');
      setNewUser({ email: '', password: '', full_name: '', role: 'receptionist' });
      loadUsers();
      flash('Staff account created successfully.');
    } catch (err) { setModalError(err.message || 'Failed to create user.'); }
    finally { setCreating(false); }
  };

  const handleToggleStatus = async (user) => {
    const action = user.is_active ? 'suspend' : 'activate';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${user.full_name}?`)) return;
    try {
      await api.setUserStatus(user.id, !user.is_active);
      loadUsers();
      flash(`${user.full_name} has been ${action}d.`);
    } catch (err) { setError(err.message); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    if (newPassword.length < 6) { setResetError('Password must be at least 6 characters.'); return; }
    setResetting(true);
    try {
      await api.resetUserPassword(resetUser.id, newPassword);
      setShowResetModal(false);
      setNewPassword('');
      setResetUser(null);
      flash(`Password reset for ${resetUser.full_name}.`);
    } catch (err) { setResetError(err.message || 'Failed to reset password.'); }
    finally { setResetting(false); }
  };

  const handleChangeRole = async (user) => {
    const newRole = user.role === 'admin' ? 'receptionist' : 'admin';
    if (!confirm(`Change ${user.full_name}'s role to ${newRole}?`)) return;
    try {
      await api.setUserRole(user.id, newRole);
      loadUsers();
      flash(`${user.full_name} is now ${newRole}.`);
    } catch (err) { setError(err.message); }
  };

  const viewShifts = async (user) => {
    setSelectedUser(user);
    try {
      const shifts = await api.getUserShifts(user.id, 50);
      setUserShifts(shifts);
      setShowShiftModal(true);
    } catch (err) { console.error(err); }
  };

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  if (!isAdmin) {
    return (
      <>
        <Header title="Settings" />
        <div className="page-container"><div className="card text-center py-10"><p className="text-gray-500">Admin access required.</p></div></div>
      </>
    );
  }

  const tabs = [
    { key: 'users', label: 'Staff & Shifts' },
    { key: 'hotel', label: 'Hotel Settings' },
    { key: 'permissions', label: 'Permissions' },
  ];

  return (
    <>
      <Header title="Settings" subtitle="System configuration & staff management" />
      <div className="page-container">
        {success && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">{success}</div>}
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded p-0.5 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === t.key ? 'bg-blue-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Staff & Shifts Tab ── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title mb-0">Staff Accounts ({users.length})</h3>
              <button onClick={() => setShowUserModal(true)} className="btn-primary text-xs">+ Add Staff</button>
            </div>

            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="text-left py-2.5 px-4">Staff Member</th>
                    <th className="text-left py-2.5 px-4">Role</th>
                    <th className="text-left py-2.5 px-4">Status</th>
                    <th className="text-left py-2.5 px-4">Today's Shift</th>
                    <th className="text-left py-2.5 px-4">Last Login</th>
                    <th className="text-center py-2.5 px-4">Total Shifts</th>
                    <th className="text-right py-2.5 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const isOnline = u.today_shift && !u.today_shift.logout_time;
                    return (
                      <tr key={u.id} className="table-row">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-600">{u.full_name?.split(' ').map(n => n[0]).join('')}</span>
                              </div>
                              {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{u.full_name}</p>
                              <p className="text-[11px] text-gray-500">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={u.role === 'admin' ? 'badge-blue' : 'badge-gray'}>{u.role}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          {u.is_active ? (
                            <span className="badge-green">{isOnline ? 'Online' : 'Active'}</span>
                          ) : (
                            <span className="badge-red">Suspended</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          {u.today_shift ? (
                            <div>
                              <p className="text-xs text-gray-900">In: {formatTime(u.today_shift.login_time)}</p>
                              <p className="text-xs text-gray-500">{u.today_shift.logout_time ? `Out: ${formatTime(u.today_shift.logout_time)}` : 'Still on shift'}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">No shift today</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          {u.last_shift ? (
                            <div>
                              <p className="text-xs text-gray-700">{formatDate(u.last_shift.login_time)}</p>
                              <p className="text-[10px] text-gray-400">
                                {u.last_shift.logout_time
                                  ? `${formatTime(u.last_shift.login_time)} - ${formatTime(u.last_shift.logout_time)}`
                                  : `${formatTime(u.last_shift.login_time)} - ongoing`}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Never</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button onClick={() => viewShifts(u)} className="text-sm font-medium text-blue-600 hover:underline">
                            {u.total_shifts}
                          </button>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex gap-1.5 justify-end flex-wrap">
                            <button onClick={() => viewShifts(u)} className="px-2 py-1 text-[11px] rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                              Shifts
                            </button>
                            <button onClick={() => { setResetUser(u); setShowResetModal(true); setResetError(''); setNewPassword(''); }}
                              className="px-2 py-1 text-[11px] rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200">
                              Reset Password
                            </button>
                            <button onClick={() => handleChangeRole(u)}
                              className="px-2 py-1 text-[11px] rounded bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200">
                              {u.role === 'admin' ? 'Make Receptionist' : 'Make Admin'}
                            </button>
                            {u.role !== 'admin' && (
                              <button onClick={() => handleToggleStatus(u)}
                                className={`px-2 py-1 text-[11px] rounded ${u.is_active
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                  : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'}`}>
                                {u.is_active ? 'Suspend' : 'Activate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Hotel Settings Tab ── */}
        {activeTab === 'hotel' && (
          <div className="space-y-4 max-w-2xl">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="card">
                <h3 className="section-title">Hotel Identity</h3>
                <div className="space-y-3">
                  <div>
                    <label className="label-field">Hotel Logo</label>
                    {form.hotel_logo ? (
                      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded border border-gray-200">
                        <img src={form.hotel_logo} alt="Logo" className="h-14 object-contain" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Current logo</p>
                          <button type="button" onClick={() => setForm(p => ({ ...p, hotel_logo: '' }))} className="text-xs text-red-600 hover:underline mt-1">Remove logo</button>
                        </div>
                        <label className="btn-secondary text-xs cursor-pointer">
                          Change
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files[0]; if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => setForm(p => ({ ...p, hotel_logo: ev.target.result }));
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded border-2 border-dashed border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                        <span className="text-sm text-gray-600 font-medium">Click to upload logo</span>
                        <span className="text-[11px] text-gray-400 mt-0.5">PNG, JPG, or SVG</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files[0]; if (!file) return;
                          if (file.size > 500000) { setError('Logo must be under 500KB.'); return; }
                          const reader = new FileReader();
                          reader.onload = (ev) => setForm(p => ({ ...p, hotel_logo: ev.target.result }));
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">Appears on receipts and login page. Max 500KB.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-field">Hotel / System Name</label>
                      <input type="text" className="input-field" value={form.hotel_name || ''} onChange={(e) => setForm(p => ({ ...p, hotel_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label-field">Tagline</label>
                      <input type="text" className="input-field" value={form.hotel_tagline || ''} onChange={(e) => setForm(p => ({ ...p, hotel_tagline: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="section-title">Contact & Legal (shown on receipts)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label-field">Address</label>
                    <input type="text" className="input-field" placeholder="e.g. KG 7 Ave, Kigali, Rwanda" value={form.hotel_address || ''} onChange={(e) => setForm(p => ({ ...p, hotel_address: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label-field">Phone</label>
                    <input type="text" className="input-field" placeholder="+250 788 000 000" value={form.hotel_phone || ''} onChange={(e) => setForm(p => ({ ...p, hotel_phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label-field">Email</label>
                    <input type="text" className="input-field" placeholder="info@hotel.com" value={form.hotel_email || ''} onChange={(e) => setForm(p => ({ ...p, hotel_email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label-field">TIN / Tax Number</label>
                    <input type="text" className="input-field" placeholder="Tax identification number" value={form.hotel_tin || ''} onChange={(e) => setForm(p => ({ ...p, hotel_tin: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="section-title">Region & Currency</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-field">Country</label>
                    <select className="select-field" value={form.country || ''} onChange={(e) => {
                      const country = countries.find(c => c.name === e.target.value);
                      setForm(p => ({ ...p, country: e.target.value, currency: country?.currency || p.currency }));
                    }}>
                      {countries.map(c => <option key={c.code} value={c.name}>{c.name} ({c.phone})</option>)}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-field">Currency</label>
                    <select className="select-field" value={form.currency || ''} onChange={(e) => setForm(p => ({ ...p, currency: e.target.value }))}>
                      {Object.values(currencies).map(c => <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn-primary w-full">Save All Settings</button>
            </form>
          </div>
        )}

        {/* ── Permissions Tab ── */}
        {activeTab === 'permissions' && (
          <div className="card max-w-2xl">
            <h3 className="section-title">Role Permissions</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="text-left py-2 px-3">Feature</th>
                  <th className="text-center py-2 px-3">Admin</th>
                  <th className="text-center py-2 px-3">Receptionist</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Dashboard', true, true],
                  ['Guest Check-In', true, true],
                  ['Guest Check-Out', true, true],
                  ['Guest Search', true, true],
                  ['Reservations', true, true],
                  ['Room Overview (view only)', true, true],
                  ['Room Status Changes', true, false],
                  ['Payments (own sales only)', true, true],
                  ['Payments (all staff)', true, false],
                  ['Reports & Analytics', true, false],
                  ['Settings & User Management', true, false],
                  ['Suspend / Activate Users', true, false],
                  ['View Shift History', true, false],
                ].map(([feature, admin, reception]) => (
                  <tr key={feature} className="table-row">
                    <td className="py-2 px-3 text-gray-700">{feature}</td>
                    <td className="py-2 px-3 text-center">{admin ? <span className="text-green-600 font-medium">Yes</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="py-2 px-3 text-center">{reception ? <span className="text-green-600 font-medium">Yes</span> : <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add User Modal */}
        <Modal isOpen={showUserModal} onClose={() => { setShowUserModal(false); setModalError(''); }} title="Add Staff Account" size="sm">
          <form onSubmit={handleCreateUser} className="space-y-3">
            {modalError && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{modalError}</div>}
            <div><label className="label-field">Full Name *</label><input type="text" className="input-field" value={newUser.full_name} onChange={(e) => setNewUser(p => ({ ...p, full_name: e.target.value }))} required /></div>
            <div><label className="label-field">Email *</label><input type="email" className="input-field" value={newUser.email} onChange={(e) => setNewUser(p => ({ ...p, email: e.target.value }))} required /></div>
            <div><label className="label-field">Password *</label><input type="password" className="input-field" minLength={6} value={newUser.password} onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))} required /></div>
            <div>
              <label className="label-field">Role</label>
              <select className="select-field" value={newUser.role} onChange={(e) => setNewUser(p => ({ ...p, role: e.target.value }))}>
                <option value="receptionist">Receptionist</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowUserModal(false); setModalError(''); }} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary disabled:opacity-50">
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Shift History Modal */}
        <Modal isOpen={showShiftModal} onClose={() => setShowShiftModal(false)} title={`Shift History — ${selectedUser?.full_name}`} size="lg">
          {selectedUser && (
            <div>
              <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">{selectedUser.full_name?.split(' ').map(n => n[0]).join('')}</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{selectedUser.full_name}</p>
                  <p className="text-xs text-gray-500">{selectedUser.email} &middot; {selectedUser.role} &middot; {selectedUser.total_shifts} total shifts</p>
                </div>
              </div>

              {userShifts.length > 0 ? (
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="table-header">
                        <th className="text-left py-2 px-3">#</th>
                        <th className="text-left py-2 px-3">Date</th>
                        <th className="text-left py-2 px-3">Clock In</th>
                        <th className="text-left py-2 px-3">Clock Out</th>
                        <th className="text-left py-2 px-3">Duration</th>
                        <th className="text-left py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userShifts.map((s, i) => {
                        const duration = s.logout_time ? getDuration(s.login_time, s.logout_time) : null;
                        return (
                          <tr key={s.id} className="table-row">
                            <td className="py-2 px-3 text-gray-400 text-xs">{userShifts.length - i}</td>
                            <td className="py-2 px-3 text-gray-900">{formatDate(s.login_time)}</td>
                            <td className="py-2 px-3 text-gray-700">{formatTime(s.login_time)}</td>
                            <td className="py-2 px-3 text-gray-700">{s.logout_time ? formatTime(s.logout_time) : '—'}</td>
                            <td className="py-2 px-3 text-gray-600">{duration || '—'}</td>
                            <td className="py-2 px-3">
                              {s.logout_time
                                ? <span className="badge-gray">Completed</span>
                                : <span className="badge-green">Active</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-gray-400">No shift records found</p>
              )}
            </div>
          )}
        </Modal>

        {/* Reset Password Modal */}
        <Modal isOpen={showResetModal} onClose={() => { setShowResetModal(false); setResetError(''); }} title={`Reset Password — ${resetUser?.full_name}`} size="sm">
          {resetUser && (
            <form onSubmit={handleResetPassword} className="space-y-3">
              {resetError && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{resetError}</div>}
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-xs text-gray-500">Resetting password for</p>
                <p className="text-sm font-medium text-gray-900">{resetUser.full_name}</p>
                <p className="text-xs text-gray-500">{resetUser.email}</p>
              </div>
              <div>
                <label className="label-field">New Password *</label>
                <input type="password" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters" required minLength={6} autoFocus />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowResetModal(false); setResetError(''); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={resetting} className="btn-primary disabled:opacity-50">
                  {resetting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      </div>
    </>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getDuration(start, end) {
  const ms = new Date(end) - new Date(start);
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
