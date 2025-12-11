import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, FileText, Calendar, Users, Clock, Filter, Download } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { Rencontre } from '../lib/types';
import { useAuthStore } from '../store/authStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

export default function MesRencontresPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [rencontres, setRencontres] = useState<Rencontre[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtres
  const [filters, setFilters] = useState({
    typeId: '',
    dateDebut: '',
    dateFin: '',
  });

  useEffect(() => {
    fetchRencontres();
  }, [filters]);

  const fetchRencontres = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters.typeId) params.append('typeId', filters.typeId);
      if (filters.dateDebut) params.append('dateDebut', filters.dateDebut);
      if (filters.dateFin) params.append('dateFin', filters.dateFin);
      params.append('limit', '100');

      const response = await api.get<{ rencontres: Rencontre[] }>(`/rencontres?${params.toString()}`);
      setRencontres(response.data.rencontres || []);
    } catch (error: any) {
      console.error('Erreur détaillée:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Erreur lors du chargement';
      setError(errorMsg);
      toast.error(errorMsg);
      setRencontres([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette rencontre ?')) return;

    try {
      await api.delete(`/rencontres/${id}`);
      toast.success('Rencontre supprimée avec succès');
      fetchRencontres();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const handleExportPDF = async (id: string) => {
    try {
      const response = await api.get(`/pdf/rencontre/${id}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rencontre-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('PDF téléchargé avec succès');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'export PDF');
    }
  };

  const canModify = (rencontre: Rencontre) => {
    // L'utilisateur peut modifier uniquement ses propres rencontres
    if (user?.role === 'SECTION_USER') {
      return rencontre.scopeType === 'SECTION' && rencontre.scopeId === user.sectionId;
    }
    if (user?.role === 'SOUS_LOCALITE_ADMIN') {
      return rencontre.scopeType === 'SOUS_LOCALITE' && rencontre.scopeId === user.sousLocaliteId;
    }
    if (user?.role === 'LOCALITE') {
      return rencontre.scopeType === 'LOCALITE';
    }
    return false;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="card p-12 text-center">
          <div className="text-red-600 text-xl mb-4">❌ Erreur</div>
          <p className="text-gray-700 mb-4">{error}</p>
          <button onClick={() => { setError(null); setIsLoading(true); fetchRencontres(); }} className="btn btn-primary">
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Mes Rencontres</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {user?.role === 'SECTION_USER' && 'Rencontres de votre section'}
            {user?.role === 'SOUS_LOCALITE_ADMIN' && 'Rencontres de votre sous-localité et sections'}
            {user?.role === 'LOCALITE' && 'Toutes les rencontres'}
          </p>
        </div>
        <Button
          onClick={() => navigate('/rencontres/new')}
          className="inline-flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouvelle rencontre
        </Button>
      </motion.div>

      {/* Filtres */}
      <motion.div variants={itemVariants}>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Filtres</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label text-gray-700 dark:text-gray-300">Date début</label>
              <Input
                type="date"
                value={filters.dateDebut}
                onChange={(e) => setFilters({ ...filters, dateDebut: e.target.value })}
              />
            </div>
            <div>
              <label className="label text-gray-700 dark:text-gray-300">Date fin</label>
              <Input
                type="date"
                value={filters.dateFin}
                onChange={(e) => setFilters({ ...filters, dateFin: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => setFilters({ typeId: '', dateDebut: '', dateFin: '' })}
                variant="outline"
                className="w-full"
              >
                Réinitialiser
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Liste des rencontres */}
      {rencontres.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Aucune rencontre</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Commencez par créer votre première rencontre</p>
            <Button onClick={() => navigate('/rencontres/new')}>
              Créer une rencontre
            </Button>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-4">
          {rencontres.map((rencontre, index) => (
            <motion.div 
              key={rencontre.id}
              variants={itemVariants}
              custom={index}
            >
              <Card hover className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* En-tête */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{rencontre.type.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{rencontre.section.name}</p>
                    </div>
                    {!canModify(rencontre) && (
                      <Badge variant="secondary">Lecture seule</Badge>
                    )}
                  </div>

                  {/* Informations */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm">{formatDate(rencontre.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm">{rencontre.heureDebut} - {rencontre.heureFin}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm">
                        {rencontre.presenceTotale} présents ({rencontre.presenceHomme}H / {rencontre.presenceFemme}F)
                      </span>
                    </div>
                  </div>

                  {/* Détails */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Modérateur:</span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">{rencontre.moderateur}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Moniteur:</span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">{rencontre.moniteur}</span>
                    </div>
                  </div>

                  {rencontre.theme && (
                    <div className="mt-3 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Thème:</span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">{rencontre.theme}</span>
                    </div>
                  )}

                  {rencontre.observations && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Observations:</span>
                      <p className="text-gray-900 dark:text-gray-100 mt-1">{rencontre.observations}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleExportPDF(rencontre.id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    title="Exporter en PDF"
                  >
                    <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </motion.button>
                  {canModify(rencontre) && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(`/rencontres/${rencontre.id}/edit`)}
                        className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDelete(rencontre.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </motion.button>
                    </>
                  )}
                </div>
              </div>
            </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

