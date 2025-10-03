// src/ui/Icon.tsx
import React from "react";
import { Pressable, ViewStyle } from "react-native";
import {
  // base
  Heart,
  Bell,
  ShoppingCart,
  ShoppingBag,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Pencil,
  ShieldCheck,
  Shield,
  ArrowUpDown,
  LogOut,
  Image as ImageIcon,
  Trash2,
  X,
  Settings,
  HelpCircle,
  User,
  Home,
  CirclePlus,
  Newspaper,
  AlertCircle,
  TrendingUp,
  Eye,
  EyeOff,
  ArrowRight,
  Tag,
  RefreshCw,
  Share2,
  Bike,
  CheckCircle,
  Leaf,
  Minus,
  Plus,
  Search,
  Compass,
  MessageCircle,
  // extra / équivalents
  Sparkles,
  LogIn,
  Star,
  StarOff,
  MapPin,
  Circle,
  CircleDot,
  Check,
  Trash,
  Save,
  Wifi,
  Snowflake,
  Flame,
  Tv,
  Car,
  UtensilsCrossed,
  Scissors,
  Droplet,
  PawPrint,
  BedDouble,
  Laptop,
  Languages,
  Flag,
  Navigation,
  Navigation2,
  Bluetooth,
  Cpu,
  Smartphone,
  Camera,
  Radio,
  Gauge,
  Sun,
  Shirt,
  Hand,
  GitBranch,
  ArrowLeftRight,
  PanelsTopLeft,
  Lock,
  Signpost,
  Briefcase,
  Mic,
  Map,
  CloudUpload,
  CarFront,
  XCircle,
  Calendar,
  Square,
  CheckSquare,
  IdCard,
  Wrench,
  AlarmClock,
  Plane,
  // *** nouveaux imports pour les demandes ***
  Ticket,
  Mail,
  Phone,
  Grid,
  Clock,
} from "lucide-react-native";

/** Tous les noms acceptés (style Ionicons) */
export type IconName =
  // existants
  | "heart-outline"
  | "notifications-outline"
  | "cart-outline"
  | "bag-outline"
  | "chevron-forward"
  | "chevron-back"
  | "create-outline"
  | "shield-checkmark"
  | "shield-outline"
  | "swap-vertical"
  | "log-out-outline"
  | "image-outline"
  | "trash-outline"
  | "close"
  | "settings-outline"
  | "help-circle-outline"
  | "person-outline"
  | "home-outline"
  | "add-circle-outline"
  | "newspaper-outline"
  | "alert-circle"
  | "trending-up-outline"
  | "eye-outline"
  | "eye-off-outline"
  | "arrow-forward"
  | "pricetag-outline"
  | "refresh"
  | "refresh-outline"
  | "share-outline"
  | "bicycle-outline"
  | "checkmark-circle"
  | "shield-checkmark-outline"
  | "leaf-outline"
  | "remove"
  | "add"
  | "search-outline"
  | "compass-outline"
  | "chat-outline"
  // ajouts vus dans ton code
  | "chevron-down"
  | "search"
  | "leaf"
  | "sparkles-outline"
  | "checkmark-circle-outline"
  | "log-in-outline"
  | "star"
  | "star-outline"
  | "location-outline"
  | "radio-button-on"
  | "radio-button-off"
  | "checkmark"
  | "trash"
  | "ellipse-outline"
  | "save-outline"
  | "wifi-outline"
  | "snow-outline"
  | "flame-outline"
  | "tv-outline"
  | "car-outline"
  | "restaurant-outline"
  | "cut-outline"
  | "water-outline"
  | "paw-outline"
  | "bed-outline"
  | "swap-vertical-outline"
  | "laptop-outline"
  | "checkbox"
  | "square-outline"
  | "school-outline" // fallback Newspaper
  | "language-outline"
  | "flag-outline"
  | "navigate"
  | "navigate-outline"
  | "bluetooth-outline"
  | "hardware-chip-outline"
  | "phone-portrait-outline"
  | "camera-outline"
  | "radio-outline"
  | "speedometer-outline"
  | "sunny-outline"
  | "shirt-outline"
  | "alert-circle-outline"
  | "hand-left-outline"
  | "git-branch-outline"
  | "swap-horizontal-outline"
  | "browsers-outline"
  | "lock-closed-outline"
  | "trail-sign-outline"
  | "briefcase-outline"
  | "mic-outline"
  | "map-outline"
  | "cloud-upload-outline"
  | "car-sport-outline"
  | "close-circle"
  | "calendar-outline"
  | "id-card-outline"
  | "construct-outline"
  | "alarm-outline"
  // variantes non-outline que tu appelles
  | "wifi"
  | "snow"
  | "bluetooth"
  | "heart"
  | "sync-outline"
  // icônes de tabbar ajoutées
  | "airplane-outline"
  | "chatbubble-ellipses-outline"
  | "person-circle-outline"
  // *** nouveaux noms demandés ***
  | "ticket-outline"
  | "mail-outline"
  | "call-outline"
  | "grid-outline"
  | "time-outline"
  | "create";

export type IoniconName = IconName;

type TouchableProps = Pick<
  React.ComponentProps<typeof Pressable>,
  | "onPress"
  | "onLongPress"
  | "hitSlop"
  | "accessibilityLabel"
  | "accessibilityRole"
  | "disabled"
