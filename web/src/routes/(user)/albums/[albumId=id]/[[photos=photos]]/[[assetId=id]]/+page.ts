import { getAlbumInfo, getAllAlbums, getAuthStatus } from '@immich/sdk';
import { redirect } from '@sveltejs/kit';
import { Route } from '$lib/route';
import { authenticate } from '$lib/utils/auth';
import type { PageLoad } from './$types';

export const load = (async ({ params, url, depends }) => {
  await authenticate(url);

  depends('album:data');

  const { isElevated } = await getAuthStatus();
  if (!isElevated) {
    const albums = await getAllAlbums({});
    if (albums.some(({ id, isLocked }) => id === params.albumId && isLocked)) {
      redirect(307, Route.pinPrompt({ continue: url.pathname + url.search }));
    }
  }

  const album = await getAlbumInfo({ id: params.albumId });

  return {
    album,
    meta: {
      title: album.albumName,
    },
  };
}) satisfies PageLoad;
