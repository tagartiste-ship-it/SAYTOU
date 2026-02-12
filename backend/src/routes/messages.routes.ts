import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/messages
 * Liste des messages (envoyés + reçus) pour l'utilisateur connecté
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const box = String(req.query.box ?? 'inbox').trim(); // inbox | sent

    const where = box === 'sent'
      ? { senderId: userId }
      : { recipientId: userId };

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, email: true, role: true } },
        recipient: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json({ messages });
  } catch (error) {
    console.error('Erreur récupération messages:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
});

/**
 * GET /api/messages/unread-count
 * Nombre de messages non lus
 */
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const count = await prisma.message.count({
      where: { recipientId: userId, isRead: false },
    });
    res.json({ count });
  } catch (error) {
    console.error('Erreur comptage messages non lus:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/messages/recipients
 * Liste des destinataires possibles selon le rôle:
 * - COMITE_PEDAGOGIQUE: SOUS_LOCALITE_ADMIN + SECTION_USER de la même localité
 * - SECTION_USER: COMITE_PEDAGOGIQUE + SOUS_LOCALITE_ADMIN de la même localité (réponse)
 * - ORG_UNIT_RESP: SECTION_USER de la même localité (pour communiquer avec les sections)
 */
router.get('/recipients', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.user!;
    const canSend = ['COMITE_PEDAGOGIQUE', 'SECTION_USER', 'ORG_UNIT_RESP'].includes(role);

    if (!canSend) {
      res.status(403).json({ error: 'Vous n\'êtes pas autorisé à envoyer des messages' });
      return;
    }

    // Trouver la localité de l'utilisateur
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        localiteId: true,
        sousLocaliteId: true,
        sectionId: true,
        sousLocalite: { select: { localiteId: true } },
        section: { select: { sousLocalite: { select: { localiteId: true } } } },
      },
    });

    const localiteId = actor?.localiteId
      || actor?.sousLocalite?.localiteId
      || actor?.section?.sousLocalite?.localiteId
      || null;

    if (!localiteId) {
      res.status(403).json({ error: 'Localité non définie' });
      return;
    }

    let targetRoles: any[] = [];
    if (role === 'COMITE_PEDAGOGIQUE') {
      targetRoles = ['SOUS_LOCALITE_ADMIN', 'SECTION_USER'];
    } else if (role === 'SECTION_USER') {
      targetRoles = ['COMITE_PEDAGOGIQUE', 'SOUS_LOCALITE_ADMIN'];
    } else if (role === 'ORG_UNIT_RESP') {
      targetRoles = ['SECTION_USER', 'COMITE_PEDAGOGIQUE', 'SOUS_LOCALITE_ADMIN'];
    }

    const recipients = await prisma.user.findMany({
      where: {
        id: { not: userId },
        role: { in: targetRoles as any },
        OR: [
          { localiteId },
          { sousLocalite: { localiteId } },
          { section: { sousLocalite: { localiteId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        sousLocalite: { select: { id: true, name: true } },
        section: { select: { id: true, name: true, sousLocalite: { select: { id: true, name: true } } } },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    res.json({ recipients });
  } catch (error) {
    console.error('Erreur récupération destinataires:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/messages
 * Envoyer un message (COMITE_PEDAGOGIQUE, SECTION_USER, ORG_UNIT_RESP)
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.user!;
    const canSend = ['COMITE_PEDAGOGIQUE', 'SECTION_USER', 'ORG_UNIT_RESP'].includes(role);

    if (!canSend) {
      res.status(403).json({ error: 'Vous n\'êtes pas autorisé à envoyer des messages' });
      return;
    }

    const { recipientIds, subject, body } = req.body;

    if (!subject || !String(subject).trim()) {
      res.status(400).json({ error: 'Le sujet est requis' });
      return;
    }

    if (!body || !String(body).trim()) {
      res.status(400).json({ error: 'Le contenu est requis' });
      return;
    }

    const ids: string[] = Array.isArray(recipientIds) ? recipientIds : [recipientIds].filter(Boolean);
    if (!ids.length) {
      res.status(400).json({ error: 'Au moins un destinataire est requis' });
      return;
    }

    // Vérifier que les destinataires existent
    const validRecipients = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });

    if (!validRecipients.length) {
      res.status(400).json({ error: 'Aucun destinataire valide' });
      return;
    }

    // Créer un message par destinataire
    const messages = await prisma.message.createMany({
      data: validRecipients.map((r) => ({
        senderId: userId,
        recipientId: r.id,
        subject: String(subject).trim(),
        body: String(body).trim(),
      })),
    });

    res.status(201).json({
      message: `${messages.count} message(s) envoyé(s)`,
      count: messages.count,
    });
  } catch (error) {
    console.error('Erreur envoi message:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

/**
 * PUT /api/messages/:id/read
 * Marquer un message comme lu
 */
router.put('/:id/read', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const { id } = req.params;

    const message = await prisma.message.findUnique({
      where: { id },
      select: { recipientId: true },
    });

    if (!message || message.recipientId !== userId) {
      res.status(404).json({ error: 'Message non trouvé' });
      return;
    }

    await prisma.message.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ message: 'Message marqué comme lu' });
  } catch (error) {
    console.error('Erreur marquage message lu:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/messages/read-all
 * Marquer tous les messages comme lus
 */
router.put('/read-all', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;

    await prisma.message.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ message: 'Tous les messages marqués comme lus' });
  } catch (error) {
    console.error('Erreur marquage tous messages lus:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
