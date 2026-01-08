import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, UserPlus, Mail, Check, X, Shield, ArrowLeft,
  MapPin, Activity, Trophy, TrendingUp, Calendar,
  Eye, EyeOff, Search, Target, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { api, getApiErrorMessage } from '@/lib/api';
import NotificationCenter from '@/components/NotificationCenter';
import BottomNavigation from '@/components/BottomNavigation';

interface Friend {
  id: number;
  email: string;
  username: string;
  avatar_url?: string;
  status: string;
}

interface FriendStats {
  id: number;
  username: string;
  avatarUrl?: string;
  totalDistanceKm: number;
  territoriesOwned: number;
  areaKm2: number;
  totalRuns: number;
  lastRunAt?: string;
}

interface ActivityItem {
  id: string;
  type: 'run' | 'territory_lost';
  userId: number;
  username: string;
  timestamp: string;
  data: any;
}

interface WeeklyComparison {
  userWeeklyDistance: number;
  friendsAvgDistance: number;
  weekStart: string;
}

interface Team {
  id: number;
  name: string;
  description?: string;
  role?: string;
  visibility?: string;
  member_count: number;
  created_by: number;
  creator_name?: string;
  total_distance_km?: number;
  total_runs?: number;
  territories_owned?: number;
}

interface TeamMember {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  role: string;
  joined_at: string;
}

interface LeaderboardUser {
  id: number;
  username: string;
  avatar_url?: string;
  total_distance_km: number;
  territories_owned: number;
  total_runs: number;
  rank: number;
}

