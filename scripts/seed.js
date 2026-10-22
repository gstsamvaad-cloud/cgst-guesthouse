require('dotenv').config();
const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

const ROOMS = [
  { label: 'AC Suite 101', type: 'suite' },
  { label: 'AC Suite 102', type: 'suite' },
  { label: 'AC Room 201',  type: 'room'  },
  { label: 'AC Room 202',  type: 'room'  },
  { label: 'AC Room 203',  type: 'room'  },
];

const OFFICER = {
  name: 'JC / ADC (Admin)', email: 'officer@cgst.gov.in',
  mobile: '9000000000', role: 'officer',
  password: 'Officer@123#Change',  // ← CHANGE AFTER FIRST LOGIN
};

(async () => {
  console.log('Seeding…');
  try {
    for (const r of ROOMS) {
      const ex = await sql.query('SELECT id FROM rooms WHERE label=$1', [r.label]);
      if (!ex.rows.length) await sql.query('INSERT INTO rooms (label,type) VALUES ($1,$2)', [r.label, r.type]);
    }
    console.log(`✓ ${ROOMS.length} rooms ready.`);

    const ex = await sql.query('SELECT id FROM users WHERE email=$1', [OFFICER.email]);
    if (!ex.rows.length) {
      const hash = await bcrypt.hash(OFFICER.password, 12);
      await sql.query('INSERT INTO users (name,email,mobile,role,password_hash) VALUES ($1,$2,$3,$4,$5)',
        [OFFICER.name, OFFICER.email, OFFICER.mobile, OFFICER.role, hash]);
      console.log(`✓ Officer: ${OFFICER.email}  password: ${OFFICER.password}  ← CHANGE THIS`);
    } else {
      console.log('  Officer already exists.');
    }
    console.log('✓ Seed complete.');
  } catch (e) { console.error('Seed failed:', e.message); process.exit(1); }
})();
