export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  category: 'bridal' | 'special-event' | 'everyday' | 'photoshoot';
  image?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  rating: number;
  comment: string;
  service: string;
  image?: string;
}

export interface Artist {
  id: string;
  name: string;
  title: string;
  bio: string;
  experience: string;
  specialties: string[];
  image?: string;
}

export interface BookingForm {
  name: string;
  email: string;
  phone: string;
  service: string;
  date: string;
  time: string;
  message?: string;
}

export interface ContactInfo {
  address: string;
  phone: string;
  email: string;
  hours: {
    weekdays: string;
    weekends: string;
  };
}