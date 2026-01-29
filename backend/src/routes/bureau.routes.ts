import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

type BureauScopeType = 'LOCALITE' | 'SOUS_LOCALITE' | 'SECTION';
type BureauGroupe = 'S1S2' | 'S3';
type BureauAffectationKind = 'TITULAIRE' | 'ADJOINT';
type BureauSlotType = 'PRIMARY' | 'EXTRA';

type AgeTranche = 'S1' | 'S2' | 'S3' | null;

const normalizeAgeTranche = (value: unknown): AgeTranche => {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'S1' || v === 'S2' || v === 'S3') return v as AgeTranche;
  return null;
};

const computeAge = (dateNaissance?: Date | null): number | null => {
  if (!dateNaissance) return null;
  const d = new Date(dateNaissance);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
    age -= 1;
  }
  if (age < 0) return null;
  return age;
};

const computeAgeTranche = (age: number | null): AgeTranche => {
  if (age === null) return null;
  if (age < 12) return 'S1';
  if (age < 18) return 'S2';
  return 'S3';
};

const resolveMembreTranche = (m: { ageTranche?: unknown; dateNaissance?: Date | null }): AgeTranche => {
  return normalizeAgeTranche(m.ageTranche) ?? computeAgeTranche(computeAge(m.dateNaissance ?? null));
};

const parseScopeType = (value: unknown): BureauScopeType | null => {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'LOCALITE' || v === 'SOUS_LOCALITE' || v === 'SECTION') return v as BureauScopeType;
  return null;
};

const buildScopeWhere = (scopeType: BureauScopeType, scopeId: string) => {
  if (scopeType === 'SECTION') return { sectionId: scopeId };
  if (scopeType === 'SOUS_LOCALITE') {
    return { section: { sousLocaliteId: scopeId } };
  }
  return { section: { sousLocalite: { localiteId: scopeId } } };
};

const parseGroupe = (value: unknown): BureauGroupe | null => {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'S1S2' || v === 'S3') return v as BureauGroupe;
  return null;
};

const parseKind = (value: unknown): BureauAffectationKind | null => {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'TITULAIRE' || v === 'ADJOINT') return v as BureauAffectationKind;
  return null;
};

const parseSlotType = (value: unknown): BureauSlotType | null => {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'PRIMARY' || v === 'EXTRA') return v as BureauSlotType;
  return null;
};

const resolveScope = async (
  req: AuthRequest,
  requestedScopeType: BureauScopeType | null,
  requestedScopeIdRaw: unknown
): Promise<{ scopeType: BureauScopeType; scopeId: string } | null> => {
  const user = req.user;
  if (!user) return null;

  const scopeIdFromQuery = String(requestedScopeIdRaw ?? '').trim();

  if (user.role === 'SECTION_USER') {
    if (!user.sectionId) return null;
    return { scopeType: 'SECTION', scopeId: user.sectionId };
  }

  if (user.role === 'SOUS_LOCALITE_ADMIN') {
    if (!user.sousLocaliteId) return null;
    return { scopeType: 'SOUS_LOCALITE', scopeId: user.sousLocaliteId };
  }

  // LOCALITE (super admin)
  const scopeType = requestedScopeType ?? 'LOCALITE';
  if (scopeType === 'LOCALITE') {
    if (scopeIdFromQuery) return { scopeType, scopeId: scopeIdFromQuery };
    const first = await prisma.localite.findFirst({ select: { id: true } });
    if (!first?.id) return null;
    return { scopeType, scopeId: first.id };
  }

  if (!scopeIdFromQuery) return null;
  return { scopeType, scopeId: scopeIdFromQuery };
};

const buildMembreWhereForScope = (scopeType: BureauScopeType, scopeId: string, groupe: BureauGroupe) => {
  const ageTrancheFilter =
    groupe === 'S3'
      ? { ageTranche: 'S3' }
      : {
          OR: [{ ageTranche: 'S1' }, { ageTranche: 'S2' }],
        };

  if (scopeType === 'SECTION') {
    return { AND: [{ sectionId: scopeId }, ageTrancheFilter] };
  }

  if (scopeType === 'SOUS_LOCALITE') {
    return {
      AND: [
        {
          section: {
            sousLocaliteId: scopeId,
          },
        },
        ageTrancheFilter,
      ],
    };
  }

  return {
    AND: [
      {
        section: {
          sousLocalite: {
            localiteId: scopeId,
          },
        },
      },
      ageTrancheFilter,
    ],
  };
};

