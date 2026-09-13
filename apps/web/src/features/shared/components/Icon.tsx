import React from 'react';
import {
  Tractor,
  Sprout,
  Leaf,
  Home,
  Package,
  Boxes,
  Layers,
  Gavel,
  Truck,
  BarChart2,
  LineChart,
  TrendingUp,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Edit,
  Edit2,
  Edit3,
  ImagePlus,
  Camera,
  Image as ImageIcon,
  BadgeCheck,
  CheckCircle2,
  CheckCircle,
  Check,
  XCircle,
  X,
  AlertCircle,
  AlertTriangle,
  Star,
  Trash2,
  Settings,
  Sliders,
  User,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  Bell,
  Search,
  Filter,
  Calendar,
  Clock,
  QrCode,
  ScanLine,
  Map,
  MapPin,
  Navigation,
  Store,
  CreditCard,
  Wallet,
  Coins,
  DollarSign,
  HelpCircle,
  Info,
  Shield,
  ShieldCheck,
  LogOut,
  Menu,
  RefreshCw,
  Download,
  Upload,
  Share2,
  Lock,
  Mail,
  Phone,
  Award,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  Loader2,
  Eye,
  EyeOff,
  Sun,
  Cloud,
  Droplets,
  Droplet,
  FileText,
  ClipboardList,
  ClipboardCheck,
  Folder,
  Tag,
  ThumbsUp,
  ThumbsDown,
  MoreVertical,
  MoreHorizontal,
  Plus,
  Minus,
  Sparkles,
  Zap,
  Globe,
  Compass,
  Scale,
  Percent,
  TrendingDown,
  Maximize2,
  Minimize2,
  Printer,
  Copy,
  ExternalLink,
  MessageSquare,
  Send,
  type LucideProps,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  // Agriculture & Products
  agriculture: Tractor,
  tractor: Tractor,
  sprout: Sprout,
  leaf: Leaf,
  eco: Sprout,
  nature: Leaf,
  grass: Sprout,
  inventory_2: Package,
  inventory: Package,
  package: Package,
  package_2: Boxes,
  boxes: Boxes,
  layers: Layers,
  category: Layers,

  // Navigation & Core
  home: Home,
  dashboard: Home,
  gavel: Gavel,
  auction: Gavel,
  local_shipping: Truck,
  truck: Truck,
  shipping: Truck,
  delivery: Truck,
  directions_car: Truck,

  // Analytics & Stats
  analytics: BarChart2,
  insights: TrendingUp,
  trending_up: TrendingUp,
  trending_down: TrendingDown,
  query_stats: LineChart,
  bar_chart: BarChart2,
  monitoring: LineChart,
  percent: Percent,
  scale: Scale,

  // Arrows & Navigation
  arrow_back: ArrowLeft,
  arrow_left: ArrowLeft,
  arrow_forward: ArrowRight,
  arrow_right: ArrowRight,
  arrow_upward: ArrowUp,
  arrow_up: ArrowUp,
  arrow_downward: ArrowDown,
  arrow_down: ArrowDown,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  chevron_down: ChevronDown,
  chevron_up: ChevronUp,
  expand_more: ChevronDown,
  expand_less: ChevronUp,
  navigate_before: ChevronLeft,
  navigate_next: ChevronRight,

  // Actions & Edits
  edit: Edit,
  edit_note: Edit2,
  edit_square: Edit3,
  add_photo_alternate: ImagePlus,
  photo_camera: Camera,
  camera_alt: Camera,
  camera: Camera,
  image: ImageIcon,
  image_search: ImagePlus,
  add: Plus,
  plus: Plus,
  remove: Minus,
  delete: Trash2,
  delete_forever: Trash2,
  trash: Trash2,
  save: Check,
  download: Download,
  file_download: Download,
  upload: Upload,
  file_upload: Upload,
  refresh: RefreshCw,
  sync: RefreshCw,
  sync_problem: AlertTriangle,
  share: Share2,
  print: Printer,
  copy: Copy,
  content_copy: Copy,
  open_in_new: ExternalLink,
  send: Send,

  // Status & Badges
  verified: BadgeCheck,
  verified_user: ShieldCheck,
  check_circle: CheckCircle2,
  check_circle_outline: CheckCircle,
  check: Check,
  done: Check,
  done_all: CheckCheckIcon,
  task_alt: ClipboardCheck,
  cancel: XCircle,
  cancel_presentation: XCircle,
  close: X,
  error: AlertCircle,
  error_outline: AlertCircle,
  warning: AlertTriangle,
  star: Star,
  grade: Star,
  hourglass_top: Hourglass,
  hourglass_bottom: Hourglass,
  hourglass_empty: Hourglass,
  pending: Clock,
  schedule: Clock,
  access_time: Clock,
  calendar_month: Calendar,
  calendar_today: Calendar,
  calendar: Calendar,
  event: Calendar,
  date_range: Calendar,
  progress_activity: Loader2,
  loader_2: Loader2,

  // Users & Profiles
  person: User,
  person_outline: User,
  account_circle: User,
  person_off: UserX,
  person_add: UserPlus,
  person_check: UserCheck,
  user_check: UserCheck,
  people: Users,
  group: Users,
  groups: Users,
  badge: Award,
  admin_panel_settings: Shield,

  // Communications & Notifications
  notifications: Bell,
  notifications_active: Bell,
  notifications_none: Bell,
  bell: Bell,
  mail: Mail,
  email: Mail,
  phone: Phone,
  call: Phone,
  chat: MessageSquare,
  message: MessageSquare,

  // Search & Filters
  search: Search,
  filter_list: Filter,
  filter_alt: Filter,
  tune: Sliders,
  sliders: Sliders,
  settings: Settings,

  // Location & Maps
  location_on: MapPin,
  place: MapPin,
  pin_drop: MapPin,
  my_location: Navigation,
  map: Map,
  navigation: Navigation,
  compass: Compass,
  explore: Compass,

  // Commerce & Finance
  storefront: Store,
  store: Store,
  shopping_cart: Store,
  credit_card: CreditCard,
  payments: Coins,
  wallet: Wallet,
  account_balance_wallet: Wallet,
  paid: DollarSign,
  attach_money: DollarSign,
  price_change: TrendingUp,
  receipt: FileText,
  receipt_long: FileText,

  // Scanning & Hardware
  qr_code: QrCode,
  qr_code_2: QrCode,
  qr_code_scanner: ScanLine,
  barcode: ScanLine,

  // Docs & Tasks
  assignment: ClipboardList,
  description: FileText,
  notes: FileText,
  folder: Folder,
  folder_open: Folder,
  tag: Tag,
  sell: Tag,
  fact_check: ClipboardCheck,

  // Auth & Security
  lock: Lock,
  lock_open: Lock,
  security: Shield,
  shield: Shield,
  shield_check: ShieldCheck,
  logout: LogOut,
  login: ArrowRight,

  // UI Elements
  menu: Menu,
  more_vert: MoreVertical,
  more_horiz: MoreHorizontal,
  eye: Eye,
  visibility: Eye,
  visibility_off: EyeOff,
  help: HelpCircle,
  help_outline: HelpCircle,
  info: Info,
  sparkles: Sparkles,
  auto_awesome: Sparkles,
  bolt: Zap,
  zap: Zap,
  globe: Globe,
  language: Globe,
  fullscreen: Maximize2,
  fullscreen_exit: Minimize2,
  thumbs_up: ThumbsUp,
  thumb_up: ThumbsUp,
  thumbs_down: ThumbsDown,
  thumb_down: ThumbsDown,
  touch_app: Navigation,

  // Weather & Environment
  sunny: Sun,
  wb_sunny: Sun,
  cloud: Cloud,
  cloud_off: Cloud,
  water_drop: Droplets,
  humidity: Droplet,
};

function CheckCheckIcon(props: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size || 24}
      height={props.size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth || 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      {...props}
    >
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </svg>
  );
}

export interface IconProps extends LucideProps, Omit<React.SVGProps<SVGSVGElement>, keyof LucideProps> {
  name: string;
  title?: string;
}

export const Icon: React.FC<IconProps> = ({ name, className = '', size = 20, ...props }) => {
  const normalizedKey = name.toLowerCase().trim().replace(/-/g, '_');
  const Component = ICON_MAP[normalizedKey];

  if (!Component) {
    return <Sparkles size={size} className={className} {...props} />;
  }

  return <Component size={size} className={className} {...props} />;
};

export default Icon;
