import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Save, Users, Calendar, FileText } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { RencontreType, Section, OrdreDuJourItem, Membre } from '../lib/types';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export default function CreateRencontrePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const draftKey = `saytou:draft:createRencontre:${user?.id ?? 'anon'}`;
  
  const [types, setTypes] = useState<RencontreType[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    typeId: '',
    sectionId: user?.sectionId || '',
    date: new Date().toISOString().split('T')[0],
    heureDebut: '09:00',
    heureFin: '11:00',
    moderateur: '',
    moniteur: '',
    theme: '',
    developpement: '',
    pvReunion: '',
    presenceHomme: 0,
    presenceFemme: 0,
    observations: '',
  });
  
  const [ordreDuJour, setOrdreDuJour] = useState<OrdreDuJourItem[]>([
    { ordre: 1, titre: '', description: '' }
  ]);

  const [membres, setMembres] = useState<Membre[]>([]);
  const [membresPresents, setMembresPresents] = useState<string[]>([]);

  const selectedType = types.find((t) => t.id === formData.typeId);
  const isReunion = Boolean(selectedType?.isReunion);
  const [hasUserEditedDeveloppement, setHasUserEditedDeveloppement] = useState(false);

  const generateDeveloppementFromOrdreDuJour = () => {
    const points = ordreDuJour
      .map((item) => ({
        ordre: item.ordre,
        titre: item.titre?.trim() ?? '',
        description: item.description?.trim() ?? '',
      }))
      .filter((p) => p.titre.length > 0);

    if (points.length === 0) return '';

    return points
      .map((p) => {
        const header = `${p.ordre}. ${p.titre} :`;
        const body = p.description ? `\n   ${p.description}` : '';
        return `${header}${body}`;
      })
      .join('\n\n');
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
    }
  };

  useEffect(() => {
    if (hasRestoredDraft) return;

    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) {
        setHasRestoredDraft(true);
        return;
      }

      const parsed = JSON.parse(raw) as {
        version?: number;
        savedAt?: string;
        formData?: typeof formData;
        ordreDuJour?: OrdreDuJourItem[];
        membresPresents?: string[];
      };

      if (parsed?.formData) setFormData(parsed.formData);
      if (Array.isArray(parsed?.ordreDuJour)) setOrdreDuJour(parsed.ordreDuJour);
      if (Array.isArray(parsed?.membresPresents)) setMembresPresents(parsed.membresPresents);
    } catch {
    } finally {
      setHasRestoredDraft(true);
    }
  }, [draftKey, hasRestoredDraft]);

  useEffect(() => {
    if (!hasRestoredDraft) return;

    const timeout = window.setTimeout(() => {
      try {
        const payload = {
          version: 1,
          savedAt: new Date().toISOString(),
          formData,
          ordreDuJour,
          membresPresents,
        };
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch {
      }
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [draftKey, formData, ordreDuJour, membresPresents, hasRestoredDraft]);

  useEffect(() => {
    if (!membres.length) return;

    const presents = new Set(membresPresents);
    const presenceHomme = membres.filter((m) => presents.has(m.id) && m.genre === 'HOMME').length;
    const presenceFemme = membres.filter((m) => presents.has(m.id) && m.genre === 'FEMME').length;

    setFormData((prev) => {
      if (prev.presenceHomme === presenceHomme && prev.presenceFemme === presenceFemme) return prev;
      return { ...prev, presenceHomme, presenceFemme };
    });
  }, [membres, membresPresents]);

  useEffect(() => {
    if (!hasRestoredDraft) return;

    if (isReunion) {
      setFormData((prev) => {
        if (!prev.moniteur && !prev.theme) return prev;
        return { ...prev, moniteur: '', theme: '' };
      });

      setFormData((prev) => {
        if (hasUserEditedDeveloppement) return prev;
        if (prev.developpement?.trim()) return prev;
        const generated = generateDeveloppementFromOrdreDuJour();
        if (!generated) return prev;
        return { ...prev, developpement: generated };
      });
    } else {
      setFormData((prev) => {
        if (!prev.pvReunion) return prev;
        return { ...prev, pvReunion: '' };
      });
    }
  }, [isReunion, hasRestoredDraft]);

  useEffect(() => {
    if (!hasRestoredDraft) return;
    if (!isReunion) return;
    if (hasUserEditedDeveloppement) return;

    const generated = generateDeveloppementFromOrdreDuJour();
    setFormData((prev) => {
      if (prev.developpement === generated) return prev;
      return { ...prev, developpement: generated };
    });
  }, [ordreDuJour, isReunion, hasRestoredDraft, hasUserEditedDeveloppement]);

  useEffect(() => {
    console.log('👤 User info:', user);
    console.log('📍 User sectionId:', user?.sectionId);
    console.log('🎭 User role:', user?.role);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const typesRes = await api.get<{ types: RencontreType[] }>('/types');
      setTypes(typesRes.data.types || []);

      // Charger les sections si l'utilisateur n'est pas SECTION_USER
      if (user?.role !== 'SECTION_USER') {
        const sectionsRes = await api.get<{ sections: Section[] }>('/sections');
        setSections(sectionsRes.data.sections || []);
      }

      // Charger les membres de la section
      const membresRes = await api.get<{ membres: Membre[] }>('/membres');
      setMembres(membresRes.data.membres || []);
    } catch (error: any) {
      console.error('Erreur détaillée:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement des données');
      setTypes([]);
      setSections([]);
    }
  };

  const handleAddOrdre = () => {
    setOrdreDuJour([
      ...ordreDuJour,
      { ordre: ordreDuJour.length + 1, titre: '', description: '' }
    ]);
  };

  const handleRemoveOrdre = (index: number) => {
    const newOrdre = ordreDuJour.filter((_, i) => i !== index);
    // Réorganiser les numéros d'ordre
    setOrdreDuJour(newOrdre.map((item, i) => ({ ...item, ordre: i + 1 })));
  };

  const handleOrdreChange = (index: number, field: keyof OrdreDuJourItem, value: string) => {
    const newOrdre = [...ordreDuJour];
    newOrdre[index] = { ...newOrdre[index], [field]: value };
    setOrdreDuJour(newOrdre);
  };

  const handleToggleMembre = (membreId: string) => {
    setMembresPresents(prev => 
      prev.includes(membreId)
        ? prev.filter(id => id !== membreId)
        : [...prev, membreId]
    );
  };

  const handleToggleAll = () => {
    if (membresPresents.length === membres.length) {
      setMembresPresents([]);
    } else {
      setMembresPresents(membres.map(m => m.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.typeId) {
      toast.error('Veuillez sélectionner un type de rencontre');
      return;
    }

    if (!formData.sectionId) {
      if (user?.role === 'SECTION_USER') {
        toast.error('Section non définie. Veuillez contacter l\'administrateur');
      } else {
        toast.error('Veuillez sélectionner une section');
      }
      return;
    }

    if (!isReunion && formData.theme.trim() && !formData.developpement.trim()) {
      toast.error('Veuillez renseigner le DÉVELOPPEMENT du thème');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        ...formData,
        moniteur: isReunion ? '' : formData.moniteur,
        theme: isReunion ? '' : formData.theme,
        developpement: formData.developpement,
        pvReunion: isReunion ? formData.pvReunion : '',
        presenceHomme: Number(formData.presenceHomme),
        presenceFemme: Number(formData.presenceFemme),
        presenceTotale: Number(formData.presenceHomme) + Number(formData.presenceFemme),
        ordreDuJour: isReunion ? ordreDuJour.filter(item => item.titre.trim() !== '') : [],
        membresPresents,
      };

      await api.post('/rencontres', payload);
      toast.success('Rencontre créée avec succès');
      clearDraft();
      navigate('/rencontres');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <Button
          onClick={() => navigate('/rencontres')}
          variant="outline"
          className="p-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Nouvelle rencontre</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Enregistrez une nouvelle rencontre</p>
        </div>
      </motion.div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          const target = e.target as HTMLElement | null;
          const tagName = target?.tagName?.toUpperCase();
          if (tagName === 'TEXTAREA') return;
          e.preventDefault();
        }}
      >
        {/* Informations générales */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Informations générales
            </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type de rencontre *</label>
              <select
                required
                value={formData.typeId}
                onChange={(e) => setFormData({ ...formData, typeId: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
              >
                <option value="">Sélectionner un type</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Afficher le champ Section uniquement pour les admins */}
            {user?.role !== 'SECTION_USER' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Section *</label>
                <select
                  required
                  value={formData.sectionId}
                  onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                  className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                >
                  <option value="">Sélectionner une section</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Heure début</label>
                <input
                  type="time"
                  value={formData.heureDebut}
                  onChange={(e) => setFormData({ ...formData, heureDebut: e.target.value })}
                  className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Heure fin</label>
                <input
                  type="time"
                  value={formData.heureFin}
                  onChange={(e) => setFormData({ ...formData, heureFin: e.target.value })}
                  className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modérateur</label>
              <input
                type="text"
                value={formData.moderateur}
                onChange={(e) => setFormData({ ...formData, moderateur: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                placeholder="Nom du modérateur"
              />
            </div>

            {!isReunion && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Moniteur</label>
                <input
                  type="text"
                  value={formData.moniteur}
                  onChange={(e) => setFormData({ ...formData, moniteur: e.target.value })}
                  className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                  placeholder="Nom du moniteur"
                />
              </div>
            )}

            {!isReunion && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Thème</label>
                <input
                  type="text"
                  value={formData.theme}
                  onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                  className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                  placeholder="Thème de la rencontre"
                />
              </div>
            )}
          </div>
          </Card>
        </motion.div>

        {/* Ordre du jour (réunion uniquement) */}
        <AnimatePresence>
          {isReunion && (
            <motion.div variants={itemVariants}>
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary-600" />
                    Ordre du jour
                  </h2>
                  <Button
                    type="button"
                    onClick={handleAddOrdre}
                    variant="outline"
                    className="inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter un point
                  </Button>
                </div>

              <AnimatePresence mode="popLayout">
                {ordreDuJour.map((item, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex gap-3 items-start"
                  >
                    <div className="flex-shrink-0 w-8 h-10 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 rounded font-medium text-primary-700 dark:text-primary-400">
                      {item.ordre}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={item.titre}
                        onChange={(e) => handleOrdreChange(index, 'titre', e.target.value)}
                        className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                        placeholder="Titre du point"
                      />
                      <textarea
                        value={item.description || ''}
                        onChange={(e) => handleOrdreChange(index, 'description', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-gray-900 dark:text-gray-100"
                        rows={2}
                        placeholder="DÉVELOPPEMENT DU POINT"
                      />
                    </div>
                    {ordreDuJour.length > 1 && (
                      <motion.button
                        type="button"
                        onClick={() => handleRemoveOrdre(index)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Développement du thème (non réunion) */}
        <AnimatePresence>
          {!isReunion && formData.theme.trim() && (
            <motion.div variants={itemVariants}>
              <Card className="p-6 space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-600" />
                  DÉVELOPPEMENT
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Développement du thème <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.developpement}
                    onChange={(e) => setFormData({ ...formData, developpement: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-gray-900 dark:text-gray-100"
                    rows={6}
                    placeholder="Décrivez le développement du thème..."
                    required
                  />
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Espaces spécifiques aux réunions */}
        <AnimatePresence>
          {isReunion && (
            <motion.div 
              variants={itemVariants}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="p-6 space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-600" />
                  Espaces de réunion
                </h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Espace de développement
                <button
                  type="button"
                  onClick={() => {
                    setHasUserEditedDeveloppement(false);
                    const generated = generateDeveloppementFromOrdreDuJour();
                    if (generated) setFormData((prev) => ({ ...prev, developpement: generated }));
                  }}
                  className="ml-2 text-xs text-primary-600 hover:text-primary-700 underline"
                >
                  Charger depuis l'ordre du jour
                </button>
              </label>
              <textarea
                value={formData.developpement}
                readOnly
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                rows={6}
                placeholder="Détaillez les points de développement abordés lors de la réunion..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                PV de réunion
                <button
                  type="button"
                  onClick={() => {
                    const modele = `PROCÈS-VERBAL DE RÉUNION

Date : ${formData.date ? new Date(formData.date).toLocaleDateString('fr-FR') : '[Date]'}
Heure : ${formData.heureDebut} - ${formData.heureFin}
Lieu : [Lieu de la réunion]

PARTICIPANTS :
- Modérateur : ${formData.moderateur || '[Nom du modérateur]'}
- Présents : ${formData.presenceHomme + formData.presenceFemme} personnes (${formData.presenceHomme} H / ${formData.presenceFemme} F)

ORDRE DU JOUR :
${ordreDuJour.map((item, i) => `${i + 1}. ${item.titre || '[Point à l\'ordre du jour]'}`).join('\n')}

DÉROULEMENT :

1. OUVERTURE DE LA SÉANCE
   - Accueil des participants
   - Présentation de l'ordre du jour
   - Adoption de l'ordre du jour

2. DISCUSSIONS ET DÉCISIONS
${ordreDuJour.map((item, i) => `
   Point ${i + 1} : ${item.titre || '[Titre]'}
   ${item.description ? '   Description : ' + item.description : ''}
   - Discussion : [Résumé des échanges]
   - Décision : [Décision prise]
   - Responsable : [Nom]
   - Échéance : [Date]
`).join('\n')}

3. POINTS DIVERS
   - [Autres points abordés]

4. PROCHAINE RÉUNION
   - Date proposée : [Date]
   - Lieu : [Lieu]

CLÔTURE :
La séance est levée à ${formData.heureFin || '[Heure]'}.

Fait à [Lieu], le ${formData.date ? new Date(formData.date).toLocaleDateString('fr-FR') : '[Date]'}

Le Modérateur,                    Le Secrétaire de séance,
${formData.moderateur || '[Nom]'}                      [Nom]`;
                    setFormData({ ...formData, pvReunion: modele });
                  }}
                  className="ml-2 text-xs text-primary-600 hover:text-primary-700 underline"
                >
                  Charger le modèle
                </button>
              </label>
              <textarea
                value={formData.pvReunion}
                onChange={(e) => setFormData({ ...formData, pvReunion: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 font-mono text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-gray-900 dark:text-gray-100"
                rows={12}
                placeholder="Cliquez sur 'Charger le modèle' pour obtenir un modèle de PV pré-rempli..."
              />
            </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Présence */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              Présence
            </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hommes</label>
              <input
                type="number"
                min="0"
                disabled
                value={formData.presenceHomme}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Femmes</label>
              <input
                type="number"
                min="0"
                disabled
                value={formData.presenceFemme}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Total</label>
              <input
                type="number"
                disabled
                value={Number(formData.presenceHomme) + Number(formData.presenceFemme)}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm dark:text-gray-100"
              />
            </div>
          </div>
          </Card>
        </motion.div>

        {/* Fiche de présence */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-600" />
                Fiche de présence
                {membresPresents.length > 0 && (
                  <Badge variant="default" className="ml-2">
                    {membresPresents.length}
                  </Badge>
                )}
              </h2>
              {membres.length > 0 && (
                <Button
                  type="button"
                  onClick={handleToggleAll}
                  variant="outline"
                >
                  {membresPresents.length === membres.length ? 'Tout décocher' : 'Tout cocher'}
                </Button>
              )}
            </div>

          {membres.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {membres.map((membre) => (
                  <label
                    key={membre.id}
                    className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={membresPresents.includes(membre.id)}
                      onChange={() => handleToggleMembre(membre.id)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {membre.prenom} {membre.nom}
                      </p>
                      {membre.fonction && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{membre.fonction}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {membresPresents.length > 0 && (
                <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  Présents :{' '}
                  {membres
                    .filter((m) => membresPresents.includes(m.id))
                    .map((m) => `${m.prenom} ${m.nom}`)
                    .join(', ')}
                </div>
              )}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>{membresPresents.length}</strong> membre{membresPresents.length > 1 ? 's' : ''} présent{membresPresents.length > 1 ? 's' : ''} sur <strong>{membres.length}</strong>
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-2 text-gray-400 dark:text-gray-600" />
              <p className="text-gray-900 dark:text-gray-100">Aucun membre enregistré</p>
              <p className="text-sm">Allez dans la page "Membres" pour ajouter des membres à votre section</p>
            </div>
          )}
          </Card>
        </motion.div>

        {/* Observations */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Observations</h2>
          <textarea
            value={formData.observations}
            onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-gray-900 dark:text-gray-100"
            rows={4}
            placeholder="Observations ou remarques..."
          />
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div variants={itemVariants} className="flex items-center justify-end gap-4">
          <Button
            type="button"
            onClick={() => {
              clearDraft();
              navigate('/rencontres');
            }}
            variant="outline"
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Création...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Créer la rencontre
              </>
            )}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
}
