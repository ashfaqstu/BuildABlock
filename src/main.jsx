// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "./index.css";
import App from "./App.jsx";
import { storyblokInit, apiPlugin } from "@storyblok/react";

import Page from "./storyblok/Page";
import Teaser from "./storyblok/Teaser";
import Feature from "./storyblok/Feature";
import Home from "./Game/Home"; // Storyblok 'home' component
import Grid from "./storyblok/Grid";


// Pages
import Game from "./Game/Game";         // Storyblok 'game' component
import Platformer from "./Game/Blok.jsx"; // Your actual playable page at /game

// --- Storyblok init ---
storyblokInit({
  accessToken: import.meta.env.STORYBLOK_DELIVERY_API_TOKEN,
  apiOptions: {
    region: "eu",
    endpoint: import.meta.env.STORYBLOK_API_BASE_URL
      ? `${new URL(import.meta.env.STORYBLOK_API_BASE_URL).origin}/v2`
      : undefined,
  },
  use: [apiPlugin],
  components: {
    page: Page,
    teaser: Teaser,
    feature: Feature,
    grid: Grid,
    game: Platformer,
    home: Home,
  },
});

// --- Router ---
// /game -> Platformer
// everything else -> App (your Storyblok-driven app)
const router = createBrowserRouter([
  { path: "/game", Component: Platformer },
  { path: "/*", Component: App },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
