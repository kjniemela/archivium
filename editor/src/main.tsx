import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from "react-router";
import App, { type AppProps } from './App.tsx';

const root: HTMLElement = document.querySelector('#root')!;
const dataset: AppProps = root.dataset as AppProps;

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App {...dataset}/>
    </BrowserRouter>
  </StrictMode>,
);
