import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Shuffle, RefreshCw, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

type ReportCycle = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
} | null;

type ReportPair = {
  id: string;
  trancheAgeId: string;
  trancheAge: { id: string; name: string; order: number };
  genre: string;
  membreA: { id: string; prenom: string; nom: string };
  membreB: { id: string; prenom: string; nom: string };
  membreC?: { id: string; prenom: string; nom: string } | null;
  stats: {
    totalRencontres: number;
    presentBoth: number;
    absentEither: number;
    percent: number | null;
  };
};

type ReportSingle = {
  trancheAgeId: string;
  trancheAge: { id: string; name: string; order: number };
  genre: string;
  membre: { id: string; prenom: string; nom: string };
};

type ReportResponse = {
  cycle: ReportCycle;
  period: { lastDays: number; totalRencontres: number };
  pairs?: ReportPair[];
  singles?: ReportSingle[];
};

export default function BinomesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [report, setReport] = useState<ReportResponse | null>(null);

  const getPercentBadgeClass = (percent: number | null | undefined) => {
    if (percent == null) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
    if (percent <= 25) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
    if (percent <= 50) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200';
    if (percent <= 75) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
    return 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200';
  };

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<ReportResponse>('/binomes/report');
      setReport(res.data);
    } catch (e: any) {
      setReport(null);
      toast.error(e?.response?.data?.error || 'Erreur lors du chargement des binômes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trancheGroups = useMemo(() => {
    const pairs = report?.pairs ?? [];
    const singles = report?.singles ?? [];
    const groups = new Map<
      string,
      {
        trancheAge: { id: string; name: string; order: number };
        byGenre: Record<string, { pairs: ReportPair[]; singles: ReportSingle[] }>;
      }
    >();

    const ensure = (trancheAge: { id: string; name: string; order: number }, genre: string) => {
      const key = trancheAge.id;
      const existing = groups.get(key);
      if (existing) {
        if (!existing.byGenre[genre]) existing.byGenre[genre] = { pairs: [], singles: [] };
        return existing;
      }
      const created = { trancheAge, byGenre: { [genre]: { pairs: [], singles: [] } } as any };
      groups.set(key, created);
      return created;
    };

    for (const p of pairs) {
      const g = ensure(p.trancheAge, p.genre);
      g.byGenre[p.genre].pairs.push(p);
    }

    for (const s of singles) {
      const g = ensure(s.trancheAge, s.genre);
      g.byGenre[s.genre].singles.push(s);
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.trancheAge.order !== b.trancheAge.order) return a.trancheAge.order - b.trancheAge.order;
      return a.trancheAge.name.localeCompare(b.trancheAge.name);
    });
  }, [report]);

  const handleGenerateRandom = async () => {
    setIsMutating(true);
    try {
      await api.post('/binomes/generate');
      toast.success('Binômes générés');
      await fetchReport();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Erreur lors de la génération');
    } finally {
      setIsMutating(false);
    }
  };

  const handleRotate = async () => {
    setIsMutating(true);
    try {
      await api.post('/binomes/rotate');
      toast.success('Rotation effectuée');
      await fetchReport();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Erreur lors de la rotation');
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Binômes</h1>
          <p className="text-gray-600 dark:text-gray-400">Suivi de la présence par binôme (sur les 3 derniers mois).</p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={isLoading || isMutating} onClick={handleGenerateRandom}>
            <Shuffle className="h-4 w-4 mr-2" />
            Générer (aléatoire)
          </Button>
          <Button type="button" variant="primary" disabled={isLoading || isMutating} onClick={handleRotate}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Rotation (présence)
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <>
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <div className="mt-1 text-primary">
                <UsersRound className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Période : <strong>{report?.period?.lastDays ?? 90}</strong> derniers jours
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Rencontres trouvées : <strong>{report?.period?.totalRencontres ?? 0}</strong>
                </div>
              </div>
            </div>
          </Card>

          {trancheGroups.length === 0 ? (
            <Card className="p-6">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Aucun binôme actif. Clique sur <strong>Générer (aléatoire)</strong> ou <strong>Rotation (présence)</strong>.
              </div>
            </Card>
          ) : (
            trancheGroups.map((t) => {
              const f = t.byGenre['F'] ?? { pairs: [], singles: [] };
              const m = t.byGenre['M'] ?? { pairs: [], singles: [] };

              const countKind = (pairs: ReportPair[]) => {
                let binomes = 0;
                let trinomes = 0;
                for (const p of pairs) {
                  if (p.membreC) trinomes += 1;
                  else binomes += 1;
                }
                return { binomes, trinomes };
              };

              const fCounts = countKind(f.pairs);
              const mCounts = countKind(m.pairs);
              const totalBinomes = fCounts.binomes + mCounts.binomes;
              const totalTrinomes = fCounts.trinomes + mCounts.trinomes;

              const renderMemberChip = (label: string) => (
                <span className="inline-flex items-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-900 dark:text-gray-100">
                  {label}
                </span>
              );

              const renderPairCard = (p: ReportPair, idx: number) => {
                const title = p.membreC ? `Trinôme ${idx + 1}` : `Binôme ${idx + 1}`;
                const percent = p.stats.percent;
                const members = [
                  `${p.membreA.prenom} ${p.membreA.nom}`,
                  `${p.membreB.prenom} ${p.membreB.nom}`,
                  ...(p.membreC ? [`${p.membreC.prenom} ${p.membreC.nom}`] : []),
                ];

                return (
                  <div
                    key={p.id}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</div>
                      <div className={`rounded-md px-2 py-1 text-xs font-semibold ${getPercentBadgeClass(percent)}`}>
                        {percent == null ? '—' : `${percent}%`}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">{members.map((n) => renderMemberChip(n))}</div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Assistées: <strong>{p.stats.presentBoth}</strong> | Non assistées: <strong>{p.stats.absentEither}</strong>
                      </div>
                      <Badge variant="secondary">
                        {p.stats.presentBoth}/{p.stats.totalRencontres}
                      </Badge>
                    </div>
                  </div>
                );
              };

              const renderSingleCard = (s: ReportSingle) => (
                <div
                  key={s.membre.id}
                  className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 p-4 space-y-3"
                >
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Seul</div>
                  <div className="flex flex-wrap gap-2">{renderMemberChip(`${s.membre.prenom} ${s.membre.nom}`)}</div>
                </div>
              );

              return (
                <Card key={t.trancheAge.id} className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t.trancheAge.name}</div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        Binômes: <strong>{totalBinomes}</strong> | Trinômes: <strong>{totalTrinomes}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-4 py-3">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Genre: F</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          Binômes: <strong>{fCounts.binomes}</strong> | Trinômes: <strong>{fCounts.trinomes}</strong>
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {f.pairs.map(renderPairCard)}
                        {f.singles.map(renderSingleCard)}
                        {f.pairs.length === 0 && f.singles.length === 0 ? (
                          <div className="text-sm text-gray-600 dark:text-gray-400">Aucun</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-4 py-3">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Genre: M</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          Binômes: <strong>{mCounts.binomes}</strong> | Trinômes: <strong>{mCounts.trinomes}</strong>
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {m.pairs.map(renderPairCard)}
                        {m.singles.map(renderSingleCard)}
                        {m.pairs.length === 0 && m.singles.length === 0 ? (
                          <div className="text-sm text-gray-600 dark:text-gray-400">Aucun</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </>
      )}
    </motion.div>
  );
}
