import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, Text, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { MediaThumb } from '@/components/media-thumb';
import { Button } from '@/components/ui/button';
import { deleteFromAlbum, listAlbumItems, requestLibraryAccess } from '@/features/media/album';
import type { MediaItem } from '@/features/media/types';
import { shareTo } from '@/features/share/share';
import { errorMessage } from '@/lib/errors';
import { plural } from '@/lib/format';
import { putTransfer } from '@/lib/transfer';

type Status = 'loading' | 'ready' | 'denied';

const COLUMNS = 3;

export default function MediaScreen() {
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  // URIs in the order they were tapped, which is the order they are shared in.
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    const allowed = await requestLibraryAccess();
    if (!allowed) {
      setStatus('denied');
      return;
    }
    try {
      const albumItems = await listAlbumItems();
      setItems(albumItems);
      setSelected((current) =>
        current.filter((uri) => albumItems.some((item) => item.uri === uri))
      );
    } catch (error) {
      Alert.alert('Could not open the album', errorMessage(error));
    } finally {
      setStatus('ready');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = (uri: string) =>
    setSelected((current) =>
      current.includes(uri) ? current.filter((value) => value !== uri) : [...current, uri]
    );

  const chosen = selected
    .map((uri) => items.find((item) => item.uri === uri))
    .filter((item): item is MediaItem => item !== undefined);
  const single = chosen.length === 1 ? chosen[0] : null;

  const edit = () => {
    if (!single) {
      return;
    }
    const pathname = single.kind === 'video' ? '/video-editor' : '/image-editor';
    router.push({ pathname, params: { transfer: putTransfer([single]) } });
  };

  const remove = () => {
    Alert.alert(
      `Delete ${plural(chosen.length, 'item')}?`,
      'They will be removed from the School Admin album on this phone. Anything already shared stays shared.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFromAlbum(chosen);
              setSelected([]);
              await load();
            } catch (error) {
              Alert.alert('Could not delete', errorMessage(error));
            }
          },
        },
      ]
    );
  };

  if (status === 'denied') {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background px-8">
        <Text className="text-center text-lg font-semibold text-foreground">
          Allow access to photos and videos
        </Text>
        <Text className="text-center text-base text-muted">
          The app needs this to show the School Admin album. Your photos stay on this phone.
        </Text>
        <Button label="Try again" onPress={load} />
        <Button
          variant="ghost"
          label="Open phone settings"
          onPress={() => Linking.openSettings()}
        />
      </View>
    );
  }

  if (status === 'ready' && items.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        message="Edited photos, videos and notice cards are saved here so you can share them again."
      />
    );
  }

  const size = Math.floor(width / COLUMNS);
  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={items}
        keyExtractor={(item) => item.uri}
        numColumns={COLUMNS}
        refreshing={refreshing}
        onRefresh={refresh}
        contentContainerStyle={{ paddingBottom: chosen.length > 0 ? 180 : 16 }}
        renderItem={({ item }) => {
          const position = selected.indexOf(item.uri);
          return (
            <MediaThumb
              item={item}
              size={size}
              selectionNumber={position >= 0 ? position + 1 : undefined}
              onPress={() => toggle(item.uri)}
            />
          );
        }}
      />
      {chosen.length > 0 ? (
        <View className="absolute bottom-0 left-0 right-0 gap-3 border-t border-border bg-background p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">
              {plural(chosen.length, 'item')} selected
            </Text>
            <Button size="sm" variant="ghost" label="Clear" onPress={() => setSelected([])} />
          </View>
          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              variant="whatsapp"
              icon="logo-whatsapp"
              label="WhatsApp"
              onPress={() => shareTo('whatsapp', chosen)}
            />
            <Button
              className="flex-1"
              variant="facebook"
              icon="logo-facebook"
              label="Facebook"
              onPress={() => shareTo('facebook', chosen)}
            />
            {single?.kind === 'video' ? (
              <Button
                size="icon"
                variant="youtube"
                icon="logo-youtube"
                accessibilityLabel="YouTube"
                onPress={() => shareTo('youtube', chosen)}
              />
            ) : null}
          </View>
          <View className="flex-row gap-2">
            {single ? (
              <Button
                className="flex-1"
                variant="secondary"
                icon="create-outline"
                label="Edit"
                onPress={edit}
              />
            ) : null}
            <Button
              className="flex-1"
              variant="secondary"
              icon="trash-outline"
              label="Delete"
              onPress={remove}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
