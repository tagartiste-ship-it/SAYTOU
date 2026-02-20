import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Save, Users, Calendar, FileText } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { RencontreType, Section, OrdreDuJourItem, Rencontre, Membre } from '../lib/types';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

export default function EditRencontrePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  useEffect(() => {
    const from = new URLSearchParams(location.search).get('from');
    if (from === 'mes') return;
    toast.error('Modification autorisée uniquement depuis Mes Rencontres');
    navigate('/mes-rencontres', { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    if (user?.role !== 'SECTION_USER') return;
    if (!user.sectionId) return;
    setFormData((prev) => (prev.sectionId ? prev : { ...prev, sectionId: user.sectionId || '' }));
  }, [user?.role, user?.sectionId]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const message = event.error?.message || event.message || 'Erreur inconnue';
      // eslint-disable-next-line no-console
      console.error('Runtime error:', event.error || event);
      toast.error(message);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason: any = event.reason;
      const message = reason?.message || String(reason) || 'Erreur inconnue';
      // eslint-disable-next-line no-console
      console.error('Unhandled promise rejection:', reason);
      toast.error(message);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);
  
  const [types, setTypes] = useState<RencontreType[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  // Form data
  const [formData, setFormData] = useState({
    typeId: '',
    sectionId: '',
    date: '',
    heureDebut: '',
    heureFin: '',
    moderateur: '',
    moniteur: '',
    theme: '',
    developpement: '',
    pvReunion: '',
    presenceHomme: 0,
    presenceFemme: 0,
    observations: '',
    lieuMembreId: '',
    lieuTexte: '',
  });
  
  const [ordreDuJour, setOrdreDuJour] = useState<OrdreDuJourItem[]>([]);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [membresPresence, setMembresPresence] = useState<Membre[]>([]);
  const [membresPresents, setMembresPresents] = useState<string[]>([]);
  const [membresAbsents, setMembresAbsents] = useState<string[]>([]);

  // Sous-localité / Localité: sections pour la fiche de présence groupée
  type SectionInfo = { sectionId: string; sectionName: string; sousLocaliteName?: string; total: number };
  const [sectionsInfo, setSectionsInfo] = useState<SectionInfo[]>([]);
  const [sectionPresenceCounts, setSectionPresenceCounts] = useState<Record<string, { hommes: number; femmes: number }>>({}); 
  const isGroupedPresence = user?.role === 'SOUS_LOCALITE_ADMIN' || user?.role === 'LOCALITE' || user?.role === 'COMITE_PEDAGOGIQUE';

  const selectedType = types.find((t) => t.id === formData.typeId);

  const presentsSet = new Set(membresPresents);

  const getSectionGroupLabel = (sectionName?: string | null) => {
    const name = (sectionName || '').toUpperCase();
    if (name.includes('S1')) return 'S1';
    if (name.includes('S2')) return 'S2';
    if (name.includes('S3')) return 'S3';
    return 'S?';
  };

  const getGroupOrderForSection = (sectionName?: string | null) => {
    const g = getSectionGroupLabel(sectionName);
    if (g === 'S1') return ['S1', 'S2', 'S3'];
    if (g === 'S2') return ['S2', 'S1', 'S3'];
    if (g === 'S3') return ['S3', 'S1', 'S2'];
    return ['S1', 'S2', 'S3'];
  };

  useEffect(() => {
    fetchData();
    if (id) {
      fetchRencontre();
    }
  }, [id]);

  useEffect(() => {
    if (isGroupedPresence) {
      const fetchMembresForScope = async () => {
        try {
          const membresRes = await api.get<{ membres: Membre[] }>('/membres', {
            params: { limit: 1000 },
          });
          setMembres(membresRes.data.membres || []);
          setMembresPresence(membresRes.data.membres || []);
        } catch {
          setMembres([]);
          setMembresPresence([]);
        }
      };

      fetchMembresForScope();
      return;
    }

    if (user?.role === 'SECTION_USER') return;
    if (!formData.sectionId) {
      setMembres([]);
      setFormData((prev) => ({ ...prev, lieuMembreId: '' }));
      return;
    }

    const fetchMembresForSection = async () => {
      try {
        const membresRes = await api.get<{ membres: Membre[] }>('/membres', {
          params: { sectionId: formData.sectionId },
        });
        setMembres(membresRes.data.membres || []);
        setMembresPresence(membresRes.data.membres || []);

        setFormData((prev) => {
          if (!prev.lieuMembreId) return prev;
          const allowed = new Set((membresRes.data.membres || []).map((m) => m.id));
          if (allowed.has(prev.lieuMembreId)) return prev;
          return { ...prev, lieuMembreId: '' };
        });
      } catch {
        setMembres([]);
        setMembresPresence([]);
      }
    };

    fetchMembresForSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.sectionId, user?.role, isGroupedPresence]);

  useEffect(() => {
    if (isGroupedPresence) {
      let totalH = 0;
      let totalF = 0;
      for (const c of Object.values(sectionPresenceCounts)) {
        totalH += c.hommes || 0;
        totalF += c.femmes || 0;
      }
      setFormData((prev) => {
        if (prev.presenceHomme === totalH && prev.presenceFemme === totalF) return prev;
        return { ...prev, presenceHomme: totalH, presenceFemme: totalF };
      });
    } else {
      if (membresPresence.length === 0) return;
      const presenceHomme = membresPresence.filter(
        (m) => m.genre === 'HOMME' && membresPresents.includes(m.id)
      ).length;
      const presenceFemme = membresPresence.filter(
        (m) => m.genre === 'FEMME' && membresPresents.includes(m.id)
      ).length;
      setFormData((prev) => {
        if (prev.presenceHomme === presenceHomme && prev.presenceFemme === presenceFemme) return prev;
        return { ...prev, presenceHomme, presenceFemme };
      });
    }
  }, [membresPresence, membresPresents, sectionPresenceCounts, isGroupedPresence]);

  const fetchData = async () => {
    try {
      const typesRes = await api.get<{ types: RencontreType[] }>('/types');
      setTypes(typesRes.data.types || []);

      // Charger les sections si l'utilisateur n'est pas SECTION_USER
      if (user?.role !== 'SECTION_USER') {
        const sectionsRes = await api.get<{ sections: Section[] }>('/sections');
        setSections(sectionsRes.data.sections || []);
      }

      // Sous-localité / Localité: charger les sections pour la fiche de présence
      if (isGroupedPresence) {
        try {
          const parSectionsRes = await api.get<{ sections: Array<{ sectionId: string; sectionName: string; sousLocaliteName?: string; total: number }> }>('/membres/par-sections');
          const secs = (parSectionsRes.data.sections || []).map((s) => ({
            sectionId: s.sectionId,
            sectionName: s.sectionName,
            sousLocaliteName: s.sousLocaliteName,
            total: s.total,
          }));
          setSectionsInfo(secs);
          // Initialiser les compteurs à 0 (seront écrasés par fetchRencontre si des données existent)
          const counts: Record<string, { hommes: number; femmes: number }> = {};
          for (const s of secs) counts[s.sectionId] = { hommes: 0, femmes: 0 };
          setSectionPresenceCounts(counts);
        } catch {
          setSectionsInfo([]);
        }
      } else {
        // Charger les membres de la section
        const membresRes = await api.get<{ membres: Membre[] }>('/membres');
        setMembres(membresRes.data.membres || []);
        setMembresPresence(membresRes.data.membres || []);
      }
    } catch (error: any) {
      console.error('Erreur détaillée:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement des données');
      setTypes([]);
      setSections([]);
    }
  };

  const fetchRencontre = async () => {
    try {
      setIsFetching(true);
      const response = await api.get<{ rencontre: Rencontre }>(`/rencontres/${id}`);
      const rencontreData = response.data.rencontre || response.data;
      const rencontre = rencontreData as Rencontre;
      
      // Remplir le formulaire avec les données existantes
      setFormData({
        typeId: rencontre.typeId,
        sectionId: String(rencontre.sectionId ?? ''),
        date: new Date(rencontre.date).toISOString().split('T')[0],
        heureDebut: rencontre.heureDebut,
        heureFin: rencontre.heureFin,
        moderateur: rencontre.moderateur,
        moniteur: rencontre.moniteur,
        theme: rencontre.theme || '',
        developpement: rencontre.developpement || '',
        pvReunion: rencontre.pvReunion || '',
        presenceHomme: rencontre.presenceHomme,
        presenceFemme: rencontre.presenceFemme,
        observations: rencontre.observations || '',
        lieuMembreId: rencontre.lieuMembreId || '',
        lieuTexte: rencontre.lieuTexte || '',
      });
      
      // Remplir l'ordre du jour
      if (rencontre.ordreDuJour && rencontre.ordreDuJour.length > 0) {
        setOrdreDuJour(rencontre.ordreDuJour);
      } else {
        setOrdreDuJour([{ ordre: 1, titre: '', description: '' }]);
      }

      // Remplir les membres présents
      if (rencontre.membresPresents && rencontre.membresPresents.length > 0) {
        if (isGroupedPresence) {
          // Restaurer les compteurs par section depuis les données sauvegardées
          const saved = rencontre.membresPresents as any[];
          if (saved.length > 0 && typeof saved[0] === 'object' && 'sectionId' in saved[0]) {
            const counts: Record<string, { hommes: number; femmes: number }> = {};
            for (const item of saved) {
              counts[item.sectionId] = { hommes: item.hommes || 0, femmes: item.femmes || 0 };
            }
            setSectionPresenceCounts((prev) => ({ ...prev, ...counts }));
          }
        } else {
          setMembresPresents(rencontre.membresPresents);
        }
      }
    } catch (error: any) {
      console.error('Erreur chargement rencontre:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement de la rencontre');
      navigate('/mes-rencontres');
    } finally {
      setIsFetching(false);
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

  const preventFocusScroll = () => {
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === 'function') active.blur();
  };

  const handleTogglePresent = (membreId: string) => {
    preventFocusScroll();
    setMembresPresents((prev) => (prev.includes(membreId) ? prev.filter((id) => id !== membreId) : [...prev, membreId]));
    setMembresAbsents((prev) => prev.filter((id) => id !== membreId));
  };

  const handleToggleAbsent = (membreId: string) => {
    preventFocusScroll();
    setMembresAbsents((prev) => (prev.includes(membreId) ? prev.filter((id) => id !== membreId) : [...prev, membreId]));
    setMembresPresents((prev) => prev.filter((id) => id !== membreId));
  };

  const handleToggleAll = () => {
    preventFocusScroll();
    const eligibleIds = membresPresence.filter((m) => !!m.ageTranche).map((m) => m.id);
    const eligibleSet = new Set(eligibleIds);
    const presentEligibleCount = membresPresents.filter((mid) => eligibleSet.has(mid)).length;

    if (eligibleIds.length > 0 && presentEligibleCount === eligibleIds.length) {
      setMembresPresents((prev) => prev.filter((mid) => !eligibleSet.has(mid)));
      setMembresAbsents((prev) => prev.filter((mid) => !eligibleSet.has(mid)));
    } else {
      setMembresPresents((prev) => {
        const s = new Set(prev);
        for (const mid of eligibleIds) s.add(mid);
        return Array.from(s);
      });
      setMembresAbsents((prev) => prev.filter((mid) => !eligibleSet.has(mid)));
    }

  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.typeId) {
      toast.error('Veuillez sélectionner un type de rencontre');
      return;
    }

    if (!isGroupedPresence && !formData.sectionId) {
      toast.error('Veuillez sélectionner une section');
      return;
    }

    setIsLoading(true);
    try {
      const lieuDetails = formData.lieuTexte?.trim() || '';
      const lieuTexteFinal = lieuDetails ? lieuDetails : null;

      const payload = {
        ...formData,
        sectionId: isGroupedPresence ? null : formData.sectionId,
        presenceHomme: Number(formData.presenceHomme),
        presenceFemme: Number(formData.presenceFemme),
        presenceTotale: Number(formData.presenceHomme) + Number(formData.presenceFemme),
        ordreDuJour: ordreDuJour.filter(item => item.titre.trim() !== ''),
        membresPresents: isGroupedPresence
          ? sectionsInfo.map((s) => ({
              sectionId: s.sectionId,
              sectionName: s.sectionName,
              hommes: sectionPresenceCounts[s.sectionId]?.hommes || 0,
              femmes: sectionPresenceCounts[s.sectionId]?.femmes || 0,
              total: (sectionPresenceCounts[s.sectionId]?.hommes || 0) + (sectionPresenceCounts[s.sectionId]?.femmes || 0),
            }))
          : membresPresents,
        lieuMembreId: formData.lieuMembreId || null,
        lieuTexte: lieuTexteFinal,
      };

      await api.put(`/rencontres/${id}`, payload);
      toast.success('Rencontre modifiée avec succès');
      navigate('/mes-rencontres');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la modification');
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

  if (isFetching) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

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
          onClick={() => navigate('/mes-rencontres')}
          variant="outline"
          className="p-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Modifier la rencontre</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Modifiez les informations de la rencontre</p>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
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

            {user?.role !== 'SECTION_USER' && !isGroupedPresence && (
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lieu (chez un membre)</label>
              <select
                value={formData.lieuMembreId}
                onChange={(e) => setFormData({ ...formData, lieuMembreId: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
              >
                <option value="">Aucun</option>
                {membres.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.prenom} {m.nom}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Détails du lieu</label>
              <input
                type="text"
                value={formData.lieuTexte}
                onChange={(e) => setFormData({ ...formData, lieuTexte: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                placeholder="Ex: Quartier, adresse, repère..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Heure début *</label>
              <input
                type="time"
                required
                value={formData.heureDebut}
                onChange={(e) => setFormData({ ...formData, heureDebut: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modérateur *</label>
              <input
                type="text"
                required
                value={formData.moderateur}
                onChange={(e) => setFormData({ ...formData, moderateur: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                placeholder="Nom du modérateur"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Moniteur *</label>
              <input
                type="text"
                required
                value={formData.moniteur}
                onChange={(e) => setFormData({ ...formData, moniteur: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                placeholder="Nom du moniteur"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Thème</label>
            <input
              type="text"
              value={formData.theme}
              onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
              className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
              placeholder="Thème de la rencontre (optionnel)"
            />
          </div>
          </Card>
        </motion.div>

        {/* Ordre du jour */}
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

          <div className="space-y-3">
            {ordreDuJour.map((item, index) => (
              <div key={index} className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded font-medium">
                  {item.ordre}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={item.titre}
                    onChange={(e) => handleOrdreChange(index, 'titre', e.target.value)}
                    placeholder="Titre du point"
                    className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                  />
                  <textarea
                    value={item.description || ''}
                    onChange={(e) => handleOrdreChange(index, 'description', e.target.value)}
                    placeholder="Description (optionnel)"
                    className="flex w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100 min-h-[60px]"
                  />
                </div>
                {ordreDuJour.length > 1 && (
                  <motion.button
                    type="button"
                    onClick={() => handleRemoveOrdre(index)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-shrink-0 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </motion.button>
                )}
              </div>
            ))}
          </div>
          </Card>
        </motion.div>

        {/* Espaces spécifiques aux réunions */}
        <AnimatePresence>
          {types.find(t => t.id === formData.typeId)?.isReunion && (
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Espace de développement</label>
              <textarea
                value={formData.developpement}
                onChange={(e) => setFormData({ ...formData, developpement: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
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
- Moniteur : ${formData.moniteur || '[Nom du moniteur]'}
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
                className="flex w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100 font-mono"
                rows={12}
                placeholder="Cliquez sur 'Charger le modèle' pour obtenir un modèle de PV pré-rempli..."
              />
            </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fiche de présence */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-600" />
                Fiche de présence {isGroupedPresence && '(par section)'}
              </h2>
              {!isGroupedPresence && membresPresence.length > 0 && (
                <Button
                  type="button"
                  onClick={handleToggleAll}
                  variant="outline"
                >
                  {membresPresents.length === membresPresence.length ? 'Tout décocher' : 'Tout cocher'}
                </Button>
              )}
            </div>

          {/* ===== SOUS-LOCALITE / LOCALITE: tableau compact par section ===== */}
          {isGroupedPresence && sectionsInfo.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Section</th>
                      <th className="text-center px-3 py-3 font-semibold text-blue-700 dark:text-blue-300 w-24">Hommes</th>
                      <th className="text-center px-3 py-3 font-semibold text-pink-700 dark:text-pink-300 w-24">Femmes</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-700 dark:text-gray-300 w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionsInfo.map((sec, idx) => {
                      const counts = sectionPresenceCounts[sec.sectionId] || { hommes: 0, femmes: 0 };
                      const sectionTotal = (counts.hommes || 0) + (counts.femmes || 0);
                      const updateCount = (field: 'hommes' | 'femmes', value: number) => {
                        setSectionPresenceCounts((prev) => ({
                          ...prev,
                          [sec.sectionId]: { ...prev[sec.sectionId], [field]: Math.max(0, value) },
                        }));
                      };
                      return (
                        <tr
                          key={sec.sectionId}
                          className={`border-b border-gray-100 dark:border-gray-800 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/50'} ${sectionTotal > 0 ? 'ring-1 ring-inset ring-green-200 dark:ring-green-800' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-gray-100">{sec.sectionName}</span>
                              <Badge variant="secondary" className="text-xs">{sec.total} mbr</Badge>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={counts.hommes || ''}
                              placeholder="0"
                              onChange={(e) => updateCount('hommes', parseInt(e.target.value) || 0)}
                              className="w-20 mx-auto h-9 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20 px-2 py-1 text-center text-sm font-semibold text-blue-800 dark:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={counts.femmes || ''}
                              placeholder="0"
                              onChange={(e) => updateCount('femmes', parseInt(e.target.value) || 0)}
                              className="w-20 mx-auto h-9 rounded-lg border border-pink-300 dark:border-pink-700 bg-pink-50/50 dark:bg-pink-900/20 px-2 py-1 text-center text-sm font-semibold text-pink-800 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`text-base font-bold ${sectionTotal > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
                              {sectionTotal}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-t-2 border-primary-200 dark:border-primary-700">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">TOTAL</td>
                      <td className="px-3 py-3 text-center font-bold text-blue-700 dark:text-blue-300 text-lg">{formData.presenceHomme}</td>
                      <td className="px-3 py-3 text-center font-bold text-pink-700 dark:text-pink-300 text-lg">{formData.presenceFemme}</td>
                      <td className="px-3 py-3 text-center font-bold text-primary-700 dark:text-primary-300 text-lg">{Number(formData.presenceHomme) + Number(formData.presenceFemme)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Badge variant="default" className="text-xs">{sectionsInfo.length} section{sectionsInfo.length > 1 ? 's' : ''}</Badge>
                <span>•</span>
                <span>Saisissez le nombre d'hommes et de femmes présents pour chaque section</span>
              </div>
            </div>
          ) : !isGroupedPresence && membresPresence.length > 0 ? (
            <div className="space-y-6">
                {(() => {
                  const buckets: Record<string, Membre[]> = { S1: [], S2: [], S3: [] };
                  let excludedNoAge = 0;
                  membresPresence.forEach((m: Membre) => {
                    const label = m.ageTranche;
                    if (!label) {
                      excludedNoAge += 1;
                      return;
                    }
                    (buckets[label] ||= []).push(m);
                  });

                  const order = getGroupOrderForSection(selectedType?.trancheAge?.name);

                  const hasAnyGroup = order.some((g) => (buckets[g] || []).length > 0);
                  if (!hasAnyGroup) {
                    return (
                      <div className="p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-900 dark:text-blue-100">
                        Aucun membre à afficher dans S1/S2/S3.
                        {excludedNoAge > 0 && (
                          <div className="mt-1">
                            <strong>{excludedNoAge}</strong> membre{excludedNoAge > 1 ? 's' : ''} ignoré{excludedNoAge > 1 ? 's' : ''} car la date de naissance (âge) est manquante.
                            Mets à jour les membres dans la page <strong>Membres</strong>.
                          </div>
                        )}
                      </div>
                    );
                  }

                  return order
                    .filter((g) => (buckets[g] || []).length > 0)
                    .map((g) => {
                      const list = buckets[g] || [];
                      const hommes = list.filter((m: Membre) => m.genre === 'HOMME');
                      const femmes = list.filter((m: Membre) => m.genre === 'FEMME');
                      const sansGenre = list.filter((m: Membre) => !m.genre || (m.genre !== 'HOMME' && m.genre !== 'FEMME'));
                      const labelHommes = g === 'S1' ? 'Garçons' : 'Hommes';
                      const labelFemmes = g === 'S1' ? 'Filles' : 'Femmes';
                      const title = g;

                      const sortFn = (a: Membre, b: Membre) => {
                        const aChecked = membresPresents.includes(a.id) || membresAbsents.includes(a.id);
                        const bChecked = membresPresents.includes(b.id) || membresAbsents.includes(b.id);
                        if (aChecked !== bChecked) return aChecked ? 1 : -1;
                        return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`);
                      };

                      hommes.sort(sortFn);
                      femmes.sort(sortFn);
                      sansGenre.sort(sortFn);

                      const presentTotal = list.filter((m) => presentsSet.has(m.id)).length;
                      const presentHommes = hommes.filter((m) => presentsSet.has(m.id)).length;
                      const presentFemmes = femmes.filter((m) => presentsSet.has(m.id)).length;

                      return (
                        <div
                          key={g}
                          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
                        >
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</div>
                            <div className="flex items-center gap-2">
                              <Badge variant="default">Total: {list.length}</Badge>
                              <Badge variant="secondary">Présents: {presentTotal}</Badge>
                              <Badge variant="secondary">H: {presentHommes}</Badge>
                              <Badge variant="accent">F: {presentFemmes}</Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 items-start">
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                  {labelHommes}
                                </h4>
                                <span className="text-sm text-gray-700 dark:text-gray-300">{hommes.length}</span>
                              </div>
                              <div className="p-3 space-y-2">
                                {hommes.length === 0 && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">Aucun</div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {hommes.map((membre: Membre) => {
                                    const isPresent = membresPresents.includes(membre.id);
                                    const isAbsent = membresAbsents.includes(membre.id);
                                    return (
                                      <div
                                        key={membre.id}
                                        className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                      >
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-normal break-words leading-snug">
                                          {membre.prenom} {membre.nom}
                                        </p>

                                        <div className="mt-2 flex items-center gap-3">
                                          <label
                                            className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 font-semibold select-none"
                                            onMouseDown={(e) => e.preventDefault()}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isPresent}
                                              onChange={() => handleTogglePresent(membre.id)}
                                              className="sr-only peer"
                                              aria-label="Présent"
                                            />
                                            <span className="inline-flex items-center justify-center w-4 h-4 rounded border-2 border-green-600 bg-transparent text-transparent peer-checked:bg-green-600 peer-checked:border-green-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 text-xs font-bold leading-none">
                                              ✓
                                            </span>
                                            P
                                          </label>

                                          <label
                                            className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 font-semibold select-none"
                                            onMouseDown={(e) => e.preventDefault()}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isAbsent}
                                              onChange={() => handleToggleAbsent(membre.id)}
                                              className="sr-only peer"
                                              aria-label="Absent"
                                            />
                                            <span className="inline-flex items-center justify-center w-4 h-4 rounded border-2 border-orange-600 bg-transparent text-transparent peer-checked:bg-orange-600 peer-checked:border-orange-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500 text-xs font-bold leading-none">
                                              ✓
                                            </span>
                                            A
                                          </label>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                  {labelFemmes}
                                </h4>
                                <span className="text-sm text-gray-700 dark:text-gray-300">{femmes.length}</span>
                              </div>
                              <div className="p-3 space-y-2">
                                {femmes.length === 0 && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">Aucune</div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {femmes.map((membre: Membre) => {
                                    const isPresent = membresPresents.includes(membre.id);
                                    const isAbsent = membresAbsents.includes(membre.id);
                                    return (
                                      <div
                                        key={membre.id}
                                        className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                      >
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-normal break-words leading-snug">
                                          {membre.prenom} {membre.nom}
                                        </p>

                                        <div className="mt-2 flex items-center gap-3">
                                          <label
                                            className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 font-semibold select-none"
                                            onMouseDown={(e) => e.preventDefault()}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isPresent}
                                              onChange={() => handleTogglePresent(membre.id)}
                                              className="sr-only peer"
                                              aria-label="Présent"
                                            />
                                            <span className="inline-flex items-center justify-center w-4 h-4 rounded border-2 border-green-600 bg-transparent text-transparent peer-checked:bg-green-600 peer-checked:border-green-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 text-xs font-bold leading-none">
                                              ✓
                                            </span>
                                            P
                                          </label>

                                          <label
                                            className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 font-semibold select-none"
                                            onMouseDown={(e) => e.preventDefault()}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isAbsent}
                                              onChange={() => handleToggleAbsent(membre.id)}
                                              className="sr-only peer"
                                              aria-label="Absent"
                                            />
                                            <span className="inline-flex items-center justify-center w-4 h-4 rounded border-2 border-orange-600 bg-transparent text-transparent peer-checked:bg-orange-600 peer-checked:border-orange-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500 text-xs font-bold leading-none">
                                              ✓
                                            </span>
                                            A
                                          </label>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          {sansGenre.length > 0 && (
                            <div className="px-4 pb-4">
                              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                  <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">À classer</h4>
                                  <span className="text-sm text-gray-700 dark:text-gray-300">{sansGenre.length}</span>
                                </div>

                                <div className="p-3">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {sansGenre.map((membre: Membre) => {
                                      const isPresent = membresPresents.includes(membre.id);
                                      const isAbsent = membresAbsents.includes(membre.id);
                                      return (
                                        <div
                                          key={membre.id}
                                          className="p-2 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                        >
                                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-normal break-words leading-snug">
                                            {membre.prenom} {membre.nom}
                                          </p>

                                          <div className="mt-2 flex items-center gap-3">
                                            <label
                                              className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 font-semibold select-none"
                                              onMouseDown={(e) => e.preventDefault()}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isPresent}
                                                onChange={() => handleTogglePresent(membre.id)}
                                                className="sr-only peer"
                                                aria-label="Présent"
                                              />
                                              <span className="inline-flex items-center justify-center w-4 h-4 rounded border-2 border-green-600 bg-transparent text-transparent peer-checked:bg-green-600 peer-checked:border-green-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 text-xs font-bold leading-none">
                                                ✓
                                              </span>
                                              P
                                            </label>

                                            <label
                                              className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 font-semibold select-none"
                                              onMouseDown={(e) => e.preventDefault()}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isAbsent}
                                                onChange={() => handleToggleAbsent(membre.id)}
                                                className="sr-only peer"
                                                aria-label="Absent"
                                              />
                                              <span className="inline-flex items-center justify-center w-4 h-4 rounded border-2 border-orange-600 bg-transparent text-transparent peer-checked:bg-orange-600 peer-checked:border-orange-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500 text-xs font-bold leading-none">
                                                ✓
                                              </span>
                                              A
                                            </label>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                })()}

                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>{membresPresents.length}</strong> membre{membresPresents.length > 1 ? 's' : ''} présent{membresPresents.length > 1 ? 's' : ''} sur <strong>{membresPresence.length}</strong>
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-400 dark:text-gray-600" />
                <p className="text-gray-900 dark:text-gray-100">Aucun membre enregistré</p>
                <p className="text-sm">{isGroupedPresence ? 'Aucune section trouvée pour votre périmètre' : 'Allez dans la page "Membres" pour ajouter des membres à votre section'}</p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Présence totale (résumé calculé automatiquement) */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              Présence totale
            </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hommes</label>
              <input
                type="number"
                readOnly
                min="0"
                value={formData.presenceHomme}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Femmes</label>
              <input
                type="number"
                readOnly
                min="0"
                value={formData.presenceFemme}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Total</label>
              <input
                type="number"
                value={formData.presenceHomme + formData.presenceFemme}
                readOnly
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 px-4 py-2 text-sm dark:text-gray-100"
              />
            </div>
          </div>
          </Card>
        </motion.div>

        {/* Observations */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Observations</h2>
            <textarea
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              className="flex w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
              rows={4}
              placeholder="Observations ou remarques..."
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Heure fin *</label>
              <input
                type="time"
                required
                value={formData.heureFin}
                onChange={(e) => setFormData({ ...formData, heureFin: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
              />
            </div>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div variants={itemVariants} className="flex items-center justify-end gap-4">
          <Button
            type="button"
            onClick={() => navigate('/mes-rencontres')}
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
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Enregistrer les modifications
              </>
            )}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
}
