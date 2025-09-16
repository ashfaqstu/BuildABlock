import { StoryblokComponent, useStoryblok } from '@storyblok/react';
import { useParams } from 'react-router';

export default function App() {
	const currentYear = new Date().getFullYear();
	const { '*': slug } = useParams();
	const story = useStoryblok(slug || 'home', {
		version: import.meta.env.STORYBLOK_IS_PREVIEW === 'true' ? 'draft' : 'published'
	});
	if (!story?.content) {
		return <div>Loadinga...</div>;
	}
	return (
		<>
			<StoryblokComponent blok={story.content} />
			<footer>Build with happiness © {currentYear}</footer>
		</>
	);
}
