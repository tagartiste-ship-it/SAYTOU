import { useEffect, useState } from 'react';
import api from '../lib/api';
import type { Rencontre } from '../lib/types';

export type ArchiveMonth = { month: string; total: number; hommes: number; femmes: number; presences: number };
export const monthLabel = (month: string) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Africa/Dakar' }).format(new Date(`${month}-01T12:00:00Z`));

export function useMeetingArchive(params: Record<string, string>) {
  const key = new URLSearchParams(Object.entries(params).filter(([, value]) => value)).toString();
  const [metadata, setMetadata] = useState<{ key: string; months: ArchiveMonth[]; total: number } | null>(null);
  const [selected, setSelected] = useState('');
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [rencontres, setRencontres] = useState<Rencontre[]>([]);
  const [pages, setPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const month = metadata?.months.some((m) => m.month === selected) ? selected : metadata?.months[0]?.month || '';

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    api.get(`/rencontres?${key}&archive=1`, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      setPage(1);
      setMetadata({ key, months: data.months || [], total: data.total || 0 });
    }).catch((e) => {
      if (!controller.signal.aborted) { setError(e.response?.data?.error || 'Impossible de charger les archives'); setIsLoading(false); }
    });
    return () => controller.abort();
  }, [key, version]);

  useEffect(() => {
    if (!metadata || metadata.key !== key) return;
    if (!month) { setRencontres([]); setPages(0); setIsLoading(false); return; }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    api.get(`/rencontres?${key}&month=${month}&page=${page}&limit=50`, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      setRencontres(data.rencontres || []);
      setPages(data.totalPages || 0);
      setIsLoading(false);
    }).catch((e) => {
      if (!controller.signal.aborted) { setError(e.response?.data?.error || 'Impossible de charger les rencontres'); setIsLoading(false); }
    });
    return () => controller.abort();
  }, [metadata, key, month, page]);

  return { rencontres, months: metadata?.months || [], total: metadata?.total || 0, month, page, pages,
    summary: metadata?.months.find((m) => m.month === month), isLoading: !error && (isLoading || (!!metadata && metadata.key !== key)), error,
    selectMonth: (value: string) => { setSelected(value); setPage(1); }, setPage,
    reload: () => setVersion((value) => value + 1) };
}
