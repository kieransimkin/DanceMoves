import React from 'react';import {createRoot} from 'react-dom/client';
import App from './App.jsx';import './demo.css';import '@kieransimkin/dancemoves/styles.css';
createRoot(document.getElementById('app')).render(<React.StrictMode><App/></React.StrictMode>);
