import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Canvas,
  Group,
  ImageFormat,
  Picture,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BusyModal } from '@/components/busy-modal';
import { Button } from '@/components/ui/button';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Section } from '@/components/ui/section';
import { loadEditablePhoto } from '@/features/image-editor/draw-photo';
import { saveToAlbum } from '@/features/media/album';
import { pickMedia, takePhoto } from '@/features/media/picker';
import type { MediaItem } from '@/features/media/types';
import { drawNoticeCard, showsDate, type Notice } from '@/features/notice-card/draw-card';
import { formatNoticeDate } from '@/features/notice-card/fit';
import {
  CARD_SIZES,
  DEFAULT_NOTICE_STYLE,
  DESIGNS,
  THEMES,
  type CardSizeId,
  type NoticeStyle,
  type ThemeId,
} from '@/features/notice-card/styles';
import { useLogoImage, useOverlayFonts } from '@/features/overlays/assets';
import { useSettings } from '@/features/settings/store';
import { errorMessage } from '@/lib/errors';
import { deleteTemporaryFile, outputFile, writeBytes } from '@/lib/files';
import { renderToBytes } from '@/lib/skia';
import { putTransfer } from '@/lib/transfer';
import { waitForPaint } from '@/lib/utils';
import { brand } from '@/theme/colors';

const TITLE_IDEAS = [
  'Holiday Notice',
  'Parent-Teacher Meeting',
  'Fee Reminder',
  'Annual Function',
  'Important Notice',
];

const THEME_OPTIONS = (Object.keys(THEMES) as ThemeId[]).map((id) => ({
  value: id,
  label: THEMES[id].label,
}));
const SIZE_OPTIONS = (Object.keys(CARD_SIZES) as CardSizeId[]).map((id) => ({
  value: id,
  label: CARD_SIZES[id].label,
}));

// No card is taller than this, so a bigger copy of the photo would only use more memory.
const PHOTO_MAX_SIDE = 1350;
// Pictures of these types can have see-through parts, such as clip art, which stay see-through on
// the card.
const SEE_THROUGH_TYPES = ['image/png', 'image/webp'];

type PhotoSource = 'gallery' | 'camera';

