import { GameProvider, useGame } from './store/GameContext';
import HomeScreen from './screens/HomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';

function Router() {
  const { state } = useGame();
  if (state.screen === 'lobby') return <LobbyScreen />;
  if (state.screen === 'game')  return <GameScreen />;
  return <HomeScreen />;
}

export default function App() {
  return (
    <GameProvider>
      <Router />
    </GameProvider>
  );
}
