import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NoteTaker from './pages/NoteTaker';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<NoteTaker />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;