const Social = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendStats, setFriendStats] = useState<FriendStats[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [weeklyComparison, setWeeklyComparison] = useState<WeeklyComparison | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFriendsOnMap, setShowFriendsOnMap] = useState(false);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardUser[]>([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<LeaderboardUser[]>([]);
  const [teamsLeaderboard, setTeamsLeaderboard] = useState<Team[]>([]);

  const [friendDialogOpen, setFriendDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamSettingsDialogOpen, setTeamSettingsDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [friendEmail, setFriendEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [
        friendsRes,
        statsRes,
        activityRes,
        weeklyRes,
        teamsRes,
        myTeamsRes,
        globalLeaderboardRes,
        friendsLeaderboardRes,
        teamsLeaderboardRes
      ] = await Promise.all([
        api.get('/friends'),
        api.get('/friends/stats'),
        api.get('/friends/activity'),
        api.get('/friends/weekly-comparison'),
        api.get('/teams'),
        api.get('/teams/my-teams'),
        api.get('/leaderboard/global?limit=100').catch(() => ({ leaderboard: [] })),
        api.get('/leaderboard/friends').catch(() => ({ leaderboard: [] })),
        api.get('/leaderboard/teams?limit=100').catch(() => ({ leaderboard: [] }))
      ]);

      setFriends(friendsRes.friends || []);
      setFriendStats(statsRes.friends || []);
      setActivities(activityRes.activities || []);
      setWeeklyComparison(weeklyRes.comparison);
      setTeams(teamsRes.teams || []);
      setMyTeams(myTeamsRes.teams || []);
      setGlobalLeaderboard(globalLeaderboardRes.leaderboard || []);
      setFriendsLeaderboard(friendsLeaderboardRes.leaderboard || []);
      setTeamsLeaderboard(teamsLeaderboardRes.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load social data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async () => {
    try {
      if (!friendEmail) {
        toast({
          title: 'Error',
          description: 'Please enter an email address',
          variant: 'destructive',
        });
        return;
      }

      await api.post('/friends/request', { friendEmail });

      toast({
        title: 'Success',
        description: 'Friend request sent!',
      });

      setFriendDialogOpen(false);
      setFriendEmail('');
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to send friend request'),
        variant: 'destructive',
      });
    }
  };

  const handleAcceptFriend = async (friendId: number) => {
    try {
      await api.post(`/friends/accept/${friendId}`);
      toast({
        title: 'Success',
        description: 'Friend request accepted!',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to accept friend request'),
        variant: 'destructive',
      });
    }
  };

  const handleRemoveFriend = async (friendId: number) => {
    try {
      await api.delete(`/friends/${friendId}`);
      toast({
        title: 'Success',
        description: 'Friend removed',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to remove friend'),
        variant: 'destructive',
      });
    }
  };

  const handleCreateTeam = async () => {
    try {
      if (!newTeam.name) {
        toast({
          title: 'Error',
          description: 'Please enter a team name',
          variant: 'destructive',
        });
        return;
      }

      await api.post('/teams', newTeam);

      toast({
        title: 'Success',
        description: 'Team created!',
      });

      setTeamDialogOpen(false);
      setNewTeam({ name: '', description: '' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to create team'),
        variant: 'destructive',
      });
    }
  };

  const handleJoinTeam = async (teamId: number) => {
    try {
      await api.post(`/teams/${teamId}/join`);
      toast({
        title: 'Success',
        description: 'Joined team successfully!',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to join team'),
        variant: 'destructive',
      });
    }
  };

  const handleLeaveTeam = async (teamId: number) => {
    try {
      await api.post(`/teams/${teamId}/leave`);
      toast({
        title: 'Success',
        description: 'Left team successfully',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to leave team'),
        variant: 'destructive',
      });
    }
  };

  const handleGenerateInvite = async (teamId: number) => {
    try {
      const response = await api.post(`/teams/${teamId}/invitations`, {
        expiresInDays: 7,
        maxUses: null
      });
      
      const invitationCode = response.invitation.invitation_code;
      const invitationLink = `${window.location.origin}/invite/${invitationCode}`;
      
      // Copy link to clipboard
      await navigator.clipboard.writeText(invitationLink);
      
      toast({
        title: 'Invitation Link Created! 🎉',
        description: `Link copied to clipboard. Share it with your teammates!`,
        duration: 5000,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to generate invitation'),
        variant: 'destructive',
      });
    }
  };

  const handleJoinByCode = async () => {
    try {
      if (!inviteCode.trim()) {
        toast({
          title: 'Error',
          description: 'Please enter an invitation code',
          variant: 'destructive',
        });
        return;
      }

      const response = await api.post('/teams/join-by-invite', {
        invitationCode: inviteCode.trim()
      });

      toast({
        title: 'Success',
        description: response.message || 'Joined team successfully!',
      });

      setInviteDialogOpen(false);
      setInviteCode('');
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to join team'),
        variant: 'destructive',
      });
    }
  };

  const handleUpdateTeamSettings = async (teamId: number, visibility: string) => {
    try {
      await api.patch(`/teams/${teamId}/settings`, { visibility });
      
      toast({
        title: 'Success',
        description: 'Team settings updated',
      });
      
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to update settings'),
        variant: 'destructive',
      });
    }
  };

  const handleViewMembers = async (team: Team) => {
    try {
      setSelectedTeam(team);
      const response = await api.get(`/teams/${team.id}/members`);
      setTeamMembers(response.members || []);
      setMembersDialogOpen(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to load members'),
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (teamId: number, userId: number, username: string) => {
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`);
      
      toast({
        title: 'Success',
        description: `Removed ${username} from team`,
      });
      
      // Refresh members list
      const response = await api.get(`/teams/${teamId}/members`);
      setTeamMembers(response.members || []);
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to remove member'),
        variant: 'destructive',
      });
    }
  };

  const formatActivityMessage = (activity: ActivityItem): string => {
    switch (activity.type) {
      case 'run':
        const distance = activity.data.distanceKm.toFixed(1);
        const territories = activity.data.territoriesConquered;
        if (territories > 0) {
          return `🏃 ran ${distance} km and conquered ${territories} area${territories > 1 ? 's' : ''}`;
        }
        return `🏃 ran ${distance} km`;
      case 'territory_lost':
        return `🗺️ conquered an area from you`;
      default:
        return 'Unknown activity';
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString();
  };

  const formatLastActive = (lastRunAt?: string): string => {
    if (!lastRunAt) return 'Never';
    return formatTimeAgo(lastRunAt);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading social data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 pb-24">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Social</h1>
              <p className="text-white/60 text-sm">Connect with runners & compete</p>
            </div>
            <NotificationCenter />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Weekly Comparison */}
        {weeklyComparison && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  <CardTitle className="text-white">This Week</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {weeklyComparison.userWeeklyDistance.toFixed(1)} km
                    </div>
                    <div className="text-cyan-400 text-sm">You</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {weeklyComparison.friendsAvgDistance.toFixed(1)} km
                    </div>
                    <div className="text-orange-400 text-sm">Friends Avg</div>
                  </div>
                </div>
                {weeklyComparison.userWeeklyDistance < weeklyComparison.friendsAvgDistance && (
                  <div className="mt-3 text-center">
                    <Badge variant="secondary" className="bg-orange-500/20 text-orange-400">
                      🔥 You're behind your friends!
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Friends Layer Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-white/60" />
                  <div>
                    <div className="text-white font-medium">Show Friends on Map</div>
                    <div className="text-white/60 text-sm">View friends' territories</div>
                  </div>
                </div>
                <Switch
                  checked={showFriendsOnMap}
                  onCheckedChange={setShowFriendsOnMap}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Tabs defaultValue="social" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/10">
            <TabsTrigger value="social" className="text-white data-[state=active]:bg-white/20">
              Social
            </TabsTrigger>
            <TabsTrigger value="friends" className="text-white data-[state=active]:bg-white/20">
              Friends
            </TabsTrigger>
            <TabsTrigger value="teams" className="text-white data-[state=active]:bg-white/20">
              Teams
            </TabsTrigger>
          </TabsList>

          {/* Global Leaderboard */}
          <TabsContent value="social" className="space-y-4">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    Global Leaderboard
                  </CardTitle>
                  <Badge className="bg-yellow-500/20 text-yellow-400">Top Runners</Badge>
                </div>
                <CardDescription className="text-white/60">
                  Highest distance runners worldwide
                </CardDescription>
              </CardHeader>
              <CardContent>
                {globalLeaderboard.length === 0 ? (
                  <div className="text-center py-8">
                    <Trophy className="w-12 h-12 text-white/40 mx-auto mb-3" />
                    <p className="text-white/60">No runners yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {globalLeaderboard.map((user, index) => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex-shrink-0 w-8 text-center">
                          {index === 0 && <span className="text-2xl">🥇</span>}
                          {index === 1 && <span className="text-2xl">🥈</span>}
                          {index === 2 && <span className="text-2xl">🥉</span>}
                          {index > 2 && <span className="text-white/60 font-bold">#{index + 1}</span>}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{user.username}</div>
                          <div className="text-white/60 text-sm">{user.total_runs} runs</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-white font-bold text-lg">{parseFloat(user.total_distance_km).toFixed(1)} km</div>
                          <div className="text-white/60 text-xs">{user.territories_owned} zones</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Friends Leaderboard */}
          <TabsContent value="friends" className="space-y-4">
            {/* Add Friend Button */}
            <div className="flex justify-between items-center mb-4">
              <Dialog open={friendDialogOpen} onOpenChange={setFriendDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-green-500 hover:bg-green-600">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Friend
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Friend</DialogTitle>
                    <DialogDescription>
                      Send a friend request to connect with other runners.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="email">Friend's Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="friend@example.com"
                        value={friendEmail}
                        onChange={(e) => setFriendEmail(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleSendFriendRequest} className="w-full">
                      Send Friend Request
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-400" />
                    Friends Leaderboard
                  </CardTitle>
                  <Badge className="bg-green-500/20 text-green-400">Competing</Badge>
                </div>
                <CardDescription className="text-white/60">
                  See how you rank against your friends
                </CardDescription>
              </CardHeader>
              <CardContent>
                {friendsLeaderboard.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-white/40 mx-auto mb-3" />
                    <p className="text-white/60">No friends yet</p>
                    <p className="text-white/40 text-sm">Add friends to start competing!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friendsLeaderboard.map((user, index) => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex-shrink-0 w-8 text-center">
                          {index === 0 && <span className="text-2xl">🥇</span>}
                          {index === 1 && <span className="text-2xl">🥈</span>}
                          {index === 2 && <span className="text-2xl">🥉</span>}
                          {index > 2 && <span className="text-white/60 font-bold">#{index + 1}</span>}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{user.username}</div>
                          <div className="text-white/60 text-sm">{user.total_runs} runs</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-white font-bold text-lg">{parseFloat(user.total_distance_km).toFixed(1)} km</div>
                          <div className="text-white/60 text-xs">{user.territories_owned} zones</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams" className="space-y-4">
            {/* Create Team and Join by Code Buttons */}
            <div className="flex justify-between items-center gap-2">
              <h3 className="text-white text-lg font-semibold">Teams ({myTeams.length})</h3>
              <div className="flex gap-2">
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                      <Mail className="w-4 h-4 mr-2" />
                      Join by Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Join Team by Invitation</DialogTitle>
                      <DialogDescription>
                        Enter the invitation code shared by a team admin
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="inviteCode">Invitation Code</Label>
                        <Input
                          id="inviteCode"
                          placeholder="abc123xyz456"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleJoinByCode} className="w-full">
                        Join Team
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-purple-500 hover:bg-purple-600">
                      <Users className="w-4 h-4 mr-2" />
                      Create Team
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Team</DialogTitle>
                      <DialogDescription>
                        Create a team to compete together in competitions and share territory conquests.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="teamName">Team Name</Label>
                        <Input
                          id="teamName"
                          placeholder="Running Warriors"
                          value={newTeam.name}
                          onChange={(e) => setNewTeam(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="teamDesc">Description (Optional)</Label>
                        <Input
                          id="teamDesc"
                          placeholder="A team for serious runners"
                          value={newTeam.description}
                          onChange={(e) => setNewTeam(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                      <Button onClick={handleCreateTeam} className="w-full">
                        Create Team
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Teams List */}
            {myTeams.length === 0 ? (
              <Card className="bg-white/5 backdrop-blur-xl border-white/10">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Shield className="w-12 h-12 text-white/40 mx-auto mb-3" />
                    <p className="text-white/60">No teams yet</p>
                    <p className="text-white/40 text-sm">Create a team or join with an invitation code!</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {myTeams.map((team) => (
                  <Card key={team.id} className="bg-white/5 backdrop-blur-xl border-white/10">
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                              <Shield className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-white font-medium">{team.name}</div>
                                {team.visibility === 'private' && (
                                  <Badge variant="secondary" className="bg-white/10 text-white/70 text-xs">
                                    <EyeOff className="w-3 h-3 mr-1" />
                                    Private
                                  </Badge>
                                )}
                              </div>
                              <div className="text-white/60 text-sm">
                                {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                                {team.role && ` · ${team.role}`}
                              </div>
                              {team.description && (
                                <div className="text-white/40 text-xs mt-1">{team.description}</div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            {/* View Team Page */}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="border-white/20 text-white hover:bg-white/10"
                              onClick={() => navigate(`/team/${team.id}`)}
                            >
                              <Shield className="w-4 h-4 mr-1" />
                              View Team
                            </Button>

                            {/* View Members - available to all */}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="border-white/20 text-white hover:bg-white/10"
                              onClick={() => handleViewMembers(team)}
                            >
                              <Users className="w-4 h-4 mr-1" />
                              Members
                            </Button>

                            {/* Settings - admin only */}
                            {team.role === 'admin' && (
                              <Dialog open={teamSettingsDialogOpen && selectedTeam?.id === team.id} 
                                      onOpenChange={(open) => {
                                        setTeamSettingsDialogOpen(open);
                                        if (open) setSelectedTeam(team);
                                        else setSelectedTeam(null);
                                      }}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                                  Settings
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Team Settings</DialogTitle>
                                  <DialogDescription>
                                    Manage your team settings and invitations
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                  {/* Visibility Toggle */}
                                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                                    <div className="flex items-center gap-3">
                                      {team.visibility === 'public' ? (
                                        <Eye className="w-5 h-5 text-green-400" />
                                      ) : (
                                        <EyeOff className="w-5 h-5 text-yellow-400" />
                                      )}
                                      <div>
                                        <div className="text-white font-medium">Team Visibility</div>
                                        <div className="text-white/60 text-sm">
                                          {team.visibility === 'public' ? 'Anyone can see this team' : 'Invite-only team'}
                                        </div>
                                      </div>
                                    </div>
                                    <Switch
                                      checked={team.visibility === 'public'}
                                      onCheckedChange={(checked) => 
                                        handleUpdateTeamSettings(team.id, checked ? 'public' : 'private')
                                      }
                                    />
                                  </div>

                                  {/* Generate Invitation */}
                                  <div className="space-y-2">
                                    <Label>Team Invitations</Label>
                                    <Button 
                                      onClick={() => handleGenerateInvite(team.id)} 
                                      className="w-full"
                                      variant="outline"
                                    >
                                      <Mail className="w-4 h-4 mr-2" />
                                      Generate Invitation Link
                                    </Button>
                                    <p className="text-white/40 text-xs">
                                      Link will be copied to clipboard and can be shared anywhere
                                    </p>
                                  </div>

                                  {/* Leave Team (for non-admins) or Delete */}
                                  <Button
                                    variant="outline"
                                    className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                                    onClick={() => {
                                      handleLeaveTeam(team.id);
                                      setTeamSettingsDialogOpen(false);
                                    }}
                                  >
                                    Leave Team
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            )}
                          </div>

                          {team.role !== 'admin' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                              onClick={() => handleLeaveTeam(team.id)}
                            >
                              Leave
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Team Members Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Team Members</DialogTitle>
            <DialogDescription>
              {selectedTeam?.name} - {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white font-bold">
                      {member.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-white font-medium">{member.username}</div>
                    <div className="text-white/60 text-sm">{member.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={member.role === 'admin' ? 'default' : 'secondary'}
                    className={member.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/10 text-white/70'}
                  >
                    {member.role}
                  </Badge>
                  {selectedTeam?.role === 'admin' && member.role !== 'admin' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                      onClick={() => handleRemoveMember(selectedTeam.id, member.id, member.username)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
};

export default Social;
