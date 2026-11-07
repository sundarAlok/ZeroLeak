import React from 'react';

const YOUTUBE_URL_PATTERN = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^\s"'<>]+/gi;
const LINK_PATTERN = /https?:\/\/[^\s<>]+/g;
const TRAILING_PUNCTUATION = /[),.!?;:]+$/;
const VIDEO_ID_PATTERN = /^[\w-]{11}$/;

const cleanUrl = value => value.replace(TRAILING_PUNCTUATION, '');

const getYoutubeVideoId = value => {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return VIDEO_ID_PATTERN.test(id || '') ? id : null;
    }

    if (!['youtube.com', 'youtube-nocookie.com'].includes(host)) return null;
    const segments = url.pathname.split('/').filter(Boolean);
    const id = url.searchParams.get('v')
      || (['embed', 'shorts', 'live', 'v'].includes(segments[0]) ? segments[1] : null);
    return VIDEO_ID_PATTERN.test(id || '') ? id : null;
  } catch {
    return null;
  }
};

const renderLinkedText = text => {
  const parts = [];
  let lastIndex = 0;
  let match;
  LINK_PATTERN.lastIndex = 0;

  while ((match = LINK_PATTERN.exec(text)) !== null) {
    const url = cleanUrl(match[0]);
    const end = match.index + url.length;
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a key={`${match.index}-${url}`} href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>
    );
    lastIndex = end;
    LINK_PATTERN.lastIndex = end;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};

const VideoMessage = ({ text = '' }) => {
  const iframeSource = text.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i)?.[1];
  const videoUrls = [...text.matchAll(YOUTUBE_URL_PATTERN)].map(match => cleanUrl(match[0]));
  if (iframeSource) videoUrls.unshift(iframeSource);
  const video = videoUrls
    .map(url => ({ url, id:getYoutubeVideoId(url) }))
    .find(candidate => candidate.id);
  const displayText = text.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, iframeSource || '');

  return (
    <>
      {displayText && (
        <div style={{ whiteSpace:'pre-wrap', overflowWrap:'anywhere' }}>
          {renderLinkedText(displayText)}
        </div>
      )}
      {video && (
        <div style={{ width:'min(100%, 560px)', marginTop:displayText ? 10 : 0 }}>
          <div style={{ position:'relative', width:'100%', aspectRatio:'16 / 9', overflow:'hidden', borderRadius:10, background:'#000' }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video.id}`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:0 }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default VideoMessage;