>;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: ViewStyle;
  strokeWidth?: number;
} & Partial<TouchableProps>;

/** Mapping Ionicons-like -> composants lucide */
const map: Record<IconName, any> = {
  // base
  "heart-outline": Heart,
  "notifications-outline": Bell,
  "cart-outline": ShoppingCart,
  "bag-outline": ShoppingBag,
  "chevron-forward": ChevronRight,
  "chevron-back": ChevronLeft,
  "create-outline": Pencil,
  "shield-checkmark": ShieldCheck,
  "shield-outline": Shield,
  "swap-vertical": ArrowUpDown,
  "log-out-outline": LogOut,
  "image-outline": ImageIcon,
  "trash-outline": Trash2,
  close: X,
  "settings-outline": Settings,
  "help-circle-outline": HelpCircle,
  "person-outline": User,
  "home-outline": Home,
  "add-circle-outline": CirclePlus,
  "newspaper-outline": Newspaper,
  "alert-circle": AlertCircle,
  "trending-up-outline": TrendingUp,
  "eye-outline": Eye,
  "eye-off-outline": EyeOff,
  "arrow-forward": ArrowRight,
  "pricetag-outline": Tag,
  refresh: RefreshCw,
  "refresh-outline": RefreshCw,
  "share-outline": Share2,
  "bicycle-outline": Bike,
  "checkmark-circle": CheckCircle,
  "shield-checkmark-outline": ShieldCheck,
  "leaf-outline": Leaf,
  remove: Minus,
  add: Plus,
  "search-outline": Search,
  "compass-outline": Compass,
  "chat-outline": MessageCircle,

  // ajouts / alias
  "chevron-down": ChevronDown,
  search: Search,
  leaf: Leaf,
  "sparkles-outline": Sparkles,
  "checkmark-circle-outline": CheckCircle,
  "log-in-outline": LogIn,
  star: Star,
  "star-outline": StarOff,
  "location-outline": MapPin,
  "radio-button-on": CircleDot,
  "radio-button-off": Circle,
  checkmark: Check,
  trash: Trash,
  "ellipse-outline": Circle, // cercle vide visuellement
  "save-outline": Save,

  // équipements & co
  "wifi-outline": Wifi,
  wifi: Wifi,
  "snow-outline": Snowflake,
  snow: Snowflake,
  "flame-outline": Flame,
  "tv-outline": Tv,
  "car-outline": Car,
  "restaurant-outline": UtensilsCrossed,
  "cut-outline": Scissors,
  "water-outline": Droplet,
  "paw-outline": PawPrint,
  "bed-outline": BedDouble,
  "swap-vertical-outline": ArrowUpDown,
  "laptop-outline": Laptop,
  checkbox: CheckSquare,
  "square-outline": Square,
  "school-outline": Newspaper, // fallback

  "language-outline": Languages,
  "flag-outline": Flag,
  navigate: Navigation2,
  "navigate-outline": Navigation,
  "bluetooth-outline": Bluetooth,
  bluetooth: Bluetooth,
  "hardware-chip-outline": Cpu,
  "phone-portrait-outline": Smartphone,
  "camera-outline": Camera,
  "radio-outline": Radio,
  "speedometer-outline": Gauge,
  "sunny-outline": Sun,
  "shirt-outline": Shirt,
  "alert-circle-outline": AlertCircle,
  "hand-left-outline": Hand,
  "git-branch-outline": GitBranch,
  "swap-horizontal-outline": ArrowLeftRight,
  "browsers-outline": PanelsTopLeft,
  "lock-closed-outline": Lock,
  "trail-sign-outline": Signpost,
  "briefcase-outline": Briefcase,
  "mic-outline": Mic,
  "map-outline": Map,
  "cloud-upload-outline": CloudUpload,
  "car-sport-outline": CarFront,
  "close-circle": XCircle,
  "calendar-outline": Calendar,

  // règles / infos voiture
  "id-card-outline": IdCard,
  "construct-outline": Wrench,
  "alarm-outline": AlarmClock,

  // variantes
  "sync-outline": RefreshCw,
  heart: Heart,

  // Tabbar spécifiques
  "airplane-outline": Plane,
  "chatbubble-ellipses-outline": MessageCircle,
  "person-circle-outline": User, // ou UserCircle

  // *** nouveaux mappings demandés ***
  "ticket-outline": Ticket,
  "mail-outline": Mail,
  "call-outline": Phone,
  "grid-outline": Grid,
  "time-outline": Clock,
  create: Pencil,
};

export default function Ionicons({
  name,
  size = 24,
  color = "#111",
  style,
  strokeWidth = 2,
  onPress,
  onLongPress,
  hitSlop,
  accessibilityLabel,
  accessibilityRole = "button",
  disabled,
}: Props) {
  const Cmp = map[name];
  if (!Cmp) return null;

  const Icon = (
    <Cmp width={size} height={size} color={color} strokeWidth={strokeWidth} />
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        style={style}
        onPress={onPress}
        onLongPress={onLongPress}
        hitSlop={hitSlop ?? 8}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        disabled={disabled}
      >
        {Icon}
      </Pressable>
    );
  }

  return (
    <Cmp
      width={size}
      height={size}
      color={color}
      strokeWidth={strokeWidth}
      style={style}
    />
  );
}
