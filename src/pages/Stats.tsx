import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Calendar, Clock, Activity, TrendingUp, MapPin, ChevronRight, Loader2, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import BottomNavigation from '@/components/BottomNavigation';
import RunSummaryExport from '@/components/RunSummaryExport';

interface RunHistoryItem {
  id: number;
  distanceKm: number;
  durationSec: number;
  paceMinKm: number;
  createdAt: string;
  territoriesClaimed: number;
  gpsPoints?: { lat: number; lng: number; timestamp: number }[];
}

interface BestRun {
  id: number;
  distanceKm: number;
  durationSec: number;
  paceMinKm: number;
  createdAt: string;
}

interface StatsData {
  totals: {
    totalRuns: number;
    totalDistanceKm: number;
    totalTimeSec: number;
    avgPaceMinKm: number;
    activeDays: number;
  };
  bestRun: BestRun | null;
  fastestRun: BestRun | null;
}

const Stats = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [exportRun, setExportRun] = useState<RunHistoryItem | null>(null);

  useEffect(() => {
    fetchStatsData();
    fetchRunHistory(1);
  }, []);

  const fetchStatsData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stats/summary');
      setStatsData(response);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRunHistory = async (pageNum: number) => {
    try {
      setHistoryLoading(true);
      const response = await api.get(`/stats/history?page=${pageNum}&limit=20`);
      
      if (pageNum === 1) {
        setRunHistory(response.runs);
      } else {
        setRunHistory(prev => [...prev, ...response.runs]);
      }
      
      setHasMore(response.pagination.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch run history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadMore = () => {
    if (!historyLoading && hasMore) {
      fetchRunHistory(page + 1);
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
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTotalTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  const hasNoRuns = !statsData || statsData.totals.totalRuns === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 pb-24">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">Your Stats</h1>
          <p className="text-white/60 text-sm">{user?.username || 'Runner'}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {hasNoRuns ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Activity className="w-16 h-16 text-white/40 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">No runs yet</h2>
            <p className="text-white/60 mb-6">Start your first run to see your stats!</p>
            <Button
              onClick={() => navigate('/run')}
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-6 text-lg"
            >
              Start Your First Run 🏃‍♂️
            </Button>
          </motion.div>
        ) : (
          <>
            {/* Best Run Card */}
            {statsData?.bestRun && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border-orange-500/30">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-orange-400" />
                      <CardTitle className="text-white">Best Run</CardTitle>
                    </div>
                    <CardDescription className="text-white/60">
                      Your longest distance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-white">
                          {statsData.bestRun.distanceKm.toFixed(2)}
                        </span>
                        <span className="text-white/60 text-lg">km</span>
                      </div>
                      <div className="flex items-center gap-4 text-white/80">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{formatTime(statsData.bestRun.durationSec)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="w-4 h-4" />
                          <span>{formatPace(statsData.bestRun.paceMinKm)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-white/60 text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(statsData.bestRun.createdAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* All-Time Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white/5 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">All-Time Stats</CardTitle>
                  <CardDescription className="text-white/60">
                    Your total achievements
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                      <div className="text-blue-400 text-sm mb-1">Distance</div>
                      <div className="text-2xl font-bold text-white">
                        {statsData?.totals.totalDistanceKm.toFixed(1)} km
                      </div>
                    </div>
                    <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                      <div className="text-purple-400 text-sm mb-1">Time</div>
                      <div className="text-2xl font-bold text-white">
                        {formatTotalTime(statsData?.totals.totalTimeSec || 0)}
                      </div>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                      <div className="text-green-400 text-sm mb-1">Runs</div>
                      <div className="text-2xl font-bold text-white">
                        {statsData?.totals.totalRuns}
                      </div>
                    </div>
                    <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/20">
                      <div className="text-orange-400 text-sm mb-1">Active Days</div>
                      <div className="text-2xl font-bold text-white">
                        {statsData?.totals.activeDays}
                      </div>
                    </div>
                  </div>
                  {statsData?.totals.avgPaceMinKm > 0 && (
                    <div className="mt-4 bg-cyan-500/10 rounded-lg p-4 border border-cyan-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-cyan-400 text-sm mb-1">Average Pace</div>
                          <div className="text-xl font-bold text-white">
                            {formatPace(statsData.totals.avgPaceMinKm)}
                          </div>
                        </div>
                        <TrendingUp className="w-6 h-6 text-cyan-400" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Run History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-white/5 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Run History</CardTitle>
                  <CardDescription className="text-white/60">
                    All your runs, most recent first
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {runHistory.length === 0 ? (
                    <div className="text-center py-8 text-white/60">
                      No runs found
                    </div>
                  ) : (
                    <>
                      {runHistory.map((run, index) => (
                        <motion.div
                          key={run.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-white/5 hover:bg-white/10 transition-colors rounded-lg p-4 cursor-pointer group"
                          onClick={() => navigate(`/run/${run.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-white/60 text-sm">
                                  {formatDate(run.createdAt)}
                                </span>
                                {run.territoriesClaimed > 0 && (
                                  <div className="flex items-center gap-1 text-cyan-400 text-xs bg-cyan-500/10 px-2 py-1 rounded">
                                    <MapPin className="w-3 h-3" />
                                    <span>{run.territoriesClaimed} {run.territoriesClaimed === 1 ? 'area' : 'areas'}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-white">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold">{run.distanceKm.toFixed(2)} km</span>
                                </div>
                                <div className="flex items-center gap-1 text-white/60">
                                  <Clock className="w-4 h-4" />
                                  <span className="text-sm">{formatTime(run.durationSec)}</span>
                                </div>
                                <div className="flex items-center gap-1 text-white/60">
                                  <Activity className="w-4 h-4" />
                                  <span className="text-sm">{formatPace(run.paceMinKm)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExportRun(run);
                                }}
                                className="p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-white/40 hover:text-cyan-400 transition-all"
                                title="Share / Export"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {hasMore && (
                        <Button
                          onClick={loadMore}
                          disabled={historyLoading}
                          variant="outline"
                          className="w-full mt-4 bg-white/5 border-white/10 text-white hover:bg-white/10"
                        >
                          {historyLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            'Load More'
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>

      {/* Export Modal from History */}
      {exportRun && (
        <RunSummaryExport
          distance={exportRun.distanceKm}
          time={formatTime(exportRun.durationSec)}
          pace={formatPace(exportRun.paceMinKm).replace('/km', '')}
          territoriesClaimed={exportRun.territoriesClaimed}
          speed={exportRun.durationSec > 0 ? (exportRun.distanceKm / (exportRun.durationSec / 3600)) : 0}
          activityType="run"
          gpsPoints={exportRun.gpsPoints || []}
          onClose={() => setExportRun(null)}
        />
      )}

      <BottomNavigation />
    </div>
  );
};

export default Stats;
