import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Error catcher
window.addEventListener('error', (e) => {
  console.error('Error:', e.error);
  document.body.innerHTML += '<div style="color:red;padding:10px;background:white">ERROR: ' + e.error?.message + '</div>';
});

// document.body.innerHTML = '<h1 style="color:red;text-align:center;padding:20px">TEST: main.tsx LOADED</h1>' + document.body.innerHTML;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)