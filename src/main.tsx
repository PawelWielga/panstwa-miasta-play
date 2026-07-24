import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppProvider } from './app/AppContext';
import './styles.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Brak elementu #root.');
createRoot(rootElement).render(<StrictMode><AppProvider><App /></AppProvider></StrictMode>);
