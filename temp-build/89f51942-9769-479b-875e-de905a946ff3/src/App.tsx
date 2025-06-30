import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TodoApp } from './pages/TodoApp';
import LayoutTheme from './components/LayoutTheme';

function App() {
  return (
    <LayoutTheme>
      <Router>
        <div className="App bg-gradient-to-r from-blue-100 to-pink-100">
          <Routes>
            <Route path="/" element={<TodoApp />} />
          </Routes>
        </div>
      </Router>
    </LayoutTheme>
  );
}

export default App;