import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Edit2, Save, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');

  const handleSave = () => {
    if (username.trim()) {
      updateProfile({ username: username.trim() });
      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved.',
      });
      setIsEditing(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-semibold text-foreground">Profile</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (isEditing ? setIsEditing(false) : setIsEditing(true))}
          >
            {isEditing ? <X className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Avatar Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center"
        >
          <div className="relative">
            <Avatar className="w-24 h-24 border-4 border-primary/30">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-gradient-cyber text-primary-foreground text-2xl font-display">
                {getInitials(user?.username || 'U')}
              </AvatarFallback>
            </Avatar>
            {isEditing && (
              <Button
                size="icon"
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary"
              >
                <Camera className="w-4 h-4" />
              </Button>
            )}
          </div>
          {!isEditing && (
            <h2 className="mt-4 text-xl font-display font-bold text-foreground">
              {user?.username}
            </h2>
          )}
          <p className="text-muted-foreground text-sm">{user?.email}</p>
        </motion.div>

        {/* Edit Form */}
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-muted/50"
              />
            </div>
            <Button
              className="w-full bg-gradient-cyber"
              onClick={handleSave}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </motion.div>
        )}

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-6"
        >
          <h3 className="text-lg font-display font-semibold text-foreground mb-4">
            Your Stats
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <p className="text-3xl font-display font-bold text-gradient-territory">
                {user?.stats?.territories_owned || 0}
              </p>
              <p className="text-sm text-muted-foreground">Territories Captured</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <p className="text-3xl font-display font-bold text-gradient-cyber">
                {user?.stats?.total_distance_km?.toFixed?.(1) || 0}
              </p>
              <p className="text-sm text-muted-foreground">km Total Distance</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <p className="text-3xl font-display font-bold text-accent">
                {user?.stats?.currentStreak || 0}
              </p>
              <p className="text-sm text-muted-foreground">Day Streak</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 text-center">
              <p className="text-3xl font-display font-bold text-secondary">
                #{user?.stats?.rank || '-'}
              </p>
              <p className="text-sm text-muted-foreground">Global Rank</p>
            </div>
          </div>
        </motion.div>

        {/* Account Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl p-6"
        >
          <h3 className="text-lg font-display font-semibold text-foreground mb-4">
            Account Info
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Email</span>
              <span className="text-foreground">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Member since</span>
              <span className="text-foreground">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : '-'}
              </span>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Profile;
