import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Plus, Search, ShieldCheck, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { User, UserRole } from '../lib/types';
import { useAuthStore } from '../store/authStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

export default function UsersPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');

  type OrgUnitScopeType = 'LOCALITE' | 'SECTION';
  type OrgUnitKind = 'CELLULE' | 'COMMISSION';
  type OrgUnitRubrique = 'CELLULES_S3' | 'COMMISSIONS_S1S2';

  interface OrgUnitInstanceRow {
    id: string;
    scopeType: OrgUnitScopeType;
    scopeId: string;
    isVisible: boolean;
    definition: {
      id: string;
      kind: OrgUnitKind;
      code: string;
      name: string;
      rubrique: OrgUnitRubrique;
    };
    assignments: {
      id: string;
      positionIndex: number;
      user: {
        id: string;
        email: string;
        name: string;
        role: string;
        localiteId?: string | null;
      };
    }[];
  }

  const isLocalite = user?.role === 'LOCALITE';

  const [respEmail, setRespEmail] = useState('');
  const [respName, setRespName] = useState('');
  const [responsables, setResponsables] = useState<User[]>([]);
  const [instances, setInstances] = useState<OrgUnitInstanceRow[]>([]);
  const [isLoadingOrgUnits, setIsLoadingOrgUnits] = useState(false);
  const [selectedResponsableId, setSelectedResponsableId] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');

  // Création de comptes COMITE_PEDAGOGIQUE / SOUS_LOCALITE_ADMIN
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountRole, setNewAccountRole] = useState<'COMITE_PEDAGOGIQUE' | 'SOUS_LOCALITE_ADMIN'>('COMITE_PEDAGOGIQUE');
  const [sousLocalites, setSousLocalites] = useState<{ id: string; name: string }[]>([]);
  const [selectedSousLocaliteId, setSelectedSousLocaliteId] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const canView = user?.role === 'OWNER' || user?.role === 'LOCALITE' || user?.role === 'COMITE_PEDAGOGIQUE' || user?.role === 'SOUS_LOCALITE_ADMIN';

  const isLocked = (u: User) => {
    if (!u.lockedUntil) return false;
    const t = new Date(u.lockedUntil).getTime();
    return Number.isFinite(t) && t > Date.now();
  };

  const fetchSousLocalites = async () => {
    if (!isLocalite) return;
    try {
      const res = await api.get<{ sousLocalites: { id: string; name: string }[] }>('/sous-localites');
      setSousLocalites(res.data.sousLocalites || []);
    } catch {
      setSousLocalites([]);
    }
  };

  const createAccount = async () => {
    if (!isLocalite) return;
    const email = newAccountEmail.trim().toLowerCase();
    const name = newAccountName.trim();
    if (!email || !email.includes('@')) {
      toast.error('Email invalide');
      return;
    }
    if (!name) {
      toast.error('Nom requis');
      return;
    }
    if (newAccountRole === 'SOUS_LOCALITE_ADMIN' && !selectedSousLocaliteId) {
      toast.error('Veuillez sélectionner une sous-localité');
      return;
    }

    setIsCreatingAccount(true);
    try {
      const payload: Record<string, string> = {
        email,
        name,
        password: 'Temp1234!',
        role: newAccountRole,
      };
      if (newAccountRole === 'SOUS_LOCALITE_ADMIN') {
        payload.sousLocaliteId = selectedSousLocaliteId;
      }
      const res = await api.post<{ user: User; tempPassword?: string }>('/auth/signup', payload);
      const pwd = (res.data as any)?.tempPassword || 'Temp1234!';
      window.prompt('Mot de passe temporaire (copie-le et transmets-le) :', pwd);
      try { await navigator.clipboard.writeText(pwd); } catch {}
      toast.success(`Compte ${newAccountRole === 'COMITE_PEDAGOGIQUE' ? 'Comité Pédagogique' : 'Admin Sous-Localité'} créé`);
      setNewAccountName('');
      setNewAccountEmail('');
      setSelectedSousLocaliteId('');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la création du compte');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const fetchOrgUnitsData = async () => {
    if (!isLocalite) return;
    setIsLoadingOrgUnits(true);
    try {
      const [respRes, instRes] = await Promise.all([
        api.get<{ users: User[] }>('/org-units/responsables'),
        api.get<{ instances: OrgUnitInstanceRow[] }>('/org-units/instances'),
      ]);
      setResponsables(respRes.data.users || []);
      setInstances(instRes.data.instances || []);
    } catch (error: any) {
      console.error('Erreur chargement org-units:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement des responsables');
      setResponsables([]);
      setInstances([]);
    } finally {
      setIsLoadingOrgUnits(false);
    }
  };

  const createResponsable = async () => {
    if (!isLocalite) return;
    const email = respEmail.trim().toLowerCase();
    const name = respName.trim();
    if (!email || !email.includes('@')) {
      toast.error('Email invalide');
      return;
    }
    if (!name) {
      toast.error('Nom requis');
      return;
    }

    try {
      const res = await api.post<{ message: string; user: User; tempPassword: string }>('/org-units/responsables', {
        email,
        name,
      });
      const pwd = res.data?.tempPassword;
      if (pwd) {
        window.prompt('Mot de passe temporaire (copie-le et transmets-le au responsable):', pwd);
        try {
          await navigator.clipboard.writeText(pwd);
        } catch {
        }
      }
      toast.success('Responsable créé');
      setRespEmail('');
      setRespName('');
      await fetchOrgUnitsData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur création responsable');
    }
  };

  const assignResponsable = async () => {
    if (!isLocalite) return;
    if (!selectedResponsableId || !selectedInstanceId) {
      toast.error('Choisir un responsable et une unité');
      return;
    }
    try {
      await api.post('/org-units/assignments', {
        userId: selectedResponsableId,
        instanceId: selectedInstanceId,
        positionIndex: 0,
      });
      toast.success('Assignation enregistrée');
      await fetchOrgUnitsData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur assignation');
    }
  };

  const unassignResponsable = async (instanceId: string, userId: string) => {
    if (!isLocalite) return;
    if (!confirm('Désassigner ce responsable ?')) return;
    try {
      await api.delete('/org-units/assignments', { data: { instanceId, userId } });
      toast.success('Désassigné');
      await fetchOrgUnitsData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur désassignation');
    }
  };

  const unlockUser = async (u: User) => {
    if (!confirm(`Débloquer le compte de ${u.email} ?`)) return;
    try {
      await api.post(`/users/${u.id}/unlock`);
      toast.success('Compte débloqué');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors du déblocage');
    }
  };

  const resetPassword = async (u: User) => {
    if (!confirm(`Réinitialiser le mot de passe de ${u.email} ?`)) return;
    try {
      const res = await api.post<{ message: string; tempPassword: string }>(`/users/${u.id}/reset-password`);
      const pwd = res.data?.tempPassword;
      if (pwd) {
        window.prompt('Mot de passe temporaire (copie-le et transmets-le à l’utilisateur):', pwd);
        try {
          await navigator.clipboard.writeText(pwd);
        } catch {
        }
        toast.success('Mot de passe temporaire généré');
      } else {
        toast.success('Mot de passe réinitialisé');
      }
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors du reset mot de passe');
    }
  };

  const fetchUsers = async () => {
    if (!canView) {
      setUsers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.get<{ users: User[] }>('/users', {
        params: {
          q: query || undefined,
          role: roleFilter || undefined,
        },
      });
      setUsers(res.data.users || []);
    } catch (error: any) {
      console.error('Erreur chargement utilisateurs:', error);
      const apiError = error.response?.data?.error;
      const apiPath = error.response?.data?.path;
      toast.error(apiPath ? `${apiError || 'Erreur'} (${apiPath})` : apiError || 'Erreur lors du chargement des utilisateurs');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchOrgUnitsData();
    fetchSousLocalites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.localiteId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      fetchUsers();
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, roleFilter]);

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

  const roleLabel = (r: UserRole) => {
    if (r === 'OWNER') return 'OWNER';
    if (r === 'LOCALITE') return 'Super Admin';
    if (r === 'COMITE_PEDAGOGIQUE') return 'Comité Pédagogique';
    if (r === 'SOUS_LOCALITE_ADMIN') return 'Admin Sous-Localité';
    if (r === 'SECTION_USER') return 'Utilisateur Section';
    if (r === 'ORG_UNIT_RESP') return 'Resp Cellule/Commission';
    return r;
  };

  const roleBadgeVariant = (r: UserRole) => {
    if (r === 'OWNER') return 'default';
    if (r === 'LOCALITE') return 'default';
    if (r === 'COMITE_PEDAGOGIQUE') return 'default';
    if (r === 'SOUS_LOCALITE_ADMIN') return 'accent';
    return 'secondary';
  };

  const rows = useMemo(() => users, [users]);

  if (!canView) {
    return (
      <Card className="p-12 text-center">
        <UserCog className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Accès non autorisé</h3>
        <p className="text-gray-600 dark:text-gray-400">Seuls LOCALITE et SOUS_LOCALITE_ADMIN peuvent accéder à cette page.</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Utilisateurs</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gérez et consultez les comptes</p>
        </div>
        <Badge variant="default" className="text-base px-4 py-2">
          {users.length} utilisateur(s)
        </Badge>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="pl-9"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter((e.target.value || '') as UserRole | '')}
          className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
        >
          <option value="">Tous les rôles</option>
          <option value="LOCALITE">LOCALITE</option>
          <option value="COMITE_PEDAGOGIQUE">COMITE_PEDAGOGIQUE</option>
          <option value="SOUS_LOCALITE_ADMIN">SOUS_LOCALITE_ADMIN</option>
          <option value="SECTION_USER">SECTION_USER</option>
          <option value="ORG_UNIT_RESP">ORG_UNIT_RESP</option>
        </select>
      </motion.div>

      {/* Formulaire de création de comptes (LOCALITE uniquement) */}
      {isLocalite && (
        <motion.div variants={itemVariants}>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Créer un compte</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Comité Pédagogique ou Admin Sous-Localité</p>
              </div>
              <Plus className="w-6 h-6 text-primary" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="Nom complet" />
              <Input value={newAccountEmail} onChange={(e) => setNewAccountEmail(e.target.value)} placeholder="Email" />
              <select
                value={newAccountRole}
                onChange={(e) => {
                  setNewAccountRole(e.target.value as 'COMITE_PEDAGOGIQUE' | 'SOUS_LOCALITE_ADMIN');
                  if (e.target.value === 'COMITE_PEDAGOGIQUE') setSelectedSousLocaliteId('');
                }}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
              >
                <option value="COMITE_PEDAGOGIQUE">Comité Pédagogique</option>
                <option value="SOUS_LOCALITE_ADMIN">Admin Sous-Localité</option>
              </select>
              {newAccountRole === 'SOUS_LOCALITE_ADMIN' ? (
                <select
                  value={selectedSousLocaliteId}
                  onChange={(e) => setSelectedSousLocaliteId(e.target.value)}
                  className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
                >
                  <option value="">Choisir une sous-localité</option>
                  {sousLocalites.map((sl) => (
                    <option key={sl.id} value={sl.id}>{sl.name}</option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 italic px-2">
                  Lié à votre localité
                </div>
              )}
            </div>

            <div className="mt-3">
              <Button onClick={createAccount} disabled={isCreatingAccount} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                {isCreatingAccount ? 'Création...' : 'Créer le compte'}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {isLocalite ? (
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Responsables Cellules/Commissions</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Créer des comptes ORG_UNIT_RESP (scope: ta localité)</p>
              </div>
              <Badge variant="default">{responsables.length}</Badge>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={respName} onChange={(e) => setRespName(e.target.value)} placeholder="Nom du responsable" />
              <Input value={respEmail} onChange={(e) => setRespEmail(e.target.value)} placeholder="Email (ex: resp@saytou.test)" />
            </div>

            <div className="mt-3">
              <Button onClick={createResponsable} disabled={isLoadingOrgUnits} className="w-full">
                Créer un responsable
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {isLoadingOrgUnits ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">Chargement...</div>
              ) : responsables.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">Aucun responsable.</div>
              ) : (
                responsables.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{r.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{r.email}</div>
                    </div>
                    <Badge variant="secondary">{r.mustChangePassword ? 'MDP à changer' : 'OK'}</Badge>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Assignations</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Assigner un responsable à une cellule/commission</p>
              </div>
              <Badge variant="default">{instances.length}</Badge>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={selectedResponsableId}
                onChange={(e) => setSelectedResponsableId(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
              >
                <option value="">Choisir un responsable</option>
                {responsables.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.email})
                  </option>
                ))}
              </select>

              <select
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
              >
                <option value="">Choisir une unité</option>
                {instances.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.definition.kind} - {i.definition.name} ({i.definition.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3">
              <Button onClick={assignResponsable} disabled={isLoadingOrgUnits} className="w-full">
                Assigner
              </Button>
            </div>

            <div className="mt-4 space-y-2 max-h-80 overflow-auto pr-1">
              {isLoadingOrgUnits ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">Chargement...</div>
              ) : instances.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">Aucune unité.</div>
              ) : (
                instances.map((i) => (
                  <div key={i.id} className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {i.definition.kind} - {i.definition.name}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {i.scopeType} • {i.definition.code}
                        </div>
                      </div>
                      <Badge variant="secondary">{i.assignments?.length || 0}</Badge>
                    </div>

                    {i.assignments?.length ? (
                      <div className="mt-2 space-y-1">
                        {i.assignments.map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                            <div className="min-w-0 truncate text-gray-900 dark:text-gray-100">
                              {a.user.name} ({a.user.email})
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unassignResponsable(i.id, a.user.id)}
                            >
                              Retirer
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Card>
        </motion.div>
      ) : null}

      <motion.div variants={itemVariants}>
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <th className="py-3 px-4 font-medium">Nom</th>
                <th className="py-3 px-4 font-medium">Email</th>
                <th className="py-3 px-4 font-medium">Rôle</th>
                <th className="py-3 px-4 font-medium">Statut</th>
                <th className="py-3 px-4 font-medium">Sous-localité</th>
                <th className="py-3 px-4 font-medium">Section</th>
                <th className="py-3 px-4 font-medium">Créé le</th>
                <th className="py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 px-4 text-center text-gray-600 dark:text-gray-400">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{u.name}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{u.email}</td>
                    <td className="py-3 px-4">
                      <Badge variant={roleBadgeVariant(u.role)}>{roleLabel(u.role)}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      {isLocked(u) ? (
                        <Badge variant="secondary">Bloqué</Badge>
                      ) : (
                        <Badge variant="default">Actif</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                      {u.sousLocalite?.name || u.section?.sousLocalite?.name || '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{u.section?.name || '-'}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4">
                      {user?.role !== 'COMITE_PEDAGOGIQUE' ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resetPassword(u)}
                          className="inline-flex items-center gap-2"
                        >
                          <KeyRound className="w-4 h-4" />
                          Reset MDP
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => unlockUser(u)}
                          disabled={!isLocked(u)}
                          className="inline-flex items-center gap-2"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Débloquer
                        </Button>
                      </div>
                      ) : (
                        <span className="text-xs text-gray-400">Lecture seule</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </motion.div>
    </motion.div>
  );
}
