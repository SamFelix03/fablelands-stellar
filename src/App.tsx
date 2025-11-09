import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Debugger from "./pages/Debugger.tsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/home" element={<Home />} />
      <Route path="/debug" element={<Debugger />} />
      <Route path="/debug/:contractName" element={<Debugger />} />
    </Routes>
  );
}

export default App;
