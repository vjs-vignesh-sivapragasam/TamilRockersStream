declare module '*.jpg' {
  const value: any;
  export default value;
}
declare module '*.png' {
  const value: any;
  export default value;
}
declare module 'nodejs-mobile-react-native' {
  const nodejs: {
    start: (scriptName: string) => void;
    channel: any;
  };
  export default nodejs;
}
declare module 'expo-glass-effect' {
  export const GlassView: any;
}
declare module 'expo-haptics' {
  export enum ImpactFeedbackStyle {
    Light = 'light',
    Medium = 'medium',
    Heavy = 'heavy',
  }
  export const impactAsync: (style?: ImpactFeedbackStyle) => Promise<void>;
  export const notificationAsync: (type?: any) => Promise<void>;
  export const selectionAsync: () => Promise<void>;
}
declare module '@react-native-menu/menu' {
  export const MenuView: any;
  export type MenuComponentRef = any;
  export type MenuAction = any;
}
declare module 'expo-blur' {
  export const BlurView: any;
}
declare module '@react-native-assets/slider' {
  const Slider: any;
  export default Slider;
}
declare module 'react-native-video' {
  export const ResizeMode: any;
  export type OnLoadData = any;
  export type OnProgressData = any;
  export type VideoRef = any;
  export type OnBufferData = any;
  export type SelectedTrack = any;
  const Video: any;
  export default Video;
}