export default function NoticeCardScreen() {
  const settings = useSettings();
  const fonts = useOverlayFonts();
  const logo = useLogoImage();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [style, setStyle] = useState<NoticeStyle>(DEFAULT_NOTICE_STYLE);
  const [photo, setPhoto] = useState<SkImage | null>(null);
  const [addingPhoto, setAddingPhoto] = useState<PhotoSource | null>(null);
  const [saving, setSaving] = useState(false);
  // Blocks a second save from a quick double tap before the busy screen appears.
  const saveInProgress = useRef(false);
  // Blocks a second photo picker or camera from a quick double tap.
  const photoInProgress = useRef(false);
  // A photo that finishes loading after the screen has closed is freed instead of shown.
  const closed = useRef(false);

  useEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
    };
  }, []);

  // Frees the photo once it is removed or the screen closes.
  useEffect(() => () => photo?.dispose(), [photo]);

  const cardSize = CARD_SIZES[style.size];
  const previewWidth = windowWidth - 32;
  const scale = previewWidth / cardSize.width;
  const notice: Notice = { title, body, date, photo };
  const school = {
    name: settings.schoolName,
    address: settings.address,
    phone: settings.phone,
    website: settings.website,
  };
  const assets = { fonts, logo };

  const recorder = Skia.PictureRecorder();
  const preview = drawNoticeCard(
    recorder.beginRecording(Skia.XYWHRect(0, 0, cardSize.width, cardSize.height)),
    notice,
    style,
    assets,
    school
  );
  const picture = recorder.finishRecordingAsPicture();

  const hasText = title.trim().length > 0 || body.trim().length > 0;
  const ready = fonts !== null && logo !== null;
  const tooLong = photo
    ? 'The notice is too long to fit with the photo.'
    : 'The notice is too long to fit.';
  const bodyWarning =
    style.size === 'square'
      ? `${tooLong} Shorten the text or choose Portrait 4:5.`
      : `${tooLong} Shorten the text.`;
  const noRoom = 'There is no room for the notice text with the photo.';
  const noRoomWarning =
    style.size === 'square'
      ? `${noRoom} Shorten the title or choose Portrait 4:5.`
      : `${noRoom} Shorten the title.`;
  const warnings = [
    preview.overflow.title ? 'The title is too long to fit on two lines. Shorten it.' : null,
    preview.overflow.body ? bodyWarning : null,
    preview.bodyLeftOff ? noRoomWarning : null,
  ].filter((warning): warning is string => warning !== null);

  const addPhoto = async (source: PhotoSource) => {
    if (photoInProgress.current) {
      return;
    }
    photoInProgress.current = true;
    setAddingPhoto(source);
    let picked: MediaItem | null | undefined;
    try {
      picked =
        source === 'gallery'
          ? (await pickMedia({ kinds: ['image'], multiple: false }))[0]
          : await takePhoto();
      if (picked) {
        const image = await loadEditablePhoto(picked.uri, {
          maxSide: PHOTO_MAX_SIDE,
          keepTransparency: SEE_THROUGH_TYPES.includes(picked.mimeType ?? ''),
        });
        if (closed.current) {
          image.dispose();
        } else {
          setPhoto(image);
        }
      }
    } catch (error) {
      Alert.alert('Could not add the photo', errorMessage(error));
    } finally {
      // The card keeps its own decoded copy, so the picker's or camera's file isn't needed.
      deleteTemporaryFile(picked?.uri);
      setAddingPhoto(null);
      photoInProgress.current = false;
    }
  };

  const save = async () => {
    if (saveInProgress.current) {
      return;
    }
    saveInProgress.current = true;
    setSaving(true);
    try {
      await waitForPaint();
      // PNG keeps the lettering crisp.
      const bytes = renderToBytes(cardSize, ImageFormat.PNG, 100, (canvas) => {
        drawNoticeCard(canvas, notice, style, assets, school);
      });
      const item = await saveToAlbum({
        uri: writeBytes(outputFile('notice-cards', 'png'), bytes),
        kind: 'image',
        width: cardSize.width,
        height: cardSize.height,
        durationMs: null,
      });
      router.replace({ pathname: '/saved', params: { transfer: putTransfer([item]) } });
    } catch (error) {
      Alert.alert('Could not save the notice card', errorMessage(error));
    } finally {
      setSaving(false);
      saveInProgress.current = false;
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-surface">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-5 p-4">
        <View className="overflow-hidden rounded-xl border border-border bg-background">
          <Canvas style={{ width: previewWidth, height: cardSize.height * scale }}>
            <Group transform={[{ scale }]}>
              <Picture picture={picture} />
            </Group>
          </Canvas>
        </View>
        {warnings.length > 0 ? (
          <View className="flex-row gap-2 rounded-xl bg-brand-blush p-3">
            <Icon name="alert-circle" size={20} color={brand.magenta} />
            <Text className="flex-1 text-sm text-foreground">{warnings.join('\n')}</Text>
          </View>
        ) : null}

        <Section title="Title">
          <Input value={title} onChangeText={setTitle} placeholder="Enter a title" maxLength={80} />
          <ChoiceChips
            options={TITLE_IDEAS.map((idea) => ({ value: idea, label: idea }))}
            value={title}
            onChange={setTitle}
          />
        </Section>

        <Section title="Notice">
          <Input
            multiline
            value={body}
            onChangeText={setBody}
            placeholder="Enter the notice text"
            maxLength={1500}
            className="min-h-40"
          />
        </Section>

        <Section title="Photo">
          {photo ? (
            <Button
              variant="secondary"
              icon="trash-outline"
              label="Remove photo"
              onPress={() => setPhoto(null)}
            />
          ) : (
            <View className="flex-row gap-3">
              <Button
                className="flex-1"
                variant="secondary"
                icon="images-outline"
                label="Gallery"
                loading={addingPhoto === 'gallery'}
                disabled={addingPhoto !== null}
                onPress={() => addPhoto('gallery')}
              />
              <Button
                className="flex-1"
                variant="secondary"
                icon="camera-outline"
                label="Camera"
                loading={addingPhoto === 'camera'}
                disabled={addingPhoto !== null}
                onPress={() => addPhoto('camera')}
              />
            </View>
          )}
        </Section>

        {showsDate(notice) ? (
          <Section title="Date">
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowDatePicker(true)}
              className="h-12 flex-row items-center gap-3 rounded-xl border border-border bg-background px-3">
              <Icon name="calendar-outline" size={20} color={brand.blue} />
              <Text className="flex-1 text-base text-foreground">{formatNoticeDate(date)}</Text>
              <Text className="text-sm font-semibold text-brand-blue">Change</Text>
            </Pressable>
            {showDatePicker ? (
              <DateTimePicker
                value={date}
                mode="date"
                onChange={(event, selected) => {
                  setShowDatePicker(false);
                  if (event.type === 'set' && selected) {
                    setDate(selected);
                  }
                }}
              />
            ) : null}
          </Section>
        ) : null}

        <Section title="Design">
          <ChoiceChips
            options={DESIGNS}
            value={style.design}
            onChange={(design) => setStyle({ ...style, design })}
          />
        </Section>
        <Section title="Colours">
          <ChoiceChips
            options={THEME_OPTIONS}
            value={style.theme}
            onChange={(theme) => setStyle({ ...style, theme })}
          />
        </Section>
        <Section title="Size">
          <ChoiceChips
            options={SIZE_OPTIONS}
            value={style.size}
            onChange={(size) => setStyle({ ...style, size })}
          />
        </Section>
        <Text className="text-sm text-muted">
          The logo and school details are taken from Settings.
        </Text>
      </ScrollView>
      <View
        className="border-t border-border bg-background px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}>
        <Button
          size="lg"
          icon="checkmark"
          label="Save notice card"
          disabled={!(hasText || photo) || !ready || addingPhoto !== null}
          loading={saving}
          onPress={save}
        />
      </View>
      <BusyModal visible={saving} title="Saving notice card…" />
    </KeyboardAvoidingView>
  );
}
