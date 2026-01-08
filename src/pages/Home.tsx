import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, User, Rss, Calendar, BarChart3, Play, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import RealTerritoryMap from '@/components/RealTerritoryMap';
import BottomNavigation from '@/components/BottomNavigation';

type MapFilter = 'mine' | 'friends' | 'present';

const Home = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<MapFilter>('present');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filterOptions: { id: MapFilter; label: string; color: string }[] = [
    { id: 'mine', label: 'Mine', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    { id: 'friends', label: 'Friends', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
    { id: 'present', label: 'Present', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
  ];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Full Screen Map */}
      <div className="flex-1 relative">
        <RealTerritoryMap 
          showRuns={true} 
          filter={activeFilter}
        />
        
        {/* Floating Map Sub-Menu (Top Center) */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 z-[900] flex gap-1 bg-black/70 backdrop-blur-xl rounded-full px-2 py-1.5 border border-white/10"
          style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          {filterOptions.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeFilter === filter.id
                  ? filter.color + ' border'
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Start Run FAB - removed, now in nav */}
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Home;
