import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Mail, Check, X, Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

interface Friend {
  id: number;
  email: string;
  username: string;
  avatar_url?: string;
  status: string;
}

interface Team {
  id: number;
  name: string;
  description?: string;
  role?: string;
  member_count: number;
  created_by: number;
  creator_name?: string;
}

const Social = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [friends, setFriends] = useState<Friend[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [friendDialogOpen, setFriendDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [friendsRes, teamsRes, myTeamsRes] = await Promise.all([
        api.get('/friends'),
        api.get('/teams'),
        api.get('/teams/my-teams'),
      ]);

      setFriends(friendsRes.data.friends || []);
      setTeams(teamsRes.data.teams || []);
      setMyTeams(myTeamsRes.data.teams || []);
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
        description: error.response?.data?.error || 'Failed to send friend request',
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
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to accept friend request',
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
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove friend',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTeam = async () => {
    try {
      if (!newTeam.name) {
        toast({
          title: 'Error',
          description: 'Team name is required',
          variant: 'destructive',
        });
        return;
      }

      await api.post('/teams', newTeam);

      toast({
        title: 'Success',
        description: 'Team created successfully!',
      });

      setTeamDialogOpen(false);
      setNewTeam({ name: '', description: '' });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create team',
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
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to join team',
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
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to leave team',
        variant: 'destructive',
      });
    }
  };

  const FriendCard = ({ friend }: { friend: Friend }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      <Card className="p-4 border-2 hover:border-primary/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {friend.username || friend.email}
              </h3>
              <p className="text-sm text-muted-foreground">{friend.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {friend.status === 'pending' ? (
              <>
                <Badge variant="secondary">Pending</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAcceptFriend(friend.id)}
                >
                  <Check className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Badge variant="default">Friend</Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRemoveFriend(friend.id)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );

  const TeamCard = ({ team, isMember = false }: { team: Team; isMember?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
    >
      <Card className="p-6 border-2 hover:border-primary/50 transition-colors">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">
                {team.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {team.member_count} members
              </p>
            </div>
          </div>
          {team.role && (
            <Badge variant="secondary" className="capitalize">
              {team.role}
            </Badge>
          )}
        </div>

        {team.description && (
          <p className="text-sm text-muted-foreground mb-4">{team.description}</p>
        )}

        <div className="flex gap-2">
          {isMember ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleLeaveTeam(team.id)}
              className="w-full"
            >
              Leave Team
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => handleJoinTeam(team.id)}
              className="w-full"
            >
              Join Team
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Users className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-lg text-foreground">
              Friends & Teams
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto p-4">
        <Tabs defaultValue="friends" className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={friendDialogOpen} onOpenChange={setFriendDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Friend
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Friend</DialogTitle>
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
                      <Mail className="w-4 h-4 mr-2" />
                      Send Request
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading friends...</p>
              </div>
            ) : friends.length === 0 ? (
              <Card className="p-12 text-center">
                <UserPlus className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No friends yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Add friends to compete and run together!
                </p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {friends.map((friend) => (
                  <FriendCard key={friend.id} friend={friend} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Users className="w-4 h-4 mr-2" />
                    Create Team
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Team</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="teamName">Team Name</Label>
                      <Input
                        id="teamName"
                        placeholder="Running Warriors"
                        value={newTeam.name}
                        onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="teamDesc">Description (Optional)</Label>
                      <Input
                        id="teamDesc"
                        placeholder="A team of passionate runners..."
                        value={newTeam.description}
                        onChange={(e) =>
                          setNewTeam({ ...newTeam, description: e.target.value })
                        }
                      />
                    </div>
                    <Button onClick={handleCreateTeam} className="w-full">
                      Create Team
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-6">
              {myTeams.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg text-foreground mb-3">My Teams</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {myTeams.map((team) => (
                      <TeamCard key={team.id} team={team} isMember={true} />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-lg text-foreground mb-3">All Teams</h3>
                {loading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading teams...</p>
                  </div>
                ) : teams.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No teams yet
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Create the first team and invite others!
                    </p>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {teams.map((team) => (
                      <TeamCard key={team.id} team={team} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Social;
