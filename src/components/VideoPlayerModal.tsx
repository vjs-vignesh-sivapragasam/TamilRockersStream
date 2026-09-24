import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubePlayer from 'react-native-youtube-iframe';
import { X, Volume2, VolumeX, Maximize, RotateCcw } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { MediaItem } from '../data/sampleMedia';

interface VideoPlayerModalProps {
  visible: boolean;
  item: MediaItem | null;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  visible,
  item,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);

  if (!item) return null;

  // Default trailer fallback if none specified
  const videoId = item.trailerId || 'b9EkMc79ZSU';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={styles.container}>
        {/* Top Floating Control Bar */}
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <X color="#FFFFFF" size={20} />
          </TouchableOpacity>

          <View style={styles.titleWrapper}>
            <Text style={styles.videoTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.videoMeta}>
              Official Trailer • {item.quality} • 5.1 Surround
            </Text>
          </View>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.quality.includes('4K') ? '4K' : 'HD'}</Text>
          </View>
        </View>

        {/* Video Player Canvas */}
        <View style={styles.playerWrapper}>
          {loading && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="large" color={Colors.netflixRed} />
              <Text style={styles.loadingText}>Buffering stream...</Text>
            </View>
          )}

          <YoutubePlayer
            height={height > width ? 280 : height}
            width={width}
            play={playing}
            videoId={videoId}
            mute={muted}
            onReady={() => setLoading(false)}
            onChangeState={(state: string) => {
              if (state === 'ended') {
                setPlaying(false);
              }
            }}
          />
        </View>

        {/* Bottom Control Strip */}
        <View style={[styles.bottomStrip, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TouchableOpacity
            style={styles.iconAction}
            onPress={() => setMuted(!muted)}
          >
            {muted ? (
              <VolumeX color="#FFFFFF" size={22} />
            ) : (
              <Volume2 color="#FFFFFF" size={22} />
            )}
            <Text style={styles.iconActionText}>{muted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconAction}
            onPress={() => {
              setPlaying(false);
              setTimeout(() => setPlaying(true), 100);
            }}
          >
            <RotateCcw color="#FFFFFF" size={22} />
            <Text style={styles.iconActionText}>Replay</Text>
          </TouchableOpacity>

          <View style={styles.qualityTag}>
            <Text style={styles.qualityTagText}>Ultra HD 4K</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(35,35,35,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrapper: {
    flex: 1,
    marginHorizontal: 12,
  },
  videoTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  videoMeta: {
    color: '#A3A3A3',
    fontSize: 11,
  },
  badge: {
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  playerWrapper: {
    width: width,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  loaderOverlay: {
    position: 'absolute',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#AAA',
    fontSize: 12,
  },
  bottomStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(18,18,18,0.9)',
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  iconAction: {
    alignItems: 'center',
    gap: 4,
  },
  iconActionText: {
    color: '#CCC',
    fontSize: 11,
  },
  qualityTag: {
    borderWidth: 1,
    borderColor: '#555',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  qualityTagText: {
    color: '#46d369',
    fontSize: 11,
    fontWeight: '700',
  },
});
