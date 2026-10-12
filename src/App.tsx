import { lazy, Suspense, type ComponentType } from 'react';
import { Route, Routes } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import NotFoundPage from '@/pages/NotFoundPage';
import LoadingState from '@/components/common/LoadingState';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Applications = lazy(() => import('@/pages/Applications'));
const Vulnerabilities = lazy(() => import('@/pages/Vulnerabilities'));
const UploadApplication = lazy(() => import('@/pages/UploadApplication'));
const ScanHistory = lazy(() => import('@/pages/ScanHistory'));
const ActiveScan = lazy(() => import('@/pages/ActiveScan'));
const ApplicationDetails = lazy(() => import('@/pages/ApplicationDetails'));
const VulnerabilityDetails = lazy(() => import('@/pages/VulnerabilityDetails'));
const Reports = lazy(() => import('@/pages/Reports'));
const ApiSecurity = lazy(() => import('@/pages/ApiSecurity'));
const DynamicAnalysis = lazy(() => import('@/pages/DynamicAnalysis'));
const ReverseEngineering = lazy(() => import('@/pages/ReverseEngineering'));
const Owasp = lazy(() => import('@/pages/Owasp'));
const Settings = lazy(() => import('@/pages/Settings'));
const Login = lazy(() => import('@/pages/Login'));

const page = (Component: ComponentType) => <Suspense fallback={<LoadingState label="Loading page…"/>}><Component/></Suspense>;

const placeholderRoutes = [
  ['api-security', ApiSecurity], ['dynamic-analysis', DynamicAnalysis],
  ['reverse-engineering', ReverseEngineering], ['owasp', Owasp], ['settings', Settings],
] as const;

export default function App() {
  return <Routes>
    <Route path="login" element={page(Login)}/>
    <Route element={<AppLayout/>}>
      <Route index element={page(Dashboard)}/>
      <Route path="applications" element={page(Applications)}/>
      <Route path="application/:id" element={page(ApplicationDetails)}/>
      <Route path="upload" element={page(UploadApplication)}/>
      <Route path="active-scan" element={page(ActiveScan)}/>
      <Route path="scans" element={page(ScanHistory)}/>
      <Route path="vulnerabilities" element={page(Vulnerabilities)}/>
      <Route path="vulnerability/:id" element={page(VulnerabilityDetails)}/>
      <Route path="reports" element={page(Reports)}/>
      {placeholderRoutes.map(([path, Page]) => <Route key={path} path={path} element={page(Page)} />)}
    </Route>
    <Route path="*" element={<NotFoundPage/>}/>
  </Routes>;
}
