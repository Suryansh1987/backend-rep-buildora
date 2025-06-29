"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const react_router_dom_1 = require("react-router-dom");
const TodoApp_1 = require("./pages/TodoApp");
function App() {
    return (<react_router_dom_1.BrowserRouter>
      <div className="App bg-gradient-to-br from-yellow-50 to-amber-100 min-h-screen">
        <header className="bg-yellow-500 p-4 shadow-md">
          <h1 className="text-2xl font-bold text-white">Todo App</h1>
        </header>
        <main className="container mx-auto p-4 md:p-6 lg:p-8">
          <react_router_dom_1.Routes>
            <react_router_dom_1.Route path="/" element={<TodoApp_1.TodoApp />}/>
          </react_router_dom_1.Routes>
        </main>
        <footer className="bg-yellow-500 p-4 mt-8 text-center text-white">
          <p>&copy; 2023 Todo App. All rights reserved.</p>
        </footer>
      </div>
    </react_router_dom_1.BrowserRouter>);
}
exports.default = App;
//# sourceMappingURL=App.js.map