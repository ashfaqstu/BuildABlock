import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStoryblokApi } from "@storyblok/react";
import TargetCursor from "../components/Target";
import "../components/Target.css";

export default function Home() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);

  const storyblokApi = useStoryblokApi();
  const navigate = useNavigate();
  const audioRef = useRef(null);

  // Fetch data from Storyblok
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await storyblokApi.get("cdn/stories/home", {
          version: "published",
          token: import.meta.env.VITE_STORYBLOK_TOKEN,
        });
        setContent(response.data.story.content);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data from Storyblok:", error);
        setLoading(false);
      }
    };
    fetchData();
  }, [storyblokApi]);

  // Ensure autoplay on mount
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch((err) => {
        console.log("Autoplay might be blocked until user interacts:", err);
      });
    }
  }, []);

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const bgUrl = content?.background?.filename || null;

  return (
    <div className="flex items-center justify-center h-screen">
      <TargetCursor 
        spinDuration={2}
        hideDefaultCursor={true}
      />
      {/* Background image */}
      {bgUrl && (
        <img
          src={bgUrl}
          alt="Background"
          className="absolute inset-0 w-screen h-screen object-cover overflow-hidden"
        />
      )}

      {/* Background Music (autoplay + loop + starts muted) */}
      <audio ref={audioRef} src="/assets/sfx/bgm.mp3" autoPlay loop muted />

      {/* Mute/Unmute button */}
      <button
        onClick={toggleMute}
        className="cursor-target absolute top-4 right-4 z-20 px-3 py-2 text-sm font-bold text-[#111111] bg-[#FAF1D8] border-[2px] border-[#111111] rounded-lg shadow-[3px_3px_0_#111111] hover:scale-105 transition-transform"
      >
        {muted ? "Unmute 🔇" : "Mute 🔊"}
      </button>

      {/* Start button */}
      <button
        onClick={() => navigate("/game")}
        className="cursor-target px-6 py-2 mt-40 text-3xl z-10 font-semibold text-[#111111] bg-[#FAF1D8] border-[3px] border-[#111111] rounded-xl shadow-[6px_6px_0_#111111] transition-transform hover:scale-105 active:scale-95"
      >
        Start
      </button>
    </div>
  );
}
