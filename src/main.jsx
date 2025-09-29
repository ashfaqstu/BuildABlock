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
import Home from "./Game/Home"; 
import Grid from "./storyblok/Grid";



import Game from "./Game/Game";         


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
    game: Game,
    home: Home,
  },
});

// --- Router ---

const router = createBrowserRouter([
  { path: "/game", Component: Game },
  { path: "/*", Component: App },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
