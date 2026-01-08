import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useSync } from "@/hooks/useSync";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Home from "@/pages/Home";
import Profile from "@/pages/Profile";
import ActiveRun from "@/pages/ActiveRun";
import Competitions from "@/pages/Competitions";
import Social from "@/pages/Social";
import Stats from "@/pages/Stats";
import RunDetails from "@/pages/RunDetails";
import Invite from "@/pages/Invite";
import Team from "@/pages/Team";
import PrivacyZones from "@/pages/PrivacyZones";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

// Request location permission on app startup for instant map centering
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      console.log('Location acquired:', position.coords.latitude, position.coords.longitude);
      // Store in sessionStorage for immediate access across components
      sessionStorage.setItem('last_location', JSON.stringify({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: Date.now()
      }));
    },
    (error) => {
      console.log('Location request:', error.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    }
  );
}

const AppContent = () => {
  useSync(); // Enable automatic sync

  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/run"
            element={
              <ProtectedRoute>
                <ActiveRun />
              </ProtectedRoute>
            }
          />
          <Route
            path="/run/:id"
            element={
              <ProtectedRoute>
                <RunDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/competitions"
            element={
              <ProtectedRoute>
                <Competitions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/social"
            element={
              <ProtectedRoute>
                <Social />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <Stats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invite/:code"
            element={
              <ProtectedRoute>
                <Invite />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team/:teamId"
            element={
              <ProtectedRoute>
                <Team />
              </ProtectedRoute>
            }
          />
          <Route
            path="/privacy-zones"
            element={
              <ProtectedRoute>
                <PrivacyZones />
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
