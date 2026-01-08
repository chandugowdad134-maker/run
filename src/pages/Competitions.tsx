import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Plus, Users, Calendar, MapPin, ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { api, getApiErrorMessage } from '@/lib/api';
import BottomNavigation from '@/components/BottomNavigation';

interface Competition {
  id: number;
  name: string;
  visibility: string;
  scoring: string;
  is_team_based?: boolean;
  starts_at: string;
  ends_at: string;
  member_count: number;
  created_by: number;
}

interface Team {
  id: number;
  name: string;
  description?: string;
  member_count: number;
  role?: string;
}

interface TeamLeaderboardEntry {
  id: number;
  name: string;
  description?: string;
  member_count: number;
  total_score: number;
  total_distance: number;
  total_runs: number;
  territories_conquered: number;
}

const Competitions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [myCompetitions, setMyCompetitions] = useState<Competition[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [teamLeaderboard, setTeamLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [viewingCompetition, setViewingCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  
  const [newCompetition, setNewCompetition] = useState({
    name: '',
    visibility: 'public',
    scoring: 'territories',
    isTeamBased: false,
    startsAt: '',
    endsAt: '',
  });

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const fetchCompetitions = async () => {
    try {
      setLoading(true);
      const [allResponse, myResponse, teamsResponse] = await Promise.all([
        api.get('/competitions'),
        api.get('/competitions/my-competitions'),
        api.get('/teams/my-teams'),
      ]);

      setCompetitions(allResponse.competitions || []);
      setMyCompetitions(myResponse.competitions || []);
      setMyTeams(teamsResponse.teams || []);
    } catch (error) {
      console.error('Failed to fetch competitions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load competitions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompetition = async () => {
    try {
      if (!newCompetition.name) {
        toast({
          title: 'Error',
          description: 'Competition name is required',
          variant: 'destructive',
        });
        return;
      }

      await api.post('/competitions', newCompetition);

      toast({
        title: 'Success',
        description: 'Competition created successfully!',
      });

      setCreateDialogOpen(false);
      setNewCompetition({
        name: '',
        visibility: 'public',
        scoring: 'territories',
        isTeamBased: false,
        startsAt: '',
        endsAt: '',
      });
      fetchCompetitions();
    } catch (error) {
      console.error('Failed to create competition:', error);
      toast({
        title: 'Error',
        description: 'Failed to create competition',
        variant: 'destructive',
      });
    }
  };

  const handleJoinCompetition = async (competitionId: number) => {
    try {
      await api.post(`/competitions/${competitionId}/join`);

      toast({
        title: 'Success',
        description: 'Joined competition successfully!',
      });

      fetchCompetitions();
    } catch (error) {
      console.error('Failed to join competition:', error);
      toast({
        title: 'Error',
        description: 'Failed to join competition',
        variant: 'destructive',
      });
    }
  };

  const handleJoinTeamCompetition = async (competitionId: number, teamId: number) => {
    try {
      await api.post(`/competitions/${competitionId}/teams/${teamId}`);

      toast({
        title: 'Success',
        description: 'Team joined competition!',
      });

      setTeamDialogOpen(false);
      fetchCompetitions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to join team to competition'),
        variant: 'destructive',
      });
    }
  };

  const handleViewTeamLeaderboard = async (competition: Competition) => {
    try {
      const response = await api.get(`/competitions/${competition.id}/team-leaderboard`);
      setTeamLeaderboard(response.leaderboard || []);
      setViewingCompetition(competition);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(error, 'Failed to load team leaderboard'),
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date set';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const CompetitionCard = ({ competition, showJoin = false }: { competition: Competition; showJoin?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
    >
      <Card className="p-6 border-2 hover:border-primary/50 transition-colors">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              {competition.is_team_based ? (
                <Shield className="w-6 h-6 text-primary" />
              ) : (
                <Trophy className="w-6 h-6 text-primary" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg text-foreground">
                  {competition.name}
                </h3>
                {competition.is_team_based && (
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                    Team
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Users className="w-4 h-4" />
                <span>{competition.member_count || 0} {competition.is_team_based ? 'teams' : 'participants'}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {competition.is_team_based && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewTeamLeaderboard(competition)}
              >
                Standings
              </Button>
            )}
            {showJoin && (
              <>
                {competition.is_team_based ? (
                  <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        Join with Team
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Select Your Team</DialogTitle>
                        <DialogDescription>
                          Choose which team to join this competition with
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {myTeams.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4">
                            You need to be part of a team to join
                          </p>
                        ) : (
                          myTeams.map((team) => (
                            <Button
                              key={team.id}
                              variant="outline"
                              className="w-full justify-start"
                              onClick={() => handleJoinTeamCompetition(competition.id, team.id)}
                            >
                              <Shield className="w-4 h-4 mr-2" />
                              {team.name} ({team.member_count} members)
                            </Button>
                          ))
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleJoinCompetition(competition.id)}
                  >
                    Join
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground capitalize">{competition.visibility}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-foreground capitalize">{competition.scoring}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {formatDate(competition.starts_at)} - {formatDate(competition.ends_at)}
            </span>
          </div>
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
            <Trophy className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-lg text-foreground">
              Competitions
            </span>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Competition</DialogTitle>
                <DialogDescription>
                  Set up a new competition for you and your friends to compete in territory conquest.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">Competition Name</Label>
                  <Input
                    id="name"
                    placeholder="Summer Sprint Challenge"
                    value={newCompetition.name}
                    onChange={(e) =>
                      setNewCompetition({ ...newCompetition, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="visibility">Visibility</Label>
                  <Select
                    value={newCompetition.visibility}
                    onValueChange={(value) =>
                      setNewCompetition({ ...newCompetition, visibility: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="friends">Friends Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="scoring">Scoring Type</Label>
                  <Select
                    value={newCompetition.scoring}
                    onValueChange={(value) =>
                      setNewCompetition({ ...newCompetition, scoring: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="territories">Most Territories</SelectItem>
                      <SelectItem value="distance">Total Distance</SelectItem>
                      <SelectItem value="runs">Number of Runs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-medium">Team Competition</div>
                      <div className="text-sm text-muted-foreground">
                        Teams compete collectively instead of individuals
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={newCompetition.isTeamBased}
                    onCheckedChange={(checked) =>
                      setNewCompetition({ ...newCompetition, isTeamBased: checked })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="starts">Start Date</Label>
                  <Input
                    id="starts"
                    type="datetime-local"
                    value={newCompetition.startsAt}
                    onChange={(e) =>
                      setNewCompetition({ ...newCompetition, startsAt: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="ends">End Date</Label>
                  <Input
                    id="ends"
                    type="datetime-local"
                    value={newCompetition.endsAt}
                    onChange={(e) =>
                      setNewCompetition({ ...newCompetition, endsAt: e.target.value })
                    }
                  />
                </div>

                <Button onClick={handleCreateCompetition} className="w-full">
                  Create Competition
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto p-4">
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="all">All Competitions</TabsTrigger>
            <TabsTrigger value="mine">My Competitions</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading competitions...</p>
              </div>
            ) : competitions.length === 0 ? (
              <Card className="p-12 text-center">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No competitions yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Be the first to create a competition!
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Competition
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {competitions.map((competition) => (
                  <CompetitionCard
                    key={competition.id}
                    competition={competition}
                    showJoin={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading your competitions...</p>
              </div>
            ) : myCompetitions.length === 0 ? (
              <Card className="p-12 text-center">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  You haven't joined any competitions
                </h3>
                <p className="text-muted-foreground mb-4">
                  Join a competition to compete with other runners!
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {myCompetitions.map((competition) => (
                  <CompetitionCard key={competition.id} competition={competition} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Team Leaderboard Dialog */}
      <Dialog open={!!viewingCompetition} onOpenChange={() => setViewingCompetition(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Team Standings - {viewingCompetition?.name}</DialogTitle>
            <DialogDescription>
              Real-time rankings based on collective team performance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {teamLeaderboard.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No teams have joined yet</p>
              </div>
            ) : (
              teamLeaderboard.map((team, index) => (
                <div
                  key={team.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 font-bold text-primary">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground">{team.name}</h4>
                      {index === 0 && (
                        <Badge className="bg-yellow-500/20 text-yellow-400">
                          🏆 1st Place
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>{team.member_count} members</span>
                      <span>•</span>
                      <span>{team.total_distance.toFixed(1)} km</span>
                      <span>•</span>
                      <span>{team.total_runs} runs</span>
                      {viewingCompetition?.scoring === 'territories' && (
                        <>
                          <span>•</span>
                          <span>{team.territories_conquered} territories</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {viewingCompetition?.scoring === 'distance'
                        ? `${team.total_distance.toFixed(1)} km`
                        : viewingCompetition?.scoring === 'runs'
                        ? `${team.total_runs} runs`
                        : `${team.territories_conquered} zones`}
                    </div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
};

export default Competitions;
