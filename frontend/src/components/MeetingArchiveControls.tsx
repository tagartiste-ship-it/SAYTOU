import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMeetingArchive, monthLabel } from '../hooks/useMeetingArchive';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

type Archive = ReturnType<typeof useMeetingArchive>;
export function MeetingArchiveControls({ archive }: { archive: Archive }) {
  const { months, month, page, pages, summary } = archive;
  const years = [...new Set(months.map((m) => m.month.slice(0, 4)))];
  const year = month.slice(0, 4);
  const index = months.findIndex((m) => m.month === month);
  return <Card className="p-5 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"><Calendar className="w-5 h-5" />Archives par mois</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">{archive.total} rencontre(s) au total · Tous les mois conservés</p>
        {months.length > 0 && <p className="text-xs text-gray-500 mt-1">De {monthLabel(months[months.length - 1].month)} à {monthLabel(months[0].month)}{archive.total ? ' · Selon les filtres sélectionnés' : ''}</p>}
      </div>
      {months.length > 0 && <div className="flex flex-wrap gap-2">
        <select aria-label="Année des archives" value={year} onChange={(e) => archive.selectMonth(months.find((m) => m.month.startsWith(e.target.value))!.month)} className="h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 dark:text-gray-100">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select aria-label="Mois des archives" value={month} onChange={(e) => archive.selectMonth(e.target.value)} className="h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 dark:text-gray-100">
          {months.filter((m) => m.month.startsWith(year)).map((m) => <option key={m.month} value={m.month}>{monthLabel(m.month)} ({m.total})</option>)}
        </select>
      </div>}
    </div>
    {summary && <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-gray-50 dark:bg-gray-900 p-4 text-sm text-gray-600 dark:text-gray-400">
        <div>Rencontres du mois<strong className="block text-xl text-primary">{summary.total}</strong></div>
        <div>Présences cumulées<strong className="block text-xl text-gray-900 dark:text-gray-100">{summary.presences}</strong></div>
        <div>Hommes<strong className="block text-xl text-blue-600">{summary.hommes}</strong></div>
        <div>Femmes<strong className="block text-xl text-pink-600">{summary.femmes}</strong></div>
      </div>
      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="outline" disabled={index <= 0} onClick={() => archive.selectMonth(months[index - 1].month)}><ChevronLeft className="w-4 h-4 mr-1" />Mois plus récent</Button>
          <Button variant="outline" disabled={index < 0 || index >= months.length - 1} onClick={() => archive.selectMonth(months[index + 1].month)}>Mois plus ancien<ChevronRight className="w-4 h-4 ml-1" /></Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Button variant="outline" disabled={page <= 1} onClick={() => archive.setPage(page - 1)}>Précédent</Button>
          <span>Page {page} / {Math.max(1, pages)}</span>
          <Button variant="outline" disabled={page >= pages} onClick={() => archive.setPage(page + 1)}>Suivant</Button>
        </div>
      </div>
    </>}
  </Card>;
}
