import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, User, Rss, Calendar, BarChart3, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      id: 'profile',
      path: '/profile',
      icon: User,
      label: 'Me',
      color: 'text-muted-foreground',
    },
    {
      id: 'social',
      path: '/social',
      icon: Rss,
      label: 'Social',
      color: 'text-muted-foreground',
    },
    {
      id: 'home',
      path: '/',
      icon: MapPin,
      label: 'Map',
      color: 'text-primary',
      highlighted: true,
    },
    {
      id: 'run',
      path: '/run',
      icon: Navigation,
      label: 'Run',
      color: 'text-orange-500',
      highlighted: true,
    },
    {
      id: 'competitions',
      path: '/competitions',
      icon: Calendar,
      label: 'Events',
      color: 'text-muted-foreground',
    },
    {
      id: 'stats',
      path: '/stats',
      icon: BarChart3,
      label: 'Stats',
      color: 'text-muted-foreground',
    },
  ];

  // Don't show navigation on auth pages
  if (['/login', '/signup'].includes(location.pathname)) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[1000] bg-card/95 backdrop-blur-xl border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-end justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Button
              key={item.id}
              variant="ghost"
              className={`flex flex-col items-center gap-0.5 h-auto py-2 px-2 min-w-[50px] ${
                item.highlighted ? 'py-1 px-3 min-w-[55px] -mt-2' : ''
              }`}
              onClick={() => navigate(item.path)}
            >
              {item.highlighted ? (
                <div className={`rounded-full p-2 border-2 ${
                  item.id === 'home' ? 'bg-primary/20 border-primary' : 'bg-orange-500/20 border-orange-500'
                }`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
              ) : (
                <Icon className={`w-5 h-5 ${isActive ? item.color.replace('muted-', '') : item.color}`} />
              )}
              <span className={`text-[10px] ${
                item.highlighted ? `${item.color} font-medium` :
                isActive ? item.color.replace('muted-', '') : item.color
              }`}>
                {item.label}
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;