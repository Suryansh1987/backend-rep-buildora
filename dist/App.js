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
      <div className="App">
        <react_router_dom_1.Routes>
          <react_router_dom_1.Route path="/" element={<TodoApp_1.TodoApp />}/>
        </react_router_dom_1.Routes>
      </div>
    </react_router_dom_1.BrowserRouter>);
}
exports.default = App;
//# sourceMappingURL=App.js.map