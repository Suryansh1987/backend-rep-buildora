import { Product, Category } from '@/types';

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Wireless Bluetooth Headphones',
    price: 79.99,
    originalPrice: 99.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
    category: 'Electronics',
    rating: 4.5,
    reviews: 128,
    description: 'Premium wireless headphones with noise cancellation and 30-hour battery life.',
    inStock: true,
    features: ['Noise Cancellation', '30h Battery', 'Wireless Charging']
  },
  {
    id: '2',
    name: 'Smart Fitness Watch',
    price: 199.99,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
    category: 'Electronics',
    rating: 4.3,
    reviews: 89,
    description: 'Advanced fitness tracking with heart rate monitor and GPS.',
    inStock: true,
    features: ['Heart Rate Monitor', 'GPS Tracking', 'Water Resistant']
  },
  {
    id: '3',
    name: 'Organic Cotton T-Shirt',
    price: 24.99,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500',
    category: 'Clothing',
    rating: 4.7,
    reviews: 203,
    description: 'Comfortable organic cotton t-shirt in various colors.',
    inStock: true
  },
  {
    id: '4',
    name: 'Professional Camera Lens',
    price: 449.99,
    image: 'https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=500',
    category: 'Electronics',
    rating: 4.8,
    reviews: 67,
    description: '85mm f/1.4 portrait lens for professional photography.',
    inStock: true,
    features: ['85mm Focal Length', 'f/1.4 Aperture', 'Weather Sealed']
  },
  {
    id: '5',
    name: 'Minimalist Desk Lamp',
    price: 89.99,
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500',
    category: 'Home & Garden',
    rating: 4.4,
    reviews: 156,
    description: 'Modern LED desk lamp with adjustable brightness and color temperature.',
    inStock: true
  },
  {
    id: '6',
    name: 'Running Shoes',
    price: 129.99,
    originalPrice: 159.99,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
    category: 'Sports',
    rating: 4.6,
    reviews: 342,
    description: 'Lightweight running shoes with advanced cushioning technology.',
    inStock: true
  }
];

export const mockCategories: Category[] = [
  {
    id: '1',
    name: 'Electronics',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400',
    productCount: 156
  },
  {
    id: '2',
    name: 'Clothing',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400',
    productCount: 89
  },
  {
    id: '3',
    name: 'Home & Garden',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400',
    productCount: 234
  },
  {
    id: '4',
    name: 'Sports',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
    productCount: 67
  },
  {
    id: '5',
    name: 'Books',
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400',
    productCount: 123
  },
  {
    id: '6',
    name: 'Beauty',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400',
    productCount: 78
  }
];