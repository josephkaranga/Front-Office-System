/**
 * ============================================================
 *  API CLIENT — Frontend HTTP Client
 * ============================================================
 *
 *  Singleton HTTP client for all backend API calls.
 *  Handles JWT token management, auto-logout on 401/403,
 *  and provides typed methods for every endpoint.
 *
 *  Usage:
 *    import api from './utils/api';
 *    const data = await api.getDashboard();
 *    await api.checkIn({ guest_id: 1, room_id: 2, ... });
 *
 *  In production (Vercel): uses relative /api paths.
 *  In development: proxies to localhost:3001.
 * ============================================================
 */

const API_BASE = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  /** Store or clear JWT token */
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  /** Core request method — adds auth header, handles errors */
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });

    const data = await response.json();

    if (!response.ok) {
      if ((response.status === 401 || response.status === 403) && !endpoint.includes('/auth/login')) {
        this.setToken(null);
        window.location.href = '/';
        throw new Error('Session expired');
      }
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // ── HTTP Methods ──
  get(endpoint) { return this.request(endpoint); }
  post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); }
  put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); }
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }

  // ── Auth ──
  login(email, password) { return this.post('/auth/login', { email, password }); }
  register(data) { return this.post('/auth/register', data); }
  logout() { return this.post('/auth/logout', {}); }
  getMe() { return this.get('/auth/me'); }
  getUsers() { return this.get('/auth/users'); }
  createUser(data) { return this.post('/auth/users', data); }
  setUserStatus(id, is_active) { return this.put(`/auth/users/${id}/status`, { is_active }); }
  setUserRole(id, role) { return this.put(`/auth/users/${id}/role`, { role }); }
  getUserShifts(id, limit = 30) { return this.get(`/auth/users/${id}/shifts?limit=${limit}`); }
  getShifts(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/auth/shifts${qs ? `?${qs}` : ''}`); }
  changePassword(current_password, new_password) { return this.put('/auth/change-password', { current_password, new_password }); }
  resetUserPassword(userId, new_password) { return this.put(`/auth/users/${userId}/reset-password`, { new_password }); }

  // ── Guests ──
  getGuests(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/guests${qs ? `?${qs}` : ''}`); }
  getGuest(id) { return this.get(`/guests/${id}`); }
  createGuest(data) { return this.post('/guests', data); }
  updateGuest(id, data) { return this.put(`/guests/${id}`, data); }

  // ── Rooms ──
  getRooms(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/rooms${qs ? `?${qs}` : ''}`); }
  getRoom(id) { return this.get(`/rooms/${id}`); }
  updateRoomStatus(id, status) { return this.put(`/rooms/${id}/status`, { status }); }

  // ── Check-ins ──
  getCheckins(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/checkins${qs ? `?${qs}` : ''}`); }
  checkIn(data) { return this.post('/checkins', data); }
  checkOut(id) { return this.post(`/checkins/${id}/checkout`, {}); }

  // ── Reservations ──
  getReservations(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/reservations${qs ? `?${qs}` : ''}`); }
  createReservation(data) { return this.post('/reservations', data); }
  cancelReservation(id) { return this.put(`/reservations/${id}/cancel`, {}); }

  // ── Payments ──
  getPayments(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/payments${qs ? `?${qs}` : ''}`); }
  createPayment(data) { return this.post('/payments', data); }

  // ── Extras / Guest Folio ──
  getFolio(checkinId) { return this.get(`/extras/checkin/${checkinId}`); }
  addExtra(data) { return this.post('/extras', data); }
  deleteExtra(id) { return this.delete(`/extras/${id}`); }

  // ── Housekeeping ──
  getHousekeeping(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/housekeeping${qs ? `?${qs}` : ''}`); }
  createTask(data) { return this.post('/housekeeping', data); }
  startTask(id) { return this.put(`/housekeeping/${id}/start`, {}); }
  completeTask(id) { return this.put(`/housekeeping/${id}/complete`, {}); }
  deleteTask(id) { return this.delete(`/housekeeping/${id}`); }

  // ── Receipts ──
  getReceipt(checkinId) { return this.get(`/receipts/checkin/${checkinId}`); }

  // ── Reports ──
  getDashboard() { return this.get('/reports/dashboard'); }
  getRevenueReport(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/reports/revenue${qs ? `?${qs}` : ''}`); }
  getOccupancyReport(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/reports/occupancy${qs ? `?${qs}` : ''}`); }
  getGuestHistory(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/reports/guest-history${qs ? `?${qs}` : ''}`); }

  // ── Settings ──
  getSettings() { return this.get('/settings'); }
  updateSettings(data) { return this.put('/settings', data); }
}

const api = new ApiClient();
export default api;
