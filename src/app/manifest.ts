import type { MetadataRoute } from 'next';

/** The web app manifest: the name and icons used when Coach is added to a home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Coach',
    short_name: 'Coach',
    description: 'Training plan, Strava and Lift',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
