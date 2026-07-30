import {Composition} from 'remotion';
import {FirstTimeSetup} from './FirstTimeSetup';

export const RemotionRoot = () => {
  return (
    <Composition
      id="FirstTimeSetup"
      component={FirstTimeSetup}
      durationInFrames={1620}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
