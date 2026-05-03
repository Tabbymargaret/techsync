import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing.tsx';
import Login from './pages/Login.tsx';
import Register from './pages/Register.tsx';
import DashboardRedirect from './pages/DashboardRedirect.tsx';
import MentorDashboard from './pages/MentorDashboard.tsx';
import StudentDashboard from './pages/StudentDashboard.tsx';
import Profile from './pages/Profile.tsx';
import MentorsDirectory from './pages/MentorsDirectory.tsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/mentors" element={<MentorsDirectory />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['mentor']} />}>
        <Route path="/mentor-dashboard" element={<MentorDashboard />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route path="/student-dashboard" element={<StudentDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
