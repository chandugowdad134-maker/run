import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Plus, Users, Calendar, MapPin, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

interface Competition {
  id: number;
  name: string;
  visibility: string;
  scoring: string;
  starts_at: string;
  ends_at: string;
  member_count: number;
  created_by: number;
}

const Competitions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [myCompetitions, setMyCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const [newCompetition, setNewCompetition] = useState({
    name: '',
    visibility: 'public',
    scoring: 'territories',
    startsAt: '',
    endsAt: '',
  });

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const fetchCompetitions = async () => {
    try {
      setLoading(true);
      const [allResponse, myResponse] = await Promise.all([
        api.get('/competitions'),
        api.get('/competitions/my-competitions'),
      ]);

      setCompetitions(allResponse.competitions || []);
      setMyCompetitions(myResponse.competitions || []);
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
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">
                {competition.name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Users className="w-4 h-4" />
                <span>{competition.member_count || 0} participants</span>
              </div>
            </div>
          </div>
          {showJoin && (
            <Button
              size="sm"
              onClick={() => handleJoinCompetition(competition.id)}
            >
              Join
            </Button>
          )}
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
    </div>
  );
};

export default Competitions;
