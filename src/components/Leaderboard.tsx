import { motion } from "framer-motion";
import { Crown, TrendingUp, MapPin, Zap } from "lucide-react";

// TODO: Replace with real data from /api/leaderboard endpoint
// const leaderboardData = [
//   { rank: 1, name: "SpeedDemon", territories: 47, km: 234.5, streak: 12, change: "up" },
//   { rank: 2, name: "RunnerKing", territories: 42, km: 198.2, streak: 8, change: "up" },
//   { rank: 3, name: "NightRunner", territories: 38, km: 176.8, streak: 15, change: "down" },
//   { rank: 4, name: "MarathonMike", territories: 35, km: 156.3, streak: 6, change: "up" },
//   { rank: 5, name: "TrailBlazer", territories: 31, km: 142.1, streak: 4, change: "same" },
// ];

const Leaderboard = () => {
  // TODO: Fetch real leaderboard data from API
  const leaderboardData = [];
  const isLoading = false;

  if (isLoading) {
    return (
      <div className="bg-gradient-card rounded-2xl border-glow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl text-foreground flex items-center gap-2">
            <Crown className="w-5 h-5 text-accent" />
            King of the Area
          </h3>
          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
            This Week
          </span>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  if (leaderboardData.length === 0) {
    return (
      <div className="bg-gradient-card rounded-2xl border-glow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl text-foreground flex items-center gap-2">
            <Crown className="w-5 h-5 text-accent" />
            King of the Area
          </h3>
          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
            This Week
          </span>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <Crown className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No leaderboard data available</p>
            <p className="text-xs mt-1">Start running to claim your territory!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-card rounded-2xl border-glow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-xl text-foreground flex items-center gap-2">
          <Crown className="w-5 h-5 text-accent" />
          King of the Area
        </h3>
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          This Week
        </span>
      </div>
      
      <div className="space-y-3">
        {leaderboardData.map((player, index) => (
          <motion.div
            key={player.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-300 hover:bg-white/5 ${
              index === 0 ? "bg-accent/10 border border-accent/30" : ""
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-display text-sm ${
              index === 0 
                ? "bg-gradient-territory text-white" 
                : index === 1 
                  ? "bg-gradient-cyber text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}>
              {player.rank}
            </div>
            
            <div className="flex-1">
              <p className="font-semibold text-foreground">@{player.name}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {player.territories} zones
                </span>
                <span>{player.km} km</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-accent bg-accent/10 px-2 py-1 rounded-md">
                <Zap className="w-3 h-3" />
                <span className="text-xs font-display">{player.streak}</span>
              </div>
              {player.change === "up" && (
                <TrendingUp className="w-4 h-4 text-green-400" />
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
