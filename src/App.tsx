import { AdminPage } from './pages/AdminPage';
import { LandingPage } from './pages/LandingPage';
import { StudentExamPage } from './pages/StudentExamPage';
import { useSpaRouter } from './utils/router';

// Admin access is intentionally separated from the student exam interface.
// Admin panel tidak ditautkan dari halaman ujian siswa.

export default function App() {
  const { route, navigate } = useSpaRouter();

  if (route.page === 'admin') {
    return <AdminPage onNavigate={navigate} />;
  }

  if (route.page === 'exam') {
    return <StudentExamPage encodedConfig={route.encodedConfig} />;
  }

  return <LandingPage onNavigate={navigate} />;
}
