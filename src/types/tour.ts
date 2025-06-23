export interface Destination {
  id: string;
  name: string;
  address: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  openingHours?: {
    open: string;
    close: string;
    days?: string[];
  };
  ticketPrice?: {
    adult: number;
    child?: number;
    student?: number;
    currency: string;
  };
  description: string;
  history?: string;
  culture?: string;
  images?: string[]; // Array of Cloudinary URLs
  rating?: number;
  website?: string;
  phoneNumber?: string;
  estimatedVisitTime: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
}

export interface Activity {
  id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  type:
    | 'sightseeing'
    | 'dining'
    | 'shopping'
    | 'entertainment'
    | 'cultural'
    | 'outdoor'
    | 'transport'
    | 'other';
  cost?: number;
  isOptional: boolean;
  requirements?: string[];
  notes?: string;
  images?: string[]; // Array of Cloudinary URLs
}

export interface TourStop {
  id: string;
  destinationId: string;
  destination?: Destination;
  arrivalTime: string; // HH:MM format
  departureTime: string; // HH:MM format
  activities: Activity[];
  specialInstructions?: string;
  meetingPoint?: string;
  order: number;
}

export interface TourItinerary {
  id: string;
  title: string;
  description: string;
  guideId: string[];
  guideName: string[];
  tourDate: Date;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  maxParticipants?: number;
  currentParticipants?: number;
  difficulty: 'easy' | 'moderate' | 'challenging';
  category:
    | 'cultural'
    | 'historical'
    | 'nature'
    | 'adventure'
    | 'food'
    | 'shopping'
    | 'mixed';
  price?: {
    adult: number;
    child?: number;
    currency: string;
  };
  stops: TourStop[];
  totalDuration: number; // in minutes
  language: string[];
  requirements?: string[];
  included?: string[];
  excluded?: string[];
  notes?: string;
  images?: string[]; // Array of Cloudinary URLs for tour gallery
  status: 'draft' | 'published' | 'active' | 'completed' | 'cancelled';
  chatId?: string; // Associated chat room
  participantIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TourTemplate {
  id: string;
  name: string;
  description: string;
  guideId: string[];
  category: string;
  stops: Omit<TourStop, 'id'>[];
  estimatedDuration: number;
  isPublic: boolean;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TourStatus =
  | 'draft'
  | 'published'
  | 'active'
  | 'completed'
  | 'cancelled';
export enum TourStatusEnum {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface TourParticipant {
  userId: string;
  userName: string;
  userAvatar?: string;
  joinedAt: Date;
  status: 'confirmed' | 'pending' | 'cancelled';
  specialRequests?: string;
}
