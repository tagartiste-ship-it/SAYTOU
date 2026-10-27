import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

// All persistence is replaced before any request. Never connects to a real database.
process.env.DATABASE_URL = 'postgresql://test:test@localhost:1/test';
process.env.JWT_SECRET = 'isolated-meeting-tests';
process.env.NODE_ENV = 'test';
const { default: prisma } = await import('../dist/utils/prisma.js');
const { default: router } = await import('../dist/routes/rencontres.routes.js');
const { generateAccessToken } = await import('../dist/utils/jwt.js');

const units = [
  { id: 'cell', scopeType: 'LOCALITE', scopeId: 'locality', isVisible: true, definition: { name: 'Sociale', kind: 'CELLULE', isActive: true } },
  { id: 'commission', scopeType: 'LOCALITE', scopeId: 'locality', isVisible: true, definition: { name: 'Logistique', kind: 'COMMISSION', isActive: true } },
  { id: 'foreign', scopeType: 'LOCALITE', scopeId: 'other', isVisible: true, definition: { name: 'Autre', kind: 'CELLULE', isActive: true } },
];
let assigned = ['cell', 'commission'];
let meetings;
const match = (row, where = {}) => Object.entries(where).every(([key, value]) => {
  if (key === 'AND') return value.every((w) => match(row, w));
  if (key === 'OR') return value.some((w) => match(row, w));
  if (value === null || typeof value !== 'object') return row[key] === value;
  if ('in' in value) return value.in.includes(row[key]);
  if ('gte' in value || 'lte' in value || 'lt' in value) {
    const current = new Date(row[key]).getTime();
    return (!value.gte || current >= new Date(value.gte).getTime()) && (!value.lte || current <= new Date(value.lte).getTime()) && (!value.lt || current < new Date(value.lt).getTime());
  }
  return row[key] != null && match(row[key], value);
});
const decorate = (m) => ({ ...m, type: { id: 'type', name: 'Réunion', isReunion: true }, section: null,
  orgUnitInstance: units.find((u) => u.id === m.orgUnitInstanceId) ?? null,
  createdBy: { id: 'resp', name: 'Responsable' } });
prisma.user.findUnique = async ({ where }) => ({ id: where.id, sectionId: where.id === 'section' ? 'section-id' : null, sousLocaliteId: null, localiteId: 'locality' });
prisma.section.findMany = async () => [{ id: 'section-id' }];
prisma.orgUnitAssignment.findMany = async ({ where }) => where.userId === 'resp' ? assigned.filter((id) => units.some((u) => u.id === id && u.isVisible && u.definition.isActive)).map((instanceId) => ({ instanceId })) : [];
prisma.orgUnitInstance.findMany = async ({ where }) => units.filter((u) => match(u, where));
prisma.rencontreType.findUnique = async () => ({ id: 'type', name: 'Réunion', isReunion: true });
prisma.rencontre.create = async ({ data }) => {
  const row = decorate({ id: `new-${meetings.length}`, createdAt: new Date(), ...data });
  meetings.push(row);
  return row;
};
prisma.rencontre.count = async ({ where }) => meetings.filter((m) => match(m, where)).length;
prisma.rencontre.findMany = async ({ where, skip = 0, take = meetings.length }) => meetings.filter((m) => match(m, where))
  .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id)).slice(skip, skip + take);
