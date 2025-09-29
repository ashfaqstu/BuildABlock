import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStoryblokApi } from "@storyblok/react";
import TargetCursor from "../components/Target";
import "../components/Target.css";
import GameHome from "../components/GameHome.jsx";
import logo from "/assets/img/logos.png";

export default function Home() {
  return (
    <>
    <TargetCursor 
        spinDuration={2}
        hideDefaultCursor={true}
      />
    <GameHome
    to="/game" 
     
      audioSrc="/assets/sfx/bgm.mp3"                  
      logoSrc={logo}                         
    />
    </>
  );
}
