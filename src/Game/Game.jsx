import { useState, useEffect } from 'react';
import { useStoryblokApi, useStoryblokBridge, storyblokEditable } from '@storyblok/react'; 

export default function Game({ blok }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  const storyblokApi = useStoryblokApi();

  // Fetch data from Storyblok
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await storyblokApi.get('cdn/stories/game', {
          version: import.meta.env.STORYBLOK_IS_PREVIEW === 'true' ? 'draft' : 'published',
          token: import.meta.env.STORYBLOK_DELIVERY_API_TOKEN,
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
  useEffect(() => {
    if (content?.story?.id) {
      // Only sync once we have the content id
      useStoryblokBridge(content.story.id);
    }
  }, [content]);

  if (loading) {
    return <div>Loading...</div>;
  }

  // Get the image URL and description from the content
  const imageUrl = content?.imagea?.filename || null;
  const description = content?.description || null;

  // Get the editable attributes for the content block (blok)
  const attributes = storyblokEditable(blok); // Get Storyblok editable attributes

  return (
    <div {...attributes}> {/* Apply Storyblok's editable attributes to the div */}
      <h1>Game Page</h1>
      {description && <p>{description}</p>}
      {imageUrl && <img src={imageUrl} alt="Game Image" />}
    </div>
  );
}