prisma.rencontre.groupBy = async ({ where }) => {
  const days = new Map();
  for (const m of meetings.filter((m) => match(m, where))) {
    const date = new Date(m.date).toISOString().slice(0, 10);
    const row = days.get(date) || { date: new Date(date), _count: { _all: 0 }, _sum: { presenceHomme: 0, presenceFemme: 0, presenceTotale: 0 } };
    row._count._all += 1;
    row._sum.presenceHomme += m.presenceHomme || 0;
    row._sum.presenceFemme += m.presenceFemme || 0;
    row._sum.presenceTotale += m.presenceTotale || 0;
    days.set(date, row);
  }
  return [...days.values()];
};
prisma.rencontre.findUnique = async ({ where }) => meetings.find((m) => m.id === where.id) ?? null;
prisma.rencontre.update = async ({ where, data }) => {
  const m = meetings.find((m) => m.id === where.id);
  Object.assign(m, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
  return m;
};
prisma.rencontre.delete = async ({ where }) => { meetings = meetings.filter((m) => m.id !== where.id); };
prisma.membre.updateMany = async () => { throw new Error('An internal meeting must not alter section activity statistics'); };

const app = express();
app.use(express.json());
app.use('/rencontres', router);
const payload = { orgUnitInstanceId: 'cell', typeId: 'type', date: '2026-10-27', heureDebut: '10:00', heureFin: '11:00', moderateur: 'Test', moniteur: '', presenceHomme: 3, presenceFemme: 4, membresPresents: ['section-member'] };

test('Institution meetings: creation, visibility and permissions', async (t) => {
  meetings = [decorate({ id: 'foreign-meeting', scopeType: 'ORG_UNIT', scopeId: 'foreign', orgUnitInstanceId: 'foreign', sectionId: null, createdAt: new Date(), presenceHomme: 1, presenceFemme: 1 }),
    decorate({ id: 'section-meeting', scopeType: 'SECTION', scopeId: 'section-id', orgUnitInstanceId: null, sectionId: 'section-id', createdAt: new Date() })];
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const call = async (role, path = '', method = 'GET', body) => {
    const userId = role === 'ORG_UNIT_RESP' ? 'resp' : role === 'SECTION_USER' ? 'section' : 'local';
    const response = await fetch(`http://127.0.0.1:${server.address().port}/rencontres${path}`, {
      method, headers: { Authorization: `Bearer ${generateAccessToken({ userId, role, email: 'test@example.test' })}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };
  let created;
  await t.test('Assigned responsible creates cell meeting and server owns scope and counts', async () => {
    const result = await call('ORG_UNIT_RESP', '', 'POST', { ...payload, sectionId: 'forged-section', scopeId: 'foreign' });
    assert.equal(result.status, 201);
    created = result.data.rencontre.id;
    assert.equal(result.data.rencontre.scopeType, 'ORG_UNIT');
    assert.equal(result.data.rencontre.scopeId, 'cell');
    assert.equal(result.data.rencontre.sectionId, null);
    assert.equal(result.data.rencontre.presenceTotale, 7);
    assert.deepEqual(result.data.rencontre.membresPresents, []);
    assert.equal(result.data.rencontre.orgUnitInstance.definition.name, 'Sociale');
  });
  await t.test('Assigned responsible also creates commission meeting', async () => {
    const result = await call('ORG_UNIT_RESP', '', 'POST', { ...payload, orgUnitInstanceId: 'commission' });
    assert.equal(result.status, 201);
    assert.equal(result.data.rencontre.orgUnitInstance.definition.kind, 'COMMISSION');
  });
  await t.test('Missing or forged assignment cannot create a meeting', async () => {
    for (const orgUnitInstanceId of ['', 'foreign']) assert.equal((await call('ORG_UNIT_RESP', '', 'POST', { ...payload, orgUnitInstanceId })).status, 403);
    assert.equal((await call('SECTION_USER', '', 'POST', payload)).status, 403);
  });
  await t.test('Responsible list excludes all other institutions and section meetings', async () => {
    const result = await call('ORG_UNIT_RESP');
    assert.equal(result.status, 200);
    assert.equal(result.data.total, 2);
    assert.ok(result.data.rencontres.every((m) => assigned.includes(m.orgUnitInstanceId)));
    assert.equal((await call('ORG_UNIT_RESP', '/foreign-meeting')).status, 403);
    assert.equal((await call('ORG_UNIT_RESP', '/section-meeting')).status, 403);
    assert.equal((await call('ORG_UNIT_RESP', '?orgUnitInstanceId=foreign')).data.total, 0);
  });
  await t.test('Locality reads its institutions, filters cells and commissions, excludes other localities', async () => {
    const result = await call('LOCALITE');
    assert.ok(result.data.rencontres.some((m) => m.id === created));
    assert.ok(!result.data.rencontres.some((m) => m.id === 'foreign-meeting'));
    assert.equal((await call('LOCALITE', `/${created}`)).status, 200);
    assert.equal((await call('LOCALITE', '/foreign-meeting')).status, 403);
    for (const kind of ['CELLULE', 'COMMISSION']) {
      const filtered = await call('LOCALITE', `?organiser=${kind}`);
      assert.equal(filtered.data.total, 1);
      assert.equal(filtered.data.rencontres[0].orgUnitInstance.definition.kind, kind);
    }
  });
  await t.test('Only assigned responsible may edit/delete institutional meetings', async () => {
    assert.equal((await call('ORG_UNIT_RESP', `/${created}`, 'PUT', { presenceHomme: 5 })).status, 200);
    for (const role of ['LOCALITE', 'SECTION_USER']) {
      assert.equal((await call(role, `/${created}`, 'PUT', { theme: 'forged' })).status, 403);
      assert.equal((await call(role, `/${created}`, 'DELETE')).status, 403);
    }
    assert.equal((await call('ORG_UNIT_RESP', '/foreign-meeting', 'PUT', { theme: 'forged' })).status, 403);
    assert.equal((await call('ORG_UNIT_RESP', '/section-meeting', 'DELETE')).status, 403);
  });
  await t.test('Revoked assignment immediately removes read/edit access', async () => {
    assigned = ['commission'];
    assert.equal((await call('ORG_UNIT_RESP', `/${created}`)).status, 403);
    assert.equal((await call('ORG_UNIT_RESP', `/${created}`, 'PUT', { theme: 'forged' })).status, 403);
    assigned = ['cell', 'commission'];
  });
  await t.test('Hidden or disabled institutions cannot create new meetings', async () => {
    for (const field of ['visible', 'active']) {
      if (field === 'visible') units[0].isVisible = false;
      else units[0].definition.isActive = false;
      assert.equal((await call('ORG_UNIT_RESP', '', 'POST', payload)).status, 403);
      units[0].isVisible = true;
      units[0].definition.isActive = true;
    }
  });
  await t.test('Existing 24h edit/delete lock also applies to institutions', async () => {
    meetings.find((m) => m.id === created).createdAt = new Date(Date.now() - 25 * 3600000);
    assert.equal((await call('ORG_UNIT_RESP', `/${created}`, 'PUT', { theme: 'locked' })).data.error, 'RENCONTRE_LOCKED');
    assert.equal((await call('ORG_UNIT_RESP', `/${created}`, 'DELETE')).status, 403);
    meetings.find((m) => m.id === created).createdAt = new Date();
    assert.equal((await call('ORG_UNIT_RESP', `/${created}`, 'DELETE')).status, 200);
  });
  await t.test('Existing section listing still contains its original meetings', async () => {
    const result = await call('SECTION_USER');
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.rencontres.map((m) => m.id), ['section-meeting']);
  });
  await t.test('Complete monthly archive keeps old years and every page beyond 100 meetings', async () => {
    meetings = Array.from({ length: 151 }, (_, i) => decorate({ id: `history-${String(i).padStart(3, '0')}`, scopeType: 'SECTION', scopeId: 'section-id', sectionId: 'section-id', orgUnitInstanceId: null, date: new Date('2026-10-15'), createdAt: new Date(), presenceHomme: 2, presenceFemme: 3, presenceTotale: 5 }));
    meetings.push(decorate({ ...meetings[0], id: 'oldest', date: new Date('2001-01-01') }));
    meetings.push(decorate({ ...meetings[0], id: 'leap', date: new Date('2024-02-29') }));
    meetings.push(decorate({ ...meetings[0], id: 'march', date: new Date('2024-03-01') }));
    const summary = await call('LOCALITE', '?archive=1');
    assert.equal(summary.status, 200);
    assert.equal(summary.data.total, 154);
    assert.deepEqual(summary.data.months.map((m) => m.month), ['2026-10', '2024-03', '2024-02', '2001-01']);
    assert.equal(summary.data.months[0].total, 151);
    assert.equal(summary.data.months[0].presences, 755);
    const ids = [];
    for (let page = 1; page <= 4; page++) {
      const result = await call('SECTION_USER', `?month=2026-10&page=${page}&limit=50`);
      assert.equal(result.data.total, 151);
      assert.equal(result.data.totalPages, 4);
      ids.push(...result.data.rencontres.map((m) => m.id));
    }
    assert.equal(new Set(ids).size, 151);
    assert.equal(ids.length, 151);
    assert.equal((await call('LOCALITE', '?month=2001-01')).data.rencontres[0].id, 'oldest');
    assert.deepEqual((await call('LOCALITE', '?month=2024-02')).data.rencontres.map((m) => m.id), ['leap']);
    assert.equal((await call('LOCALITE', '?month=2024-13')).status, 400);
    assert.equal((await call('LOCALITE', '?month=2026-10&page=-1&limit=0')).data.page, 1);
    assert.equal((await call('LOCALITE', '?archive=1&sectionsOnly=1')).data.total, 154);
    assert.equal((await call('ORG_UNIT_RESP', '?archive=1')).data.total, 0);
  });
});
