import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Trash2, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { RencontreType, TrancheAge } from '../lib/types';
import { useAuthStore } from '../store/authStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

export default function TypesPage() {
  const { user } = useAuthStore();
  const [types, setTypes] = useState<RencontreType[]>([]);
  const [tranchesAge, setTranchesAge] = useState<TrancheAge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<RencontreType | null>(null);
  const [formData, setFormData] = useState<{ name: string; isReunion: boolean; trancheAgeId: string }>({
    name: '',
    isReunion: false,
    trancheAgeId: '',
  });
  const draftKey = `saytou:draft:types:${user?.id ?? 'anon'}`;
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  useEffect(() => {
    fetchTypes();
    fetchTranchesAge();
  }, []);

  const fetchTranchesAge = async () => {
    try {
      const response = await api.get<{ tranchesAge: TrancheAge[] }>('/tranches-age');
      setTranchesAge(response.data.tranchesAge || []);
    } catch {
      setTranchesAge([]);
    }
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
        showModal?: boolean;
        editingTypeId?: string | null;
        formData?: { name: string; isReunion: boolean; trancheAgeId: string };
      };

      if (parsed?.formData) setFormData(parsed.formData);
      if (parsed?.showModal) setShowModal(true);
      if (parsed?.editingTypeId) setEditingType({ id: parsed.editingTypeId } as RencontreType);
    } catch {
    } finally {
      setHasRestoredDraft(true);
    }
  }, [draftKey, hasRestoredDraft]);

  useEffect(() => {
    if (!hasRestoredDraft) return;
    if (!showModal) return;
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            showModal,
            editingTypeId: editingType?.id ?? null,
            formData,
          })
        );
      } catch {
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [draftKey, formData, editingType?.id, showModal, hasRestoredDraft]);

  useEffect(() => {
    if (!hasRestoredDraft) return;
    if (!editingType?.id) return;
    const found = types.find((t) => t.id === editingType.id);
    if (found) setEditingType(found);
  }, [types, editingType?.id, hasRestoredDraft]);

  const fetchTypes = async () => {
    try {
      const response = await api.get<{ types: RencontreType[] }>('/types');
      setTypes(response.data.types || []);
      setError(null);
    } catch (error: any) {
      console.error('Erreur détaillée:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Erreur lors du chargement';
      setError(errorMsg);
      toast.error(errorMsg);
      setTypes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingType) {
        await api.put(`/types/${editingType.id}`, formData);
        toast.success('Type modifié');
      } else {
        await api.post('/types', formData);
        toast.success('Type créé');
      }
      setShowModal(false);
      setEditingType(null);
      setFormData({ name: '', isReunion: false, trancheAgeId: '' });
      clearDraft();
      fetchTypes();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  const handleEdit = (type: RencontreType) => {
    setEditingType(type);
    setFormData({ name: type.name, isReunion: type.isReunion, trancheAgeId: type.trancheAgeId ?? '' });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce type ?')) return;
    try {
      await api.delete(`/types/${id}`);
      toast.success('Type supprimé');
      fetchTypes();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const canManage = user?.role === 'LOCALITE' || user?.role === 'SOUS_LOCALITE_ADMIN' || user?.role === 'SECTION_USER';

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32" />)}
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
          <button onClick={() => { setError(null); setIsLoading(true); fetchTypes(); }} className="btn btn-primary">
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
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Types de rencontre</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gérez les types de rencontres</p>
        </div>
        {canManage && (
          <Button onClick={() => { setShowModal(true); setEditingType(null); setFormData({ name: '', isReunion: false, trancheAgeId: '' }); }} className="inline-flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nouveau type
          </Button>
        )}
      </motion.div>

      <motion.div 
        variants={containerVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {types.map((type, index) => (
          <motion.div 
            key={type.id}
            variants={itemVariants}
            custom={index}
          >
            <Card hover className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    type.isReunion 
                      ? 'bg-gradient-to-br from-accent/20 to-accent/10 dark:from-accent/30 dark:to-accent/20' 
                      : 'bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20'
                  }`}>
                    <Tag className={`w-6 h-6 ${type.isReunion ? 'text-accent-600 dark:text-accent-400' : 'text-primary-600 dark:text-primary-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{type.name}</h3>
                    <Badge variant={type.isReunion ? 'accent' : 'default'} className="mt-1">
                      {type.isReunion ? 'Réunion' : 'Rencontre'}
                    </Badge>
                    {type.trancheAge?.name && (
                      <Badge variant="secondary" className="mt-1 ml-2">
                        {type.trancheAge.name}
                      </Badge>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleEdit(type)} 
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    >
                      <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDelete(type.id)} 
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </motion.button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowModal(false);
              setEditingType(null);
              setFormData({ name: '', isReunion: false, trancheAgeId: '' });
              clearDraft();
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {editingType ? 'Modifier' : 'Nouveau'} type
                </h2>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setShowModal(false);
                    setEditingType(null);
                    setFormData({ name: '', isReunion: false, trancheAgeId: '' });
                    clearDraft();
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </motion.button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label text-gray-700 dark:text-gray-300">Nom *</label>
                  <Input 
                    required 
                    type="text" 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                    placeholder="Ex: GOUDI ALDIOUMA" 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="isReunion" 
                    checked={formData.isReunion} 
                    onChange={(e) => setFormData({ ...formData, isReunion: e.target.checked })} 
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-800" 
                  />
                  <label htmlFor="isReunion" className="text-sm text-gray-700 dark:text-gray-300">C'est une réunion</label>
                </div>
                <div>
                  <label className="label text-gray-700 dark:text-gray-300">Tranche d'âge</label>
                  <select
                    value={formData.trancheAgeId}
                    onChange={(e) => setFormData({ ...formData, trancheAgeId: e.target.value })}
                    className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                  >
                    <option value="">Tout âge</option>
                    {tranchesAge.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" onClick={() => {
                    setShowModal(false);
                    setEditingType(null);
                    setFormData({ name: '', isReunion: false, trancheAgeId: '' });
                    clearDraft();
                  }} variant="outline">
                    Annuler
                  </Button>
                  <Button type="submit">
                    Enregistrer
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
