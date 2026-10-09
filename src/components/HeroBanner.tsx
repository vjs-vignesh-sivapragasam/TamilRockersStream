import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Plus, Info, Check } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { MediaItem } from '../data/sampleMedia';

interface HeroBannerProps {
  item: MediaItem;
  onPlayPress?: () => void;
  onInfoPress?: () => void;
  isMyList?: boolean;
  onToggleMyList?: () => void;
}

const { width } = Dimensions.get('window');
const BANNER_HEIGHT = 480;

export const HeroBanner: React.FC<HeroBannerProps> = ({
  item,
  onPlayPress,
  onInfoPress,
  isMyList = false,
  onToggleMyList,
}) => {
  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: item.poster }}
        style={styles.imageBackground}
        resizeMode="cover"
      >
        {/* Top Vignette Gradient */}
        <LinearGradient
          colors={['rgba(20,20,20,0.85)', 'transparent']}
          style={styles.topGradient}
        />

        {/* Bottom Fade Gradient into Dashboard background */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)', Colors.background]}
          locations={[0, 0.5, 0.8, 1]}
          style={styles.bottomGradient}
        >
          {/* Top 10 Badge */}
          <View style={styles.badgeRow}>
            <View style={styles.topTenBadge}>
              <Text style={styles.topTenText}>TOP</Text>
              <Text style={styles.topTenNum}>10</Text>
            </View>
            <Text style={styles.rankingText}>#1 in TV Shows Today</Text>
          </View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>

          {/* Genre tags */}
          <Text style={styles.genresText}>
            {item.genres.join(' • ')}
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            {/* My List Button */}
            <TouchableOpacity
              style={styles.actionBtnSecondary}
              onPress={onToggleMyList}
              activeOpacity={0.7}
            >
              {isMyList ? (
                <Check color={Colors.textPrimary} size={24} />
              ) : (
                <Plus color={Colors.textPrimary} size={24} />
              )}
              <Text style={styles.actionBtnSecondaryText}>
                {isMyList ? 'Added' : 'My List'}
              </Text>
            </TouchableOpacity>

            {/* Play Button */}
            <TouchableOpacity
              style={styles.playButton}
              onPress={onPlayPress}
              activeOpacity={0.85}
            >
              <Play color="#FFFFFF" size={20} fill="#FFFFFF" />
              <Text style={styles.playButtonText}>Play</Text>
            </TouchableOpacity>

            {/* Info Button */}
            <TouchableOpacity
              style={styles.actionBtnSecondary}
              onPress={onInfoPress}
              activeOpacity={0.7}
            >
              <Info color={Colors.textPrimary} size={24} />
              <Text style={styles.actionBtnSecondaryText}>Info</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width,
    height: BANNER_HEIGHT,
    marginBottom: 8,
  },
  imageBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  topGradient: {
    height: 120,
    width: '100%',
  },
  bottomGradient: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  topTenBadge: {
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    alignItems: 'center',
  },
  topTenText: {
    color: '#FFF',
    fontSize: 7,
    fontWeight: '900',
    lineHeight: 8,
  },
  topTenNum: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 10,
  },
  rankingText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  genresText: {
    color: '#D1D1D1',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 8,
    borderWidth: 1.8,
    borderColor: '#FFFFFF',
    gap: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 14,
    elevation: 8,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  actionBtnSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 60,
  },
  actionBtnSecondaryText: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
});
