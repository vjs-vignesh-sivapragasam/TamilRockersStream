import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X, Play } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { MediaItem } from '../data/sampleMedia';
import { searchMedia } from '../services/movieApi';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectItem: (item: MediaItem) => void;
}

const { width } = Dimensions.get('window');

export const SearchModal: React.FC<SearchModalProps> = ({
  visible,
  onClose,
  onSelectItem,
}) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchMedia(query);
        setResults(data);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        {/* Search Header Bar */}
        <View style={styles.searchBarRow}>
          <View style={styles.inputWrapper}>
            <Search color="#888" size={18} style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              placeholder="Search movies, TV shows, genres..."
              placeholderTextColor="#888"
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
                <X color="#888" size={16} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color={Colors.netflixRed} />
            <Text style={styles.loadingText}>Searching media database...</Text>
          </View>
        )}

        {/* Results List */}
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultCard}
              activeOpacity={0.8}
              onPress={() => {
                onClose();
                onSelectItem(item);
              }}
            >
              <Image source={{ uri: item.poster }} style={styles.poster} />
              <View style={styles.cardInfo}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.meta}>
                  {item.matchScore}% Match • {item.genres.slice(0, 2).join(', ')}
                </Text>
                <Text style={styles.synopsis} numberOfLines={2}>
                  {item.synopsis}
                </Text>
              </View>
              <View style={styles.playIconWrapper}>
                <Play color="#FFFFFF" size={18} fill="#FFFFFF" style={{ marginLeft: 2 }} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() =>
            !loading && query.trim().length > 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No results found for "{query}"</Text>
                <Text style={styles.emptySubtitle}>Try searching for a different movie title, series, or actor.</Text>
              </View>
            ) : null
          }
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingHorizontal: 14,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  cancelBtn: {
    paddingHorizontal: 4,
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    color: '#888',
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 30,
    gap: 10,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 6,
    overflow: 'hidden',
    padding: 8,
    gap: 12,
  },
  poster: {
    width: 60,
    height: 85,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: '#46d369',
    fontSize: 11,
    fontWeight: '600',
  },
  synopsis: {
    color: '#A3A3A3',
    fontSize: 12,
    lineHeight: 16,
  },
  playIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#777',
    fontSize: 13,
    textAlign: 'center',
  },
});
