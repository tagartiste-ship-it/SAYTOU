import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

interface Conclave {
  id: string;
  name: string;
  zones?: Zone[];
}

interface Zone {
  id: string;
  name: string;
  conclaveId: string | null;
  comites?: Comite[];
}

interface Comite {
  id: string;
  name: string;
  zoneId: string | null;
}

interface LocaliteRow {
  id: string;
  name: string;
  comiteId?: string | null;
  comite?: {
    id: string;
    name: string;
    zone?: {
      id: string;
      name: string;
      conclave?: {
        id: string;
        name: string;
      };
    };
  } | null;
}

export default function InstitutionsPage() {
  const { user } = useAuthStore();

  const canView = user?.role === 'OWNER';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [conclaves, setConclaves] = useState<Conclave[]>([]);
  const [localites, setLocalites] = useState<LocaliteRow[]>([]);

  const [newConclaveName, setNewConclaveName] = useState('');
  const [editingConclaveId, setEditingConclaveId] = useState<string | null>(null);
  const [editingConclaveName, setEditingConclaveName] = useState('');

  const [selectedConclaveId, setSelectedConclaveId] = useState<string>('');
  const [newZoneName, setNewZoneName] = useState('');
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingZoneName, setEditingZoneName] = useState('');

  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [newComiteName, setNewComiteName] = useState('');
  const [editingComiteId, setEditingComiteId] = useState<string | null>(null);
  const [editingComiteName, setEditingComiteName] = useState('');

  const [selectedLocaliteId, setSelectedLocaliteId] = useState<string>('');
  const [selectedComiteId, setSelectedComiteId] = useState<string>('');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { y: 12, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  const fetchAll = async () => {
    if (!canView) {
      setConclaves([]);
      setLocalites([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [conclavesRes, localitesRes] = await Promise.all([
        api.get<{ conclaves: Conclave[] }>('/institutions/conclaves'),
        api.get<{ localites: LocaliteRow[] }>('/institutions/localites'),
      ]);

      setConclaves(conclavesRes.data.conclaves || []);
      setLocalites(localitesRes.data.localites || []);
    } catch (error: any) {
      console.error('Erreur chargement institutions:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement');
      setConclaves([]);
      setLocalites([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zonesForSelectedConclave = useMemo(() => {
    const conclave = conclaves.find((c) => c.id === selectedConclaveId);
    return conclave?.zones || [];
  }, [conclaves, selectedConclaveId]);

  const comitesForSelectedZone = useMemo(() => {
    const zone = zonesForSelectedConclave.find((z) => z.id === selectedZoneId);
    return zone?.comites || [];
  }, [zonesForSelectedConclave, selectedZoneId]);

  useEffect(() => {
    if (!selectedConclaveId) {
      setSelectedZoneId('');
      setSelectedComiteId('');
      return;
    }

    const conclave = conclaves.find((c) => c.id === selectedConclaveId);
    const zones = conclave?.zones || [];

    if (selectedZoneId && !zones.some((z) => z.id === selectedZoneId)) {
      setSelectedZoneId('');
      setSelectedComiteId('');
    }
  }, [conclaves, selectedConclaveId, selectedZoneId]);

  useEffect(() => {
    if (!selectedZoneId) {
      setSelectedComiteId('');
      return;
    }

    const zone = zonesForSelectedConclave.find((z) => z.id === selectedZoneId);
    const comites = zone?.comites || [];

    if (selectedComiteId && !comites.some((c) => c.id === selectedComiteId)) {
      setSelectedComiteId('');
    }
  }, [selectedZoneId, selectedComiteId, zonesForSelectedConclave]);

  const allComites = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    for (const c of conclaves) {
      for (const z of c.zones || []) {
        for (const comite of z.comites || []) {
          out.push({ id: comite.id, label: `${c.name} / ${z.name} / ${comite.name}` });
        }
      }
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [conclaves]);

  const createConclave = async () => {
    const name = newConclaveName.trim();
    if (!name) {
      toast.error('Le nom est requis');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/institutions/conclaves', { name });
      setNewConclaveName('');
      toast.success('Conclave créé');
      await fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditConclave = (c: Conclave) => {
    setEditingConclaveId(c.id);
    setEditingConclaveName(c.name);
  };

  const saveConclave = async () => {
    if (!editingConclaveId) return;
    const name = editingConclaveName.trim();
    if (!name) {
      toast.error('Le nom est requis');
      return;
    }

    setIsSaving(true);
    try {
      await api.put(`/institutions/conclaves/${editingConclaveId}`, { name });
      toast.success('Conclave modifié');
      setEditingConclaveId(null);
      setEditingConclaveName('');
      await fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la modification');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteConclave = async (c: Conclave) => {
    if (!confirm(`Supprimer le conclave "${c.name}" ?`)) return;

    setIsSaving(true);
    try {
      await api.delete(`/institutions/conclaves/${c.id}`);
      toast.success('Conclave supprimé');
      if (selectedConclaveId === c.id) setSelectedConclaveId('');
      await fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setIsSaving(false);
    }
  };

  const createZone = async () => {
    const name = newZoneName.trim();
    if (!selectedConclaveId) {
      toast.error('Choisis un conclave');
      return;
    }
    if (!name) {
      toast.error('Le nom est requis');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/institutions/zones', { name, conclaveId: selectedConclaveId });
      setNewZoneName('');
      toast.success('Zone créée');
      await fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditZone = (z: Zone) => {
    setEditingZoneId(z.id);
    setEditingZoneName(z.name);
  };

  const saveZone = async () => {
    if (!editingZoneId) return;
    const name = editingZoneName.trim();
    if (!selectedConclaveId) {
      toast.error('Choisis un conclave');
      return;
    }
    if (!name) {
      toast.error('Le nom est requis');
      return;
    }

    setIsSaving(true);
    try {
      await api.put(`/institutions/zones/${editingZoneId}`, { name, conclaveId: selectedConclaveId });
      toast.success('Zone modifiée');
      setEditingZoneId(null);
      setEditingZoneName('');
      await fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la modification');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteZone = async (z: Zone) => {
    if (!confirm(`Supprimer la zone "${z.name}" ?`)) return;

    setIsSaving(true);
    try {
      await api.delete(`/institutions/zones/${z.id}`);
      toast.success('Zone supprimée');
      if (selectedZoneId === z.id) setSelectedZoneId('');
      await fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setIsSaving(false);
    }
  };

  const createComite = async () => {
    const name = newComiteName.trim();
    if (!selectedZoneId) {
      toast.error('Choisis une zone');
      return;
    }
    if (!name) {
      toast.error('Le nom est requis');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/institutions/comites', { name, zoneId: selectedZoneId });
      setNewComiteName('');
      toast.success('Comité créé');
      await fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditComite = (c: Comite) => {
    setEditingComiteId(c.id);
    setEditingComiteName(c.name);
  };

  const saveComite = async () => {
    if (!editingComiteId) return;
    const name = editingComiteName.trim();
    if (!selectedZoneId) {
      toast.error('Choisis une zone');
      return;
    }
    if (!name) {
      toast.error('Le nom est requis');
      return;
    }

    setIsSaving(true);
    try {
      await api.put(`/institutions/comites/${editingComiteId}`, { name, zoneId: selectedZoneId });
      toast.success('Comité modifié');
      setEditingComiteId(null);
      setEditingComiteName('');
      await fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la modification');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteComite = async (c: Comite) => {
    if (!confirm(`Supprimer le comité "${c.name}" ?`)) return;

    setIsSaving(true);
    try {
      await api.delete(`/institutions/comites/${c.id}`);
      toast.success('Comité supprimé');
      if (selectedComiteId === c.id) setSelectedComiteId('');
      await fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setIsSaving(false);
    }
  };

  const attachLocalite = async (comiteId: string | null) => {
    if (!selectedLocaliteId) {
      toast.error('Choisis une localité');
      return;
    }

    setIsSaving(true);
    try {
      await api.put(`/institutions/localites/${selectedLocaliteId}/comite`, { comiteId });
      toast.success(comiteId ? 'Localité rattachée' : 'Localité détachée');
      await fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors du rattachement');
    } finally {
      setIsSaving(false);
    }
  };

  if (!canView) {
    return (
      <Card className="p-12 text-center">
        <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Accès non autorisé</h3>
        <p className="text-gray-600 dark:text-gray-400">Seul le rôle OWNER peut accéder à cette page.</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Institutions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestion Conclave / Zone / Comité et rattachement des Localités</p>
        </div>
        <Badge variant="default" className="text-base px-4 py-2">
          OWNER
        </Badge>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Conclaves</h2>
            <Badge variant="secondary">{conclaves.length}</Badge>
          </div>

          <div className="flex gap-2 mb-4">
            <Input value={newConclaveName} onChange={(e) => setNewConclaveName(e.target.value)} placeholder="Nom du conclave" />
            <Button onClick={createConclave} disabled={isSaving}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {conclaves.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">Aucun conclave.</div>
            ) : (
              conclaves.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  {editingConclaveId === c.id ? (
                    <Input value={editingConclaveName} onChange={(e) => setEditingConclaveName(e.target.value)} />
                  ) : (
                    <button
                      onClick={() => setSelectedConclaveId(c.id)}
                      className={`flex-1 text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                        selectedConclaveId === c.id
                          ? 'border-primary bg-primary/5 text-gray-900 dark:text-gray-100'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
                      }`}
                      type="button"
                    >
                      {c.name}
                    </button>
                  )}

                  {editingConclaveId === c.id ? (
                    <Button variant="secondary" onClick={saveConclave} disabled={isSaving}>
                      <Save className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => startEditConclave(c)} disabled={isSaving}>
                      <Save className="w-4 h-4" />
                    </Button>
                  )}

                  <Button variant="danger" onClick={() => deleteConclave(c)} disabled={isSaving}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Zones</h2>
            <Badge variant="secondary">{zonesForSelectedConclave.length}</Badge>
          </div>

          <select
            value={selectedConclaveId}
            onChange={(e) => {
              setSelectedConclaveId(e.target.value);
              setSelectedZoneId('');
              setEditingZoneId(null);
              setEditingZoneName('');
            }}
            className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100 mb-4"
          >
            <option value="">Choisir un conclave</option>
            {conclaves.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2 mb-4">
            <Input
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              placeholder={selectedConclaveId ? 'Nom de la zone' : 'Choisir un conclave'}
              disabled={!selectedConclaveId}
            />
            <Button onClick={createZone} disabled={isSaving || !selectedConclaveId}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {selectedConclaveId && zonesForSelectedConclave.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">Aucune zone.</div>
            ) : null}

            {zonesForSelectedConclave.map((z) => (
              <div key={z.id} className="flex items-center gap-2">
                {editingZoneId === z.id ? (
                  <Input value={editingZoneName} onChange={(e) => setEditingZoneName(e.target.value)} />
                ) : (
                  <button
                    onClick={() => setSelectedZoneId(z.id)}
                    className={`flex-1 text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                      selectedZoneId === z.id
                        ? 'border-primary bg-primary/5 text-gray-900 dark:text-gray-100'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
                    }`}
                    type="button"
                    disabled={!selectedConclaveId}
                  >
                    {z.name}
                  </button>
                )}

                {editingZoneId === z.id ? (
                  <Button variant="secondary" onClick={saveZone} disabled={isSaving}>
                    <Save className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => startEditZone(z)} disabled={isSaving}>
                    <Save className="w-4 h-4" />
                  </Button>
                )}

                <Button variant="danger" onClick={() => deleteZone(z)} disabled={isSaving}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Comités</h2>
            <Badge variant="secondary">{comitesForSelectedZone.length}</Badge>
          </div>

          <select
            value={selectedZoneId}
            onChange={(e) => {
              setSelectedZoneId(e.target.value);
              setEditingComiteId(null);
              setEditingComiteName('');
            }}
            className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100 mb-4"
            disabled={!selectedConclaveId}
          >
            <option value="">Choisir une zone</option>
            {zonesForSelectedConclave.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2 mb-4">
            <Input
              value={newComiteName}
              onChange={(e) => setNewComiteName(e.target.value)}
              placeholder={selectedZoneId ? 'Nom du comité' : 'Choisir une zone'}
              disabled={!selectedZoneId}
            />
            <Button onClick={createComite} disabled={isSaving || !selectedZoneId}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {selectedZoneId && comitesForSelectedZone.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">Aucun comité.</div>
            ) : null}

            {comitesForSelectedZone.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                {editingComiteId === c.id ? (
                  <Input value={editingComiteName} onChange={(e) => setEditingComiteName(e.target.value)} />
                ) : (
                  <div className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                    {c.name}
                  </div>
                )}

                {editingComiteId === c.id ? (
                  <Button variant="secondary" onClick={saveComite} disabled={isSaving}>
                    <Save className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => startEditComite(c)} disabled={isSaving}>
                    <Save className="w-4 h-4" />
                  </Button>
                )}

                <Button variant="danger" onClick={() => deleteComite(c)} disabled={isSaving}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Rattacher une Localité à un Comité</h2>
            <Badge variant="secondary">{localites.length}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={selectedLocaliteId}
              onChange={(e) => setSelectedLocaliteId(e.target.value)}
              className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
            >
              <option value="">Choisir une localité</option>
              {localites.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            <select
              value={selectedComiteId}
              onChange={(e) => setSelectedComiteId(e.target.value)}
              className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
            >
              <option value="">Choisir un comité</option>
              {allComites.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 mt-4">
            <Button onClick={() => attachLocalite(selectedComiteId || null)} disabled={isSaving || !selectedLocaliteId || !selectedComiteId}>
              Rattacher
            </Button>
            <Button variant="secondary" onClick={() => attachLocalite(null)} disabled={isSaving || !selectedLocaliteId}>
              Détacher
            </Button>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">État actuel</h3>
            <div className="space-y-2">
              {localites.slice(0, 20).map((l) => (
                <div key={l.id} className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 py-2">
                  <span className="font-medium">{l.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 text-right">
                    {l.comite?.zone?.conclave?.name ? `${l.comite.zone.conclave.name} / ` : ''}
                    {l.comite?.zone?.name ? `${l.comite.zone.name} / ` : ''}
                    {l.comite?.name || '—'}
                  </span>
                </div>
              ))}
              {localites.length > 20 ? (
                <div className="text-xs text-gray-500 dark:text-gray-400">Affichage limité à 20 localités.</div>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Aide rapide</h2>
            <Badge variant="secondary">UI</Badge>
          </div>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div>
              - Crée d’abord un <span className="font-semibold">Conclave</span>.
            </div>
            <div>
              - Sélectionne le conclave puis crée une <span className="font-semibold">Zone</span>.
            </div>
            <div>
              - Sélectionne la zone puis crée un <span className="font-semibold">Comité</span>.
            </div>
            <div>
              - Rattache ensuite une <span className="font-semibold">Localité</span> au comité.
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Si une suppression échoue, c’est souvent parce qu’il y a déjà des éléments rattachés. Détache d’abord, puis supprime.
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
