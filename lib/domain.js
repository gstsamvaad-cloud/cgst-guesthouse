const APPLICANT_TYPES = [
  { v: 'duty',    label: 'Departmental officer — official duty',         priority: 1 },
  { v: 'private', label: 'Departmental officer — private visit',         priority: 2 },
  { v: 'other',   label: 'Officer of other Central/State Govt/PSU/Bank', priority: 3 },
  { v: 'retired', label: 'Retired departmental official',                priority: 4 },
  { v: 'guest',   label: 'Guest of a departmental officer',              priority: 5 },
];

const RATES = {
  duty:    { suite: 450,  room: 350 },
  private: { suite: 600,  room: 400 },
  other:   { suite: 1000, room: 800 },
  retired: { suite: 600,  room: 400 },
  guest:   { suite: 750,  room: 600 },
};

const getRoomType  = grp        => grp === 'A' ? 'suite' : 'room';
const getRate      = (type, rt) => RATES[type]?.[rt] ?? 0;
const calcNights   = (ci, co)   => Math.max(0, Math.round((new Date(co) - new Date(ci)) / 86400000));
const priorityOf   = type       => APPLICANT_TYPES.find(t => t.v === type)?.priority ?? 99;
const fmtDate      = s          => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

module.exports = { APPLICANT_TYPES, RATES, getRoomType, getRate, calcNights, priorityOf, fmtDate };
