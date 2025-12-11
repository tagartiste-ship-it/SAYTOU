import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  
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
  });
  
  const [ordreDuJour, setOrdreDuJour] = useState<OrdreDuJourItem[]>([]);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [membresPresents, setMembresPresents] = useState<string[]>([]);

  const membresHommes = membres.filter((m) => m.genre === 'HOMME');
  const membresFemmes = membres.filter((m) => m.genre === 'FEMME');
  const membresSansGenre = membres.filter((m) => !m.genre);

  useEffect(() => {
    fetchData();
    if (id) {
      fetchRencontre();
    }
  }, [id]);

  useEffect(() => {
    if (membres.length === 0) return;

    const presenceHomme = membres.filter(
      (m) => m.genre === 'HOMME' && membresPresents.includes(m.id)
    ).length;

    const presenceFemme = membres.filter(
      (m) => m.genre === 'FEMME' && membresPresents.includes(m.id)
    ).length;

    setFormData((prev) => ({
      ...prev,
      presenceHomme,
      presenceFemme,
    }));
  }, [membres, membresPresents]);

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

  const fetchRencontre = async () => {
    try {
      setIsFetching(true);
      const response = await api.get<{ rencontre: Rencontre }>(`/rencontres/${id}`);
      const rencontreData = response.data.rencontre || response.data;
      const rencontre = rencontreData as Rencontre;
      
      // Remplir le formulaire avec les données existantes
      setFormData({
        typeId: rencontre.typeId,
        sectionId: rencontre.sectionId,
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
      });
      
      // Remplir l'ordre du jour
      if (rencontre.ordreDuJour && rencontre.ordreDuJour.length > 0) {
        setOrdreDuJour(rencontre.ordreDuJour);
      } else {
        setOrdreDuJour([{ ordre: 1, titre: '', description: '' }]);
      }

      // Remplir les membres présents
      if (rencontre.membresPresents && rencontre.membresPresents.length > 0) {
        setMembresPresents(rencontre.membresPresents);
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
      toast.error('Veuillez sélectionner une section');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        ...formData,
        presenceHomme: Number(formData.presenceHomme),
        presenceFemme: Number(formData.presenceFemme),
        presenceTotale: Number(formData.presenceHomme) + Number(formData.presenceFemme),
        ordreDuJour: ordreDuJour.filter(item => item.titre.trim() !== ''),
        membresPresents,
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Heure fin *</label>
                <input
                  type="time"
                  required
                  value={formData.heureFin}
                  onChange={(e) => setFormData({ ...formData, heureFin: e.target.value })}
                  className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                />
              </div>
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Colonne Hommes */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Hommes ({membresHommes.length})</h3>
                  {membresHommes.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">Aucun homme inscrit</div>
                  )}
                  {membresHommes.map((membre) => (
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

                {/* Colonne Femmes */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Femmes ({membresFemmes.length})</h3>
                  {membresFemmes.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">Aucune femme inscrite</div>
                  )}
                  {membresFemmes.map((membre) => (
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
              </div>

              {membresSansGenre.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">À classer ({membresSansGenre.length})</h3>
                  {membresSansGenre.map((membre) => (
                    <label
                      key={membre.id}
                      className="flex items-center gap-3 p-3 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
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
