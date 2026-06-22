import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Modal from '../components/Modal';
import api from '../utils/api';

const TASK_TYPES = [
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'deep_cleaning', label: 'Deep Cleaning' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'turndown', label: 'Turndown Service' },
  { value: 'restocking', label: 'Restocking' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'badge-gray' },
  { value: 'normal', label: 'Normal', color: 'badge-blue' },
  { value: 'high', label: 'High', color: 'badge-gold' },
  { value: 'urgent', label: 'Urgent', color: 'badge-red' },
];

export default function Housekeeping() {
  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ room_id: '', task_type: 'cleaning', priority: 'normal', assigned_to: '', notes: '' });

  useEffect(() => { loadAll(); }, [filter]);

  const loadAll = async () => {
    try {
      const [t, r] = await Promise.all([
        api.getHousekeeping(filter ? { status: filter } : {}),
        api.getRooms(),
      ]);
      setTasks(t);
      setRooms(r.rooms);
      try { setUsers(await api.getUsers()); } catch(e) {}
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createTask({ ...form, room_id: Number(form.room_id), assigned_to: form.assigned_to ? Number(form.assigned_to) : null });
      setShowModal(false);
      setForm({ room_id: '', task_type: 'cleaning', priority: 'normal', assigned_to: '', notes: '' });
      loadAll();
      flash('Task created.');
    } catch (err) { console.error(err); }
  };

  const handleStart = async (id) => { await api.startTask(id); loadAll(); };
  const handleComplete = async (id) => { await api.completeTask(id); loadAll(); flash('Task completed. Room available.'); };
  const handleDelete = async (id) => { if (!confirm('Delete task?')) return; await api.deleteTask(id); loadAll(); };

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const statusColors = { pending: 'bg-yellow-100 text-yellow-800', in_progress: 'bg-blue-100 text-blue-800', completed: 'bg-green-100 text-green-800' };
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <>
      <Header title="Housekeeping" subtitle="Room cleaning, maintenance & task management" />
      <div className="page-container">
        {success && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">{success}</div>}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <button onClick={() => setFilter('')} className={`stat-card text-left ${!filter ? 'ring-2 ring-blue-500' : ''}`}>
            <p className="text-lg font-bold text-gray-900">{tasks.length}</p><p className="text-xs text-gray-500">All Tasks</p>
          </button>
          <button onClick={() => setFilter('pending')} className={`stat-card text-left border-l-4 border-l-yellow-500 ${filter === 'pending' ? 'ring-2 ring-blue-500' : ''}`}>
            <p className="text-lg font-bold text-gray-900">{pendingCount}</p><p className="text-xs text-gray-500">Pending</p>
          </button>
          <button onClick={() => setFilter('in_progress')} className={`stat-card text-left border-l-4 border-l-blue-500 ${filter === 'in_progress' ? 'ring-2 ring-blue-500' : ''}`}>
            <p className="text-lg font-bold text-gray-900">{inProgressCount}</p><p className="text-xs text-gray-500">In Progress</p>
          </button>
          <button onClick={() => setFilter('completed')} className={`stat-card text-left border-l-4 border-l-green-500 ${filter === 'completed' ? 'ring-2 ring-blue-500' : ''}`}>
            <p className="text-lg font-bold text-gray-900">{completedCount}</p><p className="text-xs text-gray-500">Completed</p>
          </button>
        </div>

        <div className="flex justify-end">
          <button onClick={() => setShowModal(true)} className="btn-primary text-xs">+ New Task</button>
        </div>

        {/* Task Cards */}
        {loading ? <p className="text-center py-10 text-gray-400 text-sm">Loading...</p> : (
          <div className="grid grid-cols-3 gap-3">
            {tasks.length > 0 ? tasks.map(t => (
              <div key={t.id} className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                {t.room_image && <div className="h-24 bg-gray-100"><img src={t.room_image} alt="" className="w-full h-full object-cover" /></div>}
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Room {t.room_number}</p>
                      <p className="text-[11px] text-gray-500">Floor {t.floor} &middot; {t.room_type}</p>
                    </div>
                    <span className={`badge ${statusColors[t.status]}`}>{t.status.replace('_', ' ')}</span>
                  </div>
                  <div className="space-y-1 text-xs mb-3">
                    <div className="flex justify-between"><span className="text-gray-500">Task</span><span className="text-gray-900 capitalize">{t.task_type.replace('_', ' ')}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className={PRIORITIES.find(p => p.value === t.priority)?.color || 'badge-gray'}>{t.priority}</span></div>
                    {t.assigned_to_name && <div className="flex justify-between"><span className="text-gray-500">Assigned</span><span className="text-gray-900">{t.assigned_to_name}</span></div>}
                    {t.notes && <p className="text-gray-500 italic mt-1">{t.notes}</p>}
                    <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="text-gray-400">{fmtDateTime(t.created_at)}</span></div>
                    {t.started_at && <div className="flex justify-between"><span className="text-gray-500">Started</span><span className="text-gray-400">{fmtDateTime(t.started_at)}</span></div>}
                    {t.completed_at && <div className="flex justify-between"><span className="text-gray-500">Done</span><span className="text-green-600">{fmtDateTime(t.completed_at)}</span></div>}
                  </div>
                  <div className="flex gap-1.5">
                    {t.status === 'pending' && <button onClick={() => handleStart(t.id)} className="flex-1 btn-primary text-[11px] py-1">Start</button>}
                    {t.status === 'in_progress' && <button onClick={() => handleComplete(t.id)} className="flex-1 btn-success text-[11px] py-1">Complete</button>}
                    {t.status !== 'completed' && <button onClick={() => handleDelete(t.id)} className="px-2 py-1 text-[11px] rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">Cancel</button>}
                  </div>
                </div>
              </div>
            )) : <p className="col-span-3 text-center py-10 text-gray-400">No tasks</p>}
          </div>
        )}

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Housekeeping Task" size="md">
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="label-field">Room *</label>
              <select className="select-field" value={form.room_id} onChange={(e) => setForm(p => ({ ...p, room_id: e.target.value }))} required>
                <option value="">Select room...</option>
                {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number} - {r.room_type} ({r.status})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-field">Task Type</label>
                <select className="select-field" value={form.task_type} onChange={(e) => setForm(p => ({ ...p, task_type: e.target.value }))}>
                  {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label className="label-field">Priority</label>
                <select className="select-field" value={form.priority} onChange={(e) => setForm(p => ({ ...p, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            {users.length > 0 && (
              <div><label className="label-field">Assign To</label>
                <select className="select-field" value={form.assigned_to} onChange={(e) => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            )}
            <div><label className="label-field">Notes</label><textarea className="input-field" rows="2" value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Create Task</button>
            </div>
          </form>
        </Modal>
      </div>
    </>
  );
}

function fmtDateTime(s) { if (!s) return '-'; const d = new Date(s); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
