import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Récupérer tous les membres d'une section
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    
    // Déterminer la section à filtrer selon le rôle
    let where = {};
    
    if (user.role === 'SECTION_USER') {
      // Pour SECTION_USER, filtrer par sa section depuis le token
      if (!user.sectionId) {
        return res.status(403).json({ error: 'Section non définie pour cet utilisateur' });
      }
      
      where = { sectionId: user.sectionId };
    } else if (req.query.sectionId) {
      // Pour les autres rôles, filtrer par section si spécifié
      where = { sectionId: req.query.sectionId as string };
    }
    // Sinon, retourner tous les membres (pour LOCALITE ou SOUS_LOCALITE_ADMIN)
    
    const membres = await prisma.membre.findMany({
      where,
      include: {
        section: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { nom: 'asc' },
        { prenom: 'asc' }
      ]
    });
    
    res.json({ membres });
  } catch (error: any) {
    console.error('Erreur récupération membres:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un nouveau membre
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const { sectionId, photo, prenom, nom, genre, fonction, corpsMetier, groupeSanguin, telephone, numeroCNI } = req.body;
    
    // Validation
    if (!prenom || !nom) {
      return res.status(400).json({ error: 'Le prénom et le nom sont requis' });
    }
    
    // Vérifier les permissions
    let finalSectionId = sectionId;
    if (user.role === 'SECTION_USER') {
      if (!user.sectionId) {
        return res.status(403).json({ error: 'Section non définie pour cet utilisateur' });
      }
      finalSectionId = user.sectionId;
    } else if (!sectionId) {
      return res.status(400).json({ error: 'Section requise' });
    }
    
    const membre = await prisma.membre.create({
      data: {
        sectionId: finalSectionId,
        photo,
        prenom,
        nom,
        genre,
        fonction,
        corpsMetier,
        groupeSanguin,
        telephone,
        numeroCNI
      },
      include: {
        section: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    res.status(201).json({ membre });
  } catch (error: any) {
    console.error('Erreur création membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour un membre
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { photo, prenom, nom, genre, fonction, corpsMetier, groupeSanguin, telephone, numeroCNI } = req.body;
    
    // Validation
    if (!prenom || !nom) {
      return res.status(400).json({ error: 'Le prénom et le nom sont requis' });
    }
    
    const membre = await prisma.membre.update({
      where: { id },
      data: {
        photo,
        prenom,
        nom,
        genre,
        fonction,
        corpsMetier,
        groupeSanguin,
        telephone,
        numeroCNI
      },
      include: {
        section: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    res.json({ membre });
  } catch (error: any) {
    console.error('Erreur modification membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un membre
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.membre.delete({
      where: { id }
    });
    
    res.json({ message: 'Membre supprimé avec succès' });
  } catch (error: any) {
    console.error('Erreur suppression membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
