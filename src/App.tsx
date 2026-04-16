import { Routes, Route } from 'react-router-dom';
import { TrajectoryPage } from './pages/TrajectoryPage';
import { TreeBoostingPage } from './pages/TreeBoostingPage';
import { CombinedPage } from './pages/CombinedPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<TrajectoryPage />} />
      <Route path="/tree-boosting" element={<TreeBoostingPage />} />
      <Route path="/combined" element={<CombinedPage />} />
    </Routes>
  );
}
