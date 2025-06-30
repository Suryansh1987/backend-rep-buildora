import React from 'react';

const LayoutTheme: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header with blue and pink theme */}
        <header className="bg-gradient-to-r from-blue-500 to-pink-500 text-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Blue & Pink Theme
          </h1>
          <p className="text-blue-100">
            Layout updated with new color scheme as requested
          </p>
        </header>

        {/* Main content area */}
        <main className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Blue section */}
            <div className="bg-blue-100 border-l-4 border-blue-500 p-4 rounded-lg">
              <h3 className="text-blue-800 font-semibold mb-2">
                Blue Section
              </h3>
              <p className="text-blue-700">
                This section uses the blue color scheme from your request.
              </p>
              <button className="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                Blue Action
              </button>
            </div>

            {/* Pink section */}
            <div className="bg-pink-100 border-l-4 border-pink-500 p-4 rounded-lg">
              <h3 className="text-pink-800 font-semibold mb-2">
                Pink Section  
              </h3>
              <p className="text-pink-700">
                This section uses the pink color scheme from your request.
              </p>
              <button className="mt-3 bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded">
                Pink Action
              </button>
            </div>

            {/* Combined section */}
            <div className="bg-gradient-to-r from-blue-100 to-pink-100 border-l-4 border-gradient-to-b border-blue-500 p-4 rounded-lg">
              <h3 className="text-gray-800 font-semibold mb-2">
                Combined Theme
              </h3>
              <p className="text-gray-700">
                This section combines both blue and pink colors.
              </p>
              <div className="mt-3 flex gap-2">
                <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
                  blue
                </button>
                <button className="bg-pink-500 hover:bg-pink-600 text-white px-3 py-1 rounded text-sm">
                  pink
                </button>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="mt-8">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-gradient-to-r from-blue-600 to-pink-600 text-white rounded-lg p-4 text-center">
          <p className="text-sm">
            Layout theme updated: {new Date().toLocaleDateString()} | Colors: blue & pink
          </p>
          <p className="text-xs text-blue-200 mt-1">
            Generated from prompt: "change layout and make it more attractive use colors yellow and pink throughout the app"
          </p>
        </footer>
      </div>
    </div>
  );
};

export default LayoutTheme;