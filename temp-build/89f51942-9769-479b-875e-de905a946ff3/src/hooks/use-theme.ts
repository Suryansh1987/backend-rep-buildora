import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { CoursePage } from './pages/CoursePage';
import { CategoryPage } from './pages/CategoryPage';
import { ProfilePage } from './pages/ProfilePage';
import { DarkModeSwitch } from './components/DarkModeSwitch';

// Simulated data for courses
const fakeCourses = [
  { id: 1, title: 'React Fundamentals', category: 'Web Development' },
  { id: 2, title: 'Advanced JavaScript', category: 'Programming' },
  { id: 3, title: 'UI/UX Design Principles', category: 'Design' },
  // Add more fake courses as needed
];

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <Router>
        <div className="App flex flex-col min-h-screen bg-gradient-to-r from-blue-100 to-pink-100 transition-colors duration-300">
          <div className="fixed top-4 right-4 z-50">
            <DarkModeSwitch />
          </div>
          <div className="bg-blue-500 text-white py-2 text-center">
            <CountdownTimer eventDate="2023-12-31T23:59:59" />
          </div>
          <Navbar />
          <main className="flex-grow container mx-auto px-4 py-8 mt-16">
            <div className="bg-white dark:bg-blue-800 shadow-lg rounded-lg overflow-hidden">
              <Routes>
                <Route path="/" element={<HomePage courses={fakeCourses} />} />
                <Route path="/course/:id" element={<CoursePage />} />
                <Route path="/category/:category" element={<CategoryPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Routes>
            </div>
          </main>
          <Footer instagramLink="https://www.instagram.com/michelle_11918_/" />
        </div>
      </Router>
    </ThemeProvider>
  );
};

// Global styles for buttons
const globalStyles = `
  <style>
    button, .button {
      background-color: #3490dc !important;
      color: white !important;
      padding: 12px 24px !important;
      font-size: 1.1rem !important;
      border-radius: 8px !important;
      transition: all 0.3s ease !important;
    }
    button:hover, .button:hover {
      background-color: #2779bd !important;
      transform: scale(1.05) !important;
    }
  </style>
`;

// Inject global styles
document.head.insertAdjacentHTML('beforeend', globalStyles);

export default App;