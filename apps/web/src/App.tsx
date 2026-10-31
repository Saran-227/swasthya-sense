/**
 * Perfusion3D Wizard Application Root
 * Multimodal AI Hackathon 2026 - Track A: Cardiovascular Risk Visualization & Prediction
 */

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingLayout } from './components/layout/LandingLayout';
import { WizardLayout } from './components/layout/WizardLayout';
import { WelcomePage } from './pages/WelcomePage';
import { DataEntryPage } from './pages/DataEntryPage';
import { ReportsPage } from './pages/ReportsPage';
import { ModelInfoPage } from './pages/ModelInfoPage';
import { DesignSystemPage } from './pages/DesignSystemPage';
import { DashboardPage } from './pages/DashboardPage';
import { PatientProfilePage } from './pages/PatientProfilePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';

// Lazy-load pages
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const ResultsPage = React.lazy(() => import('./pages/ResultsPage'));

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          {/* OAuth Callback Handlers */}
          <Route path="/api/auth/callback/google" element={<AuthCallbackPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Standalone Landing Page (Task 2.1 - 2.2) */}
          <Route element={<LandingLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>

          {/* Patient Portal & Clinical Assessment Experience */}
          <Route element={<WizardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<PatientProfilePage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/enter-data" element={<DataEntryPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/model-info" element={<ModelInfoPage />} />
            <Route path="/design-system" element={<DesignSystemPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
