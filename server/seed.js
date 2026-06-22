const { initDatabase } = require('./database');
const db = require('./db-helper');
const bcrypt = require('bcryptjs');

async function seed() {
  await initDatabase();
  const salt = bcrypt.genSaltSync(10);

  const users = [
    { email: 'admin@terrassa.rw', password: bcrypt.hashSync('admin123', salt), full_name: 'System Administrator', role: 'admin' },
    { email: 'maria@terrassa.rw', password: bcrypt.hashSync('reception123', salt), full_name: 'Maria Santos', role: 'receptionist' },
    { email: 'james@terrassa.rw', password: bcrypt.hashSync('reception123', salt), full_name: 'James Ochieng', role: 'receptionist' },
    { email: 'amina@terrassa.rw', password: bcrypt.hashSync('reception123', salt), full_name: 'Amina Hassan', role: 'receptionist' },
  ];

  const roomImages = {
    'Junior Standard': 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80',
    'Senior Standard': 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80',
    'Deluxe':          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80',
  };

  // 9 rooms — your actual hotel layout
  const rooms = [
    // Ground Floor
    { room_number: '100', room_type: 'Junior Standard', floor: 0, capacity: 2, rate_per_night: 30000, rate_double: 40000, description: 'Junior standard room, ground floor', amenities: 'WiFi,TV,AC,Hot Shower,Breakfast Included' },
    { room_number: '101', room_type: 'Senior Standard', floor: 0, capacity: 2, rate_per_night: 40000, rate_double: 50000, description: 'Senior standard room, ground floor', amenities: 'WiFi,TV,AC,Hot Shower,Mini Bar,Breakfast Included,Desk' },
    { room_number: '102', room_type: 'Senior Standard', floor: 0, capacity: 2, rate_per_night: 40000, rate_double: 50000, description: 'Senior standard room, ground floor', amenities: 'WiFi,TV,AC,Hot Shower,Mini Bar,Breakfast Included,Desk' },

    // 1st Floor
    { room_number: '103', room_type: 'Senior Standard', floor: 1, capacity: 2, rate_per_night: 40000, rate_double: 50000, description: 'Senior standard room, 1st floor', amenities: 'WiFi,TV,AC,Hot Shower,Mini Bar,Breakfast Included,Desk,Balcony' },
    { room_number: '104', room_type: 'Junior Standard', floor: 1, capacity: 2, rate_per_night: 30000, rate_double: 40000, description: 'Junior standard room, 1st floor', amenities: 'WiFi,TV,AC,Hot Shower,Breakfast Included' },
    { room_number: '105', room_type: 'Deluxe',          floor: 1, capacity: 2, rate_per_night: 50000, rate_double: 60000, description: 'Deluxe room, 1st floor with premium furnishings', amenities: 'WiFi,TV,AC,Hot Shower,Mini Bar,Breakfast Included,Desk,Balcony,Bathrobe,Coffee Machine' },
    { room_number: '202', room_type: 'Junior Standard', floor: 1, capacity: 2, rate_per_night: 30000, rate_double: 40000, description: 'Junior standard room, 1st floor', amenities: 'WiFi,TV,AC,Hot Shower,Breakfast Included' },
    { room_number: '203', room_type: 'Deluxe',          floor: 1, capacity: 2, rate_per_night: 50000, rate_double: 60000, description: 'Deluxe room, 1st floor with premium furnishings', amenities: 'WiFi,TV,AC,Hot Shower,Mini Bar,Breakfast Included,Desk,Balcony,Bathrobe,Coffee Machine' },
    { room_number: '204', room_type: 'Junior Standard', floor: 1, capacity: 2, rate_per_night: 30000, rate_double: 40000, description: 'Junior standard room, 1st floor', amenities: 'WiFi,TV,AC,Hot Shower,Breakfast Included' },
  ];

  // Update default settings to Rwanda
  const defaultSettings = [
    ['hotel_name', 'Terrassa Village'],
    ['hotel_tagline', 'Hotel & Resort'],
    ['currency', 'RWF'],
    ['country', 'Rwanda'],
    ['timezone', 'Africa/Kigali'],
  ];

  console.log('Seeding users...');
  for (const u of users) {
    try { await db.insert('users', u); console.log(`  + ${u.email}`); }
    catch (e) { console.log(`  ~ ${u.email} (exists)`); }
  }

  console.log('Seeding rooms...');
  for (const r of rooms) {
    const img = roomImages[r.room_type] || roomImages['Junior Standard'];
    try { await db.insert('rooms', { ...r, image_url: img }); console.log(`  + Room ${r.room_number} — ${r.room_type} (${r.rate_per_night}/${r.rate_double} RWF)`); }
    catch (e) { console.log(`  ~ Room ${r.room_number} (exists)`); }
  }

  console.log('Setting defaults for Rwanda...');
  for (const [k, v] of defaultSettings) {
    try {
      const existing = await db.findOne('settings', { key: k });
      if (existing) { await db.update('settings', { key: k }, { value: v }); }
      else { await db.insert('settings', { key: k, value: v }); }
      console.log(`  = ${k}: ${v}`);
    } catch (e) { console.log(`  ~ ${k}`); }
  }

  console.log('\nDone! 9 rooms configured for Rwanda (RWF).');
  console.log('\nRoom Rates (Bed & Breakfast):');
  console.log('  Junior Standard: 30,000 RWF (1 pax) / 40,000 RWF (2 pax)');
  console.log('  Senior Standard: 40,000 RWF (1 pax) / 50,000 RWF (2 pax)');
  console.log('  Deluxe:          50,000 RWF (1 pax) / 60,000 RWF (2 pax)');
  console.log('\nDefault credentials:');
  console.log('  Admin:       admin@terrassa.rw / admin123');
  console.log('  Reception 1: maria@terrassa.rw / reception123');
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
