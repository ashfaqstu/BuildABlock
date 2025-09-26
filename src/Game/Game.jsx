import { useState, useEffect } from 'react';
import { useStoryblokApi, storyblokEditable } from '@storyblok/react'; 
import { storyblokInit, useStoryblokBridge } from '@storyblok/js';

export default function Game({ blok }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  const storyblokApi = useStoryblokApi();

  // Fetch data from Storyblok
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch draft content if in preview mode, or published content for production
        const response = await storyblokApi.get('cdn/stories/game', {
          version: import.meta.env.VITE_STORYBLOK_IS_PREVIEW === 'true' ? 'draft' : 'published',
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

  // Sync with Storyblok Visual Editor once content is available
  if (loading) {
    return <div>Loading...</div>;
  }

  // Get the image URL and description from the content
  const imageUrl = content?.imagea?.filename || null;
  const description = content?.description || null;


  return (
    <div>
      <h1>Game Page</h1>
      {description && <p>{description}</p>}
      {imageUrl && <img src={imageUrl} alt="Game Image" />}
    </div>
  );
}
