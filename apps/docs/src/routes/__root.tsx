import * as React from 'react';

import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';

import { RootProvider } from 'fumadocs-ui/provider/tanstack';
import appCss from '@/styles/app.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8'
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1'
      },
      {
        title: '5GNU | A flexible, user-friendly platform for creating, managing, and delivering courses'
      },
      {
        name: 'description',
        content:
          'A flexible, user-friendly platform for creating, managing, and delivering courses for companies and training organisations'
      },
      {
        property: 'og:url',
        content: 'https://5gnumultimedia.com/docs'
      },
      {
        property: 'og:type',
        content: 'website'
      },
      {
        property: 'og:title',
        content: '5GNU | A flexible, user-friendly platform for creating, managing, and delivering courses'
      },
      {
        property: 'og:description',
        content:
          'A flexible, user-friendly platform for creating, managing, and delivering courses for companies and training organisations'
      },
      {
        property: 'og:image:type',
        content: 'image/png'
      },
      {
        property: 'og:image:width',
        content: '1920'
      },
      {
        property: 'og:image:height',
        content: '1080'
      },
      {
        property: 'og:image:secure_url',
        itemProp: 'image',
        content: 'https://5gnumultimedia.com/logo-512.png'
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image'
      },
      {
        property: 'twitter:domain',
        content: '5gnumultimedia.com'
      },
      {
        property: 'twitter:url',
        content: 'https://5gnumultimedia.com/docs'
      },
      {
        name: 'twitter:title',
        content: '5GNU | A flexible, user-friendly platform for creating, managing, and delivering courses'
      },
      {
        name: 'twitter:description',
        content:
          'A flexible, user-friendly platform for creating, managing, and delivering courses for companies and training organisations'
      },
      {
        name: 'twitter:creator',
        content: '@5GNU'
      },
      {
        name: 'twitter:image',
        content: 'https://5gnumultimedia.com/logo-512.png'
      }
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico' }
    ]
  }),
  component: RootComponent
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
