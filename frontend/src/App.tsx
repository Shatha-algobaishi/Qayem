import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './app/store';
import AppRouter from './router/AppRouter';
import './assets/styles/globals.css';

// index.html hard-codes lang="ar" dir="rtl" as the initial paint; keep the
// <html> attributes in sync with the language toggle from here on, since
// several components (e.g. Badge) and the page's own text direction read
// document.documentElement rather than Redux state.
function DocumentLangSync() {
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const { locale, direction } = store.getState().ui;
      document.documentElement.lang = locale;
      document.documentElement.dir = direction;
    });
    const { locale, direction } = store.getState().ui;
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    return unsubscribe;
  }, []);
  return null;
}

export default function App() {
  return (
    <Provider store={store}>
      <DocumentLangSync />
      <AppRouter />
    </Provider>
  );
}
