import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Play,
  Download,
  Plus,
  Check,
  ThumbsUp,
  Share2,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { MediaItem, TRENDING_NOW } from '../data/sampleMedia';

interface MovieDetailModalProps {
  visible: boolean;
  item: MediaItem | null;
  onClose: () => void;
  onPlayPress?: (item: MediaItem) => void;
  onDownloadPress?: (item: MediaItem) => void;
}

const { width } = Dimensions.get('window');

export const MovieDetailModal: React.FC<MovieDetailModalProps> = ({
  visible,
  item,
  onClose,
  onPlayPress,
  onDownloadPress,
}) => {
  const [inMyList, setInMyList] = useState(false);
  const [liked, setLiked] = useState(false);

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <X color="#FFFFFF" size={20} />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Backdrop Header */}
          <View style={styles.backdropContainer}>
            <Image
              source={{ uri: item.backdrop || item.poster }}
              style={styles.backdropImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(20, 20, 20, 0.8)', '#141414']}
              style={styles.backdropGradient}
            />
          </View>

          {/* Details Body */}
          <View style={styles.body}>
            <Text style={styles.title}>{item.title}</Text>

            {/* Metadata Tags */}
            <View style={styles.metaRow}>
              <Text style={styles.matchScore}>{item.matchScore}% Match</Text>
              <Text style={styles.yearText}>2025</Text>
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingBadgeText}>{item.rating}</Text>
              </View>
              <Text style={styles.durationText}>{item.duration}</Text>
              <View style={styles.qualityBadge}>
                <Text style={styles.qualityBadgeText}>{item.quality}</Text>
              </View>
            </View>

            {/* Primary Action Buttons */}
            <TouchableOpacity
              style={styles.primaryPlayBtn}
              onPress={() => onPlayPress?.(item)}
              activeOpacity={0.85}
            >
              <Play color="#000000" size={18} fill="#000000" />
              <Text style={styles.primaryPlayText}>Play</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.downloadBtn}
              activeOpacity={0.85}
              onPress={() => onDownloadPress?.(item)}
            >
              <Download color="#FFFFFF" size={18} />
              <Text style={styles.downloadText}>Download</Text>
            </TouchableOpacity>

            {/* Synopsis */}
            <Text style={styles.synopsis}>{item.synopsis}</Text>

            {/* Cast & Genres */}
            <View style={styles.infoSection}>
              <Text style={styles.castText}>
                <Text style={styles.infoLabel}>Starring: </Text>
                {item.cast.join(', ')}
              </Text>
              <Text style={styles.genresText}>
                <Text style={styles.infoLabel}>Genres: </Text>
                {item.genres.join(', ')}
              </Text>
            </View>

            {/* Interactive Row */}
            <View style={styles.actionIconRow}>
              <TouchableOpacity
                style={styles.actionIconBtn}
                onPress={() => setInMyList(!inMyList)}
              >
                {inMyList ? (
                  <Check color={Colors.netflixRed} size={24} />
                ) : (
                  <Plus color="#FFFFFF" size={24} />
                )}
                <Text style={styles.actionIconLabel}>
                  {inMyList ? 'Added' : 'My List'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionIconBtn}
                onPress={() => setLiked(!liked)}
              >
                <ThumbsUp
                  color={liked ? Colors.netflixRed : '#FFFFFF'}
                  fill={liked ? Colors.netflixRed : 'transparent'}
                  size={24}
                />
                <Text style={styles.actionIconLabel}>Rate</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionIconBtn}>
                <Share2 color="#FFFFFF" size={24} />
                <Text style={styles.actionIconLabel}>Share</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* More Like This Section */}
            <Text style={styles.sectionHeader}>More Like This</Text>
            <View style={styles.gridContainer}>
              {TRENDING_NOW.map((simItem) => (
                <View key={simItem.id} style={styles.gridCard}>
                  <Image
                    source={{ uri: simItem.poster }}
                    style={styles.gridImage}
                    resizeMode="cover"
                  />
                  <View style={styles.gridMeta}>
                    <Text style={styles.gridTitle} numberOfLines={1}>
                      {simItem.title}
                    </Text>
                    <Text style={styles.gridMatch}>{simItem.matchScore}% Match</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 16,
    zIndex: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(30,30,30,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  backdropContainer: {
    width: width,
    height: 240,
    position: 'relative',
  },
  backdropImage: {
    width: '100%',
    height: '100%',
  },
  backdropGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  body: {
    paddingHorizontal: 16,
    marginTop: -10,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  matchScore: {
    color: '#46d369',
    fontSize: 14,
    fontWeight: '700',
  },
  yearText: {
    color: '#A3A3A3',
    fontSize: 14,
  },
  ratingBadge: {
    backgroundColor: '#333333',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  ratingBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  durationText: {
    color: '#A3A3A3',
    fontSize: 13,
  },
  qualityBadge: {
    borderWidth: 1,
    borderColor: '#666',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  qualityBadgeText: {
    color: '#CCCCCC',
    fontSize: 10,
    fontWeight: '600',
  },
  primaryPlayBtn: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 6,
    gap: 8,
    marginBottom: 10,
  },
  primaryPlayText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  downloadBtn: {
    backgroundColor: '#2A2A2A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 6,
    gap: 8,
    marginBottom: 16,
  },
  downloadText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  synopsis: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  infoSection: {
    gap: 6,
    marginBottom: 20,
  },
  castText: {
    color: '#8C8C8C',
    fontSize: 13,
    lineHeight: 18,
  },
  genresText: {
    color: '#8C8C8C',
    fontSize: 13,
    lineHeight: 18,
  },
  infoLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  actionIconRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 36,
    paddingVertical: 10,
  },
  actionIconBtn: {
    alignItems: 'center',
    gap: 6,
  },
  actionIconLabel: {
    color: '#A3A3A3',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#262626',
    marginVertical: 18,
  },
  sectionHeader: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  gridCard: {
    width: (width - 42) / 3,
    backgroundColor: '#1C1C1C',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  gridImage: {
    width: '100%',
    height: 140,
  },
  gridMeta: {
    padding: 6,
  },
  gridTitle: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  gridMatch: {
    color: '#46d369',
    fontSize: 10,
    fontWeight: '700',
  },
});
