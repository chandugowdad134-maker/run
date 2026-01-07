import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: "cyber" | "territory" | "pink";
  delay?: number;
}

const gradientClasses = {
  cyber: "from-primary/20 to-secondary/20 border-primary/30",
  territory: "from-accent/20 to-territory-pink/20 border-accent/30",
  pink: "from-territory-pink/20 to-secondary/20 border-territory-pink/30",
};

const iconGradients = {
  cyber: "bg-gradient-cyber",
  territory: "bg-gradient-territory",
  pink: "from-territory-pink to-secondary bg-gradient-to-br",
};

const FeatureCard = ({ icon: Icon, title, description, gradient, delay = 0 }: FeatureCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      viewport={{ once: true }}
      className={`relative group p-6 rounded-2xl bg-gradient-to-br ${gradientClasses[gradient]} border backdrop-blur-sm hover:scale-[1.02] transition-all duration-300`}
    >
      <div className={`w-12 h-12 rounded-xl ${iconGradients[gradient]} flex items-center justify-center mb-4 shadow-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      
      <h3 className="font-display text-lg text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      
      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-white/5 to-transparent" />
    </motion.div>
  );
};

export default FeatureCard;
