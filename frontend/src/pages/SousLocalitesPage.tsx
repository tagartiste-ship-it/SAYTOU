import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building, Plus, Trash2, Edit2, Save, X, Mail, Lock, User } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

interface SousLocalite {
  id: string;
  name: string;
  localiteId: string;
  createdAt: string;
  _count?: {
    sections: number;
    users: number;
  };
}

export default function SousLocalitesPage() {
  const [sousLocalites, setSousLocalites] = useState<SousLocalite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    adminEmail: '',
    adminPassword: '',
    adminName: ''
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  useEffect(() => {
    fetchSousLocalites();
  }, []);

  const fetchSousLocalites = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/sous-localites');
      setSousLocalites(response.data.sousLocalites || []);
    } catch (error: any) {
      console.error('Erreur chargement sous-localités:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setIsAdding(true);
    setFormData({
      name: '',
      adminEmail: '',
      adminPassword: '',
      adminName: ''
    });
  };

  const handleEdit = (sousLocalite: SousLocalite) => {
    setEditingId(sousLocalite.id);
    setFormData({
      name: sousLocalite.name,
      adminEmail: '',
      adminPassword: '',
      adminName: ''
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      adminEmail: '',
      adminPassword: '',
      adminName: ''
    });
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Le nom est requis');
      return;
    }

    try {
      if (editingId) {
        // Modification
        await api.put(`/sous-localites/${editingId}`, {
          name: formData.name
        });
        toast.success('Sous-localité modifiée avec succès');
      } else {
        // Création avec admin
        if (!formData.adminEmail || !formData.adminPassword || !formData.adminName) {
          toast.error('Tous les champs admin sont requis pour la création');
          return;
        }

        await api.post('/sous-localites', {
          name: formData.name,
          adminEmail: formData.adminEmail,
          adminPassword: formData.adminPassword,
          adminName: formData.adminName
        });
        toast.success('Sous-localité et admin créés avec succès');
      }

      handleCancel();
      fetchSousLocalites();
    } catch (error: any) {
      console.error('Erreur sauvegarde:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette sous-localité ? Toutes les sections et données associées seront supprimées.')) {
      return;
    }

    try {
      await api.delete(`/sous-localites/${id}`);
      toast.success('Sous-localité supprimée');
      fetchSousLocalites();
    } catch (error: any) {
      console.error('Erreur suppression:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-11 w-48" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Building className="w-8 h-8 text-primary" />
            Sous-Localités
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gérez les sous-localités et leurs administrateurs
          </p>
        </div>
        {!isAdding && (
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une sous-localité
          </Button>
        )}
      </motion.div>

      {/* Statistiques */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Building className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Sous-Localités</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {sousLocalites.length}
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Liste vide */}
      {sousLocalites.length === 0 && !isAdding ? (
        <motion.div variants={itemVariants}>
          <Card className="p-12 text-center">
            <Building className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Aucune sous-localité
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Commencez par créer votre première sous-localité
            </p>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une sous-localité
            </Button>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-4">
          {/* Formulaire d'ajout */}
          <AnimatePresence>
            {isAdding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-6 border-2 border-primary">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Nouvelle sous-localité
                    </h3>
                    <Badge variant="default">En cours</Badge>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nom de la sous-localité *
                      </label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: Dakar Centre"
                        required
                      />
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        Compte administrateur
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <User className="w-4 h-4 inline mr-1" />
                            Nom complet *
                          </label>
                          <Input
                            value={formData.adminName}
                            onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                            placeholder="Ex: Jean Dupont"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <Mail className="w-4 h-4 inline mr-1" />
                            Email *
                          </label>
                          <Input
                            type="email"
                            value={formData.adminEmail}
                            onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                            placeholder="admin@example.com"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <Lock className="w-4 h-4 inline mr-1" />
                            Mot de passe *
                          </label>
                          <Input
                            type="password"
                            value={formData.adminPassword}
                            onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                            placeholder="Min. 8 caractères"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end mt-6">
                    <Button onClick={handleCancel} variant="outline">
                      <X className="w-4 h-4 mr-2" />
                      Annuler
                    </Button>
                    <Button onClick={handleSave}>
                      <Save className="w-4 h-4 mr-2" />
                      Créer
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Liste des sous-localités */}
          {sousLocalites.map((sousLocalite, index) => (
            <motion.div
              key={sousLocalite.id}
              variants={itemVariants}
              custom={index}
            >
              {editingId === sousLocalite.id ? (
                <Card className="p-6 border-2 border-accent">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Modifier la sous-localité
                    </h3>
                    <Badge variant="accent">Édition</Badge>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nom *
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex gap-2 justify-end mt-6">
                    <Button onClick={handleCancel} variant="outline">
                      <X className="w-4 h-4 mr-2" />
                      Annuler
                    </Button>
                    <Button onClick={handleSave}>
                      <Save className="w-4 h-4 mr-2" />
                      Enregistrer
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card hover className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Building className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {sousLocalite.name}
                        </h3>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                        {sousLocalite._count && (
                          <>
                            <span>{sousLocalite._count.sections} section(s)</span>
                            <span>{sousLocalite._count.users} utilisateur(s)</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleEdit(sousLocalite)}
                        className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDelete(sousLocalite.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </motion.button>
                    </div>
                  </div>
                </Card>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
