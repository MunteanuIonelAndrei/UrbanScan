import React, { useState, useRef, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  Grid,
  Box,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  Send as SendIcon,
  Image as ImageIcon,
  Map as MapIcon,
  MyLocation as MyLocationIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';

// Fix for Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// API URL - will be overridden by proxy in package.json for development
const API_URL = process.env.REACT_APP_API_URL || '';

// Map Click Handler Component
function MapClickHandler({ setCoordinates }) {
  const map = useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      const fixedLat = parseFloat(lat.toFixed(6));
      const fixedLng = parseFloat(lng.toFixed(6));
      
      // Update coordinates in the parent component
      setCoordinates({
        lat: fixedLat,
        lng: fixedLng
      });
    }
  });
  return null;
}

function App() {
  // State for map marker position
  const [markerPosition, setMarkerPosition] = useState(null);
  // State for storing captured/uploaded photos
  const [photos, setPhotos] = useState([]);
  // State for problem details
  const [problemDetails, setProblemDetails] = useState('');
  // State for location
  const [location, setLocation] = useState('');
  // State for coordinates
  const [coordinates, setCoordinates] = useState({ lat: '', lng: '' });
  // State for location confirmation
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  // State for detecting mobile device
  const [isMobile, setIsMobile] = useState(false);
  // Reference for file input
  const fileInputRef = useRef(null);
  // Reference for camera input
  const cameraInputRef = useRef(null);
  // State for form submission status
  const [submitting, setSubmitting] = useState(false);
  // State for submission message
  const [submitMessage, setSubmitMessage] = useState({ text: '', isError: false });
  // State for server connection
  const [serverStatus, setServerStatus] = useState({ connected: false, message: 'Checking server connection...' });
  // State for snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  // State for map reference
  const [mapRef, setMapRef] = useState(null);
  // State for current view
  const [currentView, setCurrentView] = useState('photos'); // 'photos', 'details', 'location'

  // Initialize device detection
  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileRegex = /android|iphone|ipad|ipod|blackberry|windows phone/i;
      setIsMobile(mobileRegex.test(userAgent));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Quietly initialize geolocation if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCoordinates(newPosition);
          setMarkerPosition([newPosition.lat, newPosition.lng]);
        },
        () => {}, // Silently ignore errors
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Check server connection on component mount
  useEffect(() => {
    const checkServerConnection = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/health`, {
          timeout: 5000
        });
        
        if (response.status === 200) {
          setServerStatus({ 
            connected: true, 
            message: 'Connected to server successfully.' 
          });
        } else {
          throw new Error(`Server returned status: ${response.status}`);
        }
      } catch (error) {
        setServerStatus({ 
          connected: false, 
          message: `Unable to connect to server. ${error.message}` 
        });
      }
    };
    
    checkServerConnection();
  }, []);

  // Handle camera capture
  const handleCameraCapture = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Add the new photo to the photos array
        setPhotos([...photos, { 
          id: Date.now(), 
          src: reader.result,
          type: 'camera',
          file
        }]);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle file uploads
  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotos(prevPhotos => [...prevPhotos, { 
            id: Date.now() + Math.random(), 
            src: reader.result,
            type: 'upload',
            file
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Handle removing a photo
  const handleRemovePhoto = (id) => {
    setPhotos(photos.filter(photo => photo.id !== id));
  };

  // Toggle location confirmation
  const handleLocationConfirmation = () => {
    setLocationConfirmed(!locationConfirmed);
    
    // Clear coordinates if user unchecks confirmation
    if (locationConfirmed) {
      setCoordinates({ lat: '', lng: '' });
    }
  };

  // Helper function to get location and update map
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setSnackbar({
        open: true,
        message: "Geolocation is not available in your browser.",
        severity: "error"
      });
      return;
    }
    
    setSnackbar({
      open: true,
      message: "Getting your location...",
      severity: "info"
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCoordinates(newPosition);
        setMarkerPosition([newPosition.lat, newPosition.lng]);

        if (mapRef) {
          mapRef.setView([newPosition.lat, newPosition.lng], 15);
        }

        setSnackbar({
          open: true,
          message: "Location updated successfully!",
          severity: "success"
        });
      },
      (error) => {
        setSnackbar({
          open: true,
          message: "Could not get your location. Please try marking it on the map.",
          severity: "error"
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbar({...snackbar, open: false});
  };

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Validation
    if (photos.length === 0) {
      setSnackbar({
        open: true,
        message: "Please take or upload at least one photo.",
        severity: "error"
      });
      return;
    }

    if (!problemDetails.trim()) {
      setSnackbar({
        open: true,
        message: "Please enter problem details.",
        severity: "error"
      });
      return;
    }

    if (!location.trim()) {
      setSnackbar({
        open: true,
        message: "Please enter a location description.",
        severity: "error"
      });
      return;
    }

    // Create form data
    const formData = new FormData();
    formData.append('problem_details', problemDetails);
    formData.append('location', location);
    formData.append('latitude', coordinates.lat);
    formData.append('longitude', coordinates.lng);
    
    // Append photos
    photos.forEach((photo) => {
      formData.append('files', photo.file);
    });

    try {
      setSubmitting(true);
      setSubmitMessage({ text: "Submitting report...", isError: false });
      
      const response = await axios.post(`${API_URL}/api/reports/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000
      });

      if (response.status === 201) {
        setSubmitMessage({ text: "Report submitted successfully!", isError: false });
        setSnackbar({
          open: true,
          message: "Report submitted successfully! Thank you for your contribution.",
          severity: "success"
        });
        
        // Reset form
        setPhotos([]);
        setProblemDetails('');
        setLocation('');
        setCoordinates({ lat: '', lng: '' });
        setLocationConfirmed(false);
        setCurrentView('photos');
      } else {
        throw new Error(response.data.message || 'Something went wrong');
      }
    } catch (error) {
      setSubmitMessage({ 
        text: `Failed to submit report: ${error.message}`, 
        isError: true 
      });
      setSnackbar({
        open: true,
        message: `Failed to submit report: ${error.message}`,
        severity: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Navigation controls
  const goToNextView = () => {
    if (currentView === 'photos') {
      // Validate photos before proceeding
      if (photos.length === 0) {
        setSnackbar({
          open: true,
          message: "Please take or upload at least one photo.",
          severity: "warning"
        });
        return;
      }
      setCurrentView('details');
    } else if (currentView === 'details') {
      // Validate problem details before proceeding
      if (!problemDetails.trim()) {
        setSnackbar({
          open: true,
          message: "Please enter problem details.",
          severity: "warning"
        });
        return;
      }
      setCurrentView('location');
    }
  };

  const goToPreviousView = () => {
    if (currentView === 'details') {
      setCurrentView('photos');
    } else if (currentView === 'location') {
      setCurrentView('details');
    }
  };

  // Render the Photos View
  const renderPhotosView = () => (
    <Box className="view-section">
      <Typography variant="h6" gutterBottom align="center">
        <ImageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Add Photos
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 2, mt: 2 }}>
        {isMobile && (
          <Grid item xs={6}>
            <Button 
              variant="contained" 
              color="primary" 
              fullWidth
              startIcon={<CameraIcon />}
              onClick={() => cameraInputRef.current.click()}
              disabled={!serverStatus.connected}
              sx={{ borderRadius: 4, py: 1.5 }}
            >
              Camera
            </Button>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraCapture}
              ref={cameraInputRef}
              style={{ display: 'none' }}
            />
          </Grid>
        )}
        
        <Grid item xs={isMobile ? 6 : 12}>
          <Button 
            variant="contained" 
            color="secondary" 
            fullWidth
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current.click()}
            disabled={!serverStatus.connected}
            sx={{ borderRadius: 4, py: 1.5 }}
          >
            Upload
          </Button>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 3 }}>
        <Grid container spacing={1}>
          {photos.map(photo => (
            <Grid item xs={6} sm={4} key={photo.id}>
              <Card sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden' }}>
                <CardMedia
                  component="img"
                  image={photo.src}
                  alt="Problem"
                  sx={{ height: 140, objectFit: 'cover' }}
                />
                <IconButton 
                  size="small" 
                  sx={{ 
                    position: 'absolute', 
                    top: 5, 
                    right: 5,
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.9)',
                    }
                  }}
                  onClick={() => handleRemovePhoto(photo.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
      
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={goToNextView}
          disabled={!serverStatus.connected}
          sx={{ borderRadius: 4, px: 4, py: 1.2 }}
        >
          Next
        </Button>
      </Box>
    </Box>
  );

  // Render the Details View
  const renderDetailsView = () => (
    <Box className="view-section">
      <Typography variant="h6" gutterBottom align="center">
        Problem Details
      </Typography>
      
      <TextField
        fullWidth
        multiline
        rows={6}
        value={problemDetails}
        onChange={(e) => setProblemDetails(e.target.value)}
        placeholder="Describe the problem in detail..."
        required
        disabled={!serverStatus.connected}
        variant="outlined"
        sx={{ 
          mt: 2, 
          '& .MuiOutlinedInput-root': {
            borderRadius: 2
          }
        }}
      />
      
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          variant="outlined" 
          onClick={goToPreviousView}
          sx={{ borderRadius: 4, px: 3, py: 1.2 }}
        >
          Back
        </Button>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={goToNextView}
          disabled={!serverStatus.connected}
          sx={{ borderRadius: 4, px: 3, py: 1.2 }}
        >
          Next
        </Button>
      </Box>
    </Box>
  );

  // Render the Location View
  const renderLocationView = () => (
    <Box className="view-section">
      <Typography variant="h6" gutterBottom align="center">
        <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Location
      </Typography>
      
      <TextField
        fullWidth
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Enter location description (e.g., Street name, Building)"
        required
        disabled={!serverStatus.connected}
        variant="outlined"
        sx={{ 
          mt: 2, 
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: 2
          }
        }}
      />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <ToggleButtonGroup
          value={locationConfirmed ? "map" : "none"}
          exclusive
          onChange={() => setLocationConfirmed(!locationConfirmed)}
          aria-label="location method"
          sx={{ width: '100%' }}
        >
          <ToggleButton value="map" aria-label="map" sx={{ width: '100%', py: 1 }}>
            <MapIcon sx={{ mr: 1 }} />
            Use Map
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      
      {locationConfirmed && (
        <Box sx={{ height: 250, mb: 2, border: '1px solid #ddd', borderRadius: 2, overflow: 'hidden' }}>
          <MapContainer
            center={markerPosition || [46.770439, 23.591423]} // Default coordinates
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            whenCreated={map => setMapRef(map)}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {coordinates.lat && coordinates.lng && (
              <Marker position={[coordinates.lat, coordinates.lng]} />
            )}
            <MapClickHandler setCoordinates={setCoordinates} />
          </MapContainer>
          
          <Button
            variant="outlined"
            color="primary"
            fullWidth
            startIcon={<MyLocationIcon />}
            onClick={handleGetLocation}
            disabled={!serverStatus.connected}
            sx={{ mt: 1, borderRadius: 4, py: 1 }}
          >
            Get My Location
          </Button>
        </Box>
      )}
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          variant="outlined" 
          onClick={goToPreviousView}
          sx={{ borderRadius: 4, px: 3, py: 1.2 }}
        >
          Back
        </Button>
        
        <Button 
          variant="contained" 
          color="primary"
          onClick={handleSubmit}
          disabled={submitting || !serverStatus.connected || (!coordinates.lat && !coordinates.lng)}
          startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          sx={{ borderRadius: 4, px: 3, py: 1.2 }}
        >
          {submitting ? 'Submitting...' : 'Submit Report'}
        </Button>
      </Box>
    </Box>
  );

  return (
    <Container maxWidth="sm" className="app-container">
      <Paper 
        elevation={3} 
        sx={{ 
          p: 2, 
          my: 2, 
          borderRadius: 3,
          minHeight: '80vh'
        }}
      >
        <Typography 
          variant="h5" 
          component="h1" 
          gutterBottom 
          align="center" 
          sx={{ fontWeight: 'bold', color: 'primary.main', mb: 2 }}
        >
          City Problem Reporter
        </Typography>
        
        {serverStatus.connected ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
            <Chip 
              label="Server Connected" 
              color="success" 
              variant="outlined" 
              size="small"
            />
          </Box>
        ) : (
          <Box sx={{ mb: 2 }}>
            <Alert severity="error" sx={{ mb: 1 }}>
              {serverStatus.message}
            </Alert>
            <Button 
              variant="outlined" 
              color="primary" 
              fullWidth
              onClick={() => window.location.reload()}
              sx={{ borderRadius: 4 }}
            >
              Retry Connection
            </Button>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />
        
        {/* Progress indicators */}
        <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 3 }}>
          <Chip 
            label="Photos" 
            color={currentView === 'photos' ? 'primary' : 'default'}
            variant={currentView === 'photos' ? 'filled' : 'outlined'}
            onClick={() => photos.length > 0 && setCurrentView('photos')}
          />
          <Chip 
            label="Details" 
            color={currentView === 'details' ? 'primary' : 'default'}
            variant={currentView === 'details' ? 'filled' : 'outlined'}
            onClick={() => photos.length > 0 && setCurrentView('details')}
          />
          <Chip 
            label="Location" 
            color={currentView === 'location' ? 'primary' : 'default'}
            variant={currentView === 'location' ? 'filled' : 'outlined'}
            onClick={() => problemDetails.trim() !== '' && photos.length > 0 && setCurrentView('location')}
          />
        </Box>
        
        {/* Dynamic view content */}
        {currentView === 'photos' && renderPhotosView()}
        {currentView === 'details' && renderDetailsView()}
        {currentView === 'location' && renderLocationView()}
      </Paper>
      
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ width: '100%', borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App;