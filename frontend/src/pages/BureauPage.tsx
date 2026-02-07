import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { Localite, Membre } from '../lib/types';
import { useSearchParams } from 'react-router-dom';

type BureauScopeType = 'LOCALITE' | 'SOUS_LOCALITE' | 'SECTION' | 'ORG_UNIT_INSTANCE';
type BureauGroupe = 'S1S2' | 'S3';
type BureauAffectationKind = 'TITULAIRE' | 'ADJOINT';
type BureauSlotType = 'PRIMARY' | 'EXTRA';

type BureauPoste = {
  id: string;
  name: string;
  scopeType: BureauScopeType;
  scopeId: string;
  groupe: BureauGroupe;
  createdAt: string;
  updatedAt: string;
  affectations?: BureauAffectation[];
};

type BureauAffectation = {
  id: string;
  posteId: string;
  membreId: string;
  kind: BureauAffectationKind;
  slotType: BureauSlotType;
  slotIndex: number;
  createdAt: string;
  membre?: Membre;
};

const buildSlots = (poste: BureauPoste, kind: BureauAffectationKind) => {
  const affectations = (poste.affectations ?? []).filter((a) => a.kind === kind);

  const primary = affectations.find((a) => a.slotType === 'PRIMARY') ?? null;
  const extras = affectations
    .filter((a) => a.slotType === 'EXTRA')
    .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

  const maxIndex = extras.reduce((acc, a) => Math.max(acc, a.slotIndex ?? 0), -1);

  return {
    primary,
    extras,
    nextExtraIndex: maxIndex + 1,
  };
};