router.get('/localites', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    if (user.role !== 'LOCALITE') return res.status(403).json({ error: 'Accès non autorisé' });

    const localites = await prisma.localite.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    res.json({ localites });
  } catch (error: any) {
    console.error('Erreur récupération localites bureau:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/postes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const scopeTypeReq = parseScopeType(req.query.scopeType);
    const groupe = parseGroupe(req.query.groupe);
    if (!groupe) return res.status(400).json({ error: 'groupe requis (S1S2 ou S3)' });

    const resolved = await resolveScope(req, scopeTypeReq, req.query.scopeId);
    if (!resolved) return res.status(400).json({ error: 'Scope invalide' });

    const postes = await prisma.bureauPoste.findMany({
      where: {
        scopeType: resolved.scopeType,
        scopeId: resolved.scopeId,
        groupe,
      },
      orderBy: [{ name: 'asc' }],
    });

    res.json({ scope: resolved, groupe, postes });
  } catch (error: any) {
    console.error('Erreur récupération postes bureau:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/postes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, scopeType, scopeId, groupe } = req.body ?? {};
    const groupeParsed = parseGroupe(groupe);
    if (!groupeParsed) return res.status(400).json({ error: 'groupe invalide' });

    const scopeTypeParsed = parseScopeType(scopeType);
    const resolved = await resolveScope(req, scopeTypeParsed, scopeId);
    if (!resolved) return res.status(400).json({ error: 'Scope invalide' });

    const cleanName = String(name ?? '').trim();
    if (!cleanName) return res.status(400).json({ error: 'Nom requis' });

    const poste = await prisma.bureauPoste.create({
      data: {
        name: cleanName,
        scopeType: resolved.scopeType,
        scopeId: resolved.scopeId,
        groupe: groupeParsed,
      },
    });

    res.status(201).json({ poste });
  } catch (error: any) {
    console.error('Erreur création poste bureau:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/postes/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const poste = await prisma.bureauPoste.findUnique({ where: { id } });
    if (!poste) return res.status(404).json({ error: 'Poste non trouvé' });

    // Scope enforcement
    if (user.role === 'SECTION_USER') {
      if (!user.sectionId || poste.scopeType !== 'SECTION' || poste.scopeId !== user.sectionId) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
    } else if (user.role === 'SOUS_LOCALITE_ADMIN') {
      if (!user.sousLocaliteId || poste.scopeType !== 'SOUS_LOCALITE' || poste.scopeId !== user.sousLocaliteId) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
    }

    await prisma.bureauPoste.delete({ where: { id } });
    res.json({ message: 'Poste supprimé' });
  } catch (error: any) {
    console.error('Erreur suppression poste bureau:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/eligible-membres', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const scopeTypeReq = parseScopeType(req.query.scopeType);
    const groupe = parseGroupe(req.query.groupe);
    if (!groupe) return res.status(400).json({ error: 'groupe requis' });

    const resolved = await resolveScope(req, scopeTypeReq, req.query.scopeId);
    if (!resolved) return res.status(400).json({ error: 'Scope invalide' });

    const membresRaw: any[] = await prisma.membre.findMany({
      where: buildScopeWhere(resolved.scopeType, resolved.scopeId),
      select: {
        id: true,
        prenom: true,
        nom: true,
        genre: true,
        ageTranche: true,
        dateNaissance: true,
        section: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      take: 5000,
    });

    const membres = membresRaw
      .map((m) => {
        const finalTranche = resolveMembreTranche(m);
        return { ...m, ageTranche: finalTranche };
      })
      .filter((m) => {
        if (groupe === 'S3') return m.ageTranche === 'S3';
        return m.ageTranche === 'S1' || m.ageTranche === 'S2';
      });

    res.json({ scope: resolved, groupe, membres });
  } catch (error: any) {
    console.error('Erreur récupération membres bureau:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/affectations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const scopeTypeReq = parseScopeType(req.query.scopeType);
    const groupe = parseGroupe(req.query.groupe);
    if (!groupe) return res.status(400).json({ error: 'groupe requis' });

    const resolved = await resolveScope(req, scopeTypeReq, req.query.scopeId);
    if (!resolved) return res.status(400).json({ error: 'Scope invalide' });

    const postes = await prisma.bureauPoste.findMany({
      where: {
        scopeType: resolved.scopeType,
        scopeId: resolved.scopeId,
        groupe,
      },
      include: {
        affectations: {
          include: {
            membre: {
              select: {
                id: true,
                prenom: true,
                nom: true,
                ageTranche: true,
                section: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: [{ slotType: 'asc' }, { slotIndex: 'asc' }],
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    res.json({ scope: resolved, groupe, postes });
  } catch (error: any) {
    console.error('Erreur récupération affectations bureau:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/affectations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { posteId, membreId, kind, slotType, slotIndex } = req.body ?? {};
    const kindParsed = parseKind(kind);
    const slotTypeParsed = parseSlotType(slotType) ?? 'EXTRA';
    const slotIndexParsed = Number(slotIndex ?? 0);

    if (!posteId) return res.status(400).json({ error: 'posteId requis' });
    if (!kindParsed) return res.status(400).json({ error: 'kind invalide' });
    if (!Number.isFinite(slotIndexParsed) || slotIndexParsed < 0) return res.status(400).json({ error: 'slotIndex invalide' });

    const poste = await prisma.bureauPoste.findUnique({ where: { id: String(posteId) } });
    if (!poste) return res.status(404).json({ error: 'Poste non trouvé' });

    // Scope enforcement
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    if (user.role === 'SECTION_USER') {
      if (!user.sectionId || poste.scopeType !== 'SECTION' || poste.scopeId !== user.sectionId) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
    } else if (user.role === 'SOUS_LOCALITE_ADMIN') {
      if (!user.sousLocaliteId || poste.scopeType !== 'SOUS_LOCALITE' || poste.scopeId !== user.sousLocaliteId) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
    }

    // If membreId is empty => remove the slot
    const cleanMembreId = String(membreId ?? '').trim();
    if (!cleanMembreId) {
      await prisma.bureauAffectation.deleteMany({
        where: {
          posteId: poste.id,
          kind: kindParsed,
          slotType: slotTypeParsed,
          slotIndex: slotIndexParsed,
        },
      });
      return res.json({ message: 'Affectation supprimée' });
    }

    // Validate membre is eligible for this poste scope + groupe
    const membre: any = await prisma.membre.findUnique({
      where: { id: cleanMembreId },
      select: { id: true, sectionId: true, ageTranche: true, dateNaissance: true, section: { select: { sousLocaliteId: true, sousLocalite: { select: { localiteId: true } } } } },
    });
    if (!membre) return res.status(404).json({ error: 'Membre non trouvé' });

    const finalTranche = resolveMembreTranche(membre);

    if (poste.groupe === 'S3' && finalTranche !== 'S3') {
      return res.status(400).json({ error: 'Membre non éligible (groupe S3)' });
    }
    if (poste.groupe === 'S1S2' && finalTranche !== 'S1' && finalTranche !== 'S2') {
      return res.status(400).json({ error: 'Membre non éligible (groupe S1S2)' });
    }

    if (poste.scopeType === 'SECTION') {
      if (membre.sectionId !== poste.scopeId) return res.status(400).json({ error: 'Membre hors scope (section)' });
    } else if (poste.scopeType === 'SOUS_LOCALITE') {
      if ((membre.section as any)?.sousLocaliteId !== poste.scopeId) return res.status(400).json({ error: 'Membre hors scope (sous-localité)' });
    } else {
      if ((membre.section as any)?.sousLocalite?.localiteId !== poste.scopeId) return res.status(400).json({ error: 'Membre hors scope (localité)' });
    }

    const affectation = await prisma.bureauAffectation.upsert({
      where: {
        posteId_kind_slotType_slotIndex: {
          posteId: poste.id,
          kind: kindParsed,
          slotType: slotTypeParsed,
          slotIndex: slotIndexParsed,
        },
      },
      update: {
        membreId: membre.id,
      },
      create: {
        posteId: poste.id,
        membreId: membre.id,
        kind: kindParsed,
        slotType: slotTypeParsed,
        slotIndex: slotIndexParsed,
      },
      include: {
        membre: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            ageTranche: true,
            section: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.status(201).json({ affectation });
  } catch (error: any) {
    console.error('Erreur upsert affectation bureau:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
