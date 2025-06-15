import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { type AppProps } from './App.tsx'

const root: HTMLElement = document.querySelector('#root')!;
const dataset: AppProps = root.dataset;

createRoot(root).render(
  <StrictMode>
    <App {...dataset}/>
  </StrictMode>,
)
