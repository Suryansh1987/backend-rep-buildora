import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TodoApp } from './pages/TodoApp';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<TodoApp />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;