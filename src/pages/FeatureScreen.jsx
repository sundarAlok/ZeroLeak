import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './feature.css';

const createStableParticles = (count) =>
  Array.from({ length: count }).map(() => ({
    x: Math.random() * window.innerWidth,
    y: window.innerHeight * (0.18 + Math.random() * 0.64),
    size: 4 + Math.random() * 14,
    driftX: (Math.random() - 0.5) * 120,
    rise: Math.random() > 0.5,
    opacity: 0.22 + Math.random() * 0.7,
  }));

const WelcomePattern = () => (
  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`} preserveAspectRatio="none">
    <defs>
      <linearGradient id="wgrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#6366F1" stopOpacity="0.18" />
        <stop offset="1" stopColor="#818CF8" stopOpacity="0.06" />
      </linearGradient>
    </defs>
    <path d={`M0,${window.innerHeight * 0.45} C${window.innerWidth * 0.28},${window.innerHeight * 0.35} ${window.innerWidth * 0.72},${window.innerHeight * 0.55} ${window.innerWidth},${window.innerHeight * 0.45} L${window.innerWidth},${window.innerHeight} L0,${window.innerHeight} Z`} fill="url(#wgrad)" />
    <circle cx={window.innerWidth * 0.72} cy={window.innerHeight * 0.18} r={80} fill="#6366F133" />
    <circle cx={window.innerWidth * 0.26} cy={window.innerHeight * 0.28} r={46} fill="#818CF833" />
  </svg>
);

const SecurityPattern = () => (
  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`} preserveAspectRatio="none">
    <defs>
      <linearGradient id="sgrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#EC4899" stopOpacity="0.14" />
        <stop offset="1" stopColor="#F472B6" stopOpacity="0.06" />
      </linearGradient>
    </defs>
    {[0, 1, 2].map((i) => (
      <path
        key={i}
        d={`M${window.innerWidth * (0.22 + i * 0.18)},${window.innerHeight * 0.15} Q${window.innerWidth * (0.22 + i * 0.18)},${window.innerHeight * 0.45} ${window.innerWidth * (0.22 + i * 0.18) - 40},${window.innerHeight * 0.68} Q${window.innerWidth * (0.22 + i * 0.18)},${window.innerHeight * 0.6} ${window.innerWidth * (0.22 + i * 0.18) + 40},${window.innerHeight * 0.68} Z`}
        fill="url(#sgrad)"
        opacity={0.18}
      />
    ))}
    {[...Array(8)].map((_, i) => (
      <line
        key={i}
        x1={(i + 1) * (window.innerWidth / 9)}
        y1={0}
        x2={(i + 1) * (window.innerWidth / 9)}
        y2={window.innerHeight}
        stroke="#F472B622"
        strokeWidth={1}
        opacity={0.08}
      />
    ))}
  </svg>
);

const MomentsPattern = () => (
  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`} preserveAspectRatio="none">
    <defs>
      <linearGradient id="mgrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#10B981" stopOpacity="0.12" />
        <stop offset="1" stopColor="#059669" stopOpacity="0.04" />
      </linearGradient>
    </defs>
    {[0, 1, 2].map((i) => (
      <path
        key={i}
        d={`M0,${220 + i * 80} Q${window.innerWidth * 0.25},${160 + i * 80} ${window.innerWidth * 0.5},${220 + i * 80} T${window.innerWidth},${220 + i * 80} L${window.innerWidth},${window.innerHeight} L0,${window.innerHeight} Z`}
        fill="url(#mgrad)"
        opacity={0.2 - i * 0.04}
      />
    ))}
  </svg>
);

const CommunityPattern = () => (
  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`} preserveAspectRatio="none">
    <defs>
      <linearGradient id="cgrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#F59E0B" stopOpacity="0.14" />
        <stop offset="1" stopColor="#FBBF24" stopOpacity="0.06" />
      </linearGradient>
    </defs>
    {[...Array(6)].map((_, i) => {
      const x = window.innerWidth * (0.2 + (i / 6) * 0.6);
      const y = window.innerHeight * (0.2 + (i % 3) * 0.18);
      return <circle key={i} cx={x} cy={y} r={14} fill="url(#cgrad)" />;
    })}
  </svg>
);

