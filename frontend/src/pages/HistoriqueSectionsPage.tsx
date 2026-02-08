import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Filter, Search, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { Rencontre, RencontreType } from '../lib/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';

type SectionHistory = {
  sectionId: string;
  sectionName: string;
  total: number;
  rencontres: Rencontre[];
};

type SectionsHistoryResponse = {
  sousLocaliteId: string;
  sections: SectionHistory[];
};

export default function HistoriqueSectionsPage() {
  const [types, setTypes] = useState<RencontreType[]>([]);
  const [sections, setSections] = useState<SectionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const [openBySectionId, setOpenBySectionId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedType) params.append('typeId', selectedType);
      if (dateDebut) params.append('dateDebut', dateDebut);
      if (dateFin) params.append('dateFin', dateFin);
      if (debouncedSearch) params.append('q', debouncedSearch);

      const [historyRes, typesRes] = await Promise.all([
        api.get<SectionsHistoryResponse>(`/rencontres/sections-history?${params.toString()}`),
        api.get<{ types: RencontreType[] }>('/types'),
      ]);

      const nextSections = Array.isArray(historyRes.data?.sections) ? historyRes.data.sections : [];
      setSections(nextSections);
      setTypes(Array.isArray(typesRes.data?.types) ? typesRes.data.types : []);

      setOpenBySectionId((prev) => {
        const next = { ...prev };
        for (const s of nextSections) {
          if (next[s.sectionId] == null) next[s.sectionId] = false;
        }
        return next;
      });
    } catch (e: any) {
      console.error('Erreur chargement historique sections:', e);
      const msg = e?.response?.data?.error || e?.message || 'Erreur lors du chargement';
      setError(msg);
      toast.error(msg);
      setSections([]);
      setTypes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, dateDebut, dateFin, debouncedSearch]);

  const totalRencontres = useMemo(() => sections.reduce((sum, s) => sum + (Number(s.total) || 0), 0), [sections]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !isLoading) {
    return (
      <div className="space-y-6">
        <Card className="p-12 text-center">
          <div className="text-red-600 text-xl mb-4">❌ Erreur</div>
          <p className="text-gray-700 dark:text-gray-300">{error}</p>
          <div className="mt-4">
            <Button onClick={() => void fetchData()}>Réessayer</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Historique sections</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Historique des rencontres par section</p>
        </div>
        <Badge variant="default" className="text-base px-4 py-2">
          <TrendingUp className="w-4 h-4 mr-2" />
          {totalRencontres} rencontres
        </Badge>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
            <Filter className="w-5 h-5" />
            Filtres
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder="Rechercher (thème, modérateur, lieu...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
            >
              <option value="">Tous les types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400">Du</label>
              <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
            </div>

            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400">Au</label>
              <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
            </div>

            <div className="flex items-end justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedType('');
                  setDateDebut('');
                  setDateFin('');
                }}
              >
                Réinitialiser
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-4">
        {sections.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-gray-600 dark:text-gray-400">Aucune rencontre trouvée.</p>
          </Card>
        ) : (
          sections.map((s) => {
            const isOpen = !!openBySectionId[s.sectionId];
            return (
              <Card key={s.sectionId} className="p-0">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 px-4 py-3 text-left"
                  onClick={() => setOpenBySectionId((prev) => ({ ...prev, [s.sectionId]: !prev[s.sectionId] }))}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{s.sectionName}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Section ID: {s.sectionId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary">{s.total}</Badge>
                    <Calendar className="w-4 h-4 text-gray-500" />
                  </div>
                </button>

                {isOpen && (
                  <div className="p-4">
                    {(s.rencontres || []).length === 0 ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400">Aucune rencontre.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-gray-200 dark:border-gray-800">
                          <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                              <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Date</th>
                              <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Type</th>
                              <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Lieu</th>
                              <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Présence</th>
                              <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Modérateur</th>
                              <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">Moniteur</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(s.rencontres || []).map((r) => {
                              const lieu = r.lieuTexte
                                ? r.lieuTexte
                                : r.lieuMembre
                                  ? `${r.lieuMembre.prenom ?? ''} ${r.lieuMembre.nom ?? ''}`.trim()
                                  : '—';

                              return (
                                <tr key={r.id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-950 dark:even:bg-gray-900/40">
                                  <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">
                                    {new Date(r.date).toLocaleDateString('fr-FR')}
                                  </td>
                                  <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">{r.type?.name ?? '—'}</td>
                                  <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">{lieu || '—'}</td>
                                  <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">
                                    {Number(r.presenceTotale ?? 0) || 0}
                                  </td>
                                  <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">{r.moderateur || '—'}</td>
                                  <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">{r.moniteur || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </motion.div>
    </motion.div>
  );
}
