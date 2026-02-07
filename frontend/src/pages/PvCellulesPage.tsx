import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

type OrgUnitKind = 'CELLULE' | 'COMMISSION';

type OrgUnitRubrique = 'CELLULES_S3' | 'COMMISSIONS_S1S2';

interface PvFieldGroup {
  group: string;
  fields: Array<{ key: string; label: string }>;
}

interface PvFieldsResponse {
  groups: PvFieldGroup[];
  keys: string[];
}

interface PvConfigRow {
  definition: {
    id: string;
    kind: OrgUnitKind;
    code: string;
    name: string;
    rubrique: OrgUnitRubrique;
  };
  config: {
    id: string;
    fields: any;
    typeIds?: any;
    updatedAt: string;
  } | null;
}

interface RencontreTypeRow {
  id: string;
  name: string;
}

export default function PvCellulesPage() {
  const { user } = useAuthStore();
  const canView = user?.role === 'OWNER';

  const [isLoading, setIsLoading] = useState(true);
  const [fieldGroups, setFieldGroups] = useState<PvFieldGroup[]>([]);
  const [rows, setRows] = useState<PvConfigRow[]>([]);
  const [types, setTypes] = useState<RencontreTypeRow[]>([]);
  const [dirtyByDefinitionId, setDirtyByDefinitionId] = useState<Record<string, boolean>>({});
  const [fieldsByDefinitionId, setFieldsByDefinitionId] = useState<Record<string, string[]>>({});
  const [typeIdsByDefinitionId, setTypeIdsByDefinitionId] = useState<Record<string, string[]>>({});

  const allFieldKeys = useMemo(() => {
    return Array.from(new Set(fieldGroups.flatMap((g) => g.fields.map((f) => f.key))));
  }, [fieldGroups]);

  const fetchData = async () => {
    if (!canView) {
      setIsLoading(false);
      setRows([]);
      setFieldGroups([]);
      setTypes([]);
      return;
    }

    setIsLoading(true);
    try {
      const [fieldsRes, configsRes, typesRes] = await Promise.all([
        api.get<PvFieldsResponse>('/institutions/org-units/pv-fields'),
        api.get<{ rows: PvConfigRow[] }>('/institutions/org-units/pv-configs'),
        api.get<{ types: RencontreTypeRow[] }>('/types'),
      ]);

      setFieldGroups(fieldsRes.data.groups || []);
      setRows(configsRes.data.rows || []);
      setTypes(Array.isArray(typesRes.data?.types) ? typesRes.data.types : []);

      const initial: Record<string, string[]> = {};
      const initialTypes: Record<string, string[]> = {};
      for (const r of configsRes.data.rows || []) {
        const defId = r.definition.id;
        const fields = Array.isArray((r.config as any)?.fields) ? ((r.config as any).fields as any[]).map(String) : [];
        const typeIds = Array.isArray((r.config as any)?.typeIds) ? ((r.config as any).typeIds as any[]).map(String) : [];
        initial[defId] = fields;
        initialTypes[defId] = typeIds;
      }
      setFieldsByDefinitionId(initial);
      setTypeIdsByDefinitionId(initialTypes);
      setDirtyByDefinitionId({});
    } catch (error: any) {
      console.error('Erreur chargement PV des cellules:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement');
      setFieldGroups([]);
      setRows([]);
      setTypes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const toggleField = (definitionId: string, key: string) => {
    if (!allFieldKeys.includes(key)) return;

    setFieldsByDefinitionId((prev) => {
      const current = new Set(prev[definitionId] || []);
      if (current.has(key)) current.delete(key);
      else current.add(key);
      const nextArr = Array.from(current);

      setDirtyByDefinitionId((d) => ({ ...d, [definitionId]: true }));
      return { ...prev, [definitionId]: nextArr };
    });
  };

  const toggleTypeId = (definitionId: string, typeId: string) => {
    setTypeIdsByDefinitionId((prev) => {
      const current = new Set(prev[definitionId] || []);
      if (current.has(typeId)) current.delete(typeId);
      else current.add(typeId);
      const nextArr = Array.from(current);
      setDirtyByDefinitionId((d) => ({ ...d, [definitionId]: true }));
      return { ...prev, [definitionId]: nextArr };
    });
  };

  const saveDefinition = async (definitionId: string) => {
    try {
      const fields = fieldsByDefinitionId[definitionId] || [];
      const typeIds = typeIdsByDefinitionId[definitionId] || [];
      await api.put(`/institutions/org-units/pv-configs/${encodeURIComponent(definitionId)}`, { fields, typeIds });
      toast.success('Configuration sauvegardée');
      setDirtyByDefinitionId((d) => ({ ...d, [definitionId]: false }));
    } catch (error: any) {
      console.error('Erreur sauvegarde PV config:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { y: 16, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Accès réservé</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Cette page est accessible uniquement au rôle OWNER.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">PV des cellules</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Choisissez les champs visibles dans les PV par Cellule/Commission</p>
        </div>
        <Button variant="outline" onClick={() => void fetchData()}>
          Actualiser
        </Button>
      </motion.div>

      {isLoading ? (
        <motion.div variants={itemVariants} className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full" />
        </motion.div>
      ) : rows.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="p-10 text-center">
            <p className="text-gray-600 dark:text-gray-400">Aucune cellule/commission.</p>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="space-y-4">
          {rows.map((r) => {
            const selected = new Set(fieldsByDefinitionId[r.definition.id] || []);
            const dirty = !!dirtyByDefinitionId[r.definition.id];
            const selectedTypes = new Set(typeIdsByDefinitionId[r.definition.id] || []);

            return (
              <Card key={r.definition.id} className="p-0">
                <div className="flex flex-col gap-3 border-b border-gray-200 dark:border-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{r.definition.kind}</Badge>
                      <Badge variant="default">{r.definition.rubrique}</Badge>
                      <Badge variant="accent">{r.definition.code}</Badge>
                    </div>
                    <p className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{r.definition.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{(fieldsByDefinitionId[r.definition.id] || []).length} champ(s) sélectionné(s)</p>
                  </div>

                  <Button onClick={() => void saveDefinition(r.definition.id)} disabled={!dirty}>
                    <Save className="h-4 w-4 mr-2" />
                    Sauvegarder
                  </Button>
                </div>

                <div className="p-4 space-y-4">
                  <div className="rounded-md border border-gray-200 dark:border-gray-800">
                    <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Types de rencontres (mapping PV auto)</p>
                    </div>
                    <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                      {types.length === 0 ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400">Aucun type.</p>
                      ) : (
                        types.map((t) => (
                          <label key={t.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={selectedTypes.has(t.id)}
                              onChange={() => toggleTypeId(r.definition.id, t.id)}
                              className="h-4 w-4"
                            />
                            <span className="truncate">{t.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {fieldGroups.map((g) => (
                    <div key={g.group} className="rounded-md border border-gray-200 dark:border-gray-800">
                      <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{g.group}</p>
                      </div>
                      <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                        {g.fields.map((f) => {
                          const checked = selected.has(f.key);
                          return (
                            <label key={f.key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleField(r.definition.id, f.key)}
                                className="h-4 w-4"
                              />
                              <span className="truncate">{f.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
