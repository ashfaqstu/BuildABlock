import React from "react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from 'react';
import { useStoryblokApi, storyblokEditable } from '@storyblok/react'; 


export default function Home() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  
    const storyblokApi = useStoryblokApi();
  
    // Fetch data from Storyblok
    useEffect(() => {
      const fetchData = async () => {
        try {
          // Fetch draft content if in preview mode, or published content for production
          const response = await storyblokApi.get('cdn/stories/home', {
            version: 'published',
            token: import.meta.env.VITE_STORYBLOK_TOKEN,
          });
          setContent(response.data.story.content);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching data from Storyblok:', error);
          setLoading(false);
        }
      };
      fetchData();
    }, [storyblokApi]);



  const bgUrl = content?.background?.filename || null;
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center h-screen">
      
      <img
        src={bgUrl}
        alt="Background"
        className="absolute inset-0 w-screen h-screen object-cover overflow-hidden  "
      />    
        

        <button
              onClick={() => navigate("/game")}
              className="px-6 py-2 mt-40 text-3xl z-10 font-semibold text-[#111111] bg-[#FAF1D8] border-[3px] border-[#111111] rounded-xl shadow-[6px_6px_0_#111111] transition-transform hover:scale-105 active:scale-95"
            >
              Start 
        </button>
        
    </div>
  );
}
