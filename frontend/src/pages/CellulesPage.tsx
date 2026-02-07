import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

type OrgUnitKind = 'CELLULE' | 'COMMISSION';
type OrgUnitScopeType = 'LOCALITE' | 'SECTION';

interface MembreLite {
  id: string;
  prenom: string;
  nom: string;
  genre?: string | null;
  fonction?: string | null;
}

interface OrgUnitMemberRow {
  id: string;
  createdAt: string;
  membre: MembreLite;
}

interface OrgUnitInstanceRow {
  id: string;
  scopeType: OrgUnitScopeType;
  scopeId: string;
  definition: {
    id: string;
    kind: OrgUnitKind;
    code: string;
    name: string;
    rubrique: string;
  };
  members?: OrgUnitMemberRow[];
}

export default function CellulesPage() {
  const { user } = useAuthStore();
  const [instances, setInstances] = useState<OrgUnitInstanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchDebounced, setMemberSearchDebounced] = useState('');
  const [members, setMembers] = useState<MembreLite[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [selectedMembreId, setSelectedMembreId] = useState<string>('');

  const canManageMembers = user?.role === 'SECTION_USER';

  const fetchInstances = async () => {
    setIsLoading(true);
    try {
      if (user?.role === 'SECTION_USER') {
        const res = await api.get<{ instances: OrgUnitInstanceRow[] }>('/org-units/instances/me', {
          params: { kind: 'CELLULE' },
        });
        setInstances(res.data.instances || []);
      } else {
        const res = await api.get<{ instances: OrgUnitInstanceRow[] }>('/org-units/instances', {
          params: { kind: 'CELLULE' },
        });
        setInstances(res.data.instances || []);
      }
    } catch (error: any) {
      console.error('Erreur chargement cellules:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement des cellules');
      setInstances([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.sectionId, user?.localiteId]);

  useEffect(() => {
    const t = window.setTimeout(() => setMemberSearchDebounced(memberSearch.trim()), 300);
    return () => window.clearTimeout(t);
  }, [memberSearch]);

  const abortMembersRef = useRef<AbortController | null>(null);
  const fetchMembers = async () => {
    if (!canManageMembers) return;
    abortMembersRef.current?.abort();
    const controller = new AbortController();
    abortMembersRef.current = controller;

    setIsSearchingMembers(true);
    try {
      const res = await api.get<{ membres: any[] }>('/membres', {
        params: memberSearchDebounced ? { q: memberSearchDebounced, limit: 200 } : { limit: 200 },
        signal: controller.signal,
      });
      const rows = Array.isArray(res.data?.membres) ? res.data.membres : [];
      setMembers(
        rows.map((m) => ({
          id: m.id,
          prenom: m.prenom,
          nom: m.nom,
          genre: m.genre ?? null,
          fonction: m.fonction ?? null,
        }))
      );
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
      console.error('Erreur chargement membres:', error);
      setMembers([]);
    } finally {
      setIsSearchingMembers(false);
    }
  };

  useEffect(() => {
    void fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberSearchDebounced, user?.role]);

  const addMember = async () => {
    if (!selectedInstanceId) {
      toast.error('Sélectionne une cellule');
      return;
    }
    if (!selectedMembreId) {
      toast.error('Sélectionne un membre');
      return;
    }

    try {
      await api.post(`/org-units/instances/${selectedInstanceId}/members`, { membreId: selectedMembreId });
      toast.success('Membre ajouté');
      setSelectedMembreId('');
      await fetchInstances();
    } catch (error: any) {
      console.error('Erreur ajout membre cellule:', error);
      toast.error(error.response?.data?.error || "Erreur lors de l'ajout");
    }
  };

  const removeMember = async (instanceId: string, membreId: string) => {
    try {
      await api.delete(`/org-units/instances/${instanceId}/members/${membreId}`);
      toast.success('Membre retiré');
      await fetchInstances();
    } catch (error: any) {
      console.error('Erreur suppression membre cellule:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Cellules</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Liste des cellules existantes</p>
        </div>
        <Badge variant="default" className="text-base px-4 py-2">{instances.length} cellule(s)</Badge>
      </div>

      {canManageMembers && (
        <Card className="p-0">
          <CardHeader>
            <CardTitle className="text-lg">Ajouter un membre dans une cellule (Section)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cellule</label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={selectedInstanceId}
                  onChange={(e) => setSelectedInstanceId(e.target.value)}
                >
                  <option value="">Sélectionner…</option>
                  {instances
                    .filter((i) => i.scopeType === 'SECTION')
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.definition.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Recherche membre</label>
                <div className="mt-1 relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="pl-9" placeholder="Nom, prénom…" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Membre</label>
                <div className="mt-1 flex gap-2">
                  <select
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    value={selectedMembreId}
                    onChange={(e) => setSelectedMembreId(e.target.value)}
                    disabled={isSearchingMembers}
                  >
                    <option value="">Sélectionner…</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.prenom} {m.nom}
                      </option>
                    ))}
                  </select>
                  <Button onClick={addMember} className="whitespace-nowrap">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {instances.length === 0 ? (
        <Card className="p-10 text-center">
          <Building2 className="w-14 h-14 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Aucune cellule.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {instances.map((inst) => (
            <Card key={inst.id} className="p-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{inst.definition.name}</CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{inst.scopeType}</p>
                </div>
                <Badge variant="secondary">{(inst.members || []).length} membre(s)</Badge>
              </CardHeader>
              <CardContent>
                {(inst.members || []).length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">Aucun membre.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(inst.members || []).map((row) => (
                      <div key={row.id} className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {row.membre.prenom} {row.membre.nom}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{row.membre.fonction || ''}</p>
                        </div>
                        {canManageMembers && inst.scopeType === 'SECTION' && (
                          <Button variant="ghost" size="sm" onClick={() => removeMember(inst.id, row.membre.id)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
