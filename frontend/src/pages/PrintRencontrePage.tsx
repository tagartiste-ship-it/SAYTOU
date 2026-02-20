import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Clock, Users, FileText, User, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { Rencontre } from '../lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

export default function PrintRencontrePage() {
  const { id } = useParams<{ id: string }>();
  const [rencontre, setRencontre] = useState<Rencontre | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPrinted, setHasPrinted] = useState(false);

  useEffect(() => {
    const fetchRencontre = async () => {
      try {
        if (!id) return;
        const response = await api.get<{ rencontre: Rencontre }>(`/rencontres/${id}`);
        const rencontreData = response.data.rencontre || (response.data as any);
        setRencontre(rencontreData as Rencontre);
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Erreur lors du chargement de la rencontre');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRencontre();
  }, [id]);

  useEffect(() => {
    if (!rencontre || hasPrinted) return;

    const t = window.setTimeout(() => {
      window.print();
      setHasPrinted(true);
    }, 350);

    return () => window.clearTimeout(t);
  }, [rencontre, hasPrinted]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 p-6">
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
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">SAYTOU</h1>
            <p className="text-primary-100 text-lg">Gestion de Rencontres</p>
            <div className="mt-4 pt-4 border-t border-primary-400">
              <p className="text-xl font-semibold">COMPTE-RENDU DE RENCONTRE</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="border-l-4 border-primary-500 pl-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={rencontre.type.isReunion ? 'default' : 'accent'}>
                {rencontre.type.name}
              </Badge>
              <Badge variant="secondary">
                {rencontre.section?.name
                  || (rencontre.scopeType === 'LOCALITE'
                    ? 'Localité'
                    : (rencontre.scopeType === 'SOUS_LOCALITE'
                      ? 'Sous-localité'
                      : '—'))}
              </Badge>
            </div>
            {rencontre.theme && (
              <h2 className="text-2xl font-bold text-gray-900 mt-2">{rencontre.theme}</h2>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
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

          {rencontre.type.isReunion && (rencontre.developpement || rencontre.pvReunion) && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
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
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-gray-800 whitespace-pre-wrap">{rencontre.developpement}</p>
                  </div>
                </div>
              )}

              {rencontre.pvReunion && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-600"></div>
                    PV de réunion
                  </h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-gray-800 whitespace-pre-wrap">{rencontre.pvReunion}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {rencontre.ordreDuJour && (rencontre.ordreDuJour as any[]).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                Ordre du jour
              </h3>
              <div className="space-y-3">
                {(rencontre.ordreDuJour as any[]).map((item, index) => (
                  <div key={index} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-primary-600 text-white rounded-full font-bold text-sm">
                      {item.ordre}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{item.titre}</p>
                      {item.description && (
                        <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              Statistiques de présence
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border-2 border-blue-200">
                <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700 mb-1">Hommes</p>
                <p className="text-4xl font-bold text-blue-600">{rencontre.presenceHomme}</p>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg border-2 border-pink-200">
                <Users className="w-8 h-8 text-pink-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700 mb-1">Femmes</p>
                <p className="text-4xl font-bold text-pink-600">{rencontre.presenceFemme}</p>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg border-2 border-primary-200">
                <Users className="w-8 h-8 text-primary-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700 mb-1">Total</p>
                <p className="text-4xl font-bold text-primary-600">{rencontre.presenceTotale}</p>
              </div>
            </div>
          </div>

          {rencontre.observations && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Observations</h3>
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{rencontre.observations}</p>
              </div>
            </div>
          )}

          <div className="border-t-2 border-gray-200 pt-6 mt-8">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
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
              <div className="text-center pt-2 border-t border-gray-300 mt-3">
                <p className="text-xs text-gray-500">
                  Ce document est un compte-rendu officiel généré par SAYTOU - Gestion de Rencontres
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