const slides = [
  {
    id: 1,
    title: 'ZeroLeak',
    subtitle: 'Next-generation privacy',
    description: 'Secure messages, calls and moments with modern end-to-end encryption and beautiful UX.',
    iconName: 'shield-lock',
    gradient: ['#0F172A', '#111827', '#23283E'],
    accentColor: '#6366F1',
    particles: 24,
    particleShape: 'circle',
    pattern: 'welcome',
  },
  {
    id: 2,
    title: 'Secure Connection',
    subtitle: 'Robust encryption',
    description: 'End-to-end encrypted messages and calls using modern cryptography.',
    iconName: 'shield',
    gradient: ['#2B0A18', '#3B1226', '#482033'],
    accentColor: '#EC4899',
    particles: 20,
    particleShape: 'diamond',
    pattern: 'security',
  },
  {
    id: 3,
    title: 'Private Moments',
    subtitle: 'Share securely',
    description: 'Photos and videos with optional timers and access controls.',
    iconName: 'camera',
    gradient: ['#052E23', '#0B3B2E', '#11372B'],
    accentColor: '#10B981',
    particles: 0,
    particleShape: 'none',
    pattern: 'moments',
  },
  {
    id: 4,
    title: 'Premium Calls',
    subtitle: 'HD voice & video',
    description: 'Encrypted HD calls with noise suppression for crystal clear conversations.',
    iconName: 'video',
    gradient: ['#120B18', '#24162A', '#2B1726'],
    accentColor: '#8B5CF6',
    particles: 22,
    particleShape: 'ring',
    pattern: 'moments',
  },
  {
    id: 5,
    title: 'Join Our World',
    subtitle: 'Privacy-first community',
    description: 'Connect with others who prioritize privacy and secure sharing.',
    iconName: 'users',
    gradient: ['#231E09', '#342D13', '#413316'],
    accentColor: '#F59E0B',
    particles: 20,
    particleShape: 'node',
    pattern: 'community',
  },
];

function Particle({ p, index, accentColor, shapeType, animProgress }) {
  const baseStyle = {
    position: 'absolute',
    left: p.x,
    top: p.y,
    width: p.size,
    height: p.size,
    opacity: animProgress > 0.5 ? (1 - animProgress) * 2 * p.opacity : animProgress * 2 * p.opacity,
    zIndex: 0,
  };

  const translateY = p.rise ? 50 - animProgress * 170 : -30 + animProgress * 60;
  const translateX = animProgress * p.driftX;
  const scale = 0.6 + animProgress * 0.45;

  const style = {
    ...baseStyle,
    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
  };

  switch (shapeType) {
    case 'diamond':
      return <div key={index} style={{ ...style, backgroundColor: accentColor, borderRadius: 4, rotate: '45deg' }} />;
    case 'ring':
      return <div key={index} style={{ ...style, borderRadius: '50%', border: `${Math.max(1, p.size * 0.12)}px solid ${accentColor}`, backgroundColor: 'transparent' }} />;
    case 'node':
      return <div key={index} style={{ ...style, borderRadius: '50%', backgroundColor: accentColor, boxShadow: `0 0 16px ${accentColor}` }} />;
    default:
      return <div key={index} style={{ ...style, backgroundColor: accentColor, borderRadius: '50%' }} />;
  }
}

function FullScreenParticles({ config, accentColor, shapeType, animProgress }) {
  if (!Array.isArray(config) || config.length === 0 || shapeType === 'none') return null;
  return config.map((p, i) => <Particle key={i} p={p} index={i} accentColor={accentColor} shapeType={shapeType} animProgress={animProgress} />);
}

function OctagonsLayer({ count = 20, color = '#10B981', animProgress }) {
  return Array.from({ length: count }).map((_, i) => {
    const x = Math.random() * (window.innerWidth * 0.86) + window.innerWidth * 0.07;
    const y = Math.random() * (window.innerHeight * 0.5) + window.innerHeight * 0.18;
    const size = 8 + Math.random() * 14;
    const floatAmp = 6 + Math.random() * 10;
    const driftX = (Math.random() - 0.5) * 40;
    const rotDur = 2800 + Math.round(Math.random() * 900);
    const rotVal = (animProgress * 360 * rotDur) / 2600;
    const floatVal = Math.sin(animProgress * Math.PI * 2) * floatAmp / 2;

    const s = size;
    const rRad = s / 2;
    const angleStep = (Math.PI * 2) / 8;
    const points = Array.from({ length: 8 })
      .map((_, k) => {
        const a = Math.PI / 8 + k * angleStep;
        const px = Math.cos(a) * rRad;
        const py = Math.sin(a) * rRad;
        return `${px},${py}`;
      })
      .join(' ');

    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: x - s / 2,
          top: y - s / 2,
          width: s,
          height: s,
          transform: `translateX(${driftX}px) translateY(${floatVal}px) rotate(${rotVal}deg)`,
          zIndex: 1,
          opacity: 0.95,
          pointerEvents: 'none',
        }}
      >
        <svg width={s} height={s} viewBox={`${-s / 2} ${-s / 2} ${s} ${s}`}>
          <polygon points={points} fill="transparent" stroke={color} strokeWidth={1.4} strokeOpacity={0.18} />
        </svg>
      </div>
    );
  });
}

