import { motion } from "framer-motion";
import { MapPin, Users, Trophy, Shield, Zap, Globe, Smartphone, Database, Lock, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import RealTerritoryMap from "@/components/RealTerritoryMap";
import Leaderboard from "@/components/Leaderboard";
import FeatureCard from "@/components/FeatureCard";
import TechStack from "@/components/TechStack";
import RoadmapSection from "@/components/RoadmapSection";
import ArchitectureDiagram from "@/components/ArchitectureDiagram";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-cyber flex items-center justify-center shadow-neon">
              <MapPin className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl text-foreground">TerritoryRun</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-primary transition-colors">Features</a>
            <a href="#architecture" className="text-sm text-muted-foreground hover:text-primary transition-colors">Architecture</a>
            <a href="#roadmap" className="text-sm text-muted-foreground hover:text-primary transition-colors">Roadmap</a>
            <Button variant="outline" size="sm">Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero bg-grid-pattern" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        
        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-2 mb-6"
            >
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Gamified Running Experience</span>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-5xl md:text-7xl text-foreground mb-6 leading-tight"
            >
              Run. <span className="text-gradient-territory">Capture.</span>{" "}
              <span className="text-gradient-cyber">Dominate.</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Turn every run into a battle for territory. Capture zones, defend your ground, 
              and become the King of your Area in real-time GPS competitions.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button variant="hero" size="xl">
                <MapPin className="w-5 h-5" />
                Start Conquering
              </Button>
              <Button variant="glass" size="xl">
                View Demo
              </Button>
            </motion.div>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="h-[600px] rounded-3xl overflow-hidden border-2 border-primary/20">
              <RealTerritoryMap />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="text-primary font-display text-sm uppercase tracking-widest"
            >
              Features
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="font-display text-4xl md:text-5xl text-foreground mt-4"
            >
              Built for Competition
            </motion.h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={MapPin}
              title="Real-Time GPS Tracking"
              description="High-precision location updates create polygon territories as you run. Watch your zone expand in real-time."
              gradient="cyber"
              delay={0}
            />
            <FeatureCard
              icon={Trophy}
              title="King of the Area"
              description="Dynamic leaderboards track who controls the most territory. Battle for the crown in your neighborhood."
              gradient="territory"
              delay={0.1}
            />
            <FeatureCard
              icon={Zap}
              title="Territory Stealing"
              description="Run through opponents' zones to steal them. New runs overwrite existing territories for constant competition."
              gradient="pink"
              delay={0.2}
            />
            <FeatureCard
              icon={Shield}
              title="Anti-Cheat System"
              description="ML-powered detection for vehicle speeds and GPS spoofing ensures only legitimate runs count."
              gradient="cyber"
              delay={0.3}
            />
            <FeatureCard
              icon={Users}
              title="Local Battles & Lobbies"
              description="Create private competitions with friends or join local battles in your city."
              gradient="territory"
              delay={0.4}
            />
            <FeatureCard
              icon={Globe}
              title="Fitness Integrations"
              description="Sync with Strava, Garmin, and Apple Watch. Import runs from your favorite platforms."
              gradient="pink"
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* Leaderboard Preview */}
      <section className="py-20 relative bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                className="text-primary font-display text-sm uppercase tracking-widest"
              >
                Competition
              </motion.span>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="font-display text-4xl md:text-5xl text-foreground mt-4 mb-6"
              >
                Climb the <span className="text-gradient-territory">Ranks</span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-muted-foreground text-lg mb-8"
              >
                Real-time leaderboards powered by Redis show who dominates each area. 
                Track your streak, defend your zones, and climb to become the ultimate King of the Area.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-4"
              >
                <div className="bg-card border-glow rounded-xl px-6 py-4">
                  <p className="text-muted-foreground text-sm">Active Players</p>
                  <p className="font-display text-3xl text-primary glow-text">12.4K</p>
                </div>
                <div className="bg-card border-glow rounded-xl px-6 py-4">
                  <p className="text-muted-foreground text-sm">Territories</p>
                  <p className="font-display text-3xl text-accent glow-territory">847K</p>
                </div>
                <div className="bg-card border-glow rounded-xl px-6 py-4">
                  <p className="text-muted-foreground text-sm">Battles/Day</p>
                  <p className="font-display text-3xl text-territory-pink">23K</p>
                </div>
              </motion.div>
            </div>
            <Leaderboard />
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="py-20 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="text-primary font-display text-sm uppercase tracking-widest"
            >
              Technical Architecture
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="font-display text-4xl md:text-5xl text-foreground mt-4 mb-4"
            >
              Built to <span className="text-gradient-cyber">Scale</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground text-lg max-w-2xl mx-auto"
            >
              High-performance architecture designed for real-time GPS tracking, 
              polygon-based territory storage, and competitive multiplayer at scale.
            </motion.p>
          </div>
          
          <ArchitectureDiagram />
          
          <div className="mt-12">
            <h3 className="font-display text-xl text-foreground text-center mb-8">Recommended Tech Stack</h3>
            <TechStack />
          </div>
          
          {/* Technical Details Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="bg-gradient-card rounded-xl border-glow p-6"
            >
              <Smartphone className="w-8 h-8 text-primary mb-4" />
              <h4 className="font-display text-sm text-foreground mb-2">Mobile Client</h4>
              <p className="text-muted-foreground text-sm">
                React Native with MapboxGL for cross-platform GPS tracking and territory visualization.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-card rounded-xl border-glow p-6"
            >
              <Database className="w-8 h-8 text-accent mb-4" />
              <h4 className="font-display text-sm text-foreground mb-2">PostGIS Database</h4>
              <p className="text-muted-foreground text-sm">
                PostgreSQL + PostGIS for polygon storage. ST_Contains, ST_Intersection for territory logic.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-card rounded-xl border-glow p-6"
            >
              <Lock className="w-8 h-8 text-territory-pink mb-4" />
              <h4 className="font-display text-sm text-foreground mb-2">Anti-Cheat Engine</h4>
              <p className="text-muted-foreground text-sm">
                ML model analyzing speed patterns, acceleration, GPS accuracy to detect spoofing & vehicles.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-card rounded-xl border-glow p-6"
            >
              <Activity className="w-8 h-8 text-secondary mb-4" />
              <h4 className="font-display text-sm text-foreground mb-2">Fitness APIs</h4>
              <p className="text-muted-foreground text-sm">
                OAuth integration with Strava, Garmin Connect, Apple HealthKit for activity imports.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section id="roadmap" className="py-20 relative bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="text-primary font-display text-sm uppercase tracking-widest"
            >
              Development Timeline
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="font-display text-4xl md:text-5xl text-foreground mt-4 mb-4"
            >
              6-Month <span className="text-gradient-territory">Roadmap</span>
            </motion.h2>
          </div>
          
          <RoadmapSection />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="bg-gradient-card rounded-3xl border-glow p-12 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-grid-pattern opacity-30" />
            <div className="relative">
              <h2 className="font-display text-4xl md:text-5xl text-foreground mb-6">
                Ready to <span className="text-gradient-cyber">Conquer</span>?
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
                Join the next generation of competitive running. Every step counts. Every territory matters.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button variant="hero" size="xl">
                  <MapPin className="w-5 h-5" />
                  Launch App
                </Button>
                <Button variant="outline" size="xl">
                  View Documentation
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-cyber flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg text-foreground">TerritoryRun</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 TerritoryRun. Gamified GPS Running Platform.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
