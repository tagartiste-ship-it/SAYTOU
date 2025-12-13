import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Calendar, Users, Filter, Download, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { Rencontre, RencontreType, Section } from '../lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

export default function RencontresPage() {
  const [rencontres, setRencontres] = useState<Rencontre[]>([]);
  const [types, setTypes] = useState<RencontreType[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, [selectedType, selectedSection, dateDebut, dateFin, debouncedSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedType) params.append('typeId', selectedType);
      if (selectedSection) params.append('sectionId', selectedSection);
      if (dateDebut) params.append('dateDebut', dateDebut);
      if (dateFin) params.append('dateFin', dateFin);
      if (debouncedSearch) params.append('q', debouncedSearch);

      const [rencontresRes, typesRes, sectionsRes] = await Promise.all([
        api.get<{ rencontres: Rencontre[] }>(`/rencontres?${params.toString()}`),
        api.get<{ types: RencontreType[] }>('/types'),
        api.get<{ sections: Section[] }>('/sections'),
      ]);

      setRencontres(rencontresRes.data.rencontres || []);
      setTypes(typesRes.data.types || []);
      setSections(sectionsRes.data.sections || []);
    } catch (error: any) {
      console.error('Erreur détaillée:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Erreur lors du chargement des rencontres';
      setError(errorMsg);
      toast.error(errorMsg);
      // Initialiser avec des tableaux vides en cas d'erreur
      setRencontres([]);
      setTypes([]);
      setSections([]);
    } finally {
      setIsLoading(false);
    }
  };


  const filteredRencontres = rencontres;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  // Affichage d'erreur si problème
  if (error && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="card p-12 text-center">
          <div className="text-red-600 text-xl mb-4">❌ Erreur</div>
          <p className="text-gray-700">{error}</p>
          <button onClick={() => { setError(null); fetchData(); }} className="btn btn-primary mt-4">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Historique</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Consultez l'historique de toutes les rencontres</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="default" className="text-base px-4 py-2">
            <TrendingUp className="w-4 h-4 mr-2" />
            {filteredRencontres.length} rencontres
          </Badge>
        </div>
      </motion.div>

      {/* Filtres */}
      <motion.div variants={itemVariants}>
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
            <Filter className="w-5 h-5" />
            Filtres
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Recherche */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder="Rechercher par thème, modérateur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>

            {/* Type */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
            >
              <option value="">Tous les types</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>

            {/* Section */}
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
            >
              <option value="">Toutes les sections</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>

            {/* Bouton réinitialiser */}
            <Button
              onClick={() => {
                setSearchTerm('');
                setSelectedType('');
                setSelectedSection('');
                setDateDebut('');
                setDateFin('');
              }}
              variant="outline"
            >
              Réinitialiser
            </Button>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label text-gray-700 dark:text-gray-300">Date début</label>
              <Input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-gray-700 dark:text-gray-300">Date fin</label>
              <Input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Liste des rencontres */}
      {filteredRencontres.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Aucune rencontre trouvée
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Aucune rencontre ne correspond aux critères de recherche
            </p>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="grid gap-4">
          {filteredRencontres.map((rencontre, index) => (
            <motion.div
              key={rencontre.id}
              variants={itemVariants}
              custom={index}
            >
              <Link
                to={`/rencontres/${rencontre.id}`}
              >
                <Card hover className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="default">
                          {rencontre.type.name}
                        </Badge>
                        <span className="text-gray-500 dark:text-gray-400 text-sm">
                          {rencontre.section.name}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        {rencontre.theme || 'Sans thème'}
                      </h3>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(rencontre.date), 'dd MMMM yyyy', { locale: fr })}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <Users className="w-4 h-4" />
                          <Badge variant="success" className="ml-1">{rencontre.presenceTotale}</Badge> présents
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Modérateur:</span> {rencontre.moderateur}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Moniteur:</span> {rencontre.moniteur}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.preventDefault();
                          window.open(`${api.defaults.baseURL}/rencontres/${rencontre.id}/pdf`, '_blank');
                        }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        title="Télécharger PDF"
                      >
                        <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </motion.button>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Stats */}
      {filteredRencontres.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Résumé</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total rencontres</p>
                <p className="text-2xl font-bold text-primary">{filteredRencontres.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Présence totale</p>
                <p className="text-2xl font-bold text-accent">
                  {filteredRencontres.reduce((sum, r) => sum + r.presenceTotale, 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Hommes</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {filteredRencontres.reduce((sum, r) => sum + r.presenceHomme, 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Femmes</p>
                <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                  {filteredRencontres.reduce((sum, r) => sum + r.presenceFemme, 0)}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
