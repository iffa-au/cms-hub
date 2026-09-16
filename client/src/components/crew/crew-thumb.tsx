import { UserRound } from 'lucide-react';

/**
 * Photos uploaded through the form live in the media bucket and can be shown
 * inline. Roughly two thirds of existing entries are Google Drive share links
 * pasted into the public form instead — those are not direct image URLs, so
 * rendering them in an <img> produces a broken thumbnail. They fall back to
 * the placeholder.
 *
 * Lives here rather than in crew-editor so the editor and the read-only view
 * screen can't drift into disagreeing about what is renderable.
 */
export function isDisplayableImage(url: string): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith('cloudfront.net') || hostname.includes('s3.');
  } catch {
    return false;
  }
}

/** 40px square avatar, or a placeholder when there's no usable image. */
export default function CrewThumb({ url }: { url: string }) {
  if (isDisplayableImage(url)) {
    return (
      <img
        src={url}
        alt=''
        className='h-10 w-10 rounded object-cover border border-[#393528] shrink-0'
        loading='lazy'
      />
    );
  }
  return (
    <span className='h-10 w-10 rounded border border-[#393528] bg-[#141414] grid place-items-center shrink-0'>
      <UserRound className='h-4 w-4 text-[#544e3b]' />
    </span>
  );
}
