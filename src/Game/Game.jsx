import { useState, useEffect } from 'react';
import { useStoryblokApi } from '@storyblok/react';


export default function Game({ blok }) {
	const[content,setContent]=useState(null);
    const[loading,setLoading]=useState(true);

    const storyblokApi = useStoryblokApi();

    useEffect(() => {
        const fetchData = async () => {
            try{
                const response = await storyblokApi.get('cdn/stories/game', {
                    version: 'published',
                    token: import.meta.env.STORYBLOK_DELIVERY_API_TOKEN,
                });
                setContent(response.data.story.content);
                console.log('Fetched content:');
                setLoading(false);

            }
            catch(error){
                console.error('Error fetching data from Storyblok:', error);
                setLoading(false);
            }
        };
        fetchData();
    }, [storyblokApi]);
    if(loading){
        return <div>Loading...</div>;
    }
    const imageUrl = content?.imagea?.filename || null;
    const description= content.description || null;
    return (
        <div>
            <h1>hi</h1>
            {description && <p>{description}</p>}
            {imageUrl && <img src={imageUrl} alt="Game Image" />}
        </div>
    );
}
