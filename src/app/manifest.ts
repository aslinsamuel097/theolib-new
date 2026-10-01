import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Theos Lib - Theological Library',
    short_name: 'TheoLib',
    description: 'Digital Sanctuary of Theological Knowledge',
    start_url: '/',
    display: 'standalone',
    background_color: '#0c0819',
    theme_color: '#3F51B5',
    icons: [
      {
        src: 'https://firebasestorage.googleapis.com/v0/b/theolib-1677e.firebasestorage.app/o/logo%2Ftheolib_logo.png?alt=media',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://firebasestorage.googleapis.com/v0/b/theolib-1677e.firebasestorage.app/o/logo%2Ftheolib_logo.png?alt=media',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
