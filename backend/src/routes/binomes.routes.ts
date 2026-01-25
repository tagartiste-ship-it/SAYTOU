import express, { Response } from 'express';
import prismaRaw from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router: any = express.Router();

const prisma: any = prismaRaw;

const THREE_MONTHS_DAYS = 90;

const subDays = (d: Date, days: number) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - days);
  return copy;
};

const addMonths = (d: Date, months: number) => {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months);
  return copy;
};

const subMonths = (d: Date, months: number) => addMonths(d, -months);

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const normalizeGenre = (g: string | null | undefined) => {
  const v = (g || '').trim().toLowerCase();
  if (!v) return null;
  if (['m', 'male', 'homme', 'masculin'].includes(v)) return 'M';
  if (['f', 'female', 'femme', 'feminin', 'féminin'].includes(v)) return 'F';
  return v.toUpperCase();
};

const getEffectiveSectionId = async (req: AuthRequest): Promise<string | null> => {
  const { userId, role } = req.user!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sectionId: true },
  });

  if (!user) return null;

  if (role === 'SECTION_USER') {
    return user.sectionId ?? null;
  }

  const sectionId = (req.query.sectionId as string) || (req.body?.sectionId as string);
  return sectionId || null;
};

const normalizeMemberAgeTrancheName = (value: unknown) => {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'S1' || v === 'S2' || v === 'S3') return v;
  return null;
};

const computeMemberTranche = async (member: { dateNaissance: Date | null; ageTranche?: string | null }) => {
  const trancheName = normalizeMemberAgeTrancheName(member.ageTranche);
  if (trancheName) {
    const found = await prisma.trancheAge.findUnique({ where: { name: trancheName }, select: { id: true } });
    return found?.id ?? null;
  }

  if (!member.dateNaissance) return null;

  const now = new Date();
  const years = now.getFullYear() - member.dateNaissance.getFullYear();
  const hadBirthdayThisYear =
    now.getMonth() > member.dateNaissance.getMonth() ||
    (now.getMonth() === member.dateNaissance.getMonth() && now.getDate() >= member.dateNaissance.getDate());
  const age = hadBirthdayThisYear ? years : years - 1;

  const tranches = await prisma.trancheAge.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] });
  const found = tranches.find((t) => age >= t.ageMin && (t.ageMax == null || age <= t.ageMax));
  return found?.id ?? null;
};

const ensureRotationIfNeeded = async (sectionId: string) => {
  const activeCycle = await prisma.binomeCycle.findFirst({
    where: { sectionId, isActive: true },
    orderBy: { startedAt: 'desc' },
  });

  if (!activeCycle) return null;

  const nextRotationAt = addMonths(activeCycle.startedAt, 3);
  if (new Date() < nextRotationAt) return activeCycle;

  // Rotation needed
  await prisma.binomeCycle.update({ where: { id: activeCycle.id }, data: { isActive: false, endedAt: new Date() } });
  return null;
};

const buildForbiddenPairsKey = (a: string, b: string) => {
  const x = String(a);
  const y = String(b);
  return x < y ? `${x}:${y}` : `${y}:${x}`;
};

const getForbiddenPairsLastMonths = async (sectionId: string, months: number) => {
  const since = subMonths(new Date(), months);
  const pairs = await prisma.binomePair.findMany({
    where: {
      cycle: {
        sectionId,
        startedAt: { gte: since },
      },
    },
    select: { membreAId: true, membreBId: true },
  });

  const set = new Set<string>();
  for (const p of pairs) {
    set.add(buildForbiddenPairsKey(p.membreAId, p.membreBId));
  }
  return set;
};

const buildPairsAvoidingForbidden = (sortedByPresenceDesc: string[], forbidden: Set<string>) => {
  const remaining = [...sortedByPresenceDesc];
  const creates: { membreAId: string; membreBId: string }[] = [];
  const solos: string[] = [];

  while (remaining.length >= 2) {
    const a = remaining[0];
    let pickIndex = -1;
    for (let i = remaining.length - 1; i >= 1; i -= 1) {
      const b = remaining[i];
      if (!forbidden.has(buildForbiddenPairsKey(a, b))) {
        pickIndex = i;
        break;
      }
    }

    if (pickIndex === -1) {
      // fallback: cannot avoid, take the lowest anyway
      pickIndex = remaining.length - 1;
    }

    const b = remaining[pickIndex];
    creates.push({ membreAId: a, membreBId: b });
    forbidden.add(buildForbiddenPairsKey(a, b));
    remaining.splice(pickIndex, 1);
    remaining.splice(0, 1);
  }

  if (remaining.length === 1) solos.push(remaining[0]);
  return { creates, solos };
};

