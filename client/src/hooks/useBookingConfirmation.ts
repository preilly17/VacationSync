import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';

interface BookingData {
  type: 'flight' | 'hotel' | 'activity' | 'restaurant';
  data: any;
}

interface RestaurantBookingData {
  id: string;
  name: string;
  address: string;
  phone?: string;
  cuisine: string;
  rating: number;
  priceRange: string;
  website?: string;
  openTableUrl?: string;
  bookingLinks?: Array<{ text: string; url: string; type: string }>;
}

interface PendingBooking {
  type: 'flight' | 'hotel' | 'activity' | 'restaurant';
  data: any;
  tripId: number;
  timestamp: number;
  leftAt: number;
  url?: string;
}

export function useBookingConfirmation() {
  const [location] = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const leftAtRef = useRef<number | null>(null);
  const visibilityTimeoutRef = useRef<number | null>(null);
  const autoCloseTimeoutRef = useRef<number | null>(null);

  // Page Visibility API tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      const nowVisible = !document.hidden;
      const now = Date.now();
      
      if (!nowVisible && isVisible) {
        // User left the page
        leftAtRef.current = now;
      } else if (nowVisible && !isVisible) {
        // User returned to the page
        if (leftAtRef.current) {
          const timeAway = now - leftAtRef.current;
          console.log(`User returned after ${timeAway}ms away`);
          
          // Only check for booking confirmation if they were away for 30+ seconds
          if (timeAway >= 30000) {
            // Delay checking to avoid immediate popup
            visibilityTimeoutRef.current = window.setTimeout(() => {
              checkForBookingReturn(timeAway);
            }, 1000);
          }
        }
        leftAtRef.current = null;
      }
      
      setIsVisible(nowVisible);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
      }
    };
  }, [isVisible]);

  const checkForBookingReturn = useCallback((timeAway?: number) => {
    const bookingStorage = localStorage.getItem('pendingBooking');
    const confirmedBookingsStorage = localStorage.getItem('confirmedBookings') || '{}';
    
    if (!bookingStorage) return;
    
    try {
      const pending: PendingBooking = JSON.parse(bookingStorage);
      const confirmedBookings = JSON.parse(confirmedBookingsStorage);
      
      // Check if we already asked about this booking today
      const bookingKey = `${pending.type}_${pending.data.id || pending.data.name}_${pending.tripId}`;
      const today = new Date().toDateString();
      
      if (confirmedBookings[bookingKey] === today) {
        console.log('Already asked about this booking today, skipping');
        return;
      }
      
      // Only show modal if we're on the correct trip page or restaurants page with trip context
      const isCorrectPage = location.includes(`/trip/${pending.tripId}`) || 
                           (location.includes('/restaurants') && location.includes(`tripId=${pending.tripId}`));
      
      if (isCorrectPage && timeAway && timeAway >= 30000) {
        console.log('Showing booking confirmation modal for:', pending);
        setBookingData(pending);
        setShowModal(true);
        
        // Auto-close after 30 seconds if no response
        autoCloseTimeoutRef.current = window.setTimeout(() => {
          console.log('Auto-closing booking confirmation modal');
          closeModal();
        }, 30000);
        
        // Clear the pending booking
        localStorage.removeItem('pendingBooking');
      }
    } catch (error) {
      console.error('Error parsing booking data:', error);
      localStorage.removeItem('pendingBooking');
    }
  }, [location]);

  // Enhanced booking sites list for restaurants
  const bookingSites = [
    'booking.com',
    'hotels.com', 
    'expedia.com',
    'kayak.com',
    'skyscanner.com',
    'priceline.com',
    'getyourguide.com',
    'viator.com',
    'amadeus.com',
    // Restaurant booking sites
    'opentable.com',
    'resy.com',
    'yelp.com',
    'zomato.com',
    'seamless.com',
    'grubhub.com',
    'doordash.com',
    'ubereats.com',
    'bookatable.com',
    'diningcity.com',
    'tablecheck.com'
  ];

  // Legacy referrer-based detection (fallback)
  useEffect(() => {
    const checkReferrerBookingReturn = () => {
      const referrer = document.referrer;
      const bookingStorage = localStorage.getItem('pendingBooking');
      
      if (!bookingStorage || !referrer) return;
      
      const isFromBookingSite = bookingSites.some(site => 
        referrer.toLowerCase().includes(site)
      );

      if (isFromBookingSite) {
        // Small delay then check
        setTimeout(() => checkForBookingReturn(), 1500);
      }
    };

    checkReferrerBookingReturn();

    // Also check when the page gains focus (user switches back to tab)
    const handleFocus = () => {
      setTimeout(() => checkForBookingReturn(), 800);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [location, checkForBookingReturn]);

  const storeBookingIntent = (
    type: 'flight' | 'hotel' | 'activity' | 'restaurant', 
    data: any, 
    tripId: number, 
    url?: string
  ) => {
    const bookingIntent: PendingBooking = {
      type,
      data,
      tripId,
      timestamp: Date.now(),
      leftAt: Date.now(),
      url
    };
    localStorage.setItem('pendingBooking', JSON.stringify(bookingIntent));
    console.log('Stored booking intent:', bookingIntent);
  };

  const markBookingAsAsked = (type: string, dataId: string, tripId: number, response: 'confirmed' | 'declined' | 'dismissed') => {
    const confirmedBookingsStorage = localStorage.getItem('confirmedBookings') || '{}';
    const confirmedBookings = JSON.parse(confirmedBookingsStorage);
    const bookingKey = `${type}_${dataId}_${tripId}`;
    const today = new Date().toDateString();
    
    confirmedBookings[bookingKey] = today;
    localStorage.setItem('confirmedBookings', JSON.stringify(confirmedBookings));
    console.log(`Marked booking as ${response}:`, bookingKey);
  };

  const closeModal = () => {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
    
    // Mark as dismissed if closing without confirmation
    if (bookingData) {
      const dataId = bookingData.data.id || bookingData.data.name || 'unknown';
      markBookingAsAsked(bookingData.type, dataId, bookingData.data.tripId || 0, 'dismissed');
    }
    
    setShowModal(false);
    setBookingData(null);
  };

  const confirmBooking = (confirmed: boolean) => {
    if (bookingData) {
      const dataId = bookingData.data.id || bookingData.data.name || 'unknown';
      markBookingAsAsked(bookingData.type, dataId, bookingData.data.tripId || 0, confirmed ? 'confirmed' : 'declined');
    }
  };

  return {
    showModal,
    bookingData,
    storeBookingIntent,
    closeModal,
    confirmBooking,
    markBookingAsAsked
  };
}