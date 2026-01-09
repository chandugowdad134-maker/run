import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Activity, MapPin, Calendar, Trophy, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import BottomNavigation from '@/components/BottomNavigation';
import RunMap from '@/components/RunMap';

interface RunDetails {
  id: number;
  distanceKm: number;
  durationSec: number;
  paceMinKm: number;
  createdAt: string;
  geojson: any;
  territories: Array<{
    run_id: number;
    owner_id: number;
    distance_km: number;
    created_at: string;
    geometry: any;
  }>;
}

const RunDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [runData, setRunData] = useState<RunDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchRunDetails();
    }
  }, [id]);

  const fetchRunDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/stats/run/${id}`);
      setRunData(response.run);
    } catch (err: any) {
      console.error('Failed to fetch run details:', err);
      setError(err.message || 'Failed to load run details');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (paceMinKm: number): string => {
    const mins = Math.floor(paceMinKm);
    const secs = Math.round((paceMinKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}/km`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (error || !runData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button
            onClick={() => navigate('/stats')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Stats
          </Button>
          <div className="text-center py-20">
            <div className="text-white/60 text-lg mb-4">
              {error || 'Run not found'}
            </div>
            <Button
              onClick={() => navigate('/stats')}
              className="bg-blue-500 hover:bg-blue-600"
            >
              Go to Stats
            </Button>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  const conqueredTerritories = runData.territories.filter(t => t.fromOwner !== runData.territories[0]?.toOwner);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 pb-24">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button
            onClick={() => navigate('/stats')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Stats
          </Button>
          <h1 className="text-2xl font-bold text-white">Run Details</h1>
          <p className="text-white/60 text-sm">{formatDate(runData.createdAt)}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Run Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Run Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                  <div className="text-blue-400 text-sm mb-1">Distance</div>
                  <div className="text-2xl font-bold text-white">
                    {parseFloat(runData.distanceKm).toFixed(2)} km
                  </div>
                </div>
                <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                  <div className="text-purple-400 text-sm mb-1">Time</div>
                  <div className="text-2xl font-bold text-white">
                    {formatTime(runData.durationSec)}
                  </div>
                </div>
                <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                  <div className="text-green-400 text-sm mb-1">Pace</div>
                  <div className="text-2xl font-bold text-white">
                    {formatPace(runData.paceMinKm)}
                  </div>
                </div>
                <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/20">
                  <div className="text-orange-400 text-sm mb-1">Territories</div>
                  <div className="text-2xl font-bold text-white">
                    {conqueredTerritories.length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Territory Conquests */}
        {conqueredTerritories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-orange-400" />
                  <CardTitle className="text-white">Territories Conquered</CardTitle>
                </div>
                <CardDescription className="text-white/60">
                  Areas you claimed during this run
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {conqueredTerritories.map((territory, index) => (
                    <motion.div
                      key={territory.run_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-green-500/10 border border-green-500/20 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-green-400" />
                          <span className="text-white font-medium">
                            Territory {territory.run_id}
                          </span>
                        </div>
                        <div className="text-green-400 text-sm">
                          Run: {territory.distance_km?.toFixed(2)}km
                        </div>
                      </div>
                      <div className="text-white/60 text-xs mt-1">
                        {new Date(territory.changedAt).toLocaleTimeString()}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Run Map */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Run Map</CardTitle>
              <CardDescription className="text-white/60">
                GPS path and conquered territories
              </CardDescription>
            </CardHeader>
            <CardContent>
              {runData.geojson?.coordinates?.length > 0 ? (
                <RunMap
                  geojson={runData.geojson}
                  territories={runData.territories}
                  className="h-64 rounded-lg"
                />
              ) : (
                <div className="bg-gray-800/50 rounded-lg h-64 flex items-center justify-center">
                  <div className="text-center text-white/60">
                    <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No GPS data available</p>
                    <p className="text-sm mt-1">
                      {runData.geojson?.coordinates?.length || 0} GPS points recorded
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default RunDetails;
