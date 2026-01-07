import { motion } from "framer-motion";

const technologies = [
  { name: "React Native", category: "Mobile" },
  { name: "PostGIS", category: "Database" },
  { name: "Redis", category: "Cache" },
  { name: "WebSocket", category: "Realtime" },
  { name: "Strava API", category: "Integration" },
  { name: "ML Anti-Cheat", category: "Security" },
];

const TechStack = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {technologies.map((tech, index) => (
        <motion.div
          key={tech.name}
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          viewport={{ once: true }}
          className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4 text-center hover:border-primary/50 transition-all duration-300 group"
        >
          <p className="text-xs text-primary/70 uppercase tracking-wider mb-1 group-hover:text-primary transition-colors">
            {tech.category}
          </p>
          <p className="font-display text-sm text-foreground">{tech.name}</p>
        </motion.div>
      ))}
    </div>
  );
};

export default TechStack;
