import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Loader2, Users, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const Invite = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [success, setSuccess] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      // Redirect to login with return URL
      navigate(`/login?redirect=/invite/${code}`);
      return;
    }

    // Auto-join the team
    handleJoinTeam();
  }, [user, code]);

  const handleJoinTeam = async () => {
    try {
      setJoining(true);
      const response = await api.post('/teams/join-by-invite', {
        invitationCode: code
      });

      setSuccess(true);
      setTeamName(response.message || 'the team');

      toast({
        title: 'Success! 🎉',
        description: response.message || 'You\'ve joined the team!',
      });

      // Redirect to social page after 2 seconds
      setTimeout(() => {
        navigate('/social');
      }, 2000);
    } catch (error: any) {
      const message = getApiErrorMessage(
        error,
        'Failed to join team. The invitation may be invalid or expired.'
      );

      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setJoining(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-xl border-white/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-white/60 mx-auto mb-4 animate-spin" />
              <p className="text-white/80">Redirecting to login...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader className="text-center">
            {success ? (
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
            ) : error ? (
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <Shield className="w-10 h-10 text-red-400" />
              </div>
            ) : (
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Shield className="w-10 h-10 text-purple-400" />
              </div>
            )}
            <CardTitle className="text-white text-2xl">
              {success ? 'Welcome to the Team!' : error ? 'Invitation Error' : 'Joining Team...'}
            </CardTitle>
            <CardDescription className="text-white/60">
              {success
                ? `Successfully joined ${teamName}`
                : error
                ? error
                : 'Processing your team invitation'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {joining && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              </div>
            )}

            {success && (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                  <Users className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-white/90 text-sm">
                    Redirecting to your teams...
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/social')}
                  className="w-full bg-purple-500 hover:bg-purple-600"
                >
                  Go to Teams
                </Button>
              </div>
            )}

            {error && (
              <div className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-white/80 text-sm text-center">
                    This invitation link may be invalid, expired, or you may already be a member of this team.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate('/social')}
                    variant="outline"
                    className="flex-1 border-white/20 text-white hover:bg-white/10"
                  >
                    View Teams
                  </Button>
                  <Button
                    onClick={() => navigate('/')}
                    className="flex-1 bg-purple-500 hover:bg-purple-600"
                  >
                    Go Home
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Invite;
