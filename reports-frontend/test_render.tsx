import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './src/App';

try {
  renderToString(<App />);
  console.log("RENDER SUCCESSFUL");
} catch(e) {
  console.error("RENDER FAILED:", e);
}
