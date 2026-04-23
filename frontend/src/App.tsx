import { Routes, Route, Navigate } from 'react-router-dom';
import { PartyProvider } from './context/PartyContext';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Player from './pages/Player';
import Podium from './pages/Podium';

export default function App() {
  return (
    <PartyProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/party/:partyId/lobby" element={<Lobby />} />
        <Route path="/party/:partyId/play" element={<Player />} />
        <Route path="/party/:partyId/podium" element={<Podium />} />
        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PartyProvider>
  );
}
