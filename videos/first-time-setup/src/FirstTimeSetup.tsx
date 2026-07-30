import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const teal = '#0D4F5E';
const tealSoft = '#E7F7F5';
const navy = '#101C33';

const fade = (frame: number, start: number, duration = 18) =>
  interpolate(frame, [start, start + duration, start + duration + 12, start + duration + 30], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const Caption: React.FC<{step: string; title: string; body: string; start: number; end: number}> = ({
  step,
  title,
  body,
  start,
  end,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [start, start + 16, end - 16, end], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [start, start + 16], [28, 0], {extrapolateRight: 'clamp'});
  return (
    <div
      style={{
        position: 'absolute',
        left: 110,
        bottom: 82,
        width: 610,
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div style={{color: '#91E5D9', fontSize: 22, fontWeight: 800, letterSpacing: 2.5}}>{step}</div>
      <div style={{color: 'white', fontSize: 50, fontWeight: 800, lineHeight: 1.08, marginTop: 10}}>{title}</div>
      <div style={{color: '#D5E0EF', fontSize: 27, lineHeight: 1.35, marginTop: 16}}>{body}</div>
    </div>
  );
};

const Pulse: React.FC<{left: number; top: number; start: number; color?: string}> = ({left, top, start, color = '#55D6BD'}) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - start) % 36;
  const scale = interpolate(local, [0, 35], [0.55, 2.1]);
  const opacity = interpolate(local, [0, 35], [0.8, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: `4px solid ${color}`,
        opacity,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    />
  );
};

const BrowserConfirmation: React.FC<{start: number}> = ({start}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({frame: Math.max(0, frame - start), fps, config: {damping: 18, stiffness: 120}});
  const opacity = fade(frame, start, 22);
  return (
    <div
      style={{
        position: 'absolute',
        right: 120,
        top: 110,
        width: 470,
        padding: 34,
        borderRadius: 28,
        background: 'rgba(255,255,255,0.97)',
        boxShadow: '0 28px 70px rgba(0,0,0,0.28)',
        opacity,
        transform: `scale(${0.88 + 0.12 * scale})`,
      }}
    >
      <div style={{display: 'flex', gap: 12, alignItems: 'center', color: teal, fontWeight: 800, fontSize: 24}}>
        <span style={{fontSize: 34}}>🔗</span> Alt Text Pro
      </div>
      <div style={{height: 1, background: '#E5E7EB', margin: '24px 0'}} />
      <div style={{color: navy, fontSize: 31, fontWeight: 800}}>Connected successfully</div>
      <div style={{color: '#667085', fontSize: 21, lineHeight: 1.4, marginTop: 12}}>Your API key has been sent securely to your WordPress plugin.</div>
      <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 26, color: '#0A9B70', fontWeight: 800, fontSize: 22}}>
        <span style={{width: 28, height: 28, borderRadius: '50%', background: '#38C997', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>✓</span>
        Ready to generate alt text
      </div>
    </div>
  );
};

const ReadyCard: React.FC<{start: number}> = ({start}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({frame: Math.max(0, frame - start), fps, config: {damping: 16}});
  const opacity = fade(frame, start, 30);
  return (
    <div
      style={{
        position: 'absolute',
        right: 135,
        top: 230,
        width: 520,
        padding: 42,
        borderRadius: 30,
        background: 'linear-gradient(145deg, #FFFFFF 0%, #E7F7F5 100%)',
        boxShadow: '0 30px 80px rgba(13,79,94,0.25)',
        opacity,
        transform: `scale(${0.88 + scale * 0.12})`,
      }}
    >
      <div style={{width: 72, height: 72, borderRadius: '50%', background: '#38C997', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontWeight: 800}}>✓</div>
      <div style={{fontSize: 38, fontWeight: 800, color: navy, marginTop: 24}}>You’re all set</div>
      <div style={{fontSize: 23, lineHeight: 1.45, color: '#53627A', marginTop: 12}}>Alt Text Pro is connected and ready to help improve every image in your Media Library.</div>
      <div style={{marginTop: 28, borderRadius: 14, padding: '16px 20px', background: teal, color: 'white', fontSize: 22, fontWeight: 800, textAlign: 'center'}}>Open Media Library</div>
    </div>
  );
};

export const FirstTimeSetup: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const introScale = spring({frame, fps, config: {damping: 15, stiffness: 90}});
  const screenshotOpacity = interpolate(frame, [90, 120], [0, 1], {extrapolateRight: 'clamp'});
  const screenshotScale = interpolate(frame, [90, 1380], [0.63, 0.76], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const typedCharacters = Math.floor(interpolate(frame, [930, 1020], [0, 24], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const typedKey = 'alt_••••••••••••••••••••••'.slice(0, typedCharacters);

  return (
    <AbsoluteFill style={{fontFamily: 'Arial, Helvetica, sans-serif', background: '#091222', overflow: 'hidden'}}>
      <AbsoluteFill style={{background: 'radial-gradient(circle at 75% 10%, rgba(13,79,94,0.55), transparent 38%), radial-gradient(circle at 0% 100%, rgba(15,109,126,0.28), transparent 40%)'}} />
      <div style={{position: 'absolute', right: -180, bottom: -180, width: 820, height: 820, borderRadius: '50%', background: 'rgba(85,214,189,0.08)'}} />

      <div style={{position: 'absolute', left: 110, top: 76, color: '#B9C8DA', fontSize: 20, fontWeight: 700, letterSpacing: 1.4}}>ALT TEXT PRO · WORDPRESS GUIDE</div>
      <div style={{position: 'absolute', right: 110, top: 76, display: 'flex', gap: 8}}>
        {[0, 1, 2, 3, 4].map((item) => <div key={item} style={{width: item <= Math.floor(frame / 324) ? 42 : 18, height: 6, borderRadius: 10, background: item <= Math.floor(frame / 324) ? '#55D6BD' : '#31425B', transition: 'all 0.3s'}} />)}
      </div>

      {frame < 120 && (
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: interpolate(frame, [0, 20, 92, 120], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), transform: `scale(${0.92 + introScale * 0.08})`}}>
          <div style={{textAlign: 'center'}}>
            <div style={{margin: '0 auto 24px', width: 94, height: 94, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 26, background: tealSoft, color: teal, fontSize: 50}}>🔗</div>
            <div style={{color: 'white', fontSize: 68, fontWeight: 800, letterSpacing: -2}}>First-time setup</div>
            <div style={{color: '#B9C8DA', fontSize: 30, marginTop: 16}}>Connect Alt Text Pro in under a minute.</div>
          </div>
        </div>
      )}

      <div style={{position: 'absolute', left: 825, top: 130, width: 1080, height: 890, opacity: screenshotOpacity, transform: `scale(${screenshotScale})`, transformOrigin: 'top left'}}>
        <div style={{height: '100%', borderRadius: 30, overflow: 'hidden', boxShadow: '0 34px 100px rgba(0,0,0,0.44)', border: '1px solid rgba(255,255,255,0.15)'}}>
          <Img src={staticFile('assets/onboarding-modal.png')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center'}} />
        </div>
      </div>

      {frame >= 300 && frame < 570 && <Pulse left={1332} top={705} start={300} />}
      {frame >= 840 && frame < 1110 && <Pulse left={1565} top={688} start={840} color="#7EA6FF" />}
      {frame >= 1020 && frame < 1230 && (
        <div style={{position: 'absolute', right: 190, top: 550, width: 400, height: 74, borderRadius: 14, background: 'white', border: '3px solid #7EA6FF', display: 'flex', alignItems: 'center', padding: '0 20px', color: '#51617A', fontSize: 24, boxShadow: '0 12px 28px rgba(0,0,0,0.2)'}}>{typedKey}<span style={{display: frame % 20 < 10 ? 'inline' : 'none', color: teal}}>|</span></div>
      )}
      {frame >= 570 && frame < 840 && <BrowserConfirmation start={570} />}
      {frame >= 1230 && <ReadyCard start={1230} />}

      <Caption step="STEP 1" title="Open Alt Text Pro" body="After activation, open Alt Text Pro in your WordPress dashboard. The connection screen is ready for you." start={120} end={300} />
      <Caption step="STEP 2" title="Connect your account" body="Choose Connect Account to sign in or create a free account. This is the quickest way to get started." start={300} end={570} />
      <Caption step="STEP 3" title="Finish the secure sign-in" body="Complete the connection in your browser. Your plugin receives its API key automatically—nothing to copy." start={570} end={840} />
      <Caption step="STEP 4" title="Or connect manually" body="Copy your API key from the Alt Text Pro dashboard, paste it into the field, then choose Save API Key." start={840} end={1230} />
      <Caption step="DONE" title="You’re ready to generate" body="Alt Text Pro is connected and ready to create accurate alt text for your WordPress Media Library." start={1230} end={1590} />
    </AbsoluteFill>
  );
};
