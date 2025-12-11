import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, Users, TrendingUp, Activity, PieChart as PieChartIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { Stats, Section } from '../lib/types';
import { useAuthStore } from '../store/authStore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

export default function StatsPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSection]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Charger les sections si nécessaire
      if (user?.role !== 'SECTION_USER') {
        const sectionsRes = await api.get<{ sections: Section[] }>('/sections');
        setSections(sectionsRes.data.sections || []);
      }

      // Charger les statistiques selon le rôle
      let statsRes;
      if (user?.role === 'SECTION_USER' && user.sectionId) {
        statsRes = await api.get(`/stats/section/${user.sectionId}`);
        setStats(statsRes.data.statistiques);
      } else if (selectedSection) {
        statsRes = await api.get(`/stats/section/${selectedSection}`);
        setStats(statsRes.data.statistiques);
      } else if (user?.role === 'SOUS_LOCALITE_ADMIN' && user.sousLocaliteId) {
        statsRes = await api.get(`/stats/sous-localite/${user.sousLocaliteId}`);
        setStats(statsRes.data.statistiques);
      } else if (user?.role === 'LOCALITE') {
        statsRes = await api.get('/stats/global');
        setStats(statsRes.data.statistiques);
      }
    } catch (error: any) {
      console.error('Erreur détaillée:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement des statistiques');
      setSections([]);
      setStats(null);
    } finally {
      setIsLoading(false);
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
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => <Skeleton key={i} className="h-96" />)}
        </div>
      </div>
    );
  }

  const presenceData = stats ? [
    { name: 'Hommes', value: stats.totalPresenceHomme, color: '#0B6EFF' },
    { name: 'Femmes', value: stats.totalPresenceFemme, color: '#FF7A00' },
  ] : [];

  const moyenneData = stats ? [
    { name: 'Moyenne', Hommes: Math.round(stats.moyennePresenceHomme), Femmes: Math.round(stats.moyennePresenceFemme) },
  ] : [];

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Statistiques</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Visualisez vos données en temps réel</p>
        </div>
        {user?.role !== 'SECTION_USER' && (
          <select 
            value={selectedSection} 
            onChange={(e) => setSelectedSection(e.target.value)} 
            className="flex h-11 w-64 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-gray-100"
          >
            <option value="">Toutes les sections</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>{section.name}</option>
            ))}
          </select>
        )}
      </motion.div>

      {stats ? (
        <>
          {/* Cartes de statistiques */}
          <motion.div 
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <motion.div variants={itemVariants}>
              <Card hover gradient className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 rounded-lg flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total rencontres</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalRencontres}</p>
                    <Badge variant="default" className="mt-1">+{stats.totalRencontres}</Badge>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card hover gradient className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Présence totale</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalPresence}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="default">{stats.totalPresenceHomme}H</Badge>
                      <Badge variant="accent">{stats.totalPresenceFemme}F</Badge>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card hover gradient className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-accent/20 to-accent/10 dark:from-accent/30 dark:to-accent/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-accent-600 dark:text-accent-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Moyenne présence</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.round(stats.moyennePresence)}</p>
                    <Badge variant="success" className="mt-1">Par rencontre</Badge>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card hover gradient className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-lg flex items-center justify-center">
                    <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Taux participation</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {stats.totalRencontres > 0 ? Math.round((stats.totalPresence / stats.totalRencontres) * 100) / 100 : 0}
                    </p>
                    <Badge variant="success" className="mt-1">Excellent</Badge>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>

          {/* Graphiques */}
          <motion.div 
            variants={containerVariants}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Répartition Hommes/Femmes */}
            <motion.div variants={itemVariants}>
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <PieChartIcon className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Répartition Hommes/Femmes</h2>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={presenceData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {presenceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              </Card>
            </motion.div>

            {/* Moyenne de présence */}
            <motion.div variants={itemVariants}>
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-accent" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Moyenne de présence par rencontre</h2>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={moyenneData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                    <XAxis dataKey="name" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="Hommes" fill="#0B6EFF" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Femmes" fill="#FF7A00" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </motion.div>
          </motion.div>

          {/* Détails */}
          <motion.div variants={itemVariants}>
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Détails de présence</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/10 border-2 border-blue-200 dark:border-blue-800"
                >
                  <p className="text-sm text-blue-700 dark:text-blue-400 mb-2 font-medium">Présence Hommes</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalPresenceHomme}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <p className="text-sm text-blue-600 dark:text-blue-400">Moyenne: {Math.round(stats.moyennePresenceHomme)}</p>
                  </div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="p-4 rounded-lg bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/10 border-2 border-pink-200 dark:border-pink-800"
                >
                  <p className="text-sm text-pink-700 dark:text-pink-400 mb-2 font-medium">Présence Femmes</p>
                  <p className="text-3xl font-bold text-pink-600 dark:text-pink-400">{stats.totalPresenceFemme}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <TrendingUp className="w-4 h-4 text-pink-500" />
                    <p className="text-sm text-pink-600 dark:text-pink-400">Moyenne: {Math.round(stats.moyennePresenceFemme)}</p>
                  </div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="p-4 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/10 border-2 border-primary-200 dark:border-primary-800"
                >
                  <p className="text-sm text-primary-700 dark:text-primary-400 mb-2 font-medium">Total</p>
                  <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{stats.totalPresence}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <TrendingUp className="w-4 h-4 text-primary-500" />
                    <p className="text-sm text-primary-600 dark:text-primary-400">Moyenne: {Math.round(stats.moyennePresence)}</p>
                  </div>
                </motion.div>
              </div>
            </Card>
          </motion.div>
        </>
      ) : (
        <motion.div variants={itemVariants}>
          <Card className="p-12 text-center">
            <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Aucune donnée disponible</h3>
            <p className="text-gray-600 dark:text-gray-400">Créez des rencontres pour voir les statistiques</p>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
