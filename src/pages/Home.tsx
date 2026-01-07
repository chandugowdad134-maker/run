import { motion } from 'framer-motion';
import { MapPin, Trophy, Flame, Map, Settings, LogOut, User, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import RealTerritoryMap from '@/components/RealTerritoryMap';
import Leaderboard from '@/components/Leaderboard';

const Home = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[1000] bg-card/90 backdrop-blur-xl border-b border-border px-4 py-3" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-lg text-foreground">
              TerritoryRun
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
              <User className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto px-4 py-6 space-y-6" style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))', paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-card border border-border rounded-2xl p-6"
        >
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">
            Welcome, {user?.username || 'Runner'}!
          </h1>
          <p className="text-muted-foreground">Ready to conquer new territories?</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-xl p-4 text-center"
          >
            <Trophy className="w-6 h-6 text-accent mx-auto mb-2" />
            <p className="text-2xl font-display font-bold text-foreground">
                {user?.stats?.territories_owned || 0}
            </p>
            <p className="text-xs text-muted-foreground">Territories</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-xl p-4 text-center"
          >
            <Map className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-display font-bold text-foreground">
              {user?.stats?.total_distance_km?.toFixed?.(1) || 0}
            </p>
            <p className="text-xs text-muted-foreground">km Run</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-xl p-4 text-center"
          >
            <Flame className="w-6 h-6 text-destructive mx-auto mb-2" />
            <p className="text-2xl font-display font-bold text-foreground">
              {user?.stats?.currentStreak || 0}
            </p>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </motion.div>
        </div>

        {/* Territory Map */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-2xl p-4"
        >
          <h2 className="text-lg font-display font-semibold text-foreground mb-4">
            Your Territory
          </h2>
          <div className="w-full rounded-xl overflow-hidden relative" style={{ height: 'calc(100vh - 24rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))', minHeight: '300px', maxHeight: '500px' }}>
            <RealTerritoryMap showRuns={true} />
          </div>
        </motion.div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Leaderboard />
        </motion.div>

        {/* Start Run Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            className="w-full bg-gradient-territory hover:opacity-90 text-accent-foreground font-display font-bold py-8 text-lg rounded-2xl shadow-territory"
            onClick={() => navigate('/run')}
          >
            <MapPin className="w-6 h-6 mr-2" />
            Start Conquering
          </Button>
        </motion.div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-[1000] bg-card/90 backdrop-blur-xl border-t border-border px-6 py-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-around">
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate('/')}
          >
            <Map className="w-5 h-5 text-primary" />
            <span className="text-xs text-primary">Map</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate('/competitions')}
          >
            <Trophy className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Compete</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate('/social')}
          >
            <Users className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Social</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate('/profile')}
          >
            <User className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Profile</span>
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default Home;
