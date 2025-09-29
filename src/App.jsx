import { Routes, Route } from "react-router-dom";
import Home from "./Game/Home";
import Game from "./Game/Game";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/game" element={<Game />} />
    </Routes>
  );
}
