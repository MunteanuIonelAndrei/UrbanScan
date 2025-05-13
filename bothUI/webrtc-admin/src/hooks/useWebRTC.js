import { useState, useEffect, useRef, useCallback } from 'react';
import SimplePeer from "simple-peer";
import { io } from "socket.io-client";
import { ICE_SERVERS, VideoDisplayMode } from '../components/Common/constants';

const socket = io("http://172.20.10.3:4000");

export const useWebRTC = () => {
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [videoActive, setVideoActive] = useState(false);
  const [videoDisplayMode, setVideoDisplayMode] = useState(VideoDisplayMode.REGULAR);
  const [thermalAvailable, setThermalAvailable] = useState(false);
  
  const peerRef = useRef(null);
  const regularVideoRef = useRef(null);
  const thermalVideoRef = useRef(null);
  const videoTracksRef = useRef({
    regular: null,
    thermal: null
  });
  const activeListenersRef = useRef({});
  const streamRef = useRef(null);
  const trackCountRef = useRef(0);

  const cleanupPeer = useCallback(() => {
    if (peerRef.current) {
      ["signal", "connect", "close", "error", "data", "stream", "track"].forEach(event => {
        peerRef.current.removeAllListeners(event);
      });
      
      peerRef.current.destroy();
      peerRef.current = null;
      activeListenersRef.current = {};
      trackCountRef.current = 0;
    }
  }, []);

  // Handle incoming offer
  const handleOffer = useCallback(
    (offerData) => {
      console.log("[Admin] Received offer:", offerData);
      if (!offerData || !offerData.sdp || offerData.type !== "offer") {
        console.error("[Admin] Invalid offer data.");
        return;
      }
      
      cleanupPeer();
      trackCountRef.current = 0;
      
      const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        config: { iceServers: ICE_SERVERS },
      });
      
      peerRef.current = peer;
      
      peer.on("signal", (signalData) => {
        if (signalData.type === "answer") {
          console.log("[Admin] Sending answer via socket...");
          socket.emit("answer", signalData);
          setConnectionStatus("connecting");
        }
        if (signalData.candidate) {
          console.log("[Admin] Sending local ICE candidate via socket...");
          const candidateOnly = signalData.candidate.split("candidate:")[1];
          socket.emit("ice-candidate", {
            candidate: candidateOnly,
            sdpMid: signalData.sdpMid,
            sdpMLineIndex: signalData.sdpMLineIndex,
          });
        }
      });
      
      peer.on("connect", () => {
        console.log("[Admin] Peer connected! Data channel open.");
        setConnectionStatus("connected");
      });
      
      peer.on("close", () => {
        console.log("[Admin] Peer connection closed.");
        setConnectionStatus("disconnected");
        cleanupPeer();
      });
      
      peer.on("error", (err) => {
        console.error("[Admin] Peer error:", err);
        setConnectionStatus("failed");
      });
      
      // Handle incoming stream
      peer.on("stream", (stream) => {
        console.log("[Admin] Received remote stream");
        streamRef.current = stream;
      });
      
      // Handle individual tracks as they arrive
      peer.on("track", (track, stream) => {
        console.log("[Admin] Received remote track:", {
          id: track.id,
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState
        });
        handleTrack(track, stream);
      });
      
      try {
        peer.signal(offerData);
      } catch (err) {
        console.error("[Admin] Error signaling offer:", err);
      }
    },
    [cleanupPeer]
  );

  const handleTrack = useCallback((track, stream) => {
    if (track.kind !== "video") {
      console.log("[Admin] Ignoring non-video track");
      return;
    }
    
    trackCountRef.current += 1;
    const trackCount = trackCountRef.current;
    
    console.log("[Admin] Processing video track #" + trackCount);
    console.log("[Admin] Track details:", {
      id: track.id,
      label: track.label,
      settings: track.getSettings?.(),
      constraints: track.getConstraints?.()
    });
    
    // Determine track type based on order (first track is regular, second is thermal)
    const isRegular = trackCount === 1;
    const isThermal = trackCount === 2;
    
    console.log("[Admin] Track assignment:", { isRegular, isThermal, trackCount });
    
    if (isRegular && regularVideoRef.current) {
      console.log("[Admin] Setting up regular video (track #" + trackCount + ")");
      
      // Clean up any existing track
      if (videoTracksRef.current.regular) {
        videoTracksRef.current.regular.stop();
      }
      
      videoTracksRef.current.regular = track;
      
      // Create a new stream with just this track
      const mediaStream = new MediaStream([track]);
      
      // Remove any existing srcObject first
      if (regularVideoRef.current.srcObject) {
        const oldTracks = regularVideoRef.current.srcObject.getTracks();
        oldTracks.forEach(t => t.stop());
      }
      
      regularVideoRef.current.srcObject = mediaStream;
      
      // Configure video element
      regularVideoRef.current.autoplay = true;
      regularVideoRef.current.playsInline = true;
      regularVideoRef.current.muted = true;
      
      regularVideoRef.current.onloadedmetadata = () => {
        console.log("[Admin] Regular video metadata loaded");
        regularVideoRef.current.play()
          .then(() => {
            console.log("[Admin] Regular video playing");
            setVideoActive(true);
          })
          .catch((err) => console.error("[Admin] Regular video play error:", err));
      };
      
      // Add track ended handler
      track.onended = () => {
        console.log("[Admin] Regular video track ended");
      };
    } 
    else if (isThermal && thermalVideoRef.current) {
      console.log("[Admin] Setting up thermal video (track #" + trackCount + ")");
      
      // Clean up any existing track
      if (videoTracksRef.current.thermal) {
        videoTracksRef.current.thermal.stop();
      }
      
      videoTracksRef.current.thermal = track;
      
      // Create a new stream with just this track
      const mediaStream = new MediaStream([track]);
      
      // Remove any existing srcObject first
      if (thermalVideoRef.current.srcObject) {
        const oldTracks = thermalVideoRef.current.srcObject.getTracks();
        oldTracks.forEach(t => t.stop());
      }
      
      thermalVideoRef.current.srcObject = mediaStream;
      
      // Configure video element
      thermalVideoRef.current.autoplay = true;
      thermalVideoRef.current.playsInline = true;
      thermalVideoRef.current.muted = true;
      
      thermalVideoRef.current.onloadedmetadata = () => {
        console.log("[Admin] Thermal video metadata loaded");
        thermalVideoRef.current.play()
          .then(() => {
            console.log("[Admin] Thermal video playing");
            setThermalAvailable(true);
            
            // Only change display mode if we're currently showing just regular video
            if (videoDisplayMode === VideoDisplayMode.REGULAR) {
              setVideoDisplayMode(VideoDisplayMode.SIDE_BY_SIDE);
            }
          })
          .catch((err) => console.error("[Admin] Thermal video play error:", err));
      };
      
      // Add track ended handler
      track.onended = () => {
        console.log("[Admin] Thermal video track ended");
      };
    }
  }, [videoDisplayMode]);

  // Handle remote ICE candidates
  const handleRemoteICE = useCallback((candidateData) => {
    if (!peerRef.current) return;
    
    console.log("[Admin] Adding remote ICE candidate:", candidateData);
    try {
      peerRef.current.signal({
        candidate: "candidate:" + candidateData.candidate,
        sdpMid: candidateData.sdpMid,
        sdpMLineIndex: candidateData.sdpMLineIndex,
      });
    } catch (err) {
      console.error("[Admin] Error adding ICE candidate:", err);
    }
  }, []);

  // Setup signaling server connection
  useEffect(() => {
    console.log("[Admin] Connecting to signaling server...");
    
    socket.off("offer");
    socket.off("ice-candidate");
    
    socket.on("offer", handleOffer);
    socket.on("ice-candidate", handleRemoteICE);
    
    socket.emit("admin-ready");
    
    return () => {
      socket.off("offer", handleOffer);
      socket.off("ice-candidate", handleRemoteICE);
    };
  }, [handleOffer, handleRemoteICE]);

  // Cleanup video streams on unmount
  useEffect(() => {
    const currentRegularVideoRef = regularVideoRef.current;
    const currentThermalVideoRef = thermalVideoRef.current;
    const currentPeerRef = peerRef.current;
    
    return () => {
      // Clean up regular video
      if (currentRegularVideoRef) {
        if (currentRegularVideoRef.srcObject) {
          const tracks = currentRegularVideoRef.srcObject.getTracks();
          tracks.forEach((track) => {
            track.stop();
            track.onended = null;
          });
          currentRegularVideoRef.srcObject = null;
        }
        currentRegularVideoRef.onloadedmetadata = null;
      }
      
      // Clean up thermal video
      if (currentThermalVideoRef) {
        if (currentThermalVideoRef.srcObject) {
          const tracks = currentThermalVideoRef.srcObject.getTracks();
          tracks.forEach((track) => {
            track.stop();
            track.onended = null;
          });
          currentThermalVideoRef.srcObject = null;
        }
        currentThermalVideoRef.onloadedmetadata = null;
      }
      
      // Clean up peer
      if (currentPeerRef) {
        ["signal", "connect", "close", "error", "data", "track", "stream"].forEach(event => {
          currentPeerRef.removeAllListeners(event);
        });
        
        currentPeerRef.destroy();
      }
      
      // Clean up stored tracks
      if (videoTracksRef.current.regular) {
        videoTracksRef.current.regular.stop();
        videoTracksRef.current.regular = null;
      }
      if (videoTracksRef.current.thermal) {
        videoTracksRef.current.thermal.stop();
        videoTracksRef.current.thermal = null;
      }
    };
  }, []);

  const sendCommand = useCallback((command) => {
    if (!peerRef.current || !(connectionStatus === "connected" || videoActive)) {
      console.warn("[Admin] Cannot send command - not connected");
      return;
    }
    
    console.log(`[Admin] Sending command to Drone: ${command}`);
    peerRef.current.send(command);
  }, [connectionStatus, videoActive]);

  return {
    connectionStatus,
    videoActive,
    videoDisplayMode,
    setVideoDisplayMode,
    thermalAvailable,
    peerRef,
    regularVideoRef,
    thermalVideoRef,
    sendCommand,
    cleanupPeer,
    activeListenersRef
  };
};