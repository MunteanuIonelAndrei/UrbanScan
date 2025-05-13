import { useState, useEffect, useRef, useCallback } from 'react';
import _ from 'lodash';
import { MAX_ELEVATION_CACHE_SIZE } from '../components/Common/constants';
import { limitCacheSize } from '../components/Common/utils';

export const useElevation = () => {
  const [elevationCache, setElevationCache] = useState({});
  const [elevationData, setElevationData] = useState(null);
  const [elevationLoading, setElevationLoading] = useState(false);
  const [targetAltitude, setTargetAltitude] = useState(10);
  const [lastValidAGL, setLastValidAGL] = useState(null);

  const fetchElevationRef = useRef();
  
  useEffect(() => {
    if (!fetchElevationRef.current) {
      fetchElevationRef.current = _.throttle(async (lat, lng) => {
        setElevationLoading(true);
        try {
          const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
          if (elevationCache[cacheKey]) {
            console.log("[Admin] Using cached elevation data");
            setElevationData(elevationCache[cacheKey]);
            setElevationLoading(false);
            return;
          }
          
          console.log("[Admin] Fetching elevation data from API");
          const response = await fetch(
            `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`
          );
          const data = await response.json();
          
          if (data && data.results && data.results.length > 0) {
            const elevationResult = { elevation: data.results[0].elevation, lat, lng };
            setElevationCache(prevCache => {
              const newCache = { ...prevCache, [cacheKey]: elevationResult };
              return limitCacheSize(newCache, MAX_ELEVATION_CACHE_SIZE);
            });
            setElevationData(elevationResult);
          }
        } catch (error) {
          console.error("Error fetching elevation:", error);
        } finally {
          setElevationLoading(false);
        }
      }, 1000, { leading: true, trailing: true });
    }
    
    return () => {
      if (fetchElevationRef.current && fetchElevationRef.current.cancel) {
        fetchElevationRef.current.cancel();
      }
    };
  }, [elevationCache]);

  const fetchElevation = useCallback((lat, lng) => {
    if (fetchElevationRef.current) {
      fetchElevationRef.current(lat, lng);
    }
  }, []);

  return {
    elevationCache,
    setElevationCache,
    elevationData,
    setElevationData,
    elevationLoading,
    targetAltitude,
    setTargetAltitude,
    lastValidAGL,
    setLastValidAGL,
    fetchElevation
  };
};