import React from 'react';

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s"'<>]+/gi;
const IFRAME_PATTERN = /<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>[\s\S]*?<\/iframe\s*>/gi;
const TRAILING_PUNCTUATION = /[),.!?;:]+$/;
const YOUTUBE_ID_PATTERN = /^[\w-]{11}$/;
const OTHER_VIDEO_ID_PATTERN = /^[\w-]+$/;
const OTHER_VIDEO_HOST = ['red', 'gifs.com'].join('');

const cleanUrl = value => value.replace(TRAILING_PUNCTUATION, '');

const normalizeUrl = value => {
  const withProtocol = value.startsWith('www.') ? `https://${value}` : value;
  const url = new URL(withProtocol);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  if (url.protocol === 'http:') url.protocol = 'https:';
  return url;
};

const resolveVideo = value => {
  try {
    const url = normalizeUrl(value);
    if (!url) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    const segments = url.pathname.split('/').filter(Boolean);

    if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const id = host === 'youtu.be'
        ? segments[0]
        : url.searchParams.get('v') || (['embed', 'shorts', 'live', 'v'].includes(segments[0]) ? segments[1] : null);
      return YOUTUBE_ID_PATTERN.test(id || '')
        ? { src:`https://www.youtube-nocookie.com/embed/${id}`, title:'YouTube video player' }
        : null;
    }

    if (host === OTHER_VIDEO_HOST) {
      const id = ['ifr', 'watch'].includes(segments[0]) ? segments[1] : null;
      return OTHER_VIDEO_ID_PATTERN.test(id || '')
        ? { src:`https://www.${OTHER_VIDEO_HOST}/ifr/${id}`, title:'Other video player' }
        : null;
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = host === 'player.vimeo.com' && segments[0] === 'video' ? segments[1] : segments[0];
      return /^\d+$/.test(id || '')
        ? { src:`https://player.vimeo.com/video/${id}`, title:'Vimeo video player' }
        : null;
    }

    if (host === 'dailymotion.com' || host === 'dai.ly') {
      const id = host === 'dai.ly'
        ? segments[0]
        : segments[0] === 'video' ? segments[1] : segments[0] === 'embed' && segments[1] === 'video' ? segments[2] : null;
      return /^[\w]+$/.test(id || '')
        ? { src:`https://www.dailymotion.com/embed/video/${id}`, title:'Dailymotion video player' }
        : null;
    }

    return null;
  } catch {
    return null;
  }
};

const getIframeSource = text => {
  IFRAME_PATTERN.lastIndex = 0;
  return IFRAME_PATTERN.exec(text)?.[2] || '';
};

const getUrls = text => {
  URL_PATTERN.lastIndex = 0;
  return [...text.matchAll(URL_PATTERN)].map(match => cleanUrl(match[0]));
};

const getDisplayText = text => text
  .replace(IFRAME_PATTERN, ' ')
  .replace(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>[\s\S]*?<\/a\s*>/gi, ' $2 ')
  .replace(/<\/?(?:div|p|br)\b[^>]*>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const renderLinkedText = text => {
  const parts = [];
  let lastIndex = 0;
  let match;
  URL_PATTERN.lastIndex = 0;

  while ((match = URL_PATTERN.exec(text)) !== null) {
    const url = cleanUrl(match[0]);
    const end = match.index + url.length;
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a key={`${match.index}-${url}`} href={url.startsWith('www.') ? `https://${url}` : url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>
    );
    lastIndex = end;
    URL_PATTERN.lastIndex = end;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};

const VideoMessage = ({ text = '' }) => {
  const iframeSource = getIframeSource(text);
  const urls = getUrls(text);
  const video = [iframeSource, ...urls].filter(Boolean).map(resolveVideo).find(Boolean);
  const displayText = getDisplayText(text);

  return (
    <>
      {displayText && (
        <div style={{ whiteSpace:'pre-wrap', overflowWrap:'anywhere' }}>
          {renderLinkedText(displayText)}
        </div>
      )}
      {video && (
        <div style={{ width:'min(100%, 700px)', marginTop:displayText ? 10 : 0 }}>
          <div style={{ position:'relative', width:'100%', aspectRatio:'16 / 9', overflow:'hidden', borderRadius:10, background:'#000' }}>
            <iframe
              src={video.src}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
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

export const hasEmbeddableVideo = text => {
  const iframeSource = getIframeSource(text || '');
  return [iframeSource, ...getUrls(text || '')].filter(Boolean).some(url => resolveVideo(url));
};

export default VideoMessage;
