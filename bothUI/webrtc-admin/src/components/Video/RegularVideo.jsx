import React, { forwardRef, useEffect, useCallback } from 'react';

const RegularVideo = forwardRef(({ videoActive, hidden }, ref) => {
  // Ensure video plays when it becomes visible
  const ensureVideoPlaying = useCallback(() => {
    if (ref.current && ref.current.srcObject && !hidden) {
      ref.current.play()
        .catch(err => console.error("[RegularVideo] Play error:", err));
    }
  }, [ref, hidden]);

  useEffect(() => {
    if (!hidden && ref.current && ref.current.srcObject) {
      ensureVideoPlaying();
    }
  }, [hidden, ensureVideoPlaying, ref]);

  useEffect(() => {
    const videoElement = ref.current;
    if (!videoElement) return;

    // Handle when the video stalls (freezes)
    const handleStalled = () => {
      console.log("[RegularVideo] Video stalled, attempting to resume");
      if (videoElement.readyState < 3) { // HAVE_FUTURE_DATA
        videoElement.load();
      }
      ensureVideoPlaying();
    };

    const handleWaiting = () => {
      console.log("[RegularVideo] Video waiting for data");
    };

    const handlePlaying = () => {
      console.log("[RegularVideo] Video playing successfully");
    };

    const handleError = (e) => {
      console.error("[RegularVideo] Video error:", e);
      if (videoElement.error) {
        console.error("[RegularVideo] Error details:", videoElement.error);
      }
    };

    videoElement.addEventListener('stalled', handleStalled);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('error', handleError);

    return () => {
      videoElement.removeEventListener('stalled', handleStalled);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('playing', handlePlaying);
      videoElement.removeEventListener('error', handleError);
    };
  }, [ref, ensureVideoPlaying]);

  return (
    <div className={`regular-video-wrapper ${hidden ? 'hidden' : ''}`}>
      <video 
        ref={ref} 
        className="drone-video regular" 
        muted 
        autoPlay 
        playsInline
        poster=""
      />
      {!videoActive && (
        <div className="no-video-overlay">
          <p>Waiting for video stream...</p>
        </div>
      )}
    </div>
  );
});

export default RegularVideo;