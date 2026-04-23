import { AppRouter } from './app/AppRouter';
import { AppProviders } from './app/providers/AppProviders';

function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}

export default App;
