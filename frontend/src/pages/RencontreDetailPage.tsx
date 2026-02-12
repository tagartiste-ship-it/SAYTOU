import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Calendar, Clock, Users, FileText, User, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { Rencontre } from '../lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

type SectionPresenceItem = { sectionId: string; sectionName: string; hommes: number; femmes: number; total: number };

export default function RencontreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [rencontre, setRencontre] = useState<Rencontre | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isGroupedPresence = user?.role === 'SOUS_LOCALITE_ADMIN' || user?.role === 'LOCALITE' || user?.role === 'COMITE_PEDAGOGIQUE';

  useEffect(() => {
    if (id) {
      fetchRencontre();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchRencontre = async () => {
    try {
      const response = await api.get<{ rencontre: Rencontre }>(`/rencontres/${id}`);
      console.log('Rencontre data:', response.data);
      
      // L'API peut retourner soit { rencontre: {...} } soit directement {...}
      const rencontreData = response.data.rencontre || response.data;
      setRencontre(rencontreData as Rencontre);
    } catch (error: any) {
      console.error('Erreur chargement rencontre:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement de la rencontre');
      navigate('/rencontres');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      if (!id) return;

      window.open(`/rencontres/${id}/print`, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      console.error('Erreur téléchargement PDF:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du téléchargement du PDF');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!rencontre) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Rencontre introuvable</p>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto space-y-6"
    >
      {/* Barre d'actions - Non imprimable */}
      <motion.div variants={itemVariants} className="flex items-center justify-between print:hidden">
        <Button onClick={() => navigate('/rencontres')} variant="outline" className="inline-flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          Retour à l'historique
        </Button>
        <Button onClick={handleDownloadPDF} className="inline-flex items-center gap-2">
          <Download className="w-5 h-5" />
          Télécharger PDF
        </Button>
      </motion.div>

      {/* Document officiel */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-900 shadow-lg rounded-lg overflow-hidden">
        {/* En-tête du document */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 text-white p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">SAYTOU</h1>
            <p className="text-primary-100 text-lg">Gestion de Rencontres</p>
            <div className="mt-4 pt-4 border-t border-primary-400">
              <p className="text-xl font-semibold">COMPTE-RENDU DE RENCONTRE</p>
            </div>
          </div>
        </div>

        {/* Corps du document */}
        <div className="p-8 space-y-6">
          {/* Informations principales */}
          <div className="border-l-4 border-primary-500 pl-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={rencontre.type.isReunion ? 'default' : 'accent'}>
                {rencontre.type.name}
              </Badge>
              <Badge variant="secondary">
                {rencontre.section.name}
              </Badge>
            </div>
            {rencontre.theme && (
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{rencontre.theme}</h2>
            )}
          </div>

          {/* Informations générales */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Informations générales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-semibold text-gray-900">
                    {format(new Date(rencontre.date), 'EEEE dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Horaires</p>
                  <p className="font-semibold text-gray-900">
                    {rencontre.heureDebut} - {rencontre.heureFin}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Modérateur</p>
                  <p className="font-semibold text-gray-900">{rencontre.moderateur}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Moniteur</p>
                  <p className="font-semibold text-gray-900">{rencontre.moniteur}</p>
                </div>
              </div>
              {(rencontre.lieuMembre || rencontre.lieuTexte) && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Lieu</p>
                    <p className="font-semibold text-gray-900">
                      {rencontre.lieuMembre
                        ? `${rencontre.lieuMembre.prenom} ${rencontre.lieuMembre.nom}${rencontre.lieuTexte ? ` (${rencontre.lieuTexte})` : ''}`
                        : (rencontre.lieuTexte || '—')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Espaces de réunion (si c'est une réunion) */}
          {rencontre.type.isReunion && (rencontre.developpement || rencontre.pvReunion) && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                Espaces de réunion
              </h3>
              
              {rencontre.developpement && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    Espace de développement
                  </h4>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{rencontre.developpement}</p>
                  </div>
                </div>
              )}
              
              {rencontre.pvReunion && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-600"></div>
                    PV de réunion
                  </h4>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{rencontre.pvReunion}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ordre du jour */}
          {rencontre.ordreDuJour && rencontre.ordreDuJour.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                Ordre du jour
              </h3>
              <div className="space-y-3">
                {rencontre.ordreDuJour.map((item, index) => (
                  <div key={index} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-primary-600 text-white rounded-full font-bold text-sm">
                      {item.ordre}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{item.titre}</p>
                      {item.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Présence */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              Statistiques de présence
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hommes</p>
                <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{rencontre.presenceHomme}</p>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-lg border-2 border-pink-200 dark:border-pink-800">
                <Users className="w-8 h-8 text-pink-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Femmes</p>
                <p className="text-4xl font-bold text-pink-600 dark:text-pink-400">{rencontre.presenceFemme}</p>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg border-2 border-primary-200 dark:border-primary-800">
                <Users className="w-8 h-8 text-primary-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total</p>
                <p className="text-4xl font-bold text-primary-600 dark:text-primary-400">{rencontre.presenceTotale}</p>
              </div>
            </div>

            {/* Détail par section pour sous-localité / localité */}
            {isGroupedPresence && rencontre.membresPresents && Array.isArray(rencontre.membresPresents) && rencontre.membresPresents.length > 0 && typeof rencontre.membresPresents[0] === 'object' && 'sectionId' in (rencontre.membresPresents[0] as any) && (
              <div className="mt-6">
                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Détail par section</h4>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Section</th>
                        <th className="text-center px-3 py-3 font-semibold text-blue-700 dark:text-blue-300 w-24">Hommes</th>
                        <th className="text-center px-3 py-3 font-semibold text-pink-700 dark:text-pink-300 w-24">Femmes</th>
                        <th className="text-center px-3 py-3 font-semibold text-gray-700 dark:text-gray-300 w-24">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rencontre.membresPresents as unknown as SectionPresenceItem[]).map((item, idx) => (
                        <tr
                          key={item.sectionId}
                          className={`border-b border-gray-100 dark:border-gray-800 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/50'} ${item.total > 0 ? 'ring-1 ring-inset ring-green-200 dark:ring-green-800' : ''}`}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{item.sectionName}</td>
                          <td className="px-3 py-3 text-center font-semibold text-blue-700 dark:text-blue-300">{item.hommes}</td>
                          <td className="px-3 py-3 text-center font-semibold text-pink-700 dark:text-pink-300">{item.femmes}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`font-bold ${item.total > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-400'}`}>{item.total}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-t-2 border-primary-200 dark:border-primary-700">
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">TOTAL</td>
                        <td className="px-3 py-3 text-center font-bold text-blue-700 dark:text-blue-300 text-lg">{rencontre.presenceHomme}</td>
                        <td className="px-3 py-3 text-center font-bold text-pink-700 dark:text-pink-300 text-lg">{rencontre.presenceFemme}</td>
                        <td className="px-3 py-3 text-center font-bold text-primary-700 dark:text-primary-300 text-lg">{rencontre.presenceTotale}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Observations */}
          {rencontre.observations && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Observations</h3>
              <div className="prose max-w-none">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{rencontre.observations}</p>
              </div>
            </div>
          )}

          {/* Pied de document */}
          <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-6 mt-8">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-700">Document créé par:</span>
                  <span className="ml-2 text-gray-600">{rencontre.createdBy.name}</span>
                </div>
                <div className="text-gray-500">
                  {format(new Date(rencontre.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                </div>
              </div>
              {rencontre.updatedBy && (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-700">Dernière modification par:</span>
                    <span className="ml-2 text-gray-600">{rencontre.updatedBy.name}</span>
                  </div>
                  <div className="text-gray-500">
                    {format(new Date(rencontre.updatedAt), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                  </div>
                </div>
              )}
              <div className="text-center pt-2 border-t border-gray-300 dark:border-gray-600 mt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Ce document est un compte-rendu officiel généré par SAYTOU - Gestion de Rencontres
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
