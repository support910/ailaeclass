import type { MetaTagsProps } from 'svelte-meta-tags';
export const load = async ({ params = { slug: '' }, fetch }) => {
  const response = await fetch(`/api/courses/catalog/${encodeURIComponent(params.slug)}`);
  const result = response.ok ? await response.json() : null;
  const data = result?.course || null;

  const pageMetaTags = Object.freeze({
    title: data?.title,
    description: data?.description,
    openGraph: {
      title: data?.title,
      description: data?.description,
      images: [
        {
          url: data?.logo || '',
          alt: data?.title,
          width: 280,
          height: 200,
          secureUrl: data?.logo,
          type: 'image/jpeg'
        }
      ]
    },
    twitter: {
      handle: '@ailaeclass',
      site: '@ailaeclass',
      cardType: 'summary_large_image' as const,
      title: data?.title,
      description: data?.description,
      image: data?.logo,
      imageAlt: 'Course OG Image'
    }
  }) satisfies MetaTagsProps;

  return {
    slug: params.slug,
    course: data,
    pageMetaTags
  };
};
