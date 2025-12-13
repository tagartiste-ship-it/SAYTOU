import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, Edit2, Save, X, UserCircle, Phone, CreditCard, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { Membre } from '../lib/types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

export default function MembresPage() {
  const [membres, setMembres] = useState<Membre[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const draftKey = 'saytou:draft:membres';
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  
  const [formData, setFormData] = useState({
    photo: '',
    prenom: '',
    nom: '',
    genre: '',
    fonction: '',
    corpsMetier: '',
    groupeSanguin: '',
    telephone: '',
    numeroCNI: ''
  });

  useEffect(() => {
    fetchMembres();
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
        isAdding?: boolean;
        editingId?: string | null;
        formData?: typeof formData;
      };

      if (parsed?.formData) setFormData(parsed.formData);
      if (parsed?.isAdding) setIsAdding(true);
      if (parsed?.editingId) setEditingId(parsed.editingId);
    } catch {
    } finally {
      setHasRestoredDraft(true);
    }
  }, [draftKey, hasRestoredDraft]);

  useEffect(() => {
    if (!hasRestoredDraft) return;
    if (!isAdding && !editingId) return;

    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            isAdding,
            editingId,
            formData,
          })
        );
      } catch {
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [draftKey, formData, isAdding, editingId, hasRestoredDraft]);

  const fetchMembres = async () => {
    try {
      setIsLoading(true);
      // Pour SECTION_USER, pas besoin de paramètres (utilise automatiquement sa section)
      // Pour les autres rôles, on peut filtrer par section si nécessaire
      const response = await api.get('/membres');
      setMembres(response.data.membres || []);
    } catch (error: any) {
      console.error('Erreur chargement membres:', error);
      // Initialiser avec un tableau vide en cas d'erreur
      setMembres([]);
      // Afficher un message d'erreur plus détaillé
      const errorMsg = error.response?.data?.error || error.message || 'Erreur lors du chargement des membres';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setIsAdding(true);
    setFormData({
      photo: '',
      prenom: '',
      nom: '',
      genre: '',
      fonction: '',
      corpsMetier: '',
      groupeSanguin: '',
      telephone: '',
      numeroCNI: ''
    });
  };

  const handleEdit = (membre: Membre) => {
    setEditingId(membre.id);
    setFormData({
      photo: membre.photo || '',
      prenom: membre.prenom,
      nom: membre.nom,
      genre: membre.genre || '',
      fonction: membre.fonction || '',
      corpsMetier: membre.corpsMetier || '',
      groupeSanguin: membre.groupeSanguin || '',
      telephone: membre.telephone || '',
      numeroCNI: membre.numeroCNI || ''
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    clearDraft();
    setFormData({
      photo: '',
      prenom: '',
      nom: '',
      genre: '',
      fonction: '',
      corpsMetier: '',
      groupeSanguin: '',
      telephone: '',
      numeroCNI: ''
    });
  };

  const handleSave = async () => {
    if (!formData.prenom || !formData.nom) {
      toast.error('Le prénom et le nom sont requis');
      return;
    }

    try {
      if (isAdding) {
        await api.post('/membres', formData);
        toast.success('Membre ajouté avec succès');
      } else if (editingId) {
        await api.put(`/membres/${editingId}`, formData);
        toast.success('Membre modifié avec succès');
      }
      
      handleCancel();
      clearDraft();
      fetchMembres();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce membre ?')) {
      return;
    }

    try {
      await api.delete(`/membres/${id}`);
      toast.success('Membre supprimé avec succès');
      fetchMembres();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

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

  const membresHommes = membres.filter((membre) => membre.genre === 'HOMME');
  const membresFemmes = membres.filter((membre) => membre.genre === 'FEMME');
  const membresSansGenre = membres.filter((membre) => !membre.genre);
  const totalMembres = membres.length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
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
      {/* En-tête */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Membres de la section</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gérez la liste des membres de votre section</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <Badge variant="default" className="text-base px-4 py-2">
            <Users className="w-4 h-4 mr-2" />
            {totalMembres} membres
          </Badge>
          <Badge variant="secondary" className="px-3 py-1 text-sm">
            👨 {membresHommes.length} Hommes
          </Badge>
          <Badge variant="accent" className="px-3 py-1 text-sm">
            👩 {membresFemmes.length} Femmes
          </Badge>
          <Button
            onClick={handleAdd}
            className="inline-flex items-center gap-2"
            disabled={isAdding}
          >
            <Plus className="w-5 h-5" />
            Ajouter un membre
          </Button>
        </div>
      </motion.div>

      {/* Liste des membres */}
      {membres.length === 0 && !isAdding ? (
        <motion.div variants={itemVariants}>
          <Card className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Aucun membre</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Commencez par ajouter votre premier membre</p>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un membre
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
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nouveau membre</h3>
                    <Badge variant="default">En cours</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="label text-gray-700 dark:text-gray-300">Prénom *</label>
                      <Input
                        value={formData.prenom}
                        onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                        placeholder="Prénom"
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-gray-700 dark:text-gray-300">Nom *</label>
                      <Input
                        value={formData.nom}
                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                        placeholder="Nom"
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-gray-700 dark:text-gray-300">Genre</label>
                      <select
                        value={formData.genre}
                        onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                        className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                      >
                        <option value="">-</option>
                        <option value="HOMME">Homme</option>
                        <option value="FEMME">Femme</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-gray-700 dark:text-gray-300">Fonction</label>
                      <Input
                        value={formData.fonction}
                        onChange={(e) => setFormData({ ...formData, fonction: e.target.value })}
                        placeholder="Ex: Président"
                      />
                    </div>
                    <div>
                      <label className="label text-gray-700 dark:text-gray-300">Corps de métier</label>
                      <Input
                        value={formData.corpsMetier}
                        onChange={(e) => setFormData({ ...formData, corpsMetier: e.target.value })}
                        placeholder="Ex: Enseignant"
                      />
                    </div>
                    <div>
                      <label className="label text-gray-700 dark:text-gray-300">Groupe sanguin</label>
                      <select
                        value={formData.groupeSanguin}
                        onChange={(e) => setFormData({ ...formData, groupeSanguin: e.target.value })}
                        className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                      >
                        <option value="">-</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-gray-700 dark:text-gray-300">Téléphone</label>
                      <Input
                        type="tel"
                        value={formData.telephone}
                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                        placeholder="+221..."
                      />
                    </div>
                    <div>
                      <label className="label text-gray-700 dark:text-gray-300">N° CNI</label>
                      <Input
                        value={formData.numeroCNI}
                        onChange={(e) => setFormData({ ...formData, numeroCNI: e.target.value })}
                        placeholder="N° CNI"
                      />
                    </div>
                    <div>
                      <label className="label text-gray-700 dark:text-gray-300">Photo (URL)</label>
                      <Input
                        value={formData.photo}
                        onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cartes des membres - disposition en deux colonnes Hommes / Femmes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Colonne Hommes */}
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Hommes ({membresHommes.length})</h2>
              {membresHommes.length === 0 && (
                <Card className="p-6 text-center text-gray-500 dark:text-gray-400">
                  Aucun homme enregistré
                </Card>
              )}
              {membresHommes.map((membre, index) => (
                <motion.div
                  key={membre.id}
                  variants={itemVariants}
                  custom={index}
                >
                  {editingId === membre.id ? (
                    <Card className="p-6 border-2 border-accent">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Modifier le membre</h3>
                        <Badge variant="accent">Édition</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Prénom *</label>
                          <Input
                            value={formData.prenom}
                            onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Nom *</label>
                          <Input
                            value={formData.nom}
                            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Genre</label>
                          <select
                            value={formData.genre}
                            onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                            className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                          >
                            <option value="">-</option>
                            <option value="HOMME">Homme</option>
                            <option value="FEMME">Femme</option>
                          </select>
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Fonction</label>
                          <Input
                            value={formData.fonction}
                            onChange={(e) => setFormData({ ...formData, fonction: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Corps de métier</label>
                          <Input
                            value={formData.corpsMetier}
                            onChange={(e) => setFormData({ ...formData, corpsMetier: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Groupe sanguin</label>
                          <select
                            value={formData.groupeSanguin}
                            onChange={(e) => setFormData({ ...formData, groupeSanguin: e.target.value })}
                            className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                          >
                            <option value="">-</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                          </select>
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Téléphone</label>
                          <Input
                            type="tel"
                            value={formData.telephone}
                            onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">N° CNI</label>
                          <Input
                            value={formData.numeroCNI}
                            onChange={(e) => setFormData({ ...formData, numeroCNI: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Photo (URL)</label>
                          <Input
                            value={formData.photo}
                            onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                          />
                        </div>
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
                      <div className="flex items-start gap-4">
                        {/* Photo */}
                        <div className="flex-shrink-0">
                          {membre.photo ? (
                            <img 
                              src={membre.photo} 
                              alt={`${membre.prenom} ${membre.nom}`} 
                              className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" 
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 dark:from-primary/30 dark:to-accent/30 flex items-center justify-center border-2 border-primary/20">
                              <span className="text-xl font-bold text-primary dark:text-primary-400">
                                {membre.prenom.charAt(0)}{membre.nom.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Informations */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {membre.prenom} {membre.nom}
                              </h3>
                              <div className="flex gap-2 mt-1">
                                {membre.fonction && (
                                  <Badge variant="default">
                                    <Briefcase className="w-3 h-3 mr-1" />
                                    {membre.fonction}
                                  </Badge>
                                )}
                                {membre.genre && (
                                  <Badge variant={membre.genre === 'HOMME' ? 'secondary' : 'accent'}>
                                    {membre.genre === 'HOMME' ? '👨 Homme' : '👩 Femme'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleEdit(membre)}
                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title="Modifier"
                              >
                                <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDelete(membre.id)}
                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </motion.button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                            {membre.corpsMetier && (
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <UserCircle className="w-4 h-4" />
                                <span>{membre.corpsMetier}</span>
                              </div>
                            )}
                            {membre.telephone && (
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <Phone className="w-4 h-4" />
                                <span>{membre.telephone}</span>
                              </div>
                            )}
                            {membre.groupeSanguin && (
                              <Badge variant="danger">{membre.groupeSanguin}</Badge>
                            )}
                            {membre.numeroCNI && (
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <CreditCard className="w-4 h-4" />
                                <span>{membre.numeroCNI}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Colonne Femmes */}
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Femmes ({membresFemmes.length})</h2>
              {membresFemmes.length === 0 && (
                <Card className="p-6 text-center text-gray-500 dark:text-gray-400">
                  Aucune femme enregistrée
                </Card>
              )}
              {membresFemmes.map((membre, index) => (
                <motion.div
                  key={membre.id}
                  variants={itemVariants}
                  custom={index}
                >
                  {editingId === membre.id ? (
                    <Card className="p-6 border-2 border-accent">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Modifier le membre</h3>
                        <Badge variant="accent">Édition</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Prénom *</label>
                          <Input
                            value={formData.prenom}
                            onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Nom *</label>
                          <Input
                            value={formData.nom}
                            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Genre</label>
                          <select
                            value={formData.genre}
                            onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                            className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                          >
                            <option value="">-</option>
                            <option value="HOMME">Homme</option>
                            <option value="FEMME">Femme</option>
                          </select>
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Fonction</label>
                          <Input
                            value={formData.fonction}
                            onChange={(e) => setFormData({ ...formData, fonction: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Corps de métier</label>
                          <Input
                            value={formData.corpsMetier}
                            onChange={(e) => setFormData({ ...formData, corpsMetier: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Groupe sanguin</label>
                          <select
                            value={formData.groupeSanguin}
                            onChange={(e) => setFormData({ ...formData, groupeSanguin: e.target.value })}
                            className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                          >
                            <option value="">-</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                          </select>
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Téléphone</label>
                          <Input
                            type="tel"
                            value={formData.telephone}
                            onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">N° CNI</label>
                          <Input
                            value={formData.numeroCNI}
                            onChange={(e) => setFormData({ ...formData, numeroCNI: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Photo (URL)</label>
                          <Input
                            value={formData.photo}
                            onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                          />
                        </div>
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
                      <div className="flex items-start gap-4">
                        {/* Photo */}
                        <div className="flex-shrink-0">
                          {membre.photo ? (
                            <img 
                              src={membre.photo} 
                              alt={`${membre.prenom} ${membre.nom}`} 
                              className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" 
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 dark:from-primary/30 dark:to-accent/30 flex items-center justify-center border-2 border-primary/20">
                              <span className="text-xl font-bold text-primary dark:text-primary-400">
                                {membre.prenom.charAt(0)}{membre.nom.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Informations */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {membre.prenom} {membre.nom}
                              </h3>
                              <div className="flex gap-2 mt-1">
                                {membre.fonction && (
                                  <Badge variant="default">
                                    <Briefcase className="w-3 h-3 mr-1" />
                                    {membre.fonction}
                                  </Badge>
                                )}
                                {membre.genre && (
                                  <Badge variant={membre.genre === 'HOMME' ? 'secondary' : 'accent'}>
                                    {membre.genre === 'HOMME' ? '👨 Homme' : '👩 Femme'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleEdit(membre)}
                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title="Modifier"
                              >
                                <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDelete(membre.id)}
                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </motion.button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                            {membre.corpsMetier && (
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <UserCircle className="w-4 h-4" />
                                <span>{membre.corpsMetier}</span>
                              </div>
                            )}
                            {membre.telephone && (
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <Phone className="w-4 h-4" />
                                <span>{membre.telephone}</span>
                              </div>
                            )}
                            {membre.groupeSanguin && (
                              <Badge variant="danger">{membre.groupeSanguin}</Badge>
                            )}
                            {membre.numeroCNI && (
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <CreditCard className="w-4 h-4" />
                                <span>{membre.numeroCNI}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Cartes des membres - SANS GENRE */}
          {membresSansGenre.length > 0 && (
            <div className="space-y-3 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">À classer ({membresSansGenre.length})</h2>
              {membresSansGenre.map((membre, index) => (
                <motion.div
                  key={membre.id}
                  variants={itemVariants}
                  custom={index}
                >
                  {editingId === membre.id ? (
                    <Card className="p-6 border-2 border-accent">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Modifier le membre</h3>
                        <Badge variant="accent">Édition</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Prénom *</label>
                          <Input
                            value={formData.prenom}
                            onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Nom *</label>
                          <Input
                            value={formData.nom}
                            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Genre</label>
                          <select
                            value={formData.genre}
                            onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                            className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                          >
                            <option value="">-</option>
                            <option value="HOMME">Homme</option>
                            <option value="FEMME">Femme</option>
                          </select>
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Fonction</label>
                          <Input
                            value={formData.fonction}
                            onChange={(e) => setFormData({ ...formData, fonction: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Corps de métier</label>
                          <Input
                            value={formData.corpsMetier}
                            onChange={(e) => setFormData({ ...formData, corpsMetier: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Groupe sanguin</label>
                          <select
                            value={formData.groupeSanguin}
                            onChange={(e) => setFormData({ ...formData, groupeSanguin: e.target.value })}
                            className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                          >
                            <option value="">-</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                          </select>
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Téléphone</label>
                          <Input
                            type="tel"
                            value={formData.telephone}
                            onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">N° CNI</label>
                          <Input
                            value={formData.numeroCNI}
                            onChange={(e) => setFormData({ ...formData, numeroCNI: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label text-gray-700 dark:text-gray-300">Photo (URL)</label>
                          <Input
                            value={formData.photo}
                            onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                          />
                        </div>
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
                      <div className="flex items-start gap-4">
                        {/* Photo */}
                        <div className="flex-shrink-0">
                          {membre.photo ? (
                            <img 
                              src={membre.photo} 
                              alt={`${membre.prenom} ${membre.nom}`} 
                              className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" 
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 dark:from-primary/30 dark:to-accent/30 flex items-center justify-center border-2 border-primary/20">
                              <span className="text-xl font-bold text-primary dark:text-primary-400">
                                {membre.prenom.charAt(0)}{membre.nom.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Informations */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {membre.prenom} {membre.nom}
                              </h3>
                              <div className="flex gap-2 mt-1">
                                {membre.fonction && (
                                  <Badge variant="default">
                                    <Briefcase className="w-3 h-3 mr-1" />
                                    {membre.fonction}
                                  </Badge>
                                )}
                                {membre.genre && (
                                  <Badge variant={membre.genre === 'HOMME' ? 'secondary' : 'accent'}>
                                    {membre.genre === 'HOMME' ? '👨 Homme' : '👩 Femme'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleEdit(membre)}
                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title="Modifier"
                              >
                                <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDelete(membre.id)}
                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </motion.button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                            {membre.corpsMetier && (
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <UserCircle className="w-4 h-4" />
                                <span>{membre.corpsMetier}</span>
                              </div>
                            )}
                            {membre.telephone && (
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <Phone className="w-4 h-4" />
                                <span>{membre.telephone}</span>
                              </div>
                            )}
                            {membre.groupeSanguin && (
                              <Badge variant="danger">{membre.groupeSanguin}</Badge>
                            )}
                            {membre.numeroCNI && (
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <CreditCard className="w-4 h-4" />
                                <span>{membre.numeroCNI}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
