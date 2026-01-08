import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, ArrowLeft, Users, Trophy, MapPin, TrendingUp,
  Calendar, Target, Zap, Activity, Award, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { api, getApiErrorMessage } from '@/lib/api';

interface TeamStats {
  total_distance: number;
  total_runs: number;
  territories_owned: number;
  member_count: number;
  weekly_distance: number;
  monthly_distance: number;
}

interface MemberContribution {
  id: number;
  username: string;
  avatar_url?: string;
  role: string;
  distance_contributed: number;
  runs_contributed: number;
  territories_contributed: number;
  contribution_percentage: number;
  last_run_at?: string;
}

interface Challenge {
  id: number;
  type: string;
  title: string;
  description?: string;
  target_value: number;
  current_value: number;
  starts_at: string;
  ends_at?: string;
  status: string;
}

interface FeedItem {
  id: number;
  user_id: number;
  username: string;
  avatar_url?: string;
  activity_type: string;
  data: any;
  created_at: string;
}

const Team = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [team, setTeam] = useState<any>(null);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [contributions, setContributions] = useState<MemberContribution[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamData();
  }, [teamId]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const [teamRes, statsRes, contributionsRes, challengesRes, feedRes] = await Promise.all([
        api.get(`/teams/${teamId}/members`),
        api.get(`/teams/${teamId}/stats`),
        api.get(`/teams/${teamId}/contributions`),
        api.get(`/teams/${teamId}/challenges`),
        api.get(`/teams/${teamId}/feed`),
      ]);

      setTeam(teamRes.team);
      setStats(statsRes.stats);
      setContributions(contributionsRes.contributions || []);
      setChallenges(challengesRes.challenges || []);
      setFeed(feedRes.feed || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to load team data'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDistance = (km: number) => {
    return km >= 1 ? `${km.toFixed(1)} km` : `${(km * 1000).toFixed(0)} m`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'run_completed': return <Zap className="w-4 h-4" />;
      case 'territory_captured': return <MapPin className="w-4 h-4" />;
      case 'challenge_created': return <Target className="w-4 h-4" />;
      case 'challenge_completed': return <Trophy className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityText = (item: FeedItem) => {
    const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
    switch (item.activity_type) {
      case 'run_completed':
        return `ran ${formatDistance(data.distance_km)}`;
      case 'territory_captured':
        return `captured ${data.territory_name || 'a new zone'}`;
      case 'challenge_created':
        return `created challenge "${data.title}"`;
      case 'challenge_completed':
        return `completed challenge "${data.title}"`;
      default:
        return 'had activity';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading team...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/social')} className="text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-white">{team?.name || 'Team'}</h1>
              <p className="text-white/60 text-sm">{stats?.member_count || 0} members</p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="px-4 pt-6 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-6xl mx-auto">
          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-white/60 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Total Distance</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {formatDistance(stats?.total_distance || 0)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-white/60 mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm">Total Runs</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {stats?.total_runs || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-white/60 mb-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Territories</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {stats?.territories_owned || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-white/60 mb-2">
                <Users className="w-4 h-4" />
                <span className="text-sm">Active Members</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {stats?.member_count || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 max-w-6xl mx-auto">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-white/10 border-white/20">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/20">Overview</TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-white/20">Stats</TabsTrigger>
            <TabsTrigger value="challenges" className="data-[state=active]:bg-white/20">Challenges</TabsTrigger>
            <TabsTrigger value="feed" className="data-[state=active]:bg-white/20">Activity</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Weekly Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-white/80 mb-2">
                    <span>This Week</span>
                    <span>{formatDistance(stats?.weekly_distance || 0)}</span>
                  </div>
                  <Progress value={(stats?.weekly_distance || 0) / 100 * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-white/80 mb-2">
                    <span>This Month</span>
                    <span>{formatDistance(stats?.monthly_distance || 0)}</span>
                  </div>
                  <Progress value={(stats?.monthly_distance || 0) / 300 * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Top Contributors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {contributions.slice(0, 5).map((member, index) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="text-white font-medium">{member.username}</div>
                          <div className="text-white/60 text-sm">{formatDistance(member.distance_contributed)}</div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-white/10 text-white">
                        {member.contribution_percentage}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4 mt-4">
            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Member Contributions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {contributions.map((member) => (
                    <div key={member.id} className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                            <span className="text-white font-bold">{member.username.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <div className="text-white font-medium">{member.username}</div>
                            <Badge variant="secondary" className={member.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/10 text-white/70'}>
                              {member.role}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-white">{member.contribution_percentage}%</div>
                          <div className="text-white/60 text-xs">contribution</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-white font-semibold">{formatDistance(member.distance_contributed)}</div>
                          <div className="text-white/60 text-xs">Distance</div>
                        </div>
                        <div>
                          <div className="text-white font-semibold">{member.runs_contributed}</div>
                          <div className="text-white/60 text-xs">Runs</div>
                        </div>
                        <div>
                          <div className="text-white font-semibold">{member.territories_contributed}</div>
                          <div className="text-white/60 text-xs">Zones</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Challenges Tab */}
          <TabsContent value="challenges" className="space-y-4 mt-4">
            {challenges.length === 0 ? (
              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardContent className="pt-6 text-center">
                  <Target className="w-12 h-12 text-white/40 mx-auto mb-3" />
                  <p className="text-white/60">No active challenges</p>
                  <p className="text-white/40 text-sm mt-1">Team admins can create challenges</p>
                </CardContent>
              </Card>
            ) : (
              challenges.map((challenge) => (
                <Card key={challenge.id} className="bg-white/10 backdrop-blur-xl border-white/20">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="w-5 h-5 text-yellow-400" />
                          <h3 className="text-white font-bold text-lg">{challenge.title}</h3>
                        </div>
                        {challenge.description && (
                          <p className="text-white/60 text-sm mb-3">{challenge.description}</p>
                        )}
                      </div>
                      <Badge className={challenge.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                        {challenge.status}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-white/80">
                        <span>Progress</span>
                        <span>{challenge.current_value.toFixed(1)} / {challenge.target_value} {challenge.type === 'distance' ? 'km' : challenge.type === 'runs' ? 'runs' : 'zones'}</span>
                      </div>
                      <Progress value={(challenge.current_value / challenge.target_value) * 100} className="h-3" />
                      {challenge.ends_at && (
                        <div className="flex items-center gap-2 text-white/60 text-sm mt-2">
                          <Clock className="w-4 h-4" />
                          <span>Ends {new Date(challenge.ends_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Activity Feed Tab */}
          <TabsContent value="feed" className="space-y-3 mt-4">
            {feed.length === 0 ? (
              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardContent className="pt-6 text-center">
                  <Activity className="w-12 h-12 text-white/40 mx-auto mb-3" />
                  <p className="text-white/60">No recent activity</p>
                </CardContent>
              </Card>
            ) : (
              feed.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white flex-shrink-0">
                      {getActivityIcon(item.activity_type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-white">
                        <span className="font-semibold">{item.username}</span>{' '}
                        <span className="text-white/80">{getActivityText(item)}</span>
                      </p>
                      <p className="text-white/60 text-sm mt-1">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Team;
