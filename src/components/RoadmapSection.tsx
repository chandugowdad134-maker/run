import { motion } from "framer-motion";
import { Check, Clock, Rocket } from "lucide-react";

const roadmapPhases = [
  {
    phase: "Phase 1",
    title: "Foundation",
    duration: "Month 1-2",
    status: "current",
    items: [
      "Core GPS tracking engine",
      "PostGIS polygon storage",
      "Basic territory capture logic",
      "User authentication system",
    ],
  },
  {
    phase: "Phase 2",
    title: "Competition",
    duration: "Month 3-4",
    status: "upcoming",
    items: [
      "Real-time leaderboards",
      "Territory stealing mechanics",
      "Anti-cheat ML model v1",
      "Push notifications",
    ],
  },
  {
    phase: "Phase 3",
    title: "Integration",
    duration: "Month 5",
    status: "upcoming",
    items: [
      "Strava sync",
      "Garmin Connect",
      "Apple HealthKit",
      "Local Battles mode",
    ],
  },
  {
    phase: "Phase 4",
    title: "Scale",
    duration: "Month 6",
    status: "upcoming",
    items: [
      "Private Lobbies",
      "Team competitions",
      "Global events",
      "Public beta launch",
    ],
  },
];

const RoadmapSection = () => {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[50%] top-0 bottom-0 w-px bg-gradient-to-b from-primary via-accent to-territory-pink hidden lg:block" />
      
      <div className="space-y-12">
        {roadmapPhases.map((phase, index) => (
          <motion.div
            key={phase.phase}
            initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className={`flex flex-col lg:flex-row items-center gap-8 ${
              index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
            }`}
          >
            <div className={`flex-1 ${index % 2 === 0 ? "lg:text-right" : "lg:text-left"}`}>
              <div className={`bg-gradient-card border-glow rounded-2xl p-6 ${
                phase.status === "current" ? "border-primary" : ""
              }`}>
                <div className="flex items-center gap-3 mb-4 justify-between">
                  <div>
                    <span className="text-xs text-primary font-display uppercase tracking-wider">
                      {phase.phase}
                    </span>
                    <h3 className="font-display text-xl text-foreground">{phase.title}</h3>
                  </div>
                  <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {phase.duration}
                  </span>
                </div>
                
                <ul className="space-y-2">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      {phase.status === "current" ? (
                        <Clock className="w-4 h-4 text-primary" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                      )}
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            {/* Center dot */}
            <div className={`hidden lg:flex w-12 h-12 rounded-full items-center justify-center z-10 ${
              phase.status === "current" 
                ? "bg-gradient-cyber shadow-neon" 
                : "bg-muted border border-border"
            }`}>
              {phase.status === "current" ? (
                <Rocket className="w-5 h-5 text-primary-foreground" />
              ) : (
                <Clock className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex-1" />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default RoadmapSection;
