import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Users, Building2, TrendingUp, Plus, Eye, BarChart3, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import api from '../lib/api';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      if (user?.role === 'OWNER' || user?.role === 'LOCALITE') {
        const response = await api.get('/stats/global');
        setStats(response.data.statistiques);
      } else if (user?.role === 'SOUS_LOCALITE_ADMIN' && user.sousLocaliteId) {
        const response = await api.get(`/stats/sous-localite/${user.sousLocaliteId}`);
        setStats(response.data.statistiques);
      } else if (user?.sectionId) {
        const response = await api.get(`/stats/section/${user.sectionId}`);
        setStats(response.data.statistiques);
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1, 
      transition: { 
        type: 'spring' as const, 
        stiffness: 300 
      } 
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Bienvenue, <span className="font-semibold text-gray-900 dark:text-gray-100">{user?.name}</span> 👋
        </p>
      </motion.div>

      <motion.div 
        variants={containerVariants}
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={itemVariants}>
          <Card hover gradient className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Rencontres</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.totalRencontres || 0}
                </p>
                <Badge variant="default" className="mt-2">Total</Badge>
              </div>
              <div className="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-3">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card hover gradient className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Présence Totale</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.totalPresence || 0}
                </p>
                <Badge variant="accent" className="mt-2">Participants</Badge>
              </div>
              <div className="rounded-full bg-gradient-to-br from-accent/20 to-accent/10 p-3">
                <Users className="h-6 w-6 text-accent" />
              </div>
            </div>
          </Card>
        </motion.div>

        {user?.role !== 'SECTION_USER' && (
          <motion.div variants={itemVariants}>
            <Card hover gradient className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sections</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {stats?.nombreSections || stats?.totalSections || 0}
                  </p>
                  <Badge variant="success" className="mt-2">Actives</Badge>
                </div>
                <div className="rounded-full bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 p-3">
                  <Building2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <Card hover gradient className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Moyenne</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.moyennePresence?.toFixed(1) || 0}
                </p>
                <Badge variant="default" className="mt-2">Par rencontre</Badge>
              </div>
              <div className="rounded-full bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 p-3">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div 
        variants={containerVariants}
        className="grid gap-6 lg:grid-cols-2"
      >
        <motion.div variants={itemVariants}>
          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-3">
              <Link to="/rencontres/new">
                <motion.div
                  whileHover={{ scale: 1.02, x: 4 }}
                  className="flex items-center justify-between rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10 dark:hover:border-primary-400"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Plus className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Créer une rencontre</p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Enregistrer une nouvelle rencontre
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </motion.div>
              </Link>
              <Link to="/rencontres">
                <motion.div
                  whileHover={{ scale: 1.02, x: 4 }}
                  className="flex items-center justify-between rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 transition-all hover:border-accent hover:shadow-lg hover:shadow-accent/10 dark:hover:border-accent-400"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-accent/10 p-2">
                      <Eye className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Voir les rencontres</p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Consulter toutes les rencontres
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </motion.div>
              </Link>
              <Link to="/stats">
                <motion.div
                  whileHover={{ scale: 1.02, x: 4 }}
                  className="flex items-center justify-between rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 transition-all hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/10 dark:hover:border-purple-400"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2">
                      <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Statistiques</p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Voir les statistiques détaillées
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </motion.div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg">Informations</CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-3">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Rôle</p>
              <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                {user?.role === 'LOCALITE' && 'Super Admin (LOCALITÉ)'}
                {user?.role === 'SOUS_LOCALITE_ADMIN' && 'Admin Sous-Localité'}
                {user?.role === 'SECTION_USER' && 'Utilisateur Section'}
              </p>
            </div>
            
            {/* Hiérarchie organisationnelle */}
            <div className="rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/10 border-2 border-primary-200 dark:border-primary-800 p-4">
              <p className="text-sm font-medium text-primary-700 dark:text-primary-400 mb-3">Structure organisationnelle</p>
              <div className="space-y-2">
                {/* Localité (toujours affichée) */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary-700 flex-shrink-0"></div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Localité</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      La Localité de Mbour
                    </p>
                  </div>
                </div>
                
                {/* Sous-Localité */}
                {(user?.sousLocalite || user?.section?.sousLocalite) && (
                  <div className="flex items-center gap-2 ml-4">
                    <div className="w-3 h-3 rounded-full bg-primary-600 flex-shrink-0"></div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sous-Localité</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {user?.sousLocalite?.name || user?.section?.sousLocalite?.name}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Section */}
                {user?.section && (
                  <div className="flex items-center gap-2 ml-8">
                    <div className="w-3 h-3 rounded-full bg-primary-400 flex-shrink-0"></div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Section</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {user.section.name}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Message pour LOCALITE */}
                {user?.role === 'LOCALITE' && !user?.sousLocalite && !user?.section && (
                  <div className="text-center py-2 mt-2 border-t border-primary-200 dark:border-primary-800">
                    <p className="text-sm font-medium text-primary-700 dark:text-primary-400">
                      Accès à toutes les sous-localités et sections
                    </p>
                  </div>
                )}
              </div>
            </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