const getMemberPresenceStats = async (sectionId: string, memberIds: string[]) => {
  const since = subDays(new Date(), THREE_MONTHS_DAYS);

  const rencontres = await prisma.rencontre.findMany({
    where: { sectionId, date: { gte: since } },
    select: { id: true, date: true, membresPresents: true },
  });

  const total = rencontres.length;
  const presentByMember: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));

  for (const r of rencontres) {
    const presents = Array.isArray(r.membresPresents) ? (r.membresPresents as any[]) : [];
    const set = new Set(presents.map((x) => String(x)));
    for (const id of memberIds) {
      if (set.has(id)) presentByMember[id] += 1;
    }
  }

  return { totalRencontres: total, presentByMember };
};

const buildReport = async (sectionId: string) => {
  const since = subDays(new Date(), THREE_MONTHS_DAYS);
  const rencontres = await prisma.rencontre.findMany({
    where: { sectionId, date: { gte: since } },
    select: { id: true, date: true, membresPresents: true },
    orderBy: { date: 'asc' },
  });
  const totalRencontres = rencontres.length;

  const cycle = await prisma.binomeCycle.findFirst({
    where: { sectionId, isActive: true },
    orderBy: { startedAt: 'desc' },
    include: {
      pairs: {
        include: { membreA: true, membreB: true, trancheAge: true },
        orderBy: [{ trancheAgeId: 'asc' }, { genre: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!cycle) {
    return { cycle: null, period: { lastDays: THREE_MONTHS_DAYS, totalRencontres } };
  }

  const presenceSetByRencontre = rencontres.map((r) => {
    const presents = Array.isArray(r.membresPresents) ? (r.membresPresents as any[]) : [];
    return new Set(presents.map((x) => String(x)));
  });

  const countPresentAll = (memberIds: string[]) => {
    let presentAll = 0;
    for (const set of presenceSetByRencontre) {
      let ok = true;
      for (const id of memberIds) {
        if (!set.has(id)) {
          ok = false;
          break;
        }
      }
      if (ok) presentAll += 1;
    }
    return presentAll;
  };

  const pairs = cycle.pairs.map((p) => {
    const presentBoth = countPresentAll([p.membreAId, p.membreBId]);
    const absentEither = totalRencontres - presentBoth;
    const percent = totalRencontres > 0 ? Math.round((presentBoth / totalRencontres) * 1000) / 10 : null;
    return {
      id: p.id,
      trancheAge: p.trancheAge,
      trancheAgeId: p.trancheAgeId,
      genre: p.genre,
      membreA: p.membreA,
      membreB: p.membreB,
      membreC: null as any,
      stats: {
        totalRencontres,
        presentBoth,
        absentEither,
        percent,
      },
    };
  });

  const pairedMemberIds = new Set<string>();
  for (const p of cycle.pairs) {
    pairedMemberIds.add(p.membreAId);
    pairedMemberIds.add(p.membreBId);
  }

  const members = await prisma.membre.findMany({
    where: { sectionId },
    select: { id: true, prenom: true, nom: true, genre: true, dateNaissance: true, ageTranche: true },
  });

  const solos: any[] = [];
  for (const m of members) {
    const trancheAgeId = await computeMemberTranche({ dateNaissance: m.dateNaissance, ageTranche: (m as any).ageTranche });
    const genre = normalizeGenre(m.genre);
    if (!trancheAgeId || !genre) continue;
    if (pairedMemberIds.has(m.id)) continue;
    const tranche = await prisma.trancheAge.findUnique({ where: { id: trancheAgeId } });
    if (!tranche) continue;
    solos.push({
      trancheAgeId,
      trancheAge: tranche,
      genre,
      membre: { id: m.id, prenom: m.prenom, nom: m.nom },
    });
  }

  const solosByKey = new Map<string, any[]>();
  for (const s of solos) {
    const key = `${s.trancheAgeId}:${s.genre}`;
    const list = solosByKey.get(key) || [];
    list.push(s);
    solosByKey.set(key, list);
  }

  const lastPairIndexByKey = new Map<string, number>();
  for (let i = 0; i < pairs.length; i += 1) {
    const p = pairs[i];
    const key = `${p.trancheAgeId}:${p.genre}`;
    lastPairIndexByKey.set(key, i);
  }

  const singles: any[] = [];

  for (const [key, list] of solosByKey.entries()) {
    if (list.length === 0) continue;

    const lastIdx = lastPairIndexByKey.get(key);
    if (lastIdx == null) {
      // no binome exists for that tranche/genre: show as "Seul"
      for (const s of list) singles.push(s);
      continue;
    }

    const solo = list[0];
    const p = pairs[lastIdx];
    p.membreC = solo.membre;

    const presentAll3 = countPresentAll([p.membreA.id, p.membreB.id, p.membreC.id]);
    const absentEither = totalRencontres - presentAll3;
    const percent = totalRencontres > 0 ? Math.round((presentAll3 / totalRencontres) * 1000) / 10 : null;
    p.stats = {
      totalRencontres,
      presentBoth: presentAll3,
      absentEither,
      percent,
    };

    // If there are still leftovers (should be rare), show them as "Seul"
    for (let i = 1; i < list.length; i += 1) singles.push(list[i]);
  }

  return {
    cycle: {
      id: cycle.id,
      startedAt: cycle.startedAt,
      endedAt: cycle.endedAt,
      isActive: cycle.isActive,
    },
    period: { lastDays: THREE_MONTHS_DAYS, totalRencontres },
    pairs,
    singles,
  };
};

const rotateForSection = async (sectionId: string, opts?: { avoidPairsMonths?: number }) => {
  const existing = await prisma.binomeCycle.findFirst({ where: { sectionId, isActive: true } });
  if (existing) {
    await prisma.binomeCycle.update({ where: { id: existing.id }, data: { isActive: false, endedAt: new Date() } });
  }

  const members = await prisma.membre.findMany({
    where: { sectionId },
    select: { id: true, genre: true, dateNaissance: true, ageTranche: true },
  });

  const enriched: { id: string; trancheAgeId: string | null; genre: string | null }[] = [];
  for (const m of members) {
    enriched.push({
      id: m.id,
      trancheAgeId: await computeMemberTranche({ dateNaissance: m.dateNaissance, ageTranche: (m as any).ageTranche }),
      genre: normalizeGenre(m.genre),
    });
  }

  const eligible = enriched.filter((m) => !!m.trancheAgeId && !!m.genre) as { id: string; trancheAgeId: string; genre: string }[];
  const memberIds = eligible.map((m) => m.id);
  const { presentByMember } = await getMemberPresenceStats(sectionId, memberIds);

  const forbiddenPairs = await getForbiddenPairsLastMonths(sectionId, opts?.avoidPairsMonths ?? 12);

  const cycle = await prisma.binomeCycle.create({
    data: {
      sectionId,
      startedAt: new Date(),
      isActive: true,
    },
  });

  const groups = new Map<string, string[]>();
  for (const m of eligible) {
    const key = `${m.trancheAgeId}:${m.genre}`;
    const list = groups.get(key) || [];
    list.push(m.id);
    groups.set(key, list);
  }

  const pairCreates: any[] = [];

  for (const [key, ids] of groups.entries()) {
    const [trancheAgeId, genre] = key.split(':');
    const sorted = [...ids].sort((a, b) => (presentByMember[b] ?? 0) - (presentByMember[a] ?? 0));
    const { creates } = buildPairsAvoidingForbidden(sorted, forbiddenPairs);
    for (const c of creates) {
      pairCreates.push({
        cycleId: cycle.id,
        trancheAgeId,
        genre,
        membreAId: c.membreAId,
        membreBId: c.membreBId,
      });
    }
  }

  if (pairCreates.length > 0) {
    await prisma.binomePair.createMany({ data: pairCreates });
  }

  return cycle;
};

export const startBinomesAutoRotationJob = () => {
  const RUN_EVERY_MS = 60 * 60 * 1000;
  const run = async () => {
    try {
      const sections = await prisma.section.findMany({ select: { id: true } });
      for (const s of sections) {
        const activeCycle = await prisma.binomeCycle.findFirst({
          where: { sectionId: s.id, isActive: true },
          orderBy: { startedAt: 'desc' },
        });

        if (!activeCycle) continue;

        const nextRotationAt = addMonths(activeCycle.startedAt, 3);
        if (new Date() < nextRotationAt) continue;

        await prisma.binomeCycle.update({ where: { id: activeCycle.id }, data: { isActive: false, endedAt: new Date() } });
        await rotateForSection(s.id, { avoidPairsMonths: 12 });
      }
    } catch (e) {
      console.error('Erreur job rotation binômes:', e);
    }
  };

  void run();
  setInterval(() => {
    void run();
  }, RUN_EVERY_MS);
};

/**
 * GET /api/binomes/current
 * Retourne le cycle actif + binômes par tranche/genre.
 */
router.get('/current', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sectionId = await getEffectiveSectionId(req);
    if (!sectionId) {
      res.status(400).json({ error: 'Section manquante' });
      return;
    }

    const stillActive = await ensureRotationIfNeeded(sectionId);
    if (!stillActive) {
      await rotateForSection(sectionId, { avoidPairsMonths: 12 });
    }

    const cycle = await prisma.binomeCycle.findFirst({
      where: { sectionId, isActive: true },
      orderBy: { startedAt: 'desc' },
      include: {
        pairs: {
          include: { membreA: true, membreB: true, trancheAge: true },
          orderBy: [{ genre: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    res.json({ cycle });
  } catch (e) {
    console.error('Erreur binomes/current:', e);
    res.status(500).json({ error: 'Erreur lors du chargement des binômes' });
  }
});

/**
 * GET /api/binomes/report
 * Retourne les binômes actifs + stats (3 derniers mois).
 */
router.get('/report', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sectionId = await getEffectiveSectionId(req);
    if (!sectionId) {
      res.status(400).json({ error: 'Section manquante' });
      return;
    }

    const stillActive = await ensureRotationIfNeeded(sectionId);
    if (!stillActive) {
      await rotateForSection(sectionId, { avoidPairsMonths: 12 });
    }

    const report = await buildReport(sectionId);
    res.json(report);
  } catch (e) {
    console.error('Erreur binomes/report:', e);
    res.status(500).json({ error: 'Erreur lors du chargement du rapport binômes' });
  }
});

router.get('/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sectionId = await getEffectiveSectionId(req);
    if (!sectionId) {
      res.status(400).json({ error: 'Section manquante' });
      return;
    }

    const cycle = await prisma.binomeCycle.findFirst({
      where: { sectionId, isActive: true },
      orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true },
    });

    res.json({ cycle });
  } catch (e) {
    console.error('Erreur binomes/status:', e);
    res.status(500).json({ error: 'Erreur lors du chargement du status binômes' });
  }
});

/**
 * POST /api/binomes/generate
 * Génère un nouveau cycle aléatoire (par tranche + genre).
 */
router.post('/generate', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sectionId = await getEffectiveSectionId(req);
    if (!sectionId) {
      res.status(400).json({ error: 'Section manquante' });
      return;
    }

    const existing = await prisma.binomeCycle.findFirst({ where: { sectionId, isActive: true } });
    if (existing) {
      await prisma.binomeCycle.update({ where: { id: existing.id }, data: { isActive: false, endedAt: new Date() } });
    }

    const members = await prisma.membre.findMany({
      where: { sectionId },
      select: { id: true, genre: true, dateNaissance: true, ageTranche: true, prenom: true, nom: true },
    });

    const trancheCache = new Map<string, string | null>();
    const enriched: { id: string; trancheAgeId: string | null; genre: string | null }[] = [];

    for (const m of members) {
      const g = normalizeGenre(m.genre);
      let trancheId = trancheCache.get(m.id) ?? null;
      trancheId = await computeMemberTranche({ dateNaissance: m.dateNaissance, ageTranche: (m as any).ageTranche });
      trancheCache.set(m.id, trancheId);
      enriched.push({ id: m.id, trancheAgeId: trancheId, genre: g });
    }

    const eligible = enriched.filter((m) => !!m.trancheAgeId && !!m.genre) as { id: string; trancheAgeId: string; genre: string }[];

    const cycle = await prisma.binomeCycle.create({
      data: {
        sectionId,
        startedAt: new Date(),
        isActive: true,
      },
    });

    const groups = new Map<string, string[]>();
    for (const m of eligible) {
      const key = `${m.trancheAgeId}:${m.genre}`;
      const list = groups.get(key) || [];
      list.push(m.id);
      groups.set(key, list);
    }

    const pairCreates: any[] = [];
    const solos: any[] = [];

    for (const [key, ids] of groups.entries()) {
      const [trancheAgeId, genre] = key.split(':');
      const shuffled = shuffle(ids);
      for (let i = 0; i < shuffled.length; i += 2) {
        const a = shuffled[i];
        const b = shuffled[i + 1];
        if (!b) {
          solos.push({ trancheAgeId, genre, membreId: a });
          break;
        }
        pairCreates.push({
          cycleId: cycle.id,
          trancheAgeId,
          genre,
          membreAId: a,
          membreBId: b,
        });
      }
    }

    if (pairCreates.length > 0) {
      await prisma.binomePair.createMany({ data: pairCreates });
    }

    res.status(201).json({ message: 'Binômes générés', cycleId: cycle.id, solos });
  } catch (e) {
    console.error('Erreur binomes/generate:', e);
    res.status(500).json({ error: 'Erreur lors de la génération des binômes' });
  }
});

/**
 * POST /api/binomes/rotate
 * Crée un nouveau cycle basé sur la présence des 3 derniers mois :
 * pairing (plus présents) avec (moins présents).
 */
router.post('/rotate', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sectionId = await getEffectiveSectionId(req);
    if (!sectionId) {
      res.status(400).json({ error: 'Section manquante' });
      return;
    }

    const existing = await prisma.binomeCycle.findFirst({ where: { sectionId, isActive: true } });
    if (existing) {
      await prisma.binomeCycle.update({ where: { id: existing.id }, data: { isActive: false, endedAt: new Date() } });
    }

    const members = await prisma.membre.findMany({
      where: { sectionId },
      select: { id: true, genre: true, dateNaissance: true, ageTranche: true },
    });

    const enriched: { id: string; trancheAgeId: string | null; genre: string | null }[] = [];
    for (const m of members) {
      enriched.push({
        id: m.id,
        trancheAgeId: await computeMemberTranche({ dateNaissance: m.dateNaissance, ageTranche: (m as any).ageTranche }),
        genre: normalizeGenre(m.genre),
      });
    }

    const eligible = enriched.filter((m) => !!m.trancheAgeId && !!m.genre) as { id: string; trancheAgeId: string; genre: string }[];
    const memberIds = eligible.map((m) => m.id);

    const { totalRencontres, presentByMember } = await getMemberPresenceStats(sectionId, memberIds);

    const cycle = await prisma.binomeCycle.create({
      data: {
        sectionId,
        startedAt: new Date(),
        isActive: true,
      },
    });

    const groups = new Map<string, string[]>();
    for (const m of eligible) {
      const key = `${m.trancheAgeId}:${m.genre}`;
      const list = groups.get(key) || [];
      list.push(m.id);
      groups.set(key, list);
    }

    const pairCreates: any[] = [];
    const solos: any[] = [];

    for (const [key, ids] of groups.entries()) {
      const [trancheAgeId, genre] = key.split(':');

      const sorted = [...ids].sort((a, b) => {
        const pa = presentByMember[a] ?? 0;
        const pb = presentByMember[b] ?? 0;
        return pb - pa;
      });

      let left = 0;
      let right = sorted.length - 1;
      while (left < right) {
        pairCreates.push({
          cycleId: cycle.id,
          trancheAgeId,
          genre,
          membreAId: sorted[left],
          membreBId: sorted[right],
        });
        left += 1;
        right -= 1;
      }
      if (left === right) {
        solos.push({ trancheAgeId, genre, membreId: sorted[left] });
      }
    }

    if (pairCreates.length > 0) {
      await prisma.binomePair.createMany({ data: pairCreates });
    }

    res.status(201).json({
      message: 'Rotation effectuée',
      cycleId: cycle.id,
      period: { lastDays: THREE_MONTHS_DAYS, totalRencontres },
      solos,
    });
  } catch (e) {
    console.error('Erreur binomes/rotate:', e);
    res.status(500).json({ error: 'Erreur lors de la rotation des binômes' });
  }
});

export default router;
