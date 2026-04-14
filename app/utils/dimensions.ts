import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base design width (iPhone 14 Pro)
const BASE_WIDTH = 393;

export const wp = (percent: number) => (SCREEN_WIDTH * percent) / 100;
export const hp = (percent: number) => (SCREEN_HEIGHT * percent) / 100;
export const rs = (size: number) => size * (SCREEN_WIDTH / BASE_WIDTH);

export const SCREEN = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT };
