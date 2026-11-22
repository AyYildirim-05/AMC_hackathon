import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Theme, useThemedStyles } from '@/hooks/use-themed-styles';
import { useIssueStatusColors } from '@/components/utils/issue-status';
import { nearestIssueWithin, type District } from '@/components/utils/map-utils';
import { PublishReportButton } from '@/components/report/PublishReportButton';
import { CARD_SHADOW } from '@/components/utils/themed-card';
import { ProfileButton } from '@/components/utils/profile-button';
import { WEATHER_ELEMENT_META } from '@/components/utils/weather-elements';
import { Fonts, Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';
import type { Language } from '@/i18n';
import { describeIssueImages, type AiImageSource } from '@/lib/api/ai';
import { fetchMontrealDistricts, locateDistrictByCoordinates } from '@/lib/api/districts';
import {
  createIssue,
  fetchIssuesByDistrict,
  fetchMyVotes,
  toggleIssueVote,
} from '@/lib/api/issues';
import { getApiErrorMessage } from '@/lib/auth/auth-api';
import { detectDeviceLocation, geocodeAddress, reverseGeocodeLocation } from '@/lib/location';
import {
  ISSUE_STATUSES,
  WEATHER_ELEMENTS,
  type Issue,
  type IssueCategory,
  type WeatherElement,
} from '@/models/Issue';
import { uploadIssuePhotos } from '@/lib/uploads/cloudinary';

import { ReportLocationMap } from './ReportLocationMap';

/** A new report this close to an open issue is probably a duplicate of it. */
const DUPLICATE_RADIUS_METERS = 50;

export type CivicCategoryKey =
  'traffic_safety' | 'roads_potholes' | 'streetlights_utilities' | 'parks_cleanliness';

export interface CivicCategoryItem {
  key: CivicCategoryKey;
  icon: string;
  titleKey: string;
  fallbackTitle: string;
  subKey: string;
  fallbackSub: string;
}

export const CIVIC_CATEGORIES: CivicCategoryItem[] = [
  {
    key: 'traffic_safety',
    icon: '🚲',
    titleKey: 'districtScreen.categories.safety',
    fallbackTitle: 'Sécurité & Pistes cyclables',
    subKey: 'districtScreen.categories.safetySub',
    fallbackSub: 'Voies REV, feux, piétons',
  },
  {
    key: 'roads_potholes',
    icon: '🛠',
    titleKey: 'districtScreen.categories.potholes',
    fallbackTitle: 'Nids-de-poule & Chaussée',
    subKey: 'districtScreen.categories.potholesSub',
    fallbackSub: 'Asphalte, trottoirs cassés',
  },
  {
    key: 'streetlights_utilities',
    icon: '💡',
    titleKey: 'districtScreen.categories.utilities',
    fallbackTitle: 'Éclairage & Utilités',
    subKey: 'districtScreen.categories.utilitiesSub',
    fallbackSub: 'Lampadaires, égouts, eau',
  },
  {
    key: 'parks_cleanliness',
    icon: '🌲',
    titleKey: 'districtScreen.categories.parks',
    fallbackTitle: 'Parcs & Propreté',
    subKey: 'districtScreen.categories.parksSub',
    fallbackSub: 'Dépôts sauvages, parcs',
  },
];

export interface DistrictItem {
  id: string;
  name: string;
  postalCode: string;
  /** False when `postalCode` is only the Plateau fallback, so it is not shown as the district's. */
  hasPostalCode?: boolean;
  status: string;
  isClaimed: boolean;
}

const POSTAL_CODES_BY_SLUG: Record<string, string> = {
  'le-plateau-mont-royal': 'H2J 1S4',
  'ville-marie': 'H2L 2C9',
  'rosemont-la-petite-patrie': 'H1Y 2A1',
  westmount: 'H3Z 1A1',
};

function toDistrictItem(d: District): DistrictItem {
  return {
    id: d.id,
    name: d.name_fr || d.name_en,
    postalCode: d.postal_code || POSTAL_CODES_BY_SLUG[d.open_north_slug] || 'H2J 1S4',
    hasPostalCode: Boolean(d.postal_code || POSTAL_CODES_BY_SLUG[d.open_north_slug]),
    status: d.district_type === 'borough' ? 'Arrondissement validé' : 'Municipalité liée',
    isClaimed: Boolean(d.is_claimed),
  };
}

export interface DistrictScreenProps {
  /** Optional callback when back button is pressed. */
  onBack?: () => void;
  /** Optional callback invoked after successfully publishing. */
  onSubmitSuccess?: (issueData: Partial<Issue>) => void;
  /** Initial selected borough ID. */
  initialDistrictId?: string;
  /** Initial selected category. */
  initialCategory?: CivicCategoryKey | null;
  /** Initial selected weather elements. */
  initialElements?: WeatherElement[];
  /** Initial report address. */
  initialAddress?: string;
  /** Initial report title. */
  initialTitle?: string;
  /** Initial report description. */
  initialDescription?: string;
  /** Initial image URLs. */
  initialPhotos?: string[];
  /** Whether 311 forwarding is active initially. */
  initialMtl311?: boolean;
  /** Optional testID. */
  testID?: string;
}

const DEFAULT_COORDINATES = {
  latitude: 45.529841,
  longitude: -73.575124,
  place: 'Parc La Fontaine',
};

export function DistrictScreen({
  onBack,
  onSubmitSuccess,
  initialDistrictId = '11111111-1111-4111-8111-111111111101',
  initialCategory = null,
  initialElements = [],
  initialAddress = '',
  initialTitle = '',
  initialDescription = '',
  initialPhotos = [],
  initialMtl311 = true,
  testID = 'district-screen',
}: DistrictScreenProps) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const statusColors = useIssueStatusColors();
  // The same shadow as every other card (ThemedCard), in the theme's shadow color.
  const cardShadow = { ...CARD_SHADOW, shadowColor: theme.shadow };
  const user = useCurrentUser();
  const queryClient = useQueryClient();

  // Every Montréal borough (the server adds missing ones from OpenNorth), so a report can be filed
  // anywhere on the island, not only in districts someone created before.
  const { data: apiDistricts } = useQuery<District[]>({
    queryKey: ['districts', 'montreal'],
    queryFn: fetchMontrealDistricts,
  });
  // Boroughs just added on the server should show up on the other screens' district lists too.
  useEffect(() => {
    if (apiDistricts) void queryClient.invalidateQueries({ queryKey: ['districts'], exact: true });
  }, [apiDistricts, queryClient]);

  const districtOptions = useMemo<DistrictItem[]>(
    () => (apiDistricts ?? []).map(toDistrictItem),
    [apiDistricts],
  );

  const homeDistrictItem = useMemo<DistrictItem>(() => {
    if (user?.homeDistrictId) {
      const match = districtOptions.find((d) => d.id === user.homeDistrictId);
      if (match) return match;
    }
    return (
      districtOptions.find((d) => d.id === initialDistrictId) ??
      districtOptions[0] ?? {
        id: '',
        name: '',
        postalCode: user?.postalCode || 'H2J 1S4',
        status: 'Arrondissement validé',
        isClaimed: false,
      }
    );
  }, [districtOptions, user, initialDistrictId]);

  // Helper with safe fallbacks
  const tText = useCallback(
    (key: string, fallback: string, options?: Record<string, unknown>): string => {
      try {
        const res = (t as unknown as (k: string, opt?: Record<string, unknown>) => string)(
          key,
          options,
        );
        return res && res !== key ? res : fallback;
      } catch {
        return fallback;
      }
    },
    [t],
  );

  // State
  const [pickedDistrict, setPickedDistrict] = useState<DistrictItem | null>(null);
  const selectedDistrict = pickedDistrict ?? homeDistrictItem;
  const [districtTab, setDistrictTab] = useState<'my' | 'other'>('my');
  const [isBoroughModalVisible, setIsBoroughModalVisible] = useState(false);
  const [boroughSearch, setBoroughSearch] = useState('');
  const visibleDistrictOptions = useMemo(() => {
    const fold = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const query = fold(boroughSearch.trim());
    return query ? districtOptions.filter((d) => fold(d.name).includes(query)) : districtOptions;
  }, [districtOptions, boroughSearch]);

  const [selectedCategory, setSelectedCategory] = useState<CivicCategoryKey | null>(
    initialCategory,
  );
  // The server has no parks category, so parks reports are saved as traffic_safety.
  const issueCategory: IssueCategory | null =
    selectedCategory === null
      ? null
      : selectedCategory === 'parks_cleanliness'
        ? 'traffic_safety'
        : selectedCategory;
  const [selectedElements, setSelectedElements] = useState<WeatherElement[]>(initialElements);
  const [address, setAddress] = useState(initialAddress);
  const [coordinates, setCoordinates] = useState(DEFAULT_COORDINATES);
  const [isAdjustingPin, setIsAdjustingPin] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Other issues in the report's district, shown on the map by status.
  const { data: districtIssues } = useQuery({
    queryKey: ['issues', 'district', selectedDistrict.id],
    queryFn: () => fetchIssuesByDistrict(selectedDistrict.id),
    enabled: Boolean(selectedDistrict.id),
  });
  const mappableIssues = useMemo(
    () =>
      (districtIssues ?? []).filter(
        (i) => Number.isFinite(i.latitude) && Number.isFinite(i.longitude),
      ),
    [districtIssues],
  );

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const photoMetaRef = useRef<Record<string, Omit<AiImageSource, 'uri'>>>({});
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [aiDescriptionError, setAiDescriptionError] = useState<string | null>(null);
  const [mtl311Enabled, setMtl311Enabled] = useState(initialMtl311);
  const [isPublishing, setIsPublishing] = useState(false);
  const [duplicate, setDuplicate] = useState<{ issue: Issue; meters: number } | null>(null);

  // Status feedback toast
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const isFormValid = Boolean(
    selectedDistrict.id &&
    selectedCategory &&
    address.trim().length > 0 &&
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude) &&
    title.trim().length > 0 &&
    description.trim().length > 0,
  );
  const canPublish = isFormValid && !isPublishing;

  const handleSelectDistrict = (item: DistrictItem) => {
    setPickedDistrict(item);
    setIsBoroughModalVisible(false);
    setBoroughSearch('');
  };

  const handleToggleElement = (element: WeatherElement) => {
    setSelectedElements((prev) =>
      prev.includes(element) ? prev.filter((item) => item !== element) : [...prev, element],
    );
  };

  const handleRemovePhoto = (index: number) => {
    setAiDescriptionError(null);
    setPhotos((prev) => {
      const removedUri = prev[index];
      if (removedUri) delete photoMetaRef.current[removedUri];
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleTakePhoto = async () => {
    if (photos.length >= 3) {
      Alert.alert(
        tText('districtScreen.photosTitle', 'Photos justificatives (max. 3)', { max: 3 }),
        tText('photos.limitReached', 'Vous pouvez ajouter jusqu’à 3 photos.', { max: 3 }),
      );
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          tText('common.error', 'Erreur'),
          tText(
            'photos.cameraDenied',
            "L'accès à l'appareil photo est désactivé. Autorisez-le dans les Réglages pour prendre des photos.",
          ),
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        const asset = res.assets[0];
        photoMetaRef.current[asset.uri] = {
          base64: asset.base64,
          mimeType: asset.mimeType,
          fileName: asset.fileName,
        };
        setAiDescriptionError(null);
        setPhotos((prev) => [...prev, asset.uri].slice(0, 3));
      }
    } catch {
      Alert.alert(
        tText('common.error', 'Erreur'),
        tText('photos.unavailable', "Impossible d'ouvrir l'appareil photo ou la photothèque."),
      );
    }
  };

  const handlePickFromGallery = async () => {
    if (photos.length >= 3) {
      Alert.alert(
        tText('districtScreen.photosTitle', 'Photos justificatives (max. 3)', { max: 3 }),
        tText('photos.limitReached', 'Vous pouvez ajouter jusqu’à 3 photos.', { max: 3 }),
      );
      return;
    }

    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        const asset = res.assets[0];
        photoMetaRef.current[asset.uri] = {
          base64: asset.base64,
          mimeType: asset.mimeType,
          fileName: asset.fileName,
        };
        setAiDescriptionError(null);
        setPhotos((prev) => [...prev, asset.uri].slice(0, 3));
      }
    } catch {
      Alert.alert(
        tText('common.error', 'Erreur'),
        tText('photos.unavailable', "Impossible d'ouvrir l'appareil photo ou la photothèque."),
      );
    }
  };

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setFeedbackToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setFeedbackToast(null), 2500);
  }, []);

  const handleGenerateDescription = async () => {
    if (photos.length === 0 || isGeneratingDescription) return;

    const currentLanguage: Language = (i18n.resolvedLanguage ?? i18n.language ?? 'en')
      .toLowerCase()
      .startsWith('fr')
      ? 'fr'
      : 'en';

    setIsGeneratingDescription(true);
    setAiDescriptionError(null);
    try {
      const images: AiImageSource[] = photos.map((uri) => ({
        uri,
        ...photoMetaRef.current[uri],
      }));
      const result = await describeIssueImages({
        images,
        language: currentLanguage,
        context: {
          category: selectedCategory ?? undefined,
          address: address.trim() || undefined,
          districtName: selectedDistrict.name || undefined,
          elements: selectedElements.length > 0 ? selectedElements : undefined,
        },
      });
      if (result.description) {
        setDescription(result.description);
        showToast(
          tText(
            'districtScreen.aiDescription.generatedToast',
            'Description remplie à partir de votre photo.',
          ),
        );
      }
    } catch (err) {
      setAiDescriptionError(
        getApiErrorMessage(
          err,
          tText(
            'districtScreen.aiDescription.error',
            'Impossible de générer une description pour le moment. Veuillez réessayer.',
          ),
        ),
      );
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  /** Set once the user chooses a spot themselves, so the GPS lookup at open doesn't move it. */
  const userPlacedRef = useRef(false);

  /**
   * Reads the device's GPS coordinates and resolves the matching Montreal district via the
   * backend's OpenNorth Represent API endpoint (`GET /api/districts/locate`).
   */
  const locateAndResolveDistrict = useCallback(
    async (options?: { notifyOnFallback?: boolean }) => {
      const detected = await detectDeviceLocation();
      if (!detected) {
        if (options?.notifyOnFallback) {
          showToast(
            tText(
              'districtScreen.locationUnavailable',
              "Impossible d'obtenir votre position actuelle. Vérifiez les autorisations de localisation.",
            ),
          );
        }
        return false;
      }

      setCoordinates((prev) => ({
        latitude: detected.latitude,
        longitude: detected.longitude,
        place: detected.place ?? prev.place,
      }));
      setAddress(detected.address ?? `${detected.latitude}, ${detected.longitude}`);

      try {
        const { district } = await locateDistrictByCoordinates(
          detected.latitude,
          detected.longitude,
        );
        const item = toDistrictItem(district);
        if (detected.postalCode && !district.postal_code) {
          item.postalCode = detected.postalCode;
        }
        setPickedDistrict(item);
        setCoordinates((prev) => ({
          ...prev,
          place: detected.place ?? item.name,
        }));
        void queryClient.invalidateQueries({ queryKey: ['districts'] });
        if (options?.notifyOnFallback) {
          showToast(`Localisation détectée : ${item.name}`);
        }
        return true;
      } catch {
        if (options?.notifyOnFallback) {
          showToast(tText('districtScreen.locationDetected', 'Position actuelle détectée'));
        }
        return true;
      }
    },
    [queryClient, showToast, tText],
  );

  const handleUseCurrentLocation = async () => {
    if (isLocating) return;
    setIsLocating(true);
    try {
      await locateAndResolveDistrict({ notifyOnFallback: true });
    } finally {
      setIsLocating(false);
    }
  };

  // Automatically localize via device GPS + OpenNorth when opening the report screen.
  useEffect(() => {
    let active = true;
    const run = async () => {
      const detected = await detectDeviceLocation();
      // The user may have placed the pin or searched an address while GPS was still looking.
      if (!active || !detected || userPlacedRef.current) return;

      setCoordinates((prev) => ({
        latitude: detected.latitude,
        longitude: detected.longitude,
        place: detected.place ?? prev.place,
      }));
      setAddress(detected.address ?? `${detected.latitude}, ${detected.longitude}`);

      try {
        const { district } = await locateDistrictByCoordinates(
          detected.latitude,
          detected.longitude,
        );
        if (!active) return;
        const item = toDistrictItem(district);
        if (detected.postalCode && !district.postal_code) {
          item.postalCode = detected.postalCode;
        }
        setPickedDistrict(item);
        setCoordinates((prev) => ({
          ...prev,
          place: detected.place ?? item.name,
        }));
        void queryClient.invalidateQueries({ queryKey: ['districts'] });
      } catch {
        // Keep detected GPS coordinates even if OpenNorth is unavailable or outside Montreal.
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [queryClient]);

  // Pin mode: tap the map (or drag the report marker) to place the report point.
  const handleAdjustPin = () => setIsAdjustingPin((prev) => !prev);

  /** Only the latest pin placement may update the form, however fast the user taps. */
  const pickRequestRef = useRef(0);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  /**
   * A point picked on the map becomes the report location: coordinates now, then the street
   * address (reverse geocoding) and the Montreal district (OpenNorth) for it.
   */
  const handlePickPoint = async (picked: { latitude: number; longitude: number }) => {
    const request = ++pickRequestRef.current;
    userPlacedRef.current = true;
    const latitude = Number(picked.latitude.toFixed(6));
    const longitude = Number(picked.longitude.toFixed(6));
    setCoordinates((prev) => ({ ...prev, latitude, longitude }));

    const geocoded = await reverseGeocodeLocation(latitude, longitude);
    if (request !== pickRequestRef.current) return;
    setAddress(geocoded.address ?? `${latitude}, ${longitude}`);
    if (geocoded.place)
      setCoordinates((prev) => ({ ...prev, place: geocoded.place ?? prev.place }));

    try {
      const { district } = await locateDistrictByCoordinates(latitude, longitude);
      if (request !== pickRequestRef.current) return;
      const item = toDistrictItem(district);
      if (geocoded.postalCode && !district.postal_code) item.postalCode = geocoded.postalCode;
      setPickedDistrict(item);
      if (!geocoded.place) setCoordinates((prev) => ({ ...prev, place: item.name }));
      void queryClient.invalidateQueries({ queryKey: ['districts'] });
    } catch {
      // Outside Montreal (or OpenNorth unavailable): keep the pin and address, not the district.
      if (request === pickRequestRef.current) {
        showToast(
          tText(
            'districtScreen.pinOutside',
            "Cet endroit n'est dans aucun arrondissement de Montréal connu.",
          ),
        );
      }
    }
  };

  /** The typed address becomes the report point: geocoded, then handled like a placed pin. */
  const handleSearchAddress = async () => {
    if (isSearchingAddress || !address.trim()) return;
    setIsSearchingAddress(true);
    try {
      const found = await geocodeAddress(address);
      if (!found) {
        showToast(
          tText(
            'districtScreen.addressNotFound',
            "Adresse introuvable. Essayez de placer l'épingle sur la carte.",
          ),
        );
        return;
      }
      await handlePickPoint(found);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleSaveDraft = () => {
    setFeedbackToast(tText('districtScreen.draftSavedToast', 'Brouillon enregistré avec succès.'));
  };

  const resetForm = () => {
    setSelectedCategory(null);
    setSelectedElements([]);
    setAddress('');
    setTitle('');
    setDescription('');
    setPhotos([]);
    photoMetaRef.current = {};
    setAiDescriptionError(null);
    setIsAdjustingPin(false);
    setMtl311Enabled(initialMtl311);
    if (districtTab === 'other') {
      setDistrictTab('my');
      setPickedDistrict(null);
    }
    setFeedbackToast(null);
  };

  const handlePublish = () => {
    if (!canPublish || isPublishing || !issueCategory) return;
    // Only open issues of the same category count: a problem that comes back is a new report.
    // Only the selected district's issues are loaded, so a duplicate just across a district
    // boundary is missed; a server-side distance query would cover that.
    if (user?.role === 'resident') {
      const nearby = nearestIssueWithin(
        mappableIssues.filter((i) => i.status !== 'resolved' && i.category === issueCategory),
        coordinates,
        DUPLICATE_RADIUS_METERS,
      );
      if (nearby) {
        setDuplicate(nearby);
        return;
      }
    }
    void publishIssue();
  };

  const handlePublishAnyway = () => {
    setDuplicate(null);
    void publishIssue();
  };

  const handleUpvoteDuplicate = async () => {
    if (!duplicate || isPublishing) return;
    const { issue } = duplicate;
    setDuplicate(null);
    setIsPublishing(true);
    try {
      // The vote endpoint toggles, so voting on an issue already upvoted would remove the vote.
      const myVotes = await queryClient.fetchQuery({
        queryKey: ['votes', 'me'],
        queryFn: fetchMyVotes,
      });
      if (myVotes.upvotedIssueIds.includes(issue.id)) {
        showToast(t('districtScreen.duplicate.alreadyUpvoted'));
        return;
      }
      await toggleIssueVote(issue.id, 'upvote');
      void queryClient.invalidateQueries({ queryKey: ['issues'] });
      void queryClient.invalidateQueries({ queryKey: ['votes', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      showToast(t('districtScreen.duplicate.upvoted'));
    } catch (err) {
      Alert.alert(
        tText('common.error', 'Erreur'),
        getApiErrorMessage(err, "Impossible d'ajouter le vote."),
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const publishIssue = async () => {
    if (!issueCategory) return;
    const ticketNumber = `MTL-311-2026-${Math.floor(10000 + Math.random() * 90000)}`;

    setIsPublishing(true);
    try {
      const localUris = photos.filter((uri) => !/^https?:\/\//i.test(uri));
      const existingCloudinaryUrls = photos.filter((uri) =>
        /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(uri),
      );
      let uploadedUrls: string[] = [];
      if (localUris.length > 0) {
        uploadedUrls = await uploadIssuePhotos(localUris);
      }
      const issueImages = [...existingCloudinaryUrls, ...uploadedUrls];

      const created = await createIssue({
        title: title.trim(),
        description: description.trim(),
        category: issueCategory,
        elements: selectedElements,
        address: address.trim(),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        districtId: selectedDistrict.id,
        images: issueImages,
        external311Ref: mtl311Enabled ? ticketNumber : null,
      });

      // Immediately reflect the new issue on the Issues feed, the Carte map, and the report map.
      queryClient.setQueryData<Issue[]>(['issues'], (prev) => {
        if (!prev) return [created];
        if (prev.some((item) => item.id === created.id)) return prev;
        return [created, ...prev];
      });
      if (selectedDistrict.id) {
        queryClient.setQueryData<Issue[]>(['issues', 'district', selectedDistrict.id], (prev) => {
          if (!prev) return [created];
          if (prev.some((item) => item.id === created.id)) return prev;
          return [created, ...prev];
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['issues'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });

      resetForm();
      onSubmitSuccess?.(created);
      router.navigate('/');
    } catch (err) {
      Alert.alert(
        tText('common.error', 'Erreur'),
        getApiErrorMessage(err, 'Impossible de publier le signalement.'),
      );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <SafeAreaView
      testID={testID}
      // Same page background as every other tab (TabScreen / ThemedView).
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ─── 1. Header Navigation Bar ─── */}
        <View
          style={[
            styles.navHeader,
            {
              backgroundColor: theme.background,
              borderBottomColor: theme.backgroundElement,
            },
          ]}
        >
          <View style={styles.navTitleContainer}>
            {/* App Icon */}
            <View style={styles.appIconBadge}>
              <Text style={styles.appIconText}>🏙</Text>
            </View>
            <Text numberOfLines={1} style={[styles.navTitleText, { color: theme.text }]}>
              {tText('districtScreen.headerTitle', 'Municipalité')}
            </Text>
          </View>

          {/* User Profile Avatar */}
          <ProfileButton testID="district-screen-profile-button" />
        </View>

        {/* ─── Toast Feedback Notice ─── */}
        {feedbackToast && (
          <View style={styles.feedbackBanner}>
            <Text style={styles.feedbackText}>{feedbackToast}</Text>
          </View>
        )}

        {/* ─── Main Scrollable Form Content ─── */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // While placing the pin, drags pan the map instead of scrolling the form.
          scrollEnabled={!isAdjustingPin}
        >
          {/* ─── 3. OpenNorth Pipeline / District Card ─── */}
          <View
            style={[
              styles.districtCard,
              cardShadow,
              {
                backgroundColor: theme.background,
                borderColor: theme.neutral200,
              },
            ]}
          >
            <View style={styles.districtTopRow}>
              {/* Radar / Crosshairs Green Badge */}
              <View style={[styles.radarBadge, { backgroundColor: theme.background }]}>
                <Text style={styles.radarIcon}>⌖</Text>
              </View>

              <View style={styles.districtInfoCol}>
                <View style={styles.livePipelineRow}>
                  <Text style={[styles.openNorthLabel, { color: theme.neutral700 }]}>
                    {tText('districtScreen.openNorthPipeline', 'OPENNORTH PIPELINE • En direct')}
                  </Text>
                  <View style={styles.liveDot} />
                </View>
                <Text style={[styles.districtNameText, { color: theme.neutral900 }]}>
                  {selectedDistrict.name}
                </Text>
              </View>
            </View>

            {/* Validation & Electoral Sector */}
            <View style={styles.sectorRow}>
              <Text style={styles.pinSmallIcon}>📍</Text>
              <Text style={[styles.sectorText, { color: theme.neutral700 }]}>
                {tText(
                  'districtScreen.electoralSector',
                  `Secteur électoral ${selectedDistrict.postalCode} • ${selectedDistrict.status}`,
                  { postal: selectedDistrict.postalCode },
                )}
              </Text>
            </View>

            {/* Segmented Buttons: Mon arrondissement / Autre arrondissement */}
            <View style={[styles.segmentedContainer, { backgroundColor: theme.neutral200 }]}>
              <Pressable
                testID="tab-mon-arrondissement"
                accessibilityRole="button"
                onPress={() => {
                  setDistrictTab('my');
                  setPickedDistrict(homeDistrictItem);
                }}
                style={[
                  styles.segmentedBtn,
                  districtTab === 'my' && [
                    styles.segmentedBtnActive,
                    {
                      backgroundColor: theme.neutral100,
                    },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.segmentedBtnText,
                    districtTab === 'my'
                      ? [
                          styles.segmentedBtnTextActive,
                          {
                            color: theme.neutral900,
                          },
                        ]
                      : { color: theme.neutral700 },
                  ]}
                >
                  {tText('districtScreen.myDistrict', 'Mon arrondissement')}
                </Text>
              </Pressable>

              <Pressable
                testID="tab-autre-arrondissement"
                accessibilityRole="button"
                onPress={() => {
                  setDistrictTab('other');
                  setIsBoroughModalVisible(true);
                }}
                style={[
                  styles.segmentedBtn,
                  districtTab === 'other' && [
                    styles.segmentedBtnActive,
                    {
                      backgroundColor: theme.neutral100,
                    },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.segmentedBtnText,
                    districtTab === 'other'
                      ? [
                          styles.segmentedBtnTextActive,
                          {
                            color: theme.neutral900,
                          },
                        ]
                      : { color: theme.neutral700 },
                  ]}
                >
                  {tText('districtScreen.otherDistrict', 'Autre arrondissement')}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ─── 4. Type d'incident civique (2x2 Grid) ─── */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {tText('districtScreen.incidentType', "Type d'incident civique")}
              </Text>
              <Text style={styles.requiredBadge}>{tText('districtScreen.required', 'Requis')}</Text>
            </View>

            <Text style={[styles.sectionSubtitle, { color: theme.neutral700 }]}>
              {tText(
                'districtScreen.categorySubtitle',
                'Sélectionnez la catégorie qui correspond au problème rencontré.',
              )}
            </Text>

            <View style={styles.categoryGrid}>
              {CIVIC_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    testID={`category-card-${cat.key}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedCategory(cat.key)}
                    style={({ pressed }) => [
                      styles.categoryCard,
                      cardShadow,
                      isSelected
                        ? styles.categoryCardSelected
                        : [
                            styles.categoryCardUnselected,
                            {
                              backgroundColor: theme.background,
                              borderColor: theme.neutral200,
                            },
                          ],
                      pressed && styles.pressedOpacity,
                    ]}
                  >
                    {/* Top Row: Icon on left, Checkmark on right if selected */}
                    <View style={styles.categoryCardTop}>
                      <View
                        style={[
                          styles.categoryIconCircle,
                          isSelected
                            ? styles.categoryIconCircleSelected
                            : [
                                styles.categoryIconCircleUnselected,
                                {
                                  backgroundColor: theme.neutral100,
                                },
                              ],
                        ]}
                      >
                        <Text style={styles.categoryIcon}>{cat.icon}</Text>
                      </View>

                      {isSelected ? (
                        <View style={styles.checkmarkCircle}>
                          <Text style={styles.checkmarkText}>✓</Text>
                        </View>
                      ) : (
                        <View style={styles.emptyCirclePlaceholder} />
                      )}
                    </View>

                    {/* Titles */}
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.categoryTitle,
                        isSelected
                          ? styles.categoryTitleSelected
                          : [styles.categoryTitleUnselected, { color: theme.text }],
                      ]}
                    >
                      {tText(cat.titleKey, cat.fallbackTitle)}
                    </Text>

                    <Text
                      numberOfLines={2}
                      style={[
                        styles.categorySub,
                        isSelected
                          ? styles.categorySubSelected
                          : [
                              styles.categorySubUnselected,
                              {
                                color: theme.neutral600,
                              },
                            ],
                      ]}
                    >
                      {tText(cat.subKey, cat.fallbackSub)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ─── 4b. Météo & Éléments (Optionnel) ─── */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {tText('districtScreen.weatherElementsTitle', 'Météo & Éléments')}
              </Text>
              <Text style={[styles.optionalHeaderBadge, { color: theme.neutral600 }]}>
                {tText('districtScreen.optional', 'Optionnel')}
              </Text>
            </View>

            <Text style={[styles.sectionSubtitle, { color: theme.neutral700 }]}>
              {tText(
                'districtScreen.weatherElementsSub',
                'Indiquez les conditions météo liées à cet incident (optionnel).',
              )}
            </Text>

            <View style={styles.elementsChipsWrap}>
              {WEATHER_ELEMENTS.map((el) => {
                const meta = WEATHER_ELEMENT_META[el];
                const isSelected = selectedElements.includes(el);
                return (
                  <Pressable
                    key={el}
                    testID={`weather-element-chip-${el}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => handleToggleElement(el)}
                    style={({ pressed }) => [
                      styles.elementChip,
                      isSelected
                        ? styles.elementChipSelected
                        : {
                            backgroundColor: theme.neutral100,
                            borderColor: theme.neutral200,
                          },
                      pressed && styles.pressedOpacity,
                    ]}
                  >
                    <Text style={styles.elementChipIcon}>{meta.icon}</Text>
                    <Text
                      style={[
                        styles.elementChipText,
                        isSelected
                          ? styles.elementChipTextSelected
                          : {
                              color: theme.accent900,
                            },
                      ]}
                    >
                      {tText(`issue.elements.${el}`, meta.fallbackLabel)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ─── 5. Localisation précise ─── */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {tText('districtScreen.locationTitle', 'Localisation précise')}
              </Text>
              <Text style={styles.requiredBadge}>{tText('districtScreen.required', 'Requis')}</Text>
            </View>

            {/* Address Banner Card */}
            <View
              style={[
                styles.addressCard,
                cardShadow,
                {
                  backgroundColor: theme.neutral100,
                  borderColor: theme.neutral200,
                },
              ]}
            >
              <View
                style={[
                  styles.addressPinBadge,
                  {
                    backgroundColor: theme.neutral100,
                  },
                ]}
              >
                <Text style={styles.addressPinIcon}>📍</Text>
              </View>

              <View style={styles.addressInfoCol}>
                <Text style={[styles.detectedAddressLabel, { color: theme.neutral600 }]}>
                  {tText('districtScreen.detectedAddress', 'ADRESSE DÉTECTÉE')}
                </Text>
                <TextInput
                  testID="location-address-input"
                  style={[styles.addressValueText, { color: theme.text }]}
                  value={address}
                  onChangeText={setAddress}
                  returnKeyType="search"
                  onSubmitEditing={() => {
                    void handleSearchAddress();
                  }}
                  placeholder="1250 Rue Rachel Est, Montréal, QC..."
                  placeholderTextColor={theme.neutral500}
                />
              </View>

              <Pressable
                testID="address-search-button"
                accessibilityRole="button"
                accessibilityLabel={tText('districtScreen.searchAddress', "Rechercher l'adresse")}
                disabled={isSearchingAddress}
                onPress={() => {
                  void handleSearchAddress();
                }}
                style={({ pressed }) => [
                  styles.searchIconButton,
                  { backgroundColor: theme.background },
                  pressed && styles.pressedOpacity,
                ]}
              >
                <Text style={styles.searchIconText}>🔍</Text>
              </Pressable>
            </View>

            {/* Explicit button to use the user's current geolocation */}
            <Pressable
              testID="use-current-location-button"
              accessibilityRole="button"
              disabled={isLocating}
              onPress={() => {
                void handleUseCurrentLocation();
              }}
              style={({ pressed }) => [
                styles.useCurrentLocationBtn,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.neutral300,
                },
                pressed && styles.pressedOpacity,
                isLocating && styles.disabledOpacity,
              ]}
            >
              <Text style={styles.useCurrentLocationIcon}>⌖</Text>
              <Text style={[styles.useCurrentLocationText, { color: theme.neutral700 }]}>
                {isLocating
                  ? tText('districtScreen.locating', 'Localisation en cours...')
                  : tText('districtScreen.useCurrentLocation', 'Utiliser ma position actuelle')}
              </Text>
            </Pressable>

            {/* Map Preview Container */}
            <View
              style={[
                styles.mapContainer,
                isAdjustingPin && styles.mapContainerPinning,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.neutral200,
                },
              ]}
            >
              {/* Real map: the report point and the district's other issues by status */}
              <ReportLocationMap
                point={coordinates}
                issues={mappableIssues}
                pinMode={isAdjustingPin}
                onPickPoint={(picked) => void handlePickPoint(picked)}
              />

              {isAdjustingPin ? (
                <View testID="map-pin-hint" pointerEvents="none" style={styles.pinHint}>
                  <Text style={styles.pinHintText}>
                    {tText('districtScreen.pinHint', "Déplacez la carte pour placer l'épingle")}
                  </Text>
                </View>
              ) : null}

              {/* Coordinates Pill Badge under Pin */}
              <View style={styles.coordinatesPill}>
                <Text style={styles.coordinatesPillText}>
                  {`${coordinates.latitude}, ${coordinates.longitude} • ${coordinates.place}`}
                </Text>
              </View>

              {/* Adjust Pin Overlay Button */}
              <Pressable
                testID="map-adjust-pin-button"
                accessibilityRole="button"
                onPress={handleAdjustPin}
                style={({ pressed }) => [styles.adjustPinButton, pressed && styles.pressedOpacity]}
              >
                <Text style={styles.adjustPinIcon}>{isAdjustingPin ? '✓' : '🧭'}</Text>
                <Text style={styles.adjustPinText}>
                  {isAdjustingPin
                    ? tText('districtScreen.pinDone', 'Terminé')
                    : tText('districtScreen.adjustPin', "Ajuster l'épingle")}
                </Text>
              </Pressable>
            </View>

            {/* Status legend for the map's issue markers */}
            <View testID="report-map-legend" style={styles.mapLegend}>
              <Text style={[styles.mapLegendTitle, { color: theme.text }]}>
                {tText(
                  'reportMap.legendTitle',
                  `Autres signalements dans ${selectedDistrict.name}`,
                  {
                    district: selectedDistrict.name,
                  },
                )}
              </Text>
              {mappableIssues.length === 0 ? (
                <Text style={[styles.mapLegendText, { color: theme.neutral800 }]}>
                  {tText(
                    'reportMap.noIssues',
                    'Aucun autre signalement dans cet arrondissement pour le moment.',
                  )}
                </Text>
              ) : (
                <View style={styles.mapLegendRow}>
                  {ISSUE_STATUSES.map((status) => (
                    <View key={status} style={styles.mapLegendItem}>
                      <View
                        style={[styles.mapLegendDot, { backgroundColor: statusColors[status] }]}
                      />
                      <Text
                        style={[
                          styles.mapLegendText,
                          {
                            color: theme.neutral800,
                          },
                        ]}
                      >
                        {`${tText(`issue.status.${status}`, status)} (${
                          mappableIssues.filter((i) => i.status === status).length
                        })`}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* ─── 6. Titre du signalement ─── */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {tText('districtScreen.reportTitle', 'Titre du signalement')}
              </Text>
              <Text style={[styles.charCountText, { color: theme.neutral600 }]}>
                {`${title.length}/70`}
              </Text>
            </View>

            <TextInput
              testID="report-title-input"
              style={[
                styles.singleLineInput,
                {
                  backgroundColor: theme.neutral100,
                  borderColor: theme.neutral200,
                  color: theme.text,
                },
              ]}
              value={title}
              maxLength={70}
              onChangeText={setTitle}
              placeholder="ex. Piste cyclable bloquée sur Rachel Est"
              placeholderTextColor={theme.neutral500}
            />
          </View>

          {/* ─── 7. Description détaillée ─── */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {tText('districtScreen.detailedDesc', 'Description détaillée')}
              </Text>
              <Text style={styles.detourBadge}>
                {tText('districtScreen.detourRequired', 'Détour requis')}
              </Text>
            </View>

            <TextInput
              testID="report-description-input"
              multiline
              numberOfLines={4}
              style={[
                styles.multiLineInput,
                {
                  backgroundColor: theme.neutral100,
                  borderColor: theme.neutral200,
                  color: theme.text,
                },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="Expliquez en détail le problème observé..."
              placeholderTextColor={theme.neutral500}
            />

            <View style={styles.aiAssistContainer}>
              <Pressable
                testID="ai-generate-description-button"
                accessibilityRole="button"
                accessibilityState={{
                  disabled: photos.length === 0 || isGeneratingDescription,
                  busy: isGeneratingDescription,
                }}
                disabled={photos.length === 0 || isGeneratingDescription}
                onPress={() => {
                  void handleGenerateDescription();
                }}
                style={({ pressed }) => [
                  styles.aiAssistBtn,
                  {
                    backgroundColor: theme.accent100,
                    borderColor: theme.accent300,
                  },
                  (photos.length === 0 || isGeneratingDescription) && styles.disabledOpacity,
                  pressed && photos.length > 0 && !isGeneratingDescription && styles.pressedOpacity,
                ]}
              >
                {isGeneratingDescription ? (
                  <ActivityIndicator size="small" color={theme.accent700} />
                ) : (
                  <Text style={styles.aiAssistBtnIcon}>✨</Text>
                )}
                <Text style={[styles.aiAssistBtnText, { color: theme.accent700 }]}>
                  {isGeneratingDescription
                    ? tText('districtScreen.aiDescription.generating', 'Analyse de la photo...')
                    : description.trim().length > 0 && photos.length > 0
                      ? tText(
                          'districtScreen.aiDescription.regenerateButton',
                          'Régénérer depuis la photo (IA)',
                        )
                      : tText(
                          'districtScreen.aiDescription.generateButton',
                          'Remplir depuis la photo (IA)',
                        )}
                </Text>
              </Pressable>

              {photos.length === 0 && (
                <Text style={[styles.aiAssistHint, { color: theme.textSecondary }]}>
                  {tText(
                    'districtScreen.aiDescription.addPhotoHint',
                    'Ajoutez une photo ci-dessous pour préremplir la description avec Gemini IA.',
                  )}
                </Text>
              )}

              {aiDescriptionError && (
                <Text
                  testID="ai-description-error"
                  accessibilityRole="alert"
                  style={[styles.aiAssistError, { color: theme.danger }]}
                >
                  {aiDescriptionError}
                </Text>
              )}
            </View>
          </View>

          {/* ─── 8. Photos justificatives (max. 3) ─── */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {tText('districtScreen.photosTitle', 'Photos justificatives (max. 3)', { max: 3 })}
              </Text>
              <Text style={[styles.photoCountBadge, { color: theme.neutral700 }]}>
                {photos.length === 1
                  ? tText('districtScreen.photoAddedSingle', '1 ajoutée')
                  : tText('districtScreen.photoAddedPlural', `${photos.length} ajoutées`, {
                      count: photos.length,
                    })}
              </Text>
            </View>

            {/* Photo Slots Row */}
            <View style={styles.photoSlotsRow}>
              {/* Slot 1: Attached photo or Camera action */}
              {photos.length > 0 ? (
                <View style={styles.photoSlot}>
                  <Image source={{ uri: photos[0] }} style={styles.photoImage} contentFit="cover" />
                  {/* Photo jointe pill badge */}
                  <View style={styles.photoJoinedBadge}>
                    <Text style={styles.photoJoinedText}>
                      ✓ {tText('districtScreen.photoAttached', 'Photo jointe')}
                    </Text>
                  </View>
                  {/* Remove cross button */}
                  <Pressable
                    testID="remove-photo-0-button"
                    accessibilityRole="button"
                    accessibilityLabel="Retirer la photo"
                    onPress={() => handleRemovePhoto(0)}
                    style={styles.photoRemoveBtn}
                  >
                    <Text style={styles.photoRemoveText}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  testID="photo-slot-empty-1"
                  accessibilityRole="button"
                  onPress={handleTakePhoto}
                  style={[
                    styles.photoSlot,
                    styles.photoAddSlot,
                    {
                      backgroundColor: theme.neutral100,
                      borderColor: theme.neutral200,
                    },
                  ]}
                >
                  <View style={styles.photoCameraCircle}>
                    <Text style={styles.photoCameraIcon}>📷</Text>
                  </View>
                  <Text style={[styles.photoAddLabel, { color: theme.neutral800 }]}>
                    {tText('districtScreen.takePhoto', 'Prendre photo')}
                  </Text>
                </Pressable>
              )}

              {/* Slot 2: Gallery when Slot 1 is Camera; Camera when Slot 1 already holds a photo */}
              {photos.length >= 2 ? (
                <View style={styles.photoSlot}>
                  <Image source={{ uri: photos[1] }} style={styles.photoImage} contentFit="cover" />
                  <Pressable
                    testID="remove-photo-1-button"
                    accessibilityRole="button"
                    onPress={() => handleRemovePhoto(1)}
                    style={styles.photoRemoveBtn}
                  >
                    <Text style={styles.photoRemoveText}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  testID="add-photo-button"
                  accessibilityRole="button"
                  onPress={photos.length === 1 ? handleTakePhoto : handlePickFromGallery}
                  style={[
                    styles.photoSlot,
                    styles.photoAddSlot,
                    {
                      backgroundColor: theme.neutral100,
                      borderColor: theme.neutral200,
                    },
                  ]}
                >
                  <View style={styles.photoCameraCircle}>
                    <Text style={styles.photoCameraIcon}>{photos.length === 1 ? '📷' : '🖼'}</Text>
                  </View>
                  <Text style={[styles.photoAddLabel, { color: theme.neutral800 }]}>
                    {photos.length === 1
                      ? tText('districtScreen.takePhoto', 'Prendre photo')
                      : tText('districtScreen.chooseFromGallery', 'Galerie')}
                  </Text>
                </Pressable>
              )}

              {/* Slot 3: Optional gallery slot */}
              {photos.length >= 3 ? (
                <View style={styles.photoSlot}>
                  <Image source={{ uri: photos[2] }} style={styles.photoImage} contentFit="cover" />
                  <Pressable
                    testID="remove-photo-2-button"
                    accessibilityRole="button"
                    onPress={() => handleRemovePhoto(2)}
                    style={styles.photoRemoveBtn}
                  >
                    <Text style={styles.photoRemoveText}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  testID="photo-slot-optional"
                  accessibilityRole="button"
                  onPress={handlePickFromGallery}
                  style={[
                    styles.photoSlot,
                    styles.photoOptionalSlot,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.neutral200,
                    },
                  ]}
                >
                  <Text style={styles.photoOptionalIcon}>🖼</Text>
                  <Text style={[styles.photoOptionalLabel, { color: theme.neutral600 }]}>
                    {photos.length === 1
                      ? tText('districtScreen.chooseFromGallery', 'Galerie')
                      : tText('districtScreen.optional', 'Optionnel')}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* ─── 9. Transmission MTL-311 ─── */}
          <View
            style={[
              styles.mtlCard,
              cardShadow,
              {
                backgroundColor: theme.neutral100,
                borderColor: theme.neutral200,
              },
            ]}
          >
            <View style={styles.mtlTopRow}>
              {/* Courthouse / City Hall icon in navy square */}
              <View style={styles.mtlBuildingBadge}>
                <Text style={styles.mtlBuildingIcon}>🏛</Text>
              </View>

              <View style={styles.mtlTitleCol}>
                <View style={styles.mtlHeaderLine}>
                  <Text style={[styles.mtlTitle, { color: theme.text }]}>
                    {tText('districtScreen.mtl311Title', 'Transmission MTL-311')}
                  </Text>
                  <View style={styles.autoTicketPill}>
                    <Text style={styles.autoTicketText}>
                      {tText('districtScreen.autoTicket', 'AUTO-TICKET')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Native Switch Toggle */}
              <Switch
                testID="mtl-311-switch"
                value={mtl311Enabled}
                onValueChange={setMtl311Enabled}
                trackColor={{
                  false: theme.neutral300,
                  true: theme.accent900,
                }}
                thumbColor={theme.neutral100}
              />
            </View>

            <Text style={[styles.mtlDescription, { color: theme.neutral700 }]}>
              {tText(
                'districtScreen.mtl311Desc',
                'Transmettre automatiquement une requête officielle aux services municipaux de la Ville de Montréal.',
              )}
            </Text>

            {/* Info Pill box */}
            <View
              style={[
                styles.mtlNoticeBox,
                {
                  backgroundColor: theme.neutral100,
                  borderColor: theme.backgroundElement,
                },
              ]}
            >
              <Text style={styles.mtlNoticeIcon}>🛡</Text>
              <Text style={[styles.mtlNoticeText, { color: theme.accent800 }]}>
                {tText(
                  'districtScreen.mtl311Tracking',
                  'Numéro de suivi municipal officiel délivré après publication (ex. MTL-311-2026-XXXXX).',
                )}
              </Text>
            </View>
          </View>

          {/* ─── 10. Action Buttons ─── */}
          <View style={styles.actionButtonsCol}>
            {/* Primary: Publier le signalement (the district's truck drives across it) */}
            <PublishReportButton
              label={tText('districtScreen.publishButton', 'Publier le signalement')}
              disabled={!canPublish}
              sending={isPublishing}
              onPress={handlePublish}
            />

            {/* Secondary: Enregistrer comme brouillon */}
            <Pressable
              testID="save-draft-button"
              accessibilityRole="button"
              onPress={handleSaveDraft}
              style={({ pressed }) => [
                styles.secondaryDraftBtn,
                {
                  backgroundColor: theme.background,
                },
                pressed && styles.pressedOpacity,
              ]}
            >
              <Text style={[styles.secondaryDraftIcon, { color: theme.accent900 }]}>🔖</Text>
              <Text style={[styles.secondaryDraftText, { color: theme.accent900 }]}>
                {tText('districtScreen.draftButton', 'Enregistrer comme brouillon')}
              </Text>
            </Pressable>
          </View>

          {/* ─── 11. Footer Charter ─── */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerIcon}>🛡</Text>
            <Text style={[styles.footerText, { color: theme.neutral600 }]}>
              {tText(
                'districtScreen.charterFooter',
                'Charte citoyenne Montone • Données ouvertes OpenNorth',
              )}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Borough Selection Modal ("Autre arrondissement") ─── */}
      <Modal
        visible={isBoroughModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsBoroughModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsBoroughModalVisible(false)}>
          <View
            style={[
              styles.modalDialog,
              {
                backgroundColor: theme.neutral100,
                borderColor: theme.neutral200,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {tText('districtScreen.selectBorough', 'Sélectionner un arrondissement')}
            </Text>

            <TextInput
              testID="borough-search-input"
              value={boroughSearch}
              onChangeText={setBoroughSearch}
              placeholder={tText('districtScreen.searchBorough', 'Rechercher un arrondissement')}
              placeholderTextColor={theme.neutral600}
              autoCorrect={false}
              style={[
                styles.boroughSearchInput,
                {
                  color: theme.text,
                  backgroundColor: theme.neutral100,
                },
              ]}
            />
            <Text style={[styles.boroughOptionSub, { color: theme.neutral700 }]}>
              {tText('districtScreen.boroughCount', `${visibleDistrictOptions.length}`, {
                count: visibleDistrictOptions.length,
              })}
            </Text>

            <ScrollView
              testID="borough-options-list"
              style={styles.boroughOptionsScroll}
              keyboardShouldPersistTaps="handled"
            >
              {visibleDistrictOptions.map((d) => (
                <Pressable
                  key={d.id}
                  testID={`borough-option-${d.id}`}
                  accessibilityRole="button"
                  onPress={() => handleSelectDistrict(d)}
                  style={({ pressed }) => [
                    styles.boroughOptionRow,
                    selectedDistrict.id === d.id && {
                      backgroundColor: theme.background,
                    },
                    pressed && styles.pressedOpacity,
                  ]}
                >
                  <View>
                    <Text style={[styles.boroughOptionName, { color: theme.text }]}>{d.name}</Text>
                    <Text style={[styles.boroughOptionSub, { color: theme.neutral700 }]}>
                      {d.hasPostalCode === false
                        ? d.status
                        : `Secteur ${d.postalCode} • ${d.status}`}
                    </Text>
                  </View>
                  {selectedDistrict.id === d.id && <Text style={styles.boroughCheckmark}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              testID="close-borough-modal-button"
              accessibilityRole="button"
              onPress={() => setIsBoroughModalVisible(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseBtnText}>
                {tText('districtScreen.close', 'Fermer')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
      {/* ─── Duplicate Report Prompt ─── */}
      <Modal
        visible={Boolean(duplicate)}
        transparent
        animationType="fade"
        onRequestClose={() => setDuplicate(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            testID="duplicate-issue-prompt"
            style={[styles.successDialog, { backgroundColor: theme.neutral100 }]}
          >
            {duplicate && (
              <>
                <Text
                  accessibilityRole="header"
                  style={[styles.successTitle, { color: theme.text }]}
                >
                  {t('districtScreen.duplicate.prompt', {
                    distance: `${Math.round(duplicate.meters)} m`,
                  })}
                </Text>
                <Text style={[styles.successMessage, { color: theme.neutral700 }]}>
                  {duplicate.issue.title}
                </Text>
              </>
            )}
            <Pressable
              testID="duplicate-upvote-button"
              accessibilityRole="button"
              onPress={handleUpvoteDuplicate}
              style={styles.successCloseBtn}
            >
              <Text style={styles.successCloseBtnText}>{t('districtScreen.duplicate.upvote')}</Text>
            </Pressable>
            <Pressable
              testID="duplicate-publish-anyway-button"
              accessibilityRole="button"
              onPress={handlePublishAnyway}
              style={styles.duplicateSecondaryBtn}
            >
              <Text style={[styles.duplicateSecondaryText, { color: theme.text }]}>
                {t('districtScreen.duplicate.publishAnyway')}
              </Text>
            </Pressable>
            <Pressable
              testID="duplicate-cancel-button"
              accessibilityRole="button"
              onPress={() => setDuplicate(null)}
              style={styles.duplicateSecondaryBtn}
            >
              <Text style={[styles.duplicateSecondaryText, { color: theme.neutral700 }]}>
                {t('districtScreen.duplicate.cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    keyboardView: {
      flex: 1,
    },
    pressedOpacity: {
      opacity: 0.75,
    },

    // 1. Navigation Header
    navHeader: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      borderBottomWidth: 1,
    },
    navIconButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backArrowText: {
      fontSize: 22,
      fontWeight: '500',
    },
    navTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      flex: 1,
      justifyContent: 'center',
    },
    appIconBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.accent900,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appIconText: {
      fontSize: 14,
    },
    navTitleText: {
      fontSize: 17,
      fontWeight: '700',
      fontFamily: Fonts.sans,
    },

    // Toast
    feedbackBanner: {
      backgroundColor: theme.accent900,
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.three,
      alignItems: 'center',
    },
    feedbackText: {
      color: theme.neutral100,
      fontSize: 13,
      fontWeight: '600',
    },

    // Scroll Content
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: Spacing.three,
      paddingBottom: 48,
      gap: Spacing.three,
    },

    // 3. OpenNorth Pipeline / District Card
    districtCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: Spacing.three,
      gap: Spacing.two,
    },
    districtTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    radarBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radarIcon: {
      fontSize: 20,
      color: theme.neutral600,
      fontWeight: 'bold',
    },
    districtInfoCol: {
      flex: 1,
    },
    livePipelineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    openNorthLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.neutral500,
    },
    districtNameText: {
      fontSize: 20,
      fontWeight: '800',
      marginTop: 2,
    },
    sectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    pinSmallIcon: {
      fontSize: 14,
    },
    sectorText: {
      fontSize: 13,
      fontWeight: '500',
    },
    segmentedContainer: {
      flexDirection: 'row',
      borderRadius: 10,
      padding: 3,
      marginTop: 4,
    },
    segmentedBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    segmentedBtnActive: {
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    segmentedBtnText: {
      fontSize: 13,
      fontWeight: '600',
    },
    segmentedBtnTextActive: {
      fontWeight: '700',
    },

    // 4. Section Blocks & 2x2 Grid
    sectionBlock: {
      gap: Spacing.two,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    sectionSubtitle: {
      fontSize: 13,
      lineHeight: 18,
    },
    requiredBadge: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.accent700,
    },
    detourBadge: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.accent700,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.two,
    },
    categoryCard: {
      width: '48.5%',
      minHeight: 130,
      borderRadius: 16,
      padding: Spacing.three,
      justifyContent: 'space-between',
      borderWidth: 1,
    },
    categoryCardSelected: {
      backgroundColor: theme.text,
      borderColor: theme.text,
    },
    categoryCardUnselected: {},
    categoryCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    categoryIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryIconCircleSelected: {
      backgroundColor: `${theme.neutral100}26`,
    },
    categoryIconCircleUnselected: {
      borderWidth: 1,
      borderColor: theme.neutral200,
    },
    categoryIcon: {
      fontSize: 18,
    },
    checkmarkCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.neutral100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkmarkText: {
      color: theme.neutral100,
      fontSize: 12,
      fontWeight: 'bold',
    },
    emptyCirclePlaceholder: {
      width: 20,
      height: 20,
    },
    categoryTitle: {
      fontSize: 14,
      fontWeight: '700',
      marginTop: 6,
    },
    categoryTitleSelected: {
      color: theme.neutral100,
    },
    categoryTitleUnselected: {},
    categorySub: {
      fontSize: 11,
      marginTop: 2,
      lineHeight: 15,
    },
    categorySubSelected: {
      color: theme.neutral400,
    },
    categorySubUnselected: {},

    // 4b. Weather Elements Chips
    optionalHeaderBadge: {
      fontSize: 12,
      fontWeight: '600',
    },
    elementsChipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    elementChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    elementChipSelected: {
      backgroundColor: theme.text,
      borderColor: theme.text,
    },
    elementChipIcon: {
      fontSize: 14,
    },
    elementChipText: {
      fontSize: 12.5,
      fontWeight: '600',
    },
    elementChipTextSelected: {
      color: theme.neutral100,
    },

    // 5. Precise Location
    addressCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      padding: Spacing.two,
      gap: Spacing.two,
    },
    addressPinBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addressPinIcon: {
      fontSize: 18,
    },
    addressInfoCol: {
      flex: 1,
    },
    detectedAddressLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    addressValueText: {
      fontSize: 14,
      fontWeight: '600',
      padding: 0,
      margin: 0,
    },
    searchIconButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchIconText: {
      fontSize: 16,
    },
    useCurrentLocationBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 11,
      paddingHorizontal: Spacing.three,
      borderRadius: 12,
      borderWidth: 1,
    },
    useCurrentLocationIcon: {
      fontSize: 16,
      color: theme.neutral600,
      fontWeight: '700',
    },
    useCurrentLocationText: {
      fontSize: 13,
      fontWeight: '700',
    },
    disabledOpacity: {
      opacity: 0.55,
    },

    // Map
    mapLegend: { marginTop: 10, gap: 6 },
    mapLegendTitle: { fontSize: 13, fontWeight: '700' },
    mapLegendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    mapLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    mapLegendDot: { width: 10, height: 10, borderRadius: 5 },
    mapLegendText: { fontSize: 12 },
    // Taller while placing the pin, so there is room to aim.
    mapContainerPinning: {
      height: 320,
    },
    pinHint: {
      position: 'absolute',
      top: Spacing.two,
      alignSelf: 'center',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
      borderRadius: 999,
      backgroundColor: theme.text,
    },
    pinHintText: {
      color: theme.background,
      fontSize: 12.5,
      fontWeight: '600',
    },
    mapContainer: {
      height: 195,
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Pin on map
    coordinatesPill: {
      position: 'absolute',
      bottom: 44,
      backgroundColor: `${theme.neutral100}F2`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    coordinatesPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.text,
    },
    adjustPinButton: {
      position: 'absolute',
      bottom: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.neutral100,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.neutral300,
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 3,
    },
    adjustPinIcon: {
      fontSize: 14,
    },
    adjustPinText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.text,
    },

    // 6 & 7. Inputs
    charCountText: {
      fontSize: 12,
      fontWeight: '600',
    },
    singleLineInput: {
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: Spacing.three,
      fontSize: 14,
      fontWeight: '500',
    },
    multiLineInput: {
      minHeight: 88,
      borderRadius: 12,
      borderWidth: 1,
      padding: Spacing.three,
      fontSize: 14,
      lineHeight: 20,
      textAlignVertical: 'top',
    },
    aiAssistContainer: {
      gap: 6,
    },
    aiAssistBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: Spacing.three,
      borderRadius: 12,
      borderWidth: 1,
    },
    aiAssistBtnIcon: {
      fontSize: 15,
    },
    aiAssistBtnText: {
      fontSize: 13,
      fontWeight: '700',
    },
    aiAssistHint: {
      fontSize: 12,
      lineHeight: 16,
    },
    aiAssistError: {
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },

    // 8. Photo Slots
    photoCountBadge: {
      fontSize: 12,
      fontWeight: '600',
    },
    photoSlotsRow: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    photoSlot: {
      flex: 1,
      height: 98,
      borderRadius: 14,
      overflow: 'hidden',
      position: 'relative',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    photoJoinedBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      backgroundColor: `${theme.text}A6`,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
    },
    photoJoinedText: {
      color: theme.neutral100,
      fontSize: 9,
      fontWeight: '700',
    },
    photoRemoveBtn: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: `${theme.text}B2`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoRemoveText: {
      color: theme.neutral100,
      fontSize: 11,
      fontWeight: 'bold',
    },
    photoAddSlot: {
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    photoCameraCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.backgroundElement,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoCameraIcon: {
      fontSize: 18,
    },
    photoAddLabel: {
      fontSize: 12,
      fontWeight: '700',
    },
    photoOptionalSlot: {
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    photoOptionalIcon: {
      fontSize: 22,
      color: theme.neutral500,
    },
    photoOptionalLabel: {
      fontSize: 12,
      fontWeight: '600',
    },

    // 9. MTL-311 Transmission
    mtlCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: Spacing.three,
      gap: Spacing.two,
    },
    mtlTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    mtlBuildingBadge: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: theme.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mtlBuildingIcon: {
      fontSize: 20,
      color: theme.neutral100,
    },
    mtlTitleCol: {
      flex: 1,
    },
    mtlHeaderLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    mtlTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    autoTicketPill: {
      backgroundColor: theme.backgroundElement,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    autoTicketText: {
      color: theme.accent800,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    mtlDescription: {
      fontSize: 12,
      lineHeight: 17,
    },
    mtlNoticeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      borderRadius: 10,
      borderWidth: 1,
      padding: 10,
    },
    mtlNoticeIcon: {
      fontSize: 16,
      color: theme.accent700,
    },
    mtlNoticeText: {
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 15,
      flex: 1,
    },

    // 10. Buttons
    actionButtonsCol: {
      gap: Spacing.two,
      marginTop: Spacing.two,
    },

    secondaryDraftBtn: {
      height: 48,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    secondaryDraftIcon: {
      fontSize: 15,
    },
    secondaryDraftText: {
      fontSize: 14,
      fontWeight: '700',
    },

    // 11. Footer
    footerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: Spacing.two,
    },
    footerIcon: {
      fontSize: 13,
      color: theme.neutral600,
    },
    footerText: {
      fontSize: 11,
      fontWeight: '500',
    },

    // Modals
    modalOverlay: {
      flex: 1,
      backgroundColor: `${theme.text}8C`,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.three,
    },
    modalDialog: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 18,
      borderWidth: 1,
      padding: Spacing.three,
      gap: Spacing.two,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      marginBottom: Spacing.one,
    },
    boroughSearchInput: {
      height: 40,
      borderRadius: 10,
      paddingHorizontal: Spacing.two,
      fontSize: 15,
    },
    // About seven rows; the rest of the island's districts scroll.
    boroughOptionsScroll: {
      maxHeight: 380,
    },
    boroughOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.two,
      borderRadius: 10,
    },
    boroughOptionName: {
      fontSize: 15,
      fontWeight: '700',
    },
    boroughOptionSub: {
      fontSize: 12,
      marginTop: 2,
    },
    boroughCheckmark: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.neutral600,
    },
    modalCloseBtn: {
      alignSelf: 'center',
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.four,
      marginTop: Spacing.one,
    },
    modalCloseBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.accent700,
    },

    // Success Dialog
    successDialog: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 20,
      padding: Spacing.four,
      alignItems: 'center',
      gap: Spacing.two,
    },
    successIconBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    successCheckIcon: {
      fontSize: 28,
      color: theme.neutral600,
      fontWeight: 'bold',
    },
    successTitle: {
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
    },
    successMessage: {
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
    ticketRefBox: {
      width: '100%',
      borderWidth: 1,
      borderRadius: 12,
      padding: Spacing.two,
      alignItems: 'center',
      marginVertical: 4,
    },
    ticketRefLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    ticketRefValue: {
      fontSize: 18,
      fontWeight: '800',
      marginTop: 2,
    },
    ticketBoroughText: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    successCloseBtn: {
      backgroundColor: theme.text,
      paddingVertical: 12,
      paddingHorizontal: 32,
      borderRadius: 12,
      marginTop: 6,
    },
    successCloseBtnText: {
      color: theme.neutral100,
      fontSize: 14,
      fontWeight: '700',
    },
    duplicateSecondaryBtn: {
      paddingVertical: 10,
      paddingHorizontal: 32,
    },
    duplicateSecondaryText: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
