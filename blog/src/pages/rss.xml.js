import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog');
  return rss({
    title: 'TidySnap Blog',
    description: 'AI-powered desk organization tips and tricks',
    site: context.site || 'https://tidysnap.homes',
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/blog/${post.slug}/`,
    })),
    customData: `<language>zh-CN</language>`,
  });
}
