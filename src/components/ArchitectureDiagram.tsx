import { motion } from "framer-motion";

const ArchitectureDiagram = () => {
  return (
    <div className="bg-gradient-card rounded-2xl border-glow p-8 overflow-hidden">
      <svg viewBox="0 0 900 500" className="w-full h-auto">
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(180 100% 50% / 0.05)" strokeWidth="1"/>
          </pattern>
          <linearGradient id="nodeGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(180 100% 50%)" />
            <stop offset="100%" stopColor="hsl(280 100% 60%)" />
          </linearGradient>
          <linearGradient id="nodeGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(24 100% 55%)" />
            <stop offset="100%" stopColor="hsl(330 100% 60%)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect width="900" height="500" fill="url(#grid)" />
        
        {/* Connections */}
        <g stroke="hsl(180 100% 50% / 0.3)" strokeWidth="2" fill="none">
          <motion.path
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            transition={{ duration: 1.5 }}
            d="M 150 250 L 300 150"
          />
          <motion.path
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: 0.2 }}
            d="M 150 250 L 300 250"
          />
          <motion.path
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: 0.4 }}
            d="M 150 250 L 300 350"
          />
          <motion.path
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: 0.6 }}
            d="M 400 150 L 550 200"
          />
          <motion.path
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: 0.8 }}
            d="M 400 250 L 550 200"
          />
          <motion.path
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: 1 }}
            d="M 400 350 L 550 300"
          />
          <motion.path
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: 1.2 }}
            d="M 650 200 L 800 250"
          />
          <motion.path
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: 1.4 }}
            d="M 650 300 L 800 250"
          />
        </g>
        
        {/* Nodes */}
        <g filter="url(#glow)">
          {/* Mobile Client */}
          <motion.g initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
            <rect x="50" y="200" width="100" height="100" rx="12" fill="url(#nodeGradient1)" />
            <text x="100" y="240" textAnchor="middle" fill="white" fontSize="11" fontFamily="Orbitron">Mobile</text>
            <text x="100" y="260" textAnchor="middle" fill="white" fontSize="11" fontFamily="Orbitron">Client</text>
            <text x="100" y="285" textAnchor="middle" fill="white" fontSize="9" opacity="0.7">React Native</text>
          </motion.g>
          
          {/* API Gateway */}
          <motion.g initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <rect x="250" y="100" width="150" height="80" rx="12" fill="hsl(222 47% 15%)" stroke="hsl(180 100% 50% / 0.5)" strokeWidth="2" />
            <text x="325" y="135" textAnchor="middle" fill="hsl(180 100% 50%)" fontSize="11" fontFamily="Orbitron">API Gateway</text>
            <text x="325" y="160" textAnchor="middle" fill="hsl(215 20% 55%)" fontSize="9">Load Balancing + Auth</text>
          </motion.g>
          
          {/* Realtime Service */}
          <motion.g initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <rect x="250" y="210" width="150" height="80" rx="12" fill="hsl(222 47% 15%)" stroke="hsl(280 100% 60% / 0.5)" strokeWidth="2" />
            <text x="325" y="245" textAnchor="middle" fill="hsl(280 100% 60%)" fontSize="11" fontFamily="Orbitron">WebSocket</text>
            <text x="325" y="270" textAnchor="middle" fill="hsl(215 20% 55%)" fontSize="9">Real-time Updates</text>
          </motion.g>
          
          {/* Anti-Cheat */}
          <motion.g initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.4 }}>
            <rect x="250" y="320" width="150" height="80" rx="12" fill="hsl(222 47% 15%)" stroke="hsl(330 100% 60% / 0.5)" strokeWidth="2" />
            <text x="325" y="355" textAnchor="middle" fill="hsl(330 100% 60%)" fontSize="11" fontFamily="Orbitron">Anti-Cheat</text>
            <text x="325" y="380" textAnchor="middle" fill="hsl(215 20% 55%)" fontSize="9">ML Validation</text>
          </motion.g>
          
          {/* PostGIS */}
          <motion.g initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.5 }}>
            <rect x="500" y="150" width="150" height="100" rx="12" fill="url(#nodeGradient2)" />
            <text x="575" y="190" textAnchor="middle" fill="white" fontSize="11" fontFamily="Orbitron">PostGIS</text>
            <text x="575" y="210" textAnchor="middle" fill="white" fontSize="9" opacity="0.7">Territory Data</text>
            <text x="575" y="230" textAnchor="middle" fill="white" fontSize="9" opacity="0.7">Polygon Storage</text>
          </motion.g>
          
          {/* Redis */}
          <motion.g initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.6 }}>
            <rect x="500" y="270" width="150" height="80" rx="12" fill="hsl(222 47% 15%)" stroke="hsl(24 100% 55% / 0.5)" strokeWidth="2" />
            <text x="575" y="305" textAnchor="middle" fill="hsl(24 100% 55%)" fontSize="11" fontFamily="Orbitron">Redis</text>
            <text x="575" y="330" textAnchor="middle" fill="hsl(215 20% 55%)" fontSize="9">Leaderboard Cache</text>
          </motion.g>
          
          {/* Integrations */}
          <motion.g initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.7 }}>
            <rect x="700" y="190" width="150" height="120" rx="12" fill="hsl(222 47% 15%)" stroke="hsl(180 100% 50% / 0.3)" strokeWidth="2" />
            <text x="775" y="225" textAnchor="middle" fill="hsl(180 100% 50%)" fontSize="11" fontFamily="Orbitron">Integrations</text>
            <text x="775" y="255" textAnchor="middle" fill="hsl(215 20% 55%)" fontSize="9">Strava API</text>
            <text x="775" y="275" textAnchor="middle" fill="hsl(215 20% 55%)" fontSize="9">Garmin Connect</text>
            <text x="775" y="295" textAnchor="middle" fill="hsl(215 20% 55%)" fontSize="9">Apple HealthKit</text>
          </motion.g>
        </g>
      </svg>
    </div>
  );
};

export default ArchitectureDiagram;