const FeatureScreen = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollContainerRef = useRef(null);
  const [animProgress, setAnimProgress] = useState(0);

  const particleConfigs = useRef(slides.map((s) => createStableParticles(Math.min(30, s.particles)))).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimProgress((prev) => (prev + 0.02) % 1);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((s) => s + 1);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scroll({ left: (currentSlide + 1) * window.innerWidth, behavior: 'smooth' });
      }
    } else {
      navigate('/login');
    }
  };

  const handleSkip = () => {
    setCurrentSlide(slides.length - 1);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scroll({ left: (slides.length - 1) * window.innerWidth, behavior: 'smooth' });
    }
  };

  const onScroll = () => {
    if (scrollContainerRef.current) {
      const idx = Math.round(scrollContainerRef.current.scrollLeft / window.innerWidth);
      setCurrentSlide(idx);
    }
  };

  const renderPattern = (patternType) => {
    if (patternType === 'welcome') return <WelcomePattern />;
    if (patternType === 'security') return <SecurityPattern />;
    if (patternType === 'moments') return <MomentsPattern />;
    if (patternType === 'community') return <CommunityPattern />;
    return null;
  };

  const renderIcon = (iconName, accentColor, isFirst) => {
    if (isFirst) {
      return <div className="fs-logo">Z</div>;
    }
    const icons = { shield: '🛡️', 'shield-lock': '🔒', camera: '📷', video: '🎥', users: '👥' };
    return <div style={{ fontSize: 40 }}>{icons[iconName] || '◆'}</div>;
  };

  return (
    <div className="fs-root">
      <div className="fs-scroll-container" ref={scrollContainerRef} onScroll={onScroll}>
        {slides.map((slide, index) => {
          const accent = slide.accentColor;
          const particlesForSlide = particleConfigs[index];
          const gradientStr = `linear-gradient(180deg, ${slide.gradient[0]}, ${slide.gradient[1]}, ${slide.gradient[2]})`;

          return (
            <div key={slide.id} className="fs-slide" style={{ background: gradientStr }}>
              <div className="fs-patterns">
                {renderPattern(slide.pattern)}
                <FullScreenParticles config={particlesForSlide} accentColor={accent} shapeType={slide.particleShape} animProgress={animProgress} />
                {index === 2 && <OctagonsLayer count={18} color={accent} animProgress={animProgress} />}
              </div>

              <div className="fs-content">
                <div className="fs-icon-container" style={{ animation: `float 2.6s ease-in-out infinite` }}>
                  <div className="fs-icon-box" style={{ backgroundColor: accent }}>
                    {renderIcon(slide.iconName, accent, index === 0)}
                  </div>
                  <div className="fs-small-blur" style={{ backgroundColor: `${accent}33` }} />
                  <div className="fs-hollow-diamond" style={{ borderColor: accent }} />
                </div>

                <div className="fs-text-content">
                  <h1 className="fs-title">{slide.title}</h1>
                  <h2 className="fs-subtitle">{slide.subtitle}</h2>
                  <p className="fs-description">{slide.description}</p>
                </div>

                <div className="fs-features">
                  {['Encrypted', 'Secure', 'Private'].map((feature) => (
                    <div key={feature} className="fs-feature-tag">
                      <div className="fs-feature-dot" style={{ backgroundColor: accent }} />
                      <span className="fs-feature-text">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="fs-skip-btn" onClick={handleSkip}>
        <span>Skip</span>
        <span style={{ marginLeft: 8 }}>→</span>
      </button>

      <div className="fs-bottom-section">
        <div className="fs-pagination">
          {slides.map((_, i) => (
            <div
              key={i}
              className="fs-dot"
              style={{
                backgroundColor: i === currentSlide ? slides[i].accentColor : 'rgba(255,255,255,0.14)',
                width: i === currentSlide ? 26 : 10,
              }}
            />
          ))}
        </div>

        <button
          className="fs-action-btn"
          style={{
            background: `linear-gradient(90deg, ${slides[currentSlide].accentColor}, ${slides[currentSlide].accentColor}DD)`,
          }}
          onClick={handleNext}
        >
          <span>{currentSlide === slides.length - 1 ? 'Get Started' : 'Continue'}</span>
          <span style={{ marginLeft: 10 }}>{currentSlide === slides.length - 1 ? '✓' : '→'}</span>
        </button>
      </div>
    </div>
  );
};

export default FeatureScreen;
