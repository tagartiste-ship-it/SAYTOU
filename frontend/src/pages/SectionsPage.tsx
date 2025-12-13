import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Trash2, Building2, Users, Calendar, X, MapPin, Mail, Lock, User } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { Section, SousLocalite } from '../lib/types';
import { useAuthStore } from '../store/authStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

export default function SectionsPage() {
  const { user } = useAuthStore();
  const [sections, setSections] = useState<Section[]>([]);
  const [sousLocalites, setSousLocalites] = useState<SousLocalite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    sousLocaliteId: '',
    userEmail: '',
    userPassword: '',
    userName: ''
  });
  const draftKey = `saytou:draft:sections:${user?.id ?? 'anon'}`;
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

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
        editingSectionId?: string | null;
        formData?: typeof formData;
      };

      if (parsed?.formData) setFormData(parsed.formData);
      if (parsed?.showModal) setShowModal(true);
      if (parsed?.editingSectionId) setEditingSection({ id: parsed.editingSectionId } as Section);
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
            editingSectionId: editingSection?.id ?? null,
            formData,
          })
        );
      } catch {
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [draftKey, formData, editingSection?.id, showModal, hasRestoredDraft]);

  useEffect(() => {
    if (!hasRestoredDraft) return;
    if (!editingSection?.id) return;
    const found = sections.find((s) => s.id === editingSection.id);
    if (found) setEditingSection(found);
  }, [sections, editingSection?.id, hasRestoredDraft]);

  const fetchData = async () => {
    try {
      const [sectionsRes, sousLocalitesRes] = await Promise.all([
        api.get<{ sections: Section[] }>('/sections'),
        api.get<{ sousLocalites: SousLocalite[] }>('/sous-localites'),
      ]);
      setSections(sectionsRes.data.sections || []);
      setSousLocalites(sousLocalitesRes.data.sousLocalites || []);
    } catch (error: any) {
      console.error('Erreur détaillée:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement');
      setSections([]);
      setSousLocalites([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSection) {
        await api.put(`/sections/${editingSection.id}`, formData);
        toast.success('Section modifiée');
      } else {
        await api.post('/sections', formData);
        toast.success('Section créée');
      }
      setShowModal(false);
      setEditingSection(null);
      setFormData({ name: '', sousLocaliteId: '', userEmail: '', userPassword: '', userName: '' });
      clearDraft();
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  const handleEdit = (section: Section) => {
    setEditingSection(section);
    setFormData({ 
      name: section.name, 
      sousLocaliteId: section.sousLocaliteId,
      userEmail: '',
      userPassword: '',
      userName: ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette section ?')) return;
    try {
      await api.delete(`/sections/${id}`);
      toast.success('Section supprimée');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const canManage = user?.role === 'LOCALITE' || user?.role === 'SOUS_LOCALITE_ADMIN';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
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
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Sections</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gérez les sections de base</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="default" className="text-base px-4 py-2">
            <Building2 className="w-4 h-4 mr-2" />
            {sections.length} sections
          </Badge>
          {canManage && (
            <Button onClick={() => { setShowModal(true); setEditingSection(null); setFormData({ name: '', sousLocaliteId: '', userEmail: '', userPassword: '', userName: '' }); }} className="inline-flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Nouvelle section
            </Button>
          )}
        </div>
      </motion.div>

      {sections.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Aucune section</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Commencez par créer votre première section</p>
            {canManage && (
              <Button onClick={() => { setShowModal(true); setEditingSection(null); setFormData({ name: '', sousLocaliteId: '', userEmail: '', userPassword: '', userName: '' }); }}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle section
              </Button>
            )}
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section, index) => (
            <motion.div key={section.id} variants={itemVariants} custom={index}>
              <Card hover className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-accent/20 dark:from-primary/30 dark:to-accent/30 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{section.name}</h3>
                      {section.sousLocalite?.name && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span>{section.sousLocalite.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleEdit(section)}
                        className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDelete(section.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </motion.button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                      <Calendar className="w-4 h-4" />
                      <p className="text-xs">Rencontres</p>
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{section._count?.rencontres || 0}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                      <Users className="w-4 h-4" />
                      <p className="text-xs">Utilisateurs</p>
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{section._count?.users || 0}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowModal(false);
              setEditingSection(null);
              setFormData({ name: '', sousLocaliteId: '', userEmail: '', userPassword: '', userName: '' });
              clearDraft();
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {editingSection ? 'Modifier' : 'Nouvelle'} section
                </h2>
                <motion.button
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setShowModal(false);
                    setEditingSection(null);
                    setFormData({ name: '', sousLocaliteId: '', userEmail: '', userPassword: '', userName: '' });
                    clearDraft();
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </motion.button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label text-gray-700 dark:text-gray-300">Nom de la section *</label>
                  <Input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Section A"
                  />
                </div>
                <div>
                  <label className="label text-gray-700 dark:text-gray-300">Sous-localité *</label>
                  <select
                    required
                    value={formData.sousLocaliteId}
                    onChange={(e) => setFormData({ ...formData, sousLocaliteId: e.target.value })}
                    className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                  >
                    <option value="">Sélectionner une sous-localité</option>
                    {sousLocalites.map((sl) => (
                      <option key={sl.id} value={sl.id}>{sl.name}</option>
                    ))}
                  </select>
                </div>

                {!editingSection && (
                  <>
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        Compte utilisateur de la section
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">
                            <User className="w-4 h-4 inline mr-1" />
                            Nom complet *
                          </label>
                          <Input
                            required={!editingSection}
                            type="text"
                            value={formData.userName}
                            onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                            placeholder="Ex: Jean Dupont"
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">
                            <Mail className="w-4 h-4 inline mr-1" />
                            Email *
                          </label>
                          <Input
                            required={!editingSection}
                            type="email"
                            value={formData.userEmail}
                            onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                            placeholder="user@example.com"
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">
                            <Lock className="w-4 h-4 inline mr-1" />
                            Mot de passe *
                          </label>
                          <Input
                            required={!editingSection}
                            type="password"
                            value={formData.userPassword}
                            onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })}
                            placeholder="Min. 8 caractères"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" onClick={() => {
                    setShowModal(false);
                    setEditingSection(null);
                    setFormData({ name: '', sousLocaliteId: '', userEmail: '', userPassword: '', userName: '' });
                    clearDraft();
                  }} variant="outline">
                    Annuler
                  </Button>
                  <Button type="submit">
                    {editingSection ? 'Modifier' : 'Créer'}
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