export default function BureauPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();

  const [groupe, setGroupe] = useState<BureauGroupe>('S1S2');
  const [scopeType, setScopeType] = useState<BureauScopeType>('SECTION');
  const [scopeId, setScopeId] = useState<string>('');

  const [localites, setLocalites] = useState<Localite[]>([]);

  const [postes, setPostes] = useState<BureauPoste[]>([]);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [newPosteName, setNewPosteName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const canChooseScope = user?.role === 'LOCALITE';

  useEffect(() => {
    if (!user) return;

    if (user.role === 'ORG_UNIT_RESP') {
      const qsScopeType = String(searchParams.get('scopeType') ?? '').trim().toUpperCase();
      const qsScopeId = String(searchParams.get('scopeId') ?? '').trim();
      const qsGroupe = String(searchParams.get('groupe') ?? '').trim().toUpperCase();

      setScopeType(qsScopeType === 'ORG_UNIT_INSTANCE' ? 'ORG_UNIT_INSTANCE' : 'ORG_UNIT_INSTANCE');
      setScopeId(qsScopeId);
      if (qsGroupe === 'S1S2' || qsGroupe === 'S3') setGroupe(qsGroupe as any);
      return;
    }

    if (user.role === 'SECTION_USER') {
      setScopeType('SECTION');
      setScopeId(user.sectionId ?? '');
      return;
    }

    if (user.role === 'SOUS_LOCALITE_ADMIN') {
      setScopeType('SOUS_LOCALITE');
      setScopeId(user.sousLocaliteId ?? '');
      return;
    }

    setScopeType('LOCALITE');
    setScopeId('');
  }, [searchParams, user]);

  useEffect(() => {
    const loadLocalites = async () => {
      if (!user || user.role !== 'LOCALITE') return;
      try {
        const res = await api.get<{ localites: Localite[] }>('/bureau/localites');
        setLocalites(res.data.localites ?? []);
      } catch {
        setLocalites([]);
      }
    };

    void loadLocalites();
  }, [user]);

  const effectiveScope = useMemo(() => {
    if (!user) return { scopeType: scopeType, scopeId };

    if (user.role === 'SECTION_USER') {
      return { scopeType: 'SECTION' as const, scopeId: user.sectionId ?? '' };
    }

    if (user.role === 'SOUS_LOCALITE_ADMIN') {
      return { scopeType: 'SOUS_LOCALITE' as const, scopeId: user.sousLocaliteId ?? '' };
    }

    return { scopeType, scopeId };
  }, [scopeId, scopeType, user]);

  const refresh = async () => {
    if (!effectiveScope.scopeId && effectiveScope.scopeType !== 'LOCALITE') {
      setPostes([]);
      setMembres([]);
      return;
    }

    setIsLoading(true);
    try {
      const [postesRes, membresRes] = await Promise.all([
        api.get<{ postes: BureauPoste[] }>('/bureau/affectations', {
          params: { scopeType: effectiveScope.scopeType, scopeId: effectiveScope.scopeId, groupe },
        }),
        api.get<{ membres: Membre[] }>('/bureau/eligible-membres', {
          params: { scopeType: effectiveScope.scopeType, scopeId: effectiveScope.scopeId, groupe },
        }),
      ]);

      setPostes(postesRes.data.postes ?? []);
      setMembres(membresRes.data.membres ?? []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Erreur chargement bureau');
      setPostes([]);
      setMembres([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, groupe, effectiveScope.scopeId, effectiveScope.scopeType]);

  const addPoste = async () => {
    const name = newPosteName.trim();
    if (!name) return;

    setIsLoading(true);
    try {
      await api.post('/bureau/postes', {
        name,
        scopeType: effectiveScope.scopeType,
        scopeId: effectiveScope.scopeId,
        groupe,
      });
      setNewPosteName('');
      await refresh();
      toast.success('Poste ajouté');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Erreur ajout poste');
    } finally {
      setIsLoading(false);
    }
  };

  const deletePoste = async (posteId: string) => {
    setIsLoading(true);
    try {
      await api.delete(`/bureau/postes/${posteId}`);
      await refresh();
      toast.success('Poste supprimé');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Erreur suppression poste');
    } finally {
      setIsLoading(false);
    }
  };

  const upsertAffectation = async (payload: {
    posteId: string;
    kind: BureauAffectationKind;
    slotType: BureauSlotType;
    slotIndex: number;
    membreId: string;
  }) => {
    setIsLoading(true);
    try {
      await api.post('/bureau/affectations', payload);
      await refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Erreur affectation');
    } finally {
      setIsLoading(false);
    }
  };

  const memberLabel = (m: Membre) => {
    const base = `${m.nom ?? ''} ${m.prenom ?? ''}`.trim();
    const tranche = m.ageTranche ? `(${m.ageTranche})` : '';
    const sectionName = (m as any)?.section?.name ? `- ${(m as any).section.name}` : '';
    return `${base} ${tranche} ${sectionName}`.trim();
  };

  const memberOptions = useMemo(() => {
    return (membres ?? []).map((m) => ({ id: m.id, label: memberLabel(m) }));
  }, [membres]);

  const scopeTitle = useMemo(() => {
    if (!user) return '';
    if (user.role === 'SECTION_USER') return 'Bureau de la Section';
    if (user.role === 'SOUS_LOCALITE_ADMIN') return 'Bureau de la Sous-localité';
    return 'Bureau de la Localité';
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{scopeTitle}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Gestion des postes et affectations</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGroupe('S1S2')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                groupe === 'S1S2'
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-800'
              }`}
              disabled={isLoading}
            >
              S1 + S2
            </button>
            <button
              type="button"
              onClick={() => setGroupe('S3')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                groupe === 'S3'
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-800'
              }`}
              disabled={isLoading}
            >
              S3
            </button>
          </div>
        </div>
      </div>

      {canChooseScope && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Niveau</label>
              <select
                value={scopeType}
                onChange={(e) => {
                  setScopeType(e.target.value as BureauScopeType);
                  setScopeId('');
                }}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
              >
                <option value="LOCALITE">Localité</option>
                <option value="SOUS_LOCALITE">Sous-localité</option>
                <option value="SECTION">Section</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">ID</label>
              {scopeType === 'LOCALITE' ? (
                <select
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                >
                  <option value="">-- Sélectionner une localité --</option>
                  {localites.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                  placeholder="Saisir l'ID"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Postes</h2>
          <div className="flex gap-2">
            <input
              value={newPosteName}
              onChange={(e) => setNewPosteName(e.target.value)}
              placeholder="Nouveau poste"
              className="w-full sm:w-72 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={addPoste}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={isLoading || !newPosteName.trim()}
            >
              Ajouter
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {postes.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">Aucun poste pour ce bureau.</p>
          </div>
        ) : (
          postes.map((poste) => {
            const titulaires = buildSlots(poste, 'TITULAIRE');
            const adjoints = buildSlots(poste, 'ADJOINT');

            const titulaireExtras = [...titulaires.extras, { id: '__new_titulaire__', posteId: poste.id, membreId: '', kind: 'TITULAIRE' as const, slotType: 'EXTRA' as const, slotIndex: titulaires.nextExtraIndex, createdAt: '' }];
            const adjointExtras = [...adjoints.extras, { id: '__new_adjoint__', posteId: poste.id, membreId: '', kind: 'ADJOINT' as const, slotType: 'EXTRA' as const, slotIndex: adjoints.nextExtraIndex, createdAt: '' }];

            const renderSelect = (kind: BureauAffectationKind, slotType: BureauSlotType, slotIndex: number, value?: string) => {
              return (
                <select
                  value={value ?? ''}
                  onChange={(e) =>
                    void upsertAffectation({
                      posteId: poste.id,
                      kind,
                      slotType,
                      slotIndex,
                      membreId: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                  disabled={isLoading}
                >
                  <option value="">-- Aucun --</option>
                  {memberOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              );
            };

            return (
              <div
                key={poste.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{poste.name}</h3>
                  <button
                    type="button"
                    onClick={() => void deletePoste(poste.id)}
                    className="rounded-lg border border-red-200 dark:border-red-900/40 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 disabled:opacity-60"
                    disabled={isLoading}
                  >
                    Supprimer
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Titulaires</p>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Titulaire principal</p>
                        {renderSelect('TITULAIRE', 'PRIMARY', 0, titulaires.primary?.membreId)}
                      </div>

                      {titulaireExtras.map((a) => (
                        <div key={`${poste.id}-titulaire-${a.slotIndex}`}>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Titulaire (optionnel)</p>
                          {renderSelect('TITULAIRE', 'EXTRA', a.slotIndex, a.membreId)}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Adjoints</p>
                    </div>

                    <div className="space-y-2">
                      {adjointExtras.map((a) => (
                        <div key={`${poste.id}-adjoint-${a.slotIndex}`}>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Adjoint</p>
                          {renderSelect('ADJOINT', 'EXTRA', a.slotIndex, a.membreId)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isLoading && (
        <div className="text-sm text-gray-600 dark:text-gray-400">Chargement...</div>
      )}
    </div>
  );
}
