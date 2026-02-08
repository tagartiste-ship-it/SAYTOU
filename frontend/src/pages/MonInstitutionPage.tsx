import { useEffect, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';

type OrgUnitKind = 'CELLULE' | 'COMMISSION';
type OrgUnitRubrique = 'CELLULES_S3' | 'COMMISSIONS_S1S2';
type OrgUnitScopeType = 'LOCALITE' | 'SECTION';

interface AssignmentRow {
  id: string;
  positionIndex: number;
  instance: {
    id: string;
    scopeType: OrgUnitScopeType;
    scopeId: string;
    scopeName?: string | null;
    definition: {
      id: string;
      kind: OrgUnitKind;
      code: string;
      name: string;
      rubrique: OrgUnitRubrique;
    };
  };
}

interface OrgUnitPvDto {
  id: string;
  instanceId: string;
  content: string | null;
  updatedAt: string;
}

interface OrgUnitMemberDto {
  id: string;
  createdAt: string;
  bureauKinds?: string[];
  membre: {
    id: string;
    prenom: string;
    nom: string;
    genre?: string | null;
    fonction?: string | null;
    telephone?: string | null;
    section?: { id: string; name: string };
  };
}

type PvMode = 'manual' | 'auto';

export default function MonInstitutionPage() {
  const { user } = useAuthStore();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [active, setActive] = useState<{ assignmentId: string; tab: 'bureau' | 'pv' | 'membres' } | null>(null);

  const [pvDraftByInstanceId, setPvDraftByInstanceId] = useState<Record<string, string>>({});

  const [pvModeByInstanceId, setPvModeByInstanceId] = useState<Record<string, PvMode>>({});
  const [pvAutoByInstanceId, setPvAutoByInstanceId] = useState<Record<string, any>>({});
  const [pvAutoLoadingByInstanceId, setPvAutoLoadingByInstanceId] = useState<Record<string, boolean>>({});
  const [pvAutoPeriodByInstanceId, setPvAutoPeriodByInstanceId] = useState<Record<string, { from: string; to: string }>>({});

  const [pvAutoCorpsMetierByInstanceId, setPvAutoCorpsMetierByInstanceId] = useState<Record<string, string>>({});
  const [pvAutoGroupeSanguinByInstanceId, setPvAutoGroupeSanguinByInstanceId] = useState<Record<string, string>>({});
  const [pvAutoStatutElecteurByInstanceId, setPvAutoStatutElecteurByInstanceId] = useState<Record<string, string>>({});

  const [pvAutoCorpsMetierSearchByInstanceId, setPvAutoCorpsMetierSearchByInstanceId] = useState<Record<string, string>>({});
  const [pvAutoGroupeSanguinSearchByInstanceId, setPvAutoGroupeSanguinSearchByInstanceId] = useState<Record<string, string>>({});

  const [corpsMetierItems, setCorpsMetierItems] = useState<Array<{ label: string; count: number }>>([]);
  const [corpsMetierTotal, setCorpsMetierTotal] = useState<number>(0);
  const [corpsMetierTotalMembres, setCorpsMetierTotalMembres] = useState<number>(0);
  const [groupesSanguins, setGroupesSanguins] = useState<string[]>([]);

  const [membersByInstanceId, setMembersByInstanceId] = useState<Record<string, OrgUnitMemberDto[]>>({});
  const [membersLoadingByInstanceId, setMembersLoadingByInstanceId] = useState<Record<string, boolean>>({});

  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchDebounced, setMemberSearchDebounced] = useState('');
  const [memberOptions, setMemberOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedMembreId, setSelectedMembreId] = useState('');
  const abortMembersRef = useRef<AbortController | null>(null);

  const canView = user?.role === 'ORG_UNIT_RESP' || user?.role === 'OWNER';

  const fetchData = async () => {
    if (!canView) {
      setAssignments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      if (user?.role === 'OWNER') {
        const res = await api.get<{ instances: AssignmentRow['instance'][] }>('/org-units/owner/instances');
        const rows = (res.data.instances || []).map((instance, idx) => ({
          id: instance.id,
          positionIndex: idx,
          instance,
        }));
        setAssignments(rows);
      } else {
        const res = await api.get<{ assignments: AssignmentRow[] }>('/org-units/me');
        setAssignments(res.data.assignments || []);
      }
    } catch (error: any) {
      console.error('Erreur chargement mon institution:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement de mon institution');
      setAssignments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

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

  const labelScope = (scopeType: OrgUnitScopeType) => {
    if (scopeType === 'LOCALITE') return 'Localité';
    return 'Section';
  };

  const formatScope = (scopeType: OrgUnitScopeType, scopeName?: string | null) => {
    const label = labelScope(scopeType);
    if (!scopeName) return label;
    return `${label}: ${scopeName}`;
  };

  const titleForAssignment = (a: AssignmentRow) => {
    const base = a.instance.definition.name;
    const scope = formatScope(a.instance.scopeType, a.instance.scopeName);
    return `${base} — ${scope}`;
  };

  useEffect(() => {
    const t = window.setTimeout(() => setMemberSearchDebounced(memberSearch.trim()), 300);
    return () => window.clearTimeout(t);
  }, [memberSearch]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [cmRes, gsRes] = await Promise.all([
          api.get<{ total: number; totalMembres: number; items: Array<{ label: string; count: number }> }>('/membres/corps-metiers-stats'),
          api.get<{ groupesSanguins: string[] }>('/membres/groupes-sanguins'),
        ]);

        const items = Array.isArray(cmRes.data?.items) ? cmRes.data.items : [];
        setCorpsMetierItems(items);
        setCorpsMetierTotal(Number(cmRes.data?.total ?? items.length) || items.length);
        setCorpsMetierTotalMembres(Number(cmRes.data?.totalMembres ?? 0) || 0);
        setGroupesSanguins(Array.isArray(gsRes.data?.groupesSanguins) ? gsRes.data.groupesSanguins : []);
      } catch {
        setCorpsMetierItems([]);
        setCorpsMetierTotal(0);
        setCorpsMetierTotalMembres(0);
        setGroupesSanguins([]);
      }
    };

    void loadFilters();
  }, []);

  const fetchPv = async (instanceId: string) => {
    try {
      const res = await api.get<{ pv: OrgUnitPvDto | null }>(`/org-units/instances/${instanceId}/pv`);
      setPvDraftByInstanceId((prev) => ({ ...prev, [instanceId]: res.data.pv?.content ?? '' }));
    } catch (error: any) {
      console.error('Erreur chargement PV:', error);
      toast.error(error.response?.data?.error || 'Erreur chargement PV');
    }
  };

  const ensureAutoPeriodDefaults = (instanceId: string) => {
    setPvAutoPeriodByInstanceId((prev) => {
      if (prev[instanceId]?.from && prev[instanceId]?.to) return prev;
      const to = new Date();
      const from = new Date();
      from.setMonth(from.getMonth() - 1);

      const toStr = to.toISOString().slice(0, 10);
      const fromStr = from.toISOString().slice(0, 10);
      return { ...prev, [instanceId]: { from: fromStr, to: toStr } };
    });
  };

  const FIELD_LABELS: Record<string, string> = {
    type: 'Type',
    section: 'Section',
    date: 'Date',
    heureDebut: 'Heure début',
    heureFin: 'Heure fin',
    lieu: 'Lieu',
    moderateur: 'Modérateur',
    moniteur: 'Moniteur',
    theme: 'Thème',
    ordreDuJour: 'Ordre du jour',
    developpement: 'Développement',
    pvReunion: 'PV réunion',
    observations: 'Observations',
    attachments: 'Pièces jointes',
    presenceHomme: 'Présence Homme',
    presenceFemme: 'Présence Femme',
    presenceTotale: 'Présence Totale',
    presents: 'Présents',
    absents: 'Absents',
    absentsCount: 'Absents (nb)',
    effectifSection: 'Effectif section',
    tauxPresence: 'Taux présence (%)',
  };

  const formatCellValue = (value: any): string => {
    if (value == null) return '—';
    if (Array.isArray(value)) {
      const out = value.map((x) => (x == null ? '' : String(x))).filter((x) => x.trim().length > 0).join(', ');
      return out || '—';
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    const s = String(value);
    return s.trim().length ? s : '—';
  };

  const buildPvAutoMarkdown = (pvAuto: any): string => {
    const meta = pvAuto?.meta ?? {};
    if (meta?.mode === 'MEMBRE_FILTER') {
      const defName = meta?.definition?.name ?? '';
      const filter = meta?.filter ?? {};
      const totalMembres = Number(meta?.totalMembres ?? 0) || 0;
      const lines: string[] = [];
      lines.push(`PV AUTO — ${defName}`.trim());
      if (filter?.corpsMetier) lines.push(`Filtre corps de métier: ${String(filter.corpsMetier)}`);
      if (filter?.groupeSanguin) lines.push(`Filtre groupe sanguin: ${String(filter.groupeSanguin)}`);
      if (filter?.statutElecteur) lines.push(`Filtre statut électeur: ${String(filter.statutElecteur)}`);
      lines.push(`Total membres: ${totalMembres}`);
      lines.push('');

      const sections = Array.isArray(pvAuto?.sections) ? pvAuto.sections : [];
      for (const s of sections) {
        lines.push(`## Section: ${s.sectionName || s.sectionId || ''}`.trim());
        const membres = Array.isArray(s.membres) ? s.membres : [];
        lines.push('');
        lines.push(`| Prénom | Nom | Genre | Fonction | Corps de métier | Groupe sanguin | Carte électeur |`);
        lines.push(`| --- | --- | --- | --- | --- | --- | --- |`);
        for (const m of membres) {
          const row = [
            String(m?.prenom ?? '').replace(/\|/g, '\\|'),
            String(m?.nom ?? '').replace(/\|/g, '\\|'),
            String(m?.genre ?? '').replace(/\|/g, '\\|'),
            String(m?.fonction ?? '').replace(/\|/g, '\\|'),
            String(m?.corpsMetier ?? '').replace(/\|/g, '\\|'),
            String(m?.groupeSanguin ?? '').replace(/\|/g, '\\|'),
            String(m?.numeroCarteElecteur ?? '').replace(/\|/g, '\\|'),
          ];
          lines.push(`| ${row.join(' | ')} |`);
        }
        lines.push('');
      }

      return lines.join('\n').trim() + '\n';
    }

    const defName = meta?.definition?.name ?? '';
    const from = meta?.from ?? '';
    const to = meta?.to ?? '';
    const selectedFields: string[] = Array.isArray(meta?.selectedFields) ? meta.selectedFields.map(String) : [];
    const columns = selectedFields.filter((k) => k !== 'section');

    const lines: string[] = [];
    lines.push(`PV AUTO — ${defName}`.trim());
    if (from || to) lines.push(`Période: ${from || '—'} → ${to || '—'}`);
    lines.push('');

    const sections = Array.isArray(pvAuto?.sections) ? pvAuto.sections : [];
    for (const s of sections) {
      lines.push(`## Section: ${s.sectionName || s.sectionId || ''}`.trim());
      const dates = Array.isArray(s.dates) ? s.dates : [];
      for (const d of dates) {
        lines.push(`### Date: ${d.date || ''}`.trim());
        lines.push('');
        lines.push(`| ${columns.map((k) => FIELD_LABELS[k] ?? k).join(' | ')} |`);
        lines.push(`| ${columns.map(() => '---').join(' | ')} |`);

        const rencontres = Array.isArray(d.rencontres) ? d.rencontres : [];
        for (const r of rencontres) {
          const row = columns.map((k) => formatCellValue(r?.[k]).replace(/\|/g, '\\|'));
          lines.push(`| ${row.join(' | ')} |`);
        }
        lines.push('');
      }
      lines.push('');
    }

    return lines.join('\n').trim() + '\n';
  };

  const fetchPvAuto = async (instanceId: string, overrideParams?: { corpsMetier?: string; groupeSanguin?: string; statutElecteur?: string }) => {
    setPvAutoLoadingByInstanceId((prev) => ({ ...prev, [instanceId]: true }));
    try {
      const period = pvAutoPeriodByInstanceId[instanceId];
      const params: any = {};

      const assignment = assignments.find((a) => a.instance.id === instanceId);
      const defCode = String(assignment?.instance?.definition?.code ?? '').trim().toUpperCase();
      const isMemberFilterOnlyCellule = defCode === 'CORPORATIVE' || defCode === 'SANTE' || defCode === 'CSU';

      if (!isMemberFilterOnlyCellule) {
        if (period?.from) params.from = period.from;
        if (period?.to) params.to = period.to;
      } else {
        if (defCode === 'CORPORATIVE') {
          const v = overrideParams?.corpsMetier ?? pvAutoCorpsMetierByInstanceId[instanceId];
          if (v) params.corpsMetier = v;
        } else if (defCode === 'SANTE') {
          const v = overrideParams?.groupeSanguin ?? pvAutoGroupeSanguinByInstanceId[instanceId];
          if (v) params.groupeSanguin = v;
        } else if (defCode === 'CSU') {
          const v = overrideParams?.statutElecteur ?? pvAutoStatutElecteurByInstanceId[instanceId];
          if (v) params.statutElecteur = v;
        }
      }

      const res = await api.get<any>(`/org-units/instances/${instanceId}/pv/auto`, { params });
      setPvAutoByInstanceId((prev) => ({ ...prev, [instanceId]: res.data?.pvAuto ?? null }));
      toast.success('PV auto généré');
    } catch (error: any) {
      console.error('Erreur génération PV auto:', error);
      toast.error(error.response?.data?.error || 'Erreur génération PV auto');
    } finally {
      setPvAutoLoadingByInstanceId((prev) => ({ ...prev, [instanceId]: false }));
    }
  };

  const savePv = async (instanceId: string) => {
    try {
      const content = pvDraftByInstanceId[instanceId] ?? '';
      await api.put<{ pv: OrgUnitPvDto }>(`/org-units/instances/${instanceId}/pv`, { content });
      toast.success('PV sauvegardé');
    } catch (error: any) {
      console.error('Erreur sauvegarde PV:', error);
      toast.error(error.response?.data?.error || 'Erreur sauvegarde PV');
    }
  };

  const fetchInstanceMembers = async (instanceId: string) => {
    setMembersLoadingByInstanceId((prev) => ({ ...prev, [instanceId]: true }));
    try {
      const res = await api.get<{ members: OrgUnitMemberDto[] }>(`/org-units/instances/${instanceId}/members`);
      setMembersByInstanceId((prev) => ({ ...prev, [instanceId]: res.data.members || [] }));
    } catch (error: any) {
      console.error('Erreur chargement membres:', error);
      toast.error(error.response?.data?.error || 'Erreur chargement membres');
      setMembersByInstanceId((prev) => ({ ...prev, [instanceId]: [] }));
    } finally {
      setMembersLoadingByInstanceId((prev) => ({ ...prev, [instanceId]: false }));
    }
  };

  const addMemberToInstance = async (instanceId: string) => {
    if (!selectedMembreId) {
      toast.error('Sélectionne un membre');
      return;
    }
    try {
      await api.post(`/org-units/instances/${instanceId}/members`, { membreId: selectedMembreId });
      toast.success('Membre ajouté');
      setSelectedMembreId('');
      await fetchInstanceMembers(instanceId);
    } catch (error: any) {
      console.error('Erreur ajout membre:', error);
      toast.error(error.response?.data?.error || "Erreur lors de l'ajout");
    }
  };

  const removeMemberFromInstance = async (instanceId: string, membreId: string) => {
    try {
      await api.delete(`/org-units/instances/${instanceId}/members/${membreId}`);
      toast.success('Membre retiré');
      await fetchInstanceMembers(instanceId);
    } catch (error: any) {
      console.error('Erreur suppression membre:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const fetchMemberOptions = async (instanceId: string) => {
    abortMembersRef.current?.abort();
    const controller = new AbortController();
    abortMembersRef.current = controller;

    try {
      const res = await api.get<{ membres: any[] }>(`/org-units/instances/${instanceId}/eligible-membres`, {
        params: memberSearchDebounced ? { q: memberSearchDebounced } : {},
        signal: controller.signal,
      });

      const rows = Array.isArray(res.data?.membres) ? res.data.membres : [];
      setMemberOptions(
        rows.map((m) => ({
          id: String(m.id),
          label: `${m.prenom ?? ''} ${m.nom ?? ''}`.trim(),
        }))
      );
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
      console.error('Erreur recherche membres:', error);
      setMemberOptions([]);
    }
  };

  useEffect(() => {
    const activeAssignment = active?.assignmentId
      ? assignments.find((a) => a.id === active.assignmentId)
      : null;
    const activeInstanceId = activeAssignment?.instance?.id ?? '';
    if (!activeInstanceId) return;

    void fetchMemberOptions(activeInstanceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberSearchDebounced, user?.role, active?.assignmentId, assignments]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {!canView ? (
        <motion.div variants={itemVariants}>
          <Card className="p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Accès non autorisé</h3>
            <p className="text-gray-600 dark:text-gray-400">Cette page est réservée aux responsables de Cellules/Commissions.</p>
          </Card>
        </motion.div>
      ) : isLoading ? (
        <motion.div variants={itemVariants} className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-80 w-full" />
        </motion.div>
      ) : (
        <>
          <motion.div variants={itemVariants} className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Mon Institution</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Vos Cellules/Commissions assignées</p>
            </div>
            <Badge variant="default" className="text-base px-4 py-2">{assignments.length} affectation(s)</Badge>
          </motion.div>

          {assignments.length === 0 ? (
            <motion.div variants={itemVariants}>
              <Card className="p-10 text-center">
                <p className="text-gray-600 dark:text-gray-400">Aucune affectation.</p>
              </Card>
            </motion.div>
          ) : (
            <motion.div variants={itemVariants}>
              <div className="space-y-4">
                {assignments.map((a) => {
                  const isActive = active?.assignmentId === a.id;
                  const activeTab = isActive ? active?.tab : null;

                  return (
                    <Card key={a.id} className="p-0">
                      <div className="flex flex-col gap-3 border-b border-gray-200 dark:border-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{a.instance.definition.kind}</Badge>
                            <Badge variant="default">{a.instance.definition.rubrique}</Badge>
                            <Badge variant="accent">{formatScope(a.instance.scopeType, a.instance.scopeName)}</Badge>
                          </div>
                          <p className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {a.instance.definition.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">Code: {a.instance.definition.code}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant={isActive && activeTab === 'bureau' ? 'primary' : 'outline'}
                            onClick={() => setActive({ assignmentId: a.id, tab: 'bureau' })}
                          >
                            Bureau
                          </Button>
                          <Button
                            variant={isActive && activeTab === 'pv' ? 'primary' : 'outline'}
                            onClick={() => {
                              setActive({ assignmentId: a.id, tab: 'pv' });
                              void fetchPv(a.instance.id);
                            }}
                          >
                            PV
                          </Button>
                          <Button
                            variant={isActive && activeTab === 'membres' ? 'primary' : 'outline'}
                            onClick={() => {
                              setActive({ assignmentId: a.id, tab: 'membres' });
                              void fetchInstanceMembers(a.instance.id);
                            }}
                          >
                            Membres
                          </Button>
                        </div>
                      </div>

                      {isActive && (
                        <div className="p-4">
                          {activeTab === 'bureau' && (
                            <Card className="p-4">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Bureau</p>
                              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {titleForAssignment(a)}
                              </p>
                              <div className="mt-3">
                                <Link to={`/bureau?scopeType=ORG_UNIT_INSTANCE&scopeId=${encodeURIComponent(a.instance.id)}`}>
                                  <Button>Ouvrir le Bureau</Button>
                                </Link>
                              </div>
                            </Card>
                          )}

                          {activeTab === 'pv' && (
                            <Card className="p-4">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">PV</p>
                              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {titleForAssignment(a)}
                              </p>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button
                                  variant={(pvModeByInstanceId[a.instance.id] ?? 'manual') === 'manual' ? 'primary' : 'outline'}
                                  onClick={() => setPvModeByInstanceId((prev) => ({ ...prev, [a.instance.id]: 'manual' }))}
                                >
                                  Manuel
                                </Button>
                                <Button
                                  variant={(pvModeByInstanceId[a.instance.id] ?? 'manual') === 'auto' ? 'primary' : 'outline'}
                                  onClick={() => {
                                    setPvModeByInstanceId((prev) => ({ ...prev, [a.instance.id]: 'auto' }));
                                    ensureAutoPeriodDefaults(a.instance.id);
                                  }}
                                >
                                  Auto
                                </Button>
                              </div>

                              {(pvModeByInstanceId[a.instance.id] ?? 'manual') === 'auto' ? (
                                <>
                                  {(() => {
                                    const defCode = String(a.instance.definition.code ?? '').trim().toUpperCase();
                                    const isMemberFilterOnlyCellule = defCode === 'CORPORATIVE' || defCode === 'SANTE' || defCode === 'CSU';

                                    if (!isMemberFilterOnlyCellule) {
                                      return (
                                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                          <div>
                                            <label className="text-xs text-gray-600 dark:text-gray-400">Du</label>
                                            <input
                                              type="date"
                                              className="mt-1 w-full rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                                              value={pvAutoPeriodByInstanceId[a.instance.id]?.from ?? ''}
                                              onChange={(e) =>
                                                setPvAutoPeriodByInstanceId((prev) => ({
                                                  ...prev,
                                                  [a.instance.id]: {
                                                    from: e.target.value,
                                                    to: prev[a.instance.id]?.to ?? '',
                                                  },
                                                }))
                                              }
                                            />
                                          </div>
                                          <div>
                                            <label className="text-xs text-gray-600 dark:text-gray-400">Au</label>
                                            <input
                                              type="date"
                                              className="mt-1 w-full rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                                              value={pvAutoPeriodByInstanceId[a.instance.id]?.to ?? ''}
                                              onChange={(e) =>
                                                setPvAutoPeriodByInstanceId((prev) => ({
                                                  ...prev,
                                                  [a.instance.id]: {
                                                    from: prev[a.instance.id]?.from ?? '',
                                                    to: e.target.value,
                                                  },
                                                }))
                                              }
                                            />
                                          </div>
                                          <div className="flex items-end justify-end">
                                            <Button
                                              onClick={() => void fetchPvAuto(a.instance.id)}
                                              disabled={!!pvAutoLoadingByInstanceId[a.instance.id]}
                                            >
                                              {pvAutoLoadingByInstanceId[a.instance.id] ? 'Génération…' : 'Générer'}
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                        {defCode === 'CORPORATIVE' ? (
                                          <div className="sm:col-span-3 rounded-md border border-gray-200 dark:border-gray-800">
                                            <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2">
                                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Filtre: Corps de métier</p>
                                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                <span>Total corps: {corpsMetierTotal}</span>
                                                <span>•</span>
                                                <span>
                                                  Sélection: {pvAutoCorpsMetierByInstanceId[a.instance.id] ? pvAutoCorpsMetierByInstanceId[a.instance.id] : 'Tous'}
                                                </span>
                                                {(() => {
                                                  const selected = pvAutoCorpsMetierByInstanceId[a.instance.id] ?? '';
                                                  const selectedCount = selected
                                                    ? (corpsMetierItems.find((x) => x.label === selected)?.count ?? 0)
                                                    : corpsMetierTotalMembres;
                                                  return (
                                                    <>
                                                      <span>•</span>
                                                      <span>Membres: {selectedCount}</span>
                                                    </>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                            <div className="p-3 space-y-2">
                                              <input
                                                className="w-full rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                                                placeholder="Rechercher un corps de métier…"
                                                value={pvAutoCorpsMetierSearchByInstanceId[a.instance.id] ?? ''}
                                                onChange={(e) =>
                                                  setPvAutoCorpsMetierSearchByInstanceId((prev) => ({
                                                    ...prev,
                                                    [a.instance.id]: e.target.value,
                                                  }))
                                                }
                                              />

                                              <div className="max-h-64 overflow-auto rounded-md border border-gray-200 dark:border-gray-800 p-2">
                                                {(() => {
                                                  const q = (pvAutoCorpsMetierSearchByInstanceId[a.instance.id] ?? '').trim().toLowerCase();
                                                  const options = corpsMetierItems.filter((x) => (q ? x.label.toLowerCase().includes(q) : true));
                                                  const rows: Array<{ label: string; count: number }> = [{ label: '', count: corpsMetierTotalMembres }, ...options];

                                                  return (
                                                    <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                                      {rows.map((x) => {
                                                        const isAll = !x.label;
                                                        const label = isAll ? 'Tous' : x.label;
                                                        const isSelected = (pvAutoCorpsMetierByInstanceId[a.instance.id] ?? '') === x.label;

                                                        return (
                                                          <button
                                                            key={label}
                                                            type="button"
                                                            className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                                                              isSelected
                                                                ? 'border-primary bg-primary/10'
                                                                : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/40'
                                                            }`}
                                                            onClick={() => {
                                                              const v = x.label;
                                                              setPvAutoCorpsMetierByInstanceId((prev) => ({ ...prev, [a.instance.id]: v }));
                                                              void fetchPvAuto(a.instance.id, { corpsMetier: v });
                                                            }}
                                                          >
                                                            <div className="flex items-center justify-between gap-3">
                                                              <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{label}</span>
                                                              <span className="shrink-0 rounded-full bg-gray-100 dark:bg-gray-900 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">
                                                                {x.count}
                                                              </span>
                                                            </div>
                                                          </button>
                                                        );
                                                      })}
                                                    </div>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                          </div>
                                        ) : defCode === 'SANTE' ? (
                                          <div className="sm:col-span-2 rounded-md border border-gray-200 dark:border-gray-800">
                                            <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2">
                                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Filtre: Groupe sanguin</p>
                                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                                Sélection actuelle: {pvAutoGroupeSanguinByInstanceId[a.instance.id] ? pvAutoGroupeSanguinByInstanceId[a.instance.id] : 'Tous'}
                                              </p>
                                            </div>
                                            <div className="p-3 space-y-2">
                                              <input
                                                className="w-full rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                                                placeholder="Rechercher un groupe sanguin…"
                                                value={pvAutoGroupeSanguinSearchByInstanceId[a.instance.id] ?? ''}
                                                onChange={(e) =>
                                                  setPvAutoGroupeSanguinSearchByInstanceId((prev) => ({
                                                    ...prev,
                                                    [a.instance.id]: e.target.value,
                                                  }))
                                                }
                                              />

                                              <div className="max-h-56 overflow-auto rounded-md border border-gray-200 dark:border-gray-800">
                                                <table className="w-full text-sm">
                                                  <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                                                    <tr>
                                                      <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800">Option</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {(() => {
                                                      const q = (pvAutoGroupeSanguinSearchByInstanceId[a.instance.id] ?? '').trim().toLowerCase();
                                                      const options = groupesSanguins.filter((v) => (q ? v.toLowerCase().includes(q) : true));
                                                      const rows = ['', ...options];
                                                      return rows.map((v) => {
                                                        const label = v ? v : 'Tous';
                                                        const isSelected = (pvAutoGroupeSanguinByInstanceId[a.instance.id] ?? '') === v;
                                                        return (
                                                          <tr
                                                            key={label}
                                                            className={`cursor-pointer ${isSelected ? 'bg-primary/10' : ''} odd:bg-white even:bg-gray-50 dark:odd:bg-gray-950 dark:even:bg-gray-900/40`}
                                                            onClick={() =>
                                                              setPvAutoGroupeSanguinByInstanceId((prev) => ({
                                                                ...prev,
                                                                [a.instance.id]: v,
                                                              }))
                                                            }
                                                          >
                                                            <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">{label}</td>
                                                          </tr>
                                                        );
                                                      });
                                                    })()}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="sm:col-span-2 rounded-md border border-gray-200 dark:border-gray-800">
                                            <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2">
                                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Filtre: Statut électeur</p>
                                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                                Sélection actuelle: {pvAutoStatutElecteurByInstanceId[a.instance.id] ? pvAutoStatutElecteurByInstanceId[a.instance.id] : 'Tous'}
                                              </p>
                                            </div>
                                            <div className="p-3">
                                              <div className="rounded-md border border-gray-200 dark:border-gray-800">
                                                <table className="w-full text-sm">
                                                  <thead className="bg-gray-50 dark:bg-gray-900">
                                                    <tr>
                                                      <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800">Option</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {[
                                                      { value: '', label: 'Tous' },
                                                      { value: 'VOTANT', label: 'Votant' },
                                                      { value: 'NON_VOTANT', label: 'Non votant' },
                                                    ].map((opt) => {
                                                      const isSelected = (pvAutoStatutElecteurByInstanceId[a.instance.id] ?? '') === opt.value;
                                                      return (
                                                        <tr
                                                          key={opt.value || 'ALL'}
                                                          className={`cursor-pointer ${isSelected ? 'bg-primary/10' : ''} odd:bg-white even:bg-gray-50 dark:odd:bg-gray-950 dark:even:bg-gray-900/40`}
                                                          onClick={() =>
                                                            setPvAutoStatutElecteurByInstanceId((prev) => ({
                                                              ...prev,
                                                              [a.instance.id]: opt.value,
                                                            }))
                                                          }
                                                        >
                                                          <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">{opt.label}</td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        <div className="sm:col-span-3 flex items-end justify-end">
                                          <Button
                                            onClick={() => void fetchPvAuto(a.instance.id)}
                                            disabled={!!pvAutoLoadingByInstanceId[a.instance.id]}
                                          >
                                            {pvAutoLoadingByInstanceId[a.instance.id] ? 'Génération…' : 'Générer'}
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  <div className="mt-3 space-y-4">
                                    {pvAutoByInstanceId[a.instance.id] ? (
                                      (() => {
                                        const pvAuto = pvAutoByInstanceId[a.instance.id];
                                        const meta = pvAuto?.meta ?? {};
                                        const sections = Array.isArray(pvAuto?.sections) ? pvAuto.sections : [];

                                        if (meta?.mode === 'MEMBRE_FILTER') {
                                          const defCode = String(meta?.definition?.code ?? a.instance.definition.code ?? '').trim().toUpperCase();
                                          return (
                                            <div className="space-y-6">
                                              {sections.length === 0 ? (
                                                <p className="text-sm text-gray-600 dark:text-gray-400">Aucun membre trouvé.</p>
                                              ) : (
                                                sections.map((s: any) => (
                                                  <div key={String(s.sectionId ?? s.sectionName ?? '')} className="rounded-md border border-gray-200 dark:border-gray-800">
                                                    <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2">
                                                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                        Section: {s.sectionName || s.sectionId}
                                                      </p>
                                                    </div>

                                                    <div className="p-3">
                                                      <div className="overflow-x-auto">
                                                        <table className="w-full text-sm border border-gray-200 dark:border-gray-800">
                                                          <thead className="bg-gray-50 dark:bg-gray-900">
                                                            <tr>
                                                              <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Prénom</th>
                                                              <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Nom</th>
                                                              {defCode === 'CORPORATIVE' ? (
                                                                <>
                                                                  <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Adresse</th>
                                                                  <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Contact</th>
                                                                </>
                                                              ) : (
                                                                <>
                                                                  <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Genre</th>
                                                                  <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Fonction</th>
                                                                  <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Corps de métier</th>
                                                                  <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Groupe sanguin</th>
                                                                  <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Carte électeur</th>
                                                                </>
                                                              )}
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {(Array.isArray(s.membres) ? s.membres : []).map((m: any) => (
                                                              <tr key={String(m.id)} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-950 dark:even:bg-gray-900/40">
                                                                <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 align-top">{formatCellValue(m?.prenom)}</td>
                                                                <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 align-top">{formatCellValue(m?.nom)}</td>
                                                                {defCode === 'CORPORATIVE' ? (
                                                                  <>
                                                                    <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 align-top">{formatCellValue(m?.adresse)}</td>
                                                                    <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 align-top">{formatCellValue(m?.telephone)}</td>
                                                                  </>
                                                                ) : (
                                                                  <>
                                                                    <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 align-top">{formatCellValue(m?.genre)}</td>
                                                                    <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 align-top">{formatCellValue(m?.fonction)}</td>
                                                                    <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 align-top">{formatCellValue(m?.corpsMetier)}</td>
                                                                    <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 align-top">{formatCellValue(m?.groupeSanguin)}</td>
                                                                    <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 align-top">{formatCellValue(m?.numeroCarteElecteur)}</td>
                                                                  </>
                                                                )}
                                                              </tr>
                                                            ))}
                                                          </tbody>
                                                        </table>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))
                                              )}
                                            </div>
                                          );
                                        }

                                        const selectedFields: string[] = Array.isArray(meta?.selectedFields)
                                          ? meta.selectedFields.map(String)
                                          : [];
                                        const columns = selectedFields.filter((k) => k !== 'section');

                                        return (
                                          <div className="space-y-6">
                                            {sections.length === 0 ? (
                                              <p className="text-sm text-gray-600 dark:text-gray-400">Aucune donnée sur la période.</p>
                                            ) : (
                                              sections.map((s: any) => (
                                                <div key={String(s.sectionId ?? s.sectionName ?? '')} className="rounded-md border border-gray-200 dark:border-gray-800">
                                                  <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                      Section: {s.sectionName || s.sectionId}
                                                    </p>
                                                  </div>

                                                  <div className="p-3 space-y-6">
                                                    {(Array.isArray(s.dates) ? s.dates : []).map((d: any) => (
                                                      <div key={String(d.date ?? '')} className="space-y-2">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Date: {d.date}</p>

                                                        <div className="overflow-x-auto">
                                                          <table className="w-full text-sm border border-gray-200 dark:border-gray-800">
                                                            <thead className="bg-gray-50 dark:bg-gray-900">
                                                              <tr>
                                                                {columns.map((k) => (
                                                                  <th
                                                                    key={k}
                                                                    className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap"
                                                                  >
                                                                    {FIELD_LABELS[k] ?? k}
                                                                  </th>
                                                                ))}
                                                              </tr>
                                                            </thead>
                                                            <tbody>
                                                              {(Array.isArray(d.rencontres) ? d.rencontres : []).map((r: any) => (
                                                                <tr key={String(r.id)} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-950 dark:even:bg-gray-900/40">
                                                                  {columns.map((k) => (
                                                                    <td key={k} className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 align-top">
                                                                      {formatCellValue(r?.[k])}
                                                                    </td>
                                                                  ))}
                                                                </tr>
                                                              ))}
                                                            </tbody>
                                                          </table>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              ))
                                            )}
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      <p className="text-sm text-gray-600 dark:text-gray-400">Clique sur Générer pour obtenir le PV auto…</p>
                                    )}
                                  </div>
                                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        const pvAuto = pvAutoByInstanceId[a.instance.id];
                                        const formatted = pvAuto ? buildPvAutoMarkdown(pvAuto) : '';
                                        setPvDraftByInstanceId((prev) => ({
                                          ...prev,
                                          [a.instance.id]: formatted,
                                        }));
                                      }}
                                      disabled={!pvAutoByInstanceId[a.instance.id]}
                                    >
                                      Copier vers Manuel
                                    </Button>
                                  </div>
                                </>
                              ) : (
                              <textarea
                                className="mt-3 w-full min-h-[200px] rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                                value={pvDraftByInstanceId[a.instance.id] ?? ''}
                                onChange={(e) =>
                                  setPvDraftByInstanceId((prev) => ({ ...prev, [a.instance.id]: e.target.value }))
                                }
                                placeholder="Saisir le PV…"
                              />
                              )}

                              {(pvModeByInstanceId[a.instance.id] ?? 'manual') === 'manual' && (
                                <div className="mt-3 flex justify-end">
                                  <Button onClick={() => void savePv(a.instance.id)}>Sauvegarder</Button>
                                </div>
                              )}
                            </Card>
                          )}

                          {activeTab === 'membres' && (
                            <Card className="p-4">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Membres</p>
                              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {titleForAssignment(a)}
                              </p>
                              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                <div className="sm:col-span-2">
                                  <input
                                    className="w-full rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                    placeholder="Rechercher un membre…"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <select
                                    className="w-full rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                                    value={selectedMembreId}
                                    onChange={(e) => setSelectedMembreId(e.target.value)}
                                  >
                                    <option value="">Sélectionner…</option>
                                    {memberOptions.map((opt) => (
                                      <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  <Button onClick={() => void addMemberToInstance(a.instance.id)}>Ajouter</Button>
                                </div>
                              </div>

                              <div className="mt-4">
                                {membersLoadingByInstanceId[a.instance.id] ? (
                                  <p className="text-sm text-gray-600 dark:text-gray-400">Chargement…</p>
                                ) : (membersByInstanceId[a.instance.id] || []).length === 0 ? (
                                  <p className="text-sm text-gray-600 dark:text-gray-400">Aucun membre.</p>
                                ) : (
                                  <div className="space-y-3">
                                    {Object.entries(
                                      (membersByInstanceId[a.instance.id] || []).reduce<Record<string, OrgUnitMemberDto[]>>(
                                        (acc, row) => {
                                          const key = row.membre.section?.name ?? 'Sans section';
                                          acc[key] = acc[key] || [];
                                          acc[key].push(row);
                                          return acc;
                                        },
                                        {}
                                      )
                                    )
                                      .sort(([aName], [bName]) => aName.localeCompare(bName))
                                      .map(([sectionName, rows]) => (
                                        <div key={sectionName} className="rounded-md border border-gray-200 dark:border-gray-800">
                                          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-3 py-2">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{sectionName}</p>
                                            <Badge variant="secondary">{rows.length}</Badge>
                                          </div>

                                          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {rows
                                              .slice()
                                              .sort((x, y) =>
                                                `${x.membre.prenom ?? ''} ${x.membre.nom ?? ''}`
                                                  .trim()
                                                  .localeCompare(`${y.membre.prenom ?? ''} ${y.membre.nom ?? ''}`.trim())
                                              )
                                              .map((row) => {
                                                const kinds = Array.isArray(row.bureauKinds) ? row.bureauKinds : [];
                                                const hasTitulaire = kinds.includes('TITULAIRE');
                                                const hasAdjoint = kinds.includes('ADJOINT');

                                                return (
                                                  <div
                                                    key={row.id}
                                                    className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2"
                                                  >
                                                    <div className="min-w-0">
                                                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                        {row.membre.prenom} {row.membre.nom}
                                                      </p>
                                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                          {row.membre.telephone || '—'}
                                                        </p>
                                                        {hasTitulaire && <Badge variant="default">Titulaire</Badge>}
                                                        {hasAdjoint && <Badge variant="accent">Adjoint</Badge>}
                                                      </div>
                                                    </div>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => void removeMemberFromInstance(a.instance.id, row.membre.id)}
                                                    >
                                                      Retirer
                                                    </Button>
                                                  </div>
                                                );
                                              })}
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </Card>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
