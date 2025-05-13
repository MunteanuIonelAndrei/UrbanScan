import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CardMedia,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Pagination,
  Switch,
  Snackbar,
  Tabs,
  Tab,
  Badge
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Event as EventIcon,
  Description as DescriptionIcon,
  Map as MapIcon,
  Assignment as AssignmentIcon,
  CheckCircle as ResolvedIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
  InfoOutlined as InfoIcon,
  Photo as PhotoIcon,
  Delete as DeleteIcon,
  VerifiedUser as ValidIcon,
  ErrorOutline as InvalidIcon,
  List as AllIcon
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { getApiUrl } from '../contexts/AuthContext';

// Fix for Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Reports component
function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [aiResponseDialogOpen, setAiResponseDialogOpen] = useState(false);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [locationFilter, setLocationFilter] = useState('');
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [filterApplied, setFilterApplied] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0: All, 1: Valid, 2: Invalid
  
  // AI related states
  const [aiFilters, setAiFilters] = useState({
    analyzed: null,
    severity: '',
    category: '',
    is_valid: null,
  });
  const [aiEnabled, setAiEnabled] = useState(true);

  const reportsPerPage = 5;

  // Custom status chip style helper
  const getStatusChipProps = (status) => {
    const statusMap = {
      'new': { color: 'error', label: 'New' },
      'in_progress': { color: 'warning', label: 'In Progress' },
      'resolved': { color: 'success', label: 'Resolved' }
    };
    
    return statusMap[status] || { color: 'default', label: status };
  };

  // Format date helper
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Fetch reports
  // Helper function to normalize AI data structure
  const normalizeAIData = (report) => {
    // Create a normalized copy of the report
    const normalizedReport = { ...report };
    
    // If report has direct AI fields but no ai object or empty ai fields
    if (!normalizedReport.ai) {
      normalizedReport.ai = {};
    }
    
    // Make sure analyzed flag is consistent
    if (normalizedReport.ai_analyzed && !normalizedReport.ai.analyzed) {
      normalizedReport.ai.analyzed = normalizedReport.ai_analyzed;
    }
    
    // Make sure category is consistent
    if (normalizedReport.ai_category && !normalizedReport.ai.category) {
      normalizedReport.ai.category = normalizedReport.ai_category;
    }
    
    // Make sure severity is consistent
    if (normalizedReport.ai_severity && !normalizedReport.ai.severity) {
      normalizedReport.ai.severity = normalizedReport.ai_severity;
    }
    
    // Make sure department is consistent
    if (normalizedReport.ai_department && !normalizedReport.ai.department) {
      normalizedReport.ai.department = normalizedReport.ai_department;
    }
    
    // Make sure is_valid is consistent
    if (normalizedReport.ai_is_valid !== undefined && normalizedReport.ai.is_valid === undefined) {
      normalizedReport.ai.is_valid = normalizedReport.ai_is_valid;
    }
    
    // Make sure analysis text is consistent
    if (normalizedReport.ai_analysis && !normalizedReport.ai.analysis_text) {
      normalizedReport.ai.analysis_text = normalizedReport.ai_analysis;
    }
    
    // Make sure details is consistent
    if (normalizedReport.ai_details && !normalizedReport.ai.details) {
      normalizedReport.ai.details = normalizedReport.ai_details;
    }
    
    return normalizedReport;
  };

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Calculate skip value based on current page (page 1 = skip 0, page 2 = skip reportsPerPage)
        const skip = (currentPage - 1) * reportsPerPage;
        
        // Build params using skip and limit as expected by the backend API
        const params = {
          skip: skip,
          limit: reportsPerPage
        };
        
        console.log(`Making API call with skip=${skip}, limit=${reportsPerPage} for page ${currentPage}`);
        
        // Basic filters
        if (statusFilter !== 'all') {
          params.status = statusFilter;
        }
        
        if (searchTerm) {
          params.search = searchTerm;
        }
        
        if (dateFilter.start) {
          params.start_date = dateFilter.start;
        }
        
        if (dateFilter.end) {
          params.end_date = dateFilter.end;
        }
        
        if (locationFilter) {
          params.location = locationFilter;
        }
        
        // AI-related filters
        if (aiFilters.analyzed !== null) {
          params.ai_analyzed = aiFilters.analyzed;
        }
        
        if (aiFilters.severity) {
          params.ai_severity = aiFilters.severity;
        }
        
        if (aiFilters.category) {
          params.ai_category = aiFilters.category;
        }
        
        if (aiFilters.is_valid !== null) {
          params.ai_is_valid = aiFilters.is_valid;
        }
        
        console.log('Fetching reports with params:', params);
        const response = await axios.get('/api/reports', { params });
        
        // Log the page and total reports
        console.log(`Page ${currentPage}: Retrieved ${response.data.reports?.length} reports of ${response.data.total} total`);
        
        // Normalize AI data for all reports
        // Check if we got reports from the API
        if (!response.data.reports || response.data.reports.length === 0) {
          console.warn(`No reports received from API for page ${currentPage}`);
        } else {
          console.log(`Received ${response.data.reports.length} reports from API for page ${currentPage}`);
        }
        
        const normalizedReports = response.data.reports.map(report => normalizeAIData(report));
        
        // Log normalized reports before updating state
        console.log(`Normalized ${normalizedReports.length} reports for page ${currentPage}`);
        console.log('First normalized report:', normalizedReports.length > 0 ? normalizedReports[0] : 'none');
        
        setReports(normalizedReports);
        console.log(`Updated reports state with ${normalizedReports.length} reports`);
        
        setTotalPages(Math.ceil(response.data.total / reportsPerPage));
      } catch (error) {
        console.error('Error fetching reports:', error);
        setError('Failed to load reports. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchReports();
  }, [currentPage, statusFilter, searchTerm, dateFilter, locationFilter, aiFilters, filterApplied]);

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
  };

  // Handle search clear
  const handleSearchClear = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Handle filter apply
  const handleFilterApply = () => {
    setFilterDialogOpen(false);
    setCurrentPage(1);
    setFilterApplied(true);
  };

  // AI category options for filter
  const aiCategoryOptions = [
    'infrastructure',
    'public safety',
    'waste management',
    'roads',
    'utilities',
    'vandalism',
    'environment'
  ];

  // Severity options for filter
  const severityOptions = [
    'critical',
    'high',
    'medium',
    'low'
  ];

  // Handle filter clear
  const handleFilterClear = () => {
    setDateFilter({ start: '', end: '' });
    setLocationFilter('');
    setAiFilters({
      analyzed: null,
      severity: '',
      category: '',
      is_valid: null
    });
    setCurrentPage(1);
    setFilterApplied(false);
    setFilterDialogOpen(false);
  };

  // Handle report status update
  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      setStatusUpdateLoading(true);
      
      // Add debug log to trace what's happening
      console.log('Updating status for report:', reportId, 'to status:', newStatus);
      
      // Make sure we're using the report_id (string identifier) not the numeric id
      const response = await axios.patch(`/api/reports/${reportId}/status`, { 
        status: newStatus,
        resolution_note: newStatus === 'resolved' ? resolutionNote : undefined
      });
      
      // Get the updated report from response
      const updatedReport = normalizeAIData(response.data);
      
      // Update the local state with normalized data
      setReports(reports.map(report => 
        report.report_id === reportId ? updatedReport : report
      ));
      
      // Update selected report if it's the one we just modified
      if (selectedReport && selectedReport.report_id === reportId) {
        setSelectedReport(updatedReport);
      }
      
      setStatusUpdateSuccess(true);
      setResolveDialogOpen(false);
      setResolutionNote('');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setStatusUpdateSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error updating report status:', error);
      setError('Failed to update report status. Please try again.');
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // Handle resolve dialog open
  const handleResolveClick = (report) => {
    setSelectedReport(report);
    setResolveDialogOpen(true);
  };
  
  // Handle delete dialog open
  const handleDeleteClick = (report, e) => {
    e.stopPropagation(); // Prevent card click
    setReportToDelete(report);
    setDeleteDialogOpen(true);
  };
  
  // Handle report delete
  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    
    try {
      setDeleteLoading(true);
      
      // Make the delete API call
      await axios.delete(`/api/reports/${reportToDelete.report_id}`);
      
      // Update the local state to remove the deleted report
      setReports(reports.filter(report => report.report_id !== reportToDelete.report_id));
      
      // If the deleted report was selected, clear the selection
      if (selectedReport && selectedReport.report_id === reportToDelete.report_id) {
        setSelectedReport(null);
      }
      
      // Show success message
      setSnackbar({
        open: true,
        message: "Report deleted successfully",
        severity: "success"
      });
      
      // Close the dialog
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    } catch (error) {
      console.error('Error deleting report:', error);
      setSnackbar({
        open: true,
        message: "Failed to delete report. Please try again.",
        severity: "error"
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Dummy data for preview
  const dummyReports = [
    {
      id: 'report_1746215796990',
      timestamp: '2025-05-02T19:56:36.999Z',
      problemDetails: 'Broken water pipe causing flooding on the street',
      location: 'Downtown, Main Street 123',
      coordinates: { lat: 46.7618411, lng: 23.5529592 },
      photos: [
        { fileName: 'photo_1.jpg', url: 'https://placehold.co/600x400/png?text=Broken+Pipe' }
      ],
      status: 'new',
      ai_analysis: 'This appears to be a serious water main break that requires immediate attention. The flooding could cause road damage and safety hazards.',
      resolution_note: ''
    },
    {
      id: 'report_1746216039492',
      timestamp: '2025-05-01T14:22:12.492Z',
      problemDetails: 'Street light not working for over a week',
      location: 'North District, Oak Avenue',
      coordinates: { lat: 46.7712345, lng: 23.5698765 },
      photos: [
        { fileName: 'photo_1.jpg', url: 'https://placehold.co/600x400/png?text=Broken+Light' }
      ],
      status: 'in_progress',
      ai_analysis: 'This is a street light outage that affects pedestrian safety. The area appears to be a residential neighborhood with moderate foot traffic.',
      resolution_note: ''
    }
  ];

  // Use dummy data if no reports available yet
  const displayReports = reports.length > 0 ? reports : dummyReports;
  
  // Monitor displayReports changes
  useEffect(() => {
    console.log(`displayReports updated: ${displayReports.length} reports available`);
    
    // Log IDs to verify different reports are shown
    if (displayReports.length > 0) {
      const reportIds = displayReports.map(r => r.report_id || r.id).join(', ');
      console.log(`Report IDs in display: ${reportIds}`);
    }
  }, [displayReports]);

  // Handle page change
  const handlePageChange = (event, value) => {
    console.log(`Changing to page ${value}`);
    setCurrentPage(value);
    // Reset selected report when changing pages to avoid potential data mismatches
    setSelectedReport(null);
  };
  
  // Handle tab change for valid/invalid reports
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    // Update the filter based on the selected tab
    if (newValue === 0) {
      // All reports
      setAiFilters({
        ...aiFilters,
        is_valid: null
      });
    } else if (newValue === 1) {
      // Valid reports
      setAiFilters({
        ...aiFilters,
        is_valid: true
      });
    } else if (newValue === 2) {
      // Invalid reports
      setAiFilters({
        ...aiFilters,
        is_valid: false
      });
    }
    setCurrentPage(1);
  };

  // Handle report click for details
  const handleReportClick = (report) => {
    // Normalize the report data to ensure consistency 
    const normalizedReport = normalizeAIData(report);
    console.log('Report clicked (normalized):', normalizedReport);
    setSelectedReport(normalizedReport);
  };

  // Handle image click for zoom
  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
    setImageDialogOpen(true);
  };

  // Handle map view click
  const handleMapClick = () => {
    if (selectedReport && 
        ((selectedReport.coordinates?.lat && selectedReport.coordinates?.lng) || 
         (selectedReport.latitude && selectedReport.longitude))) {
      setMapDialogOpen(true);
    }
  };

  // Handle AI settings loading

  // Fetch AI settings
  useEffect(() => {
    const fetchAiSettings = async () => {
      try {
        const response = await axios.get('/api/reports/settings/ai-status');
        setAiEnabled(response.data.is_enabled);
      } catch (error) {
        console.error('Error fetching AI settings:', error);
      }
    };
    
    fetchAiSettings();
  }, []);

  // AI analysis status is now read-only in the Reports page
  // Toggle functionality has been removed as it's now only available in Settings

  // Handle manual AI analysis
  const handleAnalyzeReport = async (reportId) => {
    try {
      setStatusUpdateLoading(true);
      
      setSnackbar({
        open: true,
        message: "Starting AI analysis...",
        severity: "info"
      });
      
      const response = await axios.post(`/api/reports/${reportId}/analyze`);
      
      // Normalize the analyzed report data
      const normalizedReport = normalizeAIData(response.data);
      console.log('Analyzed report data received (normalized):', normalizedReport);
      
      // Update the report in the UI with normalized data
      setReports(reports.map(report => 
        report.report_id === reportId ? normalizedReport : report
      ));
      
      // Update the selected report if it's the one we just analyzed
      if (selectedReport && selectedReport.report_id === reportId) {
        setSelectedReport(normalizedReport);
      }
      
      setSnackbar({
        open: true,
        message: "AI analysis has been initiated. It may take a few moments to complete.",
        severity: "success"
      });
    } catch (error) {
      console.error('Error analyzing report:', error);
      setSnackbar({
        open: true,
        message: "Failed to analyze report. Please try again later.",
        severity: "error"
      });
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // Handle AI analysis dialog click
  const handleAiAnalysisClick = () => {
    // Log the AI details to help with debugging
    if (selectedReport && selectedReport.ai) {
      console.log('Opening AI analysis dialog with data:', selectedReport.ai);
      if (selectedReport.ai.details) {
        console.log('AI details keys:', Object.keys(selectedReport.ai.details));
      } else {
        console.log('No AI details found in the selected report');
      }
    }
    setAiResponseDialogOpen(true);
  };

  // Display loading state
  if (loading && reports.length === 0) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="50vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Problem Reports
        </Typography>
        
        <Box display="flex" gap={1}>
          <Chip 
            icon={<AssignmentIcon />}
            label={`AI Analysis: ${aiEnabled ? "Enabled" : "Disabled"}`}
            color={aiEnabled ? "success" : "default"}
            variant="outlined"
          />
          <Tooltip title="Filter Reports">
            <Button 
              variant="outlined" 
              startIcon={<FilterIcon />}
              onClick={() => setFilterDialogOpen(true)}
              color={filterApplied ? "secondary" : "primary"}
            >
              Filters {filterApplied ? "(Applied)" : ""}
            </Button>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Report validity tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
          aria-label="report validity tabs"
        >
          <Tab 
            icon={<AllIcon />} 
            label="All Reports" 
            iconPosition="start" 
          />
          <Tab 
            icon={<ValidIcon color="success" />} 
            label="Valid Reports" 
            iconPosition="start" 
          />
          <Tab 
            icon={<InvalidIcon color="error" />} 
            label="Invalid Reports" 
            iconPosition="start" 
          />
        </Tabs>
      </Paper>
      
      {/* Status filter and search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                label="Status"
              >
                <MenuItem value="all">All Reports</MenuItem>
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={8}>
            <form onSubmit={handleSearch}>
              <Box display="flex" gap={1}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search by location or description..."
                  variant="outlined"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    endAdornment: searchTerm && (
                      <IconButton size="small" onClick={handleSearchClear}>
                        <CloseIcon />
                      </IconButton>
                    )
                  }}
                />
                <Button 
                  type="submit" 
                  variant="contained" 
                  startIcon={<SearchIcon />}
                >
                  Search
                </Button>
              </Box>
            </form>
          </Grid>
        </Grid>
      </Paper>

      {/* Status update messages */}
      {statusUpdateSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Report status updated successfully!
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Reports display */}
      <Grid container spacing={3}>
        {/* Reports list */}
        <Grid item xs={12} md={selectedReport ? 7 : 12}>
          
          {displayReports.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">No reports found</Typography>
              <Typography color="textSecondary">
                Try adjusting your filters or search criteria
              </Typography>
            </Paper>
          ) : (
            displayReports.map((report) => (
              <Card 
                key={report.id} 
                sx={{ 
                  mb: 2, 
                  cursor: 'pointer',
                  border: selectedReport?.id === report.id ? '2px solid' : '1px solid',
                  borderColor: selectedReport?.id === report.id 
                    ? 'primary.main' 
                    : (report.ai?.is_valid === false || report.ai_is_valid === false)
                      ? '#d32f2f' // Red for invalid reports
                      : (report.ai?.severity === 'critical' || report.ai_severity === 'critical') 
                        ? '#d32f2f' // Red for critical
                        : (report.ai?.severity === 'high' || report.ai_severity === 'high')
                          ? '#ed6c02' // Orange for high 
                          : '#e0e0e0', // Default
                  borderRadius: 2,
                  overflow: 'visible',
                  position: 'relative'
                }}
                onClick={() => handleReportClick(report)}
              >
                {/* Validity indicator - appears on top-left */}
                {(report.ai?.is_valid === false || report.ai_is_valid === false) && (
                  <Box 
                    sx={{
                      position: 'absolute',
                      top: -10,
                      left: 16,
                      borderRadius: '12px',
                      px: 2,
                      py: 0.5,
                      backgroundColor: '#d32f2f',
                      color: '#fff',
                      fontWeight: 'bold',
                      zIndex: 5,
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      letterSpacing: 0.5,
                      boxShadow: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5
                    }}
                  >
                    <InvalidIcon fontSize="small" />
                    Invalid Report
                  </Box>
                )}
                
                {/* Severity indicator - appears on top-right */}
                {(report.ai?.severity || report.ai_severity) && (
                  <Box 
                    sx={{
                      position: 'absolute',
                      top: -10,
                      right: 16,
                      borderRadius: '12px',
                      px: 2,
                      py: 0.5,
                      backgroundColor: 
                        (report.ai?.severity || report.ai_severity) === 'critical' ? '#d32f2f' :
                        (report.ai?.severity || report.ai_severity) === 'high' ? '#ed6c02' :
                        (report.ai?.severity || report.ai_severity) === 'medium' ? '#2979ff' :
                        '#2e7d32',
                      color: '#fff',
                      fontWeight: 'bold',
                      zIndex: 5,
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      letterSpacing: 0.5,
                      boxShadow: 2
                    }}
                  >
                    {(report.ai?.severity || report.ai_severity)} Priority
                  </Box>
                )}
                
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4} md={3}>
                      <CardMedia
                        component="img"
                        height="120"
                        image={report.photos[0] ? getApiUrl(`/uploads/${report.photos[0].file_path}`) : 'https://placehold.co/600x400/png?text=No+Image'}
                        alt="Problem photo"
                        sx={{ 
                          borderRadius: 1, 
                          objectFit: 'cover',
                          boxShadow: 1
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImageClick(report.photos[0] ? getApiUrl(`/uploads/${report.photos[0].file_path}`) : null);
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={8} md={9}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="h6" component="div" noWrap fontWeight="bold">
                          {report.problem_details && report.problem_details.length > 50 
                            ? `${report.problem_details.substring(0, 50)}...` 
                            : report.problem_details || report.problemDetails || "No details available"}
                        </Typography>
                        <Chip 
                          {...getStatusChipProps(report.status)} 
                          size="small" 
                        />
                      </Box>
                      
                      <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                        {/* Category badge if available */}
                        {(report.ai?.category || report.ai_category) && (
                          <Chip 
                            label={report.ai?.category || report.ai_category}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                        
                        {/* Department badge if available */}
                        {(report.ai?.department || report.ai_department) && (
                          <Chip 
                            label={report.ai?.department || report.ai_department}
                            size="small"
                            color="default"
                            variant="outlined"
                          />
                        )}
                      </Box>
                      
                      <Box display="flex" alignItems="center" mt={1}>
                        <LocationIcon fontSize="small" color="action" sx={{ mr: 0.5 }} />
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {report.location}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" mt={0.5}>
                        <EventIcon fontSize="small" color="action" sx={{ mr: 0.5 }} />
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(report.created_at || report.timestamp)}
                        </Typography>
                      </Box>
                      
                      {/* AI analysis snippet if available */}
                      {(report.ai?.analysis_text || report.ai_analysis) && (
                        <Box mt={1} p={1} bgcolor="#f8f9fa" borderRadius={1}>
                          <Typography variant="body2" color="text.secondary" sx={{ 
                            fontStyle: 'italic',
                            display: '-webkit-box',
                            overflow: 'hidden',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 2
                          }}>
                            {(report.ai?.analysis_text || report.ai_analysis)}
                          </Typography>
                        </Box>
                      )}
                      
                      <Box mt={1.5} display="flex" gap={1}>
                        <Button 
                          size="small" 
                          variant="contained" 
                          onClick={(e) => {
                            // Don't stop propagation, let the card click happen
                            // which will call handleReportClick with proper data normalization
                          }}
                        >
                          View Details
                        </Button>
                        {report.status === 'new' && (
                          <Button 
                            size="small" 
                            variant="outlined" 
                            color="warning"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(report.report_id, 'in_progress');
                            }}
                            disabled={statusUpdateLoading}
                          >
                            Mark In Progress
                          </Button>
                        )}
                        {(report.status === 'new' || report.status === 'in_progress') && (
                          <Button 
                            size="small" 
                            variant="outlined" 
                            color="success"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolveClick(report);
                            }}
                            disabled={statusUpdateLoading}
                          >
                            Resolve
                          </Button>
                        )}
                        <Button 
                          size="small" 
                          variant="outlined" 
                          color="error"
                          onClick={(e) => handleDeleteClick(report, e)}
                          disabled={statusUpdateLoading || deleteLoading}
                          startIcon={<DeleteIcon />}
                        >
                          Delete
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            ))
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination 
                count={totalPages} 
                page={currentPage} 
                onChange={handlePageChange} 
                color="primary" 
              />
            </Box>
          )}
        </Grid>
        
        {/* Detail view when a report is selected */}
        {selectedReport && (
          <Grid item xs={12} md={5}>
            <Paper 
              elevation={3} 
              sx={{ 
                p: 3, 
                position: 'sticky', 
                top: 80,
                borderRadius: 2,
                border: '1px solid',
                borderColor: (selectedReport.ai?.severity || selectedReport.ai_severity) === 'critical' ? '#d32f2f' :
                             (selectedReport.ai?.severity || selectedReport.ai_severity) === 'high' ? '#ed6c02' :
                             (selectedReport.ai?.severity || selectedReport.ai_severity) === 'medium' ? '#2979ff' :
                             (selectedReport.ai?.severity || selectedReport.ai_severity) === 'low' ? '#2e7d32' : 'divider'
              }}
            >
              {/* Header with status and severity */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="h5" component="h2" fontWeight="bold">
                    Report Details
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ID: {selectedReport.report_id}
                  </Typography>
                </Box>
                <Box display="flex" gap={1}>
                  <Chip 
                    {...getStatusChipProps(selectedReport.status)} 
                    size="medium" 
                  />
                  
                  {/* Severity chip if available */}
                  {(selectedReport.ai?.severity || selectedReport.ai_severity) && (
                    <Chip 
                      label={(selectedReport.ai?.severity || selectedReport.ai_severity).toUpperCase()}
                      size="medium"
                      color={
                        (selectedReport.ai?.severity || selectedReport.ai_severity) === 'critical' ? 'error' :
                        (selectedReport.ai?.severity || selectedReport.ai_severity) === 'high' ? 'warning' :
                        (selectedReport.ai?.severity || selectedReport.ai_severity) === 'medium' ? 'info' : 'success'
                      }
                    />
                  )}
                </Box>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              {/* AI Analysis section with collapsible details */}
              <Box 
                sx={{ 
                  mb: 3, 
                  p: 2, 
                  bgcolor: '#f8f9fa', 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: (selectedReport.ai?.severity || selectedReport.ai_severity) === 'critical' ? '#ffcdd2' :
                              (selectedReport.ai?.severity || selectedReport.ai_severity) === 'high' ? '#ffe0b2' :
                              (selectedReport.ai?.severity || selectedReport.ai_severity) === 'medium' ? '#bbdefb' :
                              (selectedReport.ai?.severity || selectedReport.ai_severity) === 'low' ? '#c8e6c9' : '#eeeeee'
                }}
              >
                <Typography variant="h6" display="flex" alignItems="center" gutterBottom>
                  <AssignmentIcon sx={{ mr: 1 }} fontSize="small" />
                  AI Analysis
                </Typography>
                
                {(selectedReport.ai?.analyzed || selectedReport.ai?.category || 
                  selectedReport.ai?.severity || selectedReport.ai?.department || 
                  selectedReport.ai?.details ||
                  selectedReport.ai_analyzed === true || selectedReport.ai_category || 
                  selectedReport.ai_severity || selectedReport.ai_department || 
                  selectedReport.ai_details) ? (
                  <>
                    {/* AI analysis details */}
                    <Grid container spacing={2} mb={2}>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 1.5 }} variant="outlined">
                          <Typography variant="subtitle2" color="primary">Category</Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {selectedReport.ai?.category || selectedReport.ai_category || "Unspecified"}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 1.5 }} variant="outlined">
                          <Typography variant="subtitle2" color="primary">Department</Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {selectedReport.ai?.department || selectedReport.ai_department || "Unspecified"}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 1.5 }} variant="outlined">
                          <Typography variant="subtitle2" color="primary">Validity</Typography>
                          <Typography variant="body2" fontWeight="medium" color={
                            (selectedReport.ai?.is_valid !== undefined ? selectedReport.ai.is_valid : 
                            (selectedReport.ai_is_valid !== undefined ? selectedReport.ai_is_valid : true)) 
                            ? "success.main" : "error.main"
                          }>
                            {(selectedReport.ai?.is_valid !== undefined ? selectedReport.ai.is_valid : 
                            (selectedReport.ai_is_valid !== undefined ? selectedReport.ai_is_valid : true)) 
                            ? "Valid Report" : "Invalid Report"}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 1.5, bgcolor: 
                          (selectedReport.ai?.severity || selectedReport.ai_severity) === 'critical' ? '#ffebee' :
                          (selectedReport.ai?.severity || selectedReport.ai_severity) === 'high' ? '#fff3e0' :
                          (selectedReport.ai?.severity || selectedReport.ai_severity) === 'medium' ? '#e3f2fd' : '#e8f5e9'
                        }} variant="outlined">
                          <Typography variant="subtitle2" color="primary">Priority</Typography>
                          <Typography variant="body2" fontWeight="bold" color={
                            (selectedReport.ai?.severity || selectedReport.ai_severity) === 'critical' ? 'error.main' :
                            (selectedReport.ai?.severity || selectedReport.ai_severity) === 'high' ? 'warning.main' :
                            (selectedReport.ai?.severity || selectedReport.ai_severity) === 'medium' ? 'info.main' : 'success.main'
                          }>
                            {(selectedReport.ai?.severity || selectedReport.ai_severity) || "Low"}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                    
                    {/* Show invalid reason if the report is invalid */}
                    {(selectedReport.ai?.is_valid === false || selectedReport.ai_is_valid === false) && 
                     (selectedReport.ai?.invalid_reason || selectedReport.ai_invalid_reason) && (
                      <Box mt={2} p={2} sx={{ bgcolor: '#ffebee', borderRadius: 1, border: '1px solid #ffcdd2', mb: 2 }}>
                        <Typography variant="subtitle1" color="error" fontWeight="bold">
                          Invalid Report Reason:
                        </Typography>
                        <Typography variant="body2">
                          {selectedReport.ai?.invalid_reason || selectedReport.ai_invalid_reason}
                        </Typography>
                      </Box>
                    )}
                    
                    {/* AI analysis text */}
                    <Typography variant="body1" paragraph sx={{ 
                      whiteSpace: 'pre-line', 
                      p: 2, 
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      border: '1px solid #e0e0e0',
                      fontStyle: 'italic'
                    }}>
                      {(selectedReport.ai?.analysis_text || selectedReport.ai_analysis) || "No detailed analysis available."}
                    </Typography>
                    
                    {/* Additional AI details */}
                    {(selectedReport.ai?.details || selectedReport.ai_details) && (
                      <Box mt={2}>
                        <Typography variant="subtitle1" gutterBottom>Additional Information</Typography>
                        <Box sx={{ pl: 2 }}>
                          {Object.entries(selectedReport.ai?.details || selectedReport.ai_details || {}).map(([key, value]) => {
                            // Skip fields that are already displayed elsewhere
                            if (['category', 'severity', 'department', 'is_valid_report'].includes(key)) {
                              return null;
                            }
                            
                            // Format the key for display
                            const displayKey = key
                              .split('_')
                              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(' ');
                              
                            return (
                              <Box key={key} sx={{ mb: 1.5 }}>
                                <Typography variant="subtitle2" color="primary.main">
                                  {displayKey}
                                </Typography>
                                <Typography variant="body2" sx={{ pl: 1 }}>
                                  {typeof value === 'object' 
                                    ? JSON.stringify(value, null, 2) 
                                    : String(value)}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    )}
                  </>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', my: 2, gap: 2 }}>
                    <Typography variant="body1" color="text.secondary">
                      Not yet analyzed by AI
                    </Typography>
                    <Button 
                      variant="contained" 
                      size="small"
                      onClick={() => handleAnalyzeReport(selectedReport.report_id)}
                      startIcon={<AssignmentIcon />}
                    >
                      Analyze Now
                    </Button>
                  </Box>
                )}
              </Box>
              
              {/* Problem details */}
              <Typography variant="h6" display="flex" alignItems="center" mt={3}>
                <DescriptionIcon sx={{ mr: 1 }} />
                Problem Details
              </Typography>
              <Typography paragraph sx={{ pl: 2 }}>
                {selectedReport.problem_details || selectedReport.problemDetails || "No details available"}
              </Typography>
              
              {/* Location */}
              <Typography variant="h6" display="flex" alignItems="center" mt={2}>
                <LocationIcon sx={{ mr: 1 }} />
                Location
              </Typography>
              <Box sx={{ pl: 2 }}>
                <Typography paragraph>
                  {selectedReport.location}
                  {((selectedReport.coordinates?.lat && selectedReport.coordinates?.lng) || 
                    (selectedReport.latitude && selectedReport.longitude)) && (
                    <Button 
                      variant="outlined" 
                      size="small" 
                      startIcon={<MapIcon />}
                      onClick={handleMapClick}
                      sx={{ ml: 2 }}
                    >
                      View on Map
                    </Button>
                  )}
                </Typography>
                
                {(selectedReport.latitude && selectedReport.longitude) && (
                  <Typography variant="body2" color="text.secondary">
                    Coordinates: {selectedReport.latitude}, {selectedReport.longitude}
                  </Typography>
                )}
              </Box>
              
              {/* Timestamps */}
              <Box sx={{ mt: 2, display: 'flex', gap: 4 }}>
                <Box>
                  <Typography variant="subtitle1" display="flex" alignItems="center">
                    <EventIcon sx={{ mr: 1 }} fontSize="small" />
                    Reported
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                    {formatDate(selectedReport.created_at || selectedReport.timestamp)}
                  </Typography>
                </Box>
                
                {selectedReport.updated_at && (
                  <Box>
                    <Typography variant="subtitle1">Last Updated</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(selectedReport.updated_at)}
                    </Typography>
                  </Box>
                )}
              </Box>
              
              {/* Resolution info if available */}
              {selectedReport.status === 'resolved' && (
                <Box sx={{ mt: 3, p: 2, bgcolor: '#f1f8e9', borderRadius: 2, border: '1px solid #c5e1a5' }}>
                  <Typography variant="h6" display="flex" alignItems="center" color="success.main">
                    <ResolvedIcon sx={{ mr: 1 }} fontSize="small" />
                    Resolution
                  </Typography>
                  
                  {selectedReport.resolved_by && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Resolved by:</strong> {selectedReport.resolved_by.email || selectedReport.resolved_by_id}
                    </Typography>
                  )}
                  
                  {selectedReport.resolved_at && (
                    <Typography variant="body2">
                      <strong>Resolved on:</strong> {formatDate(selectedReport.resolved_at)}
                    </Typography>
                  )}
                  
                  {selectedReport.resolution_note && (
                    <>
                      <Typography variant="subtitle2" sx={{ mt: 1 }}>
                        Resolution Note:
                      </Typography>
                      <Typography variant="body2" paragraph sx={{ pl: 1 }}>
                        {selectedReport.resolution_note}
                      </Typography>
                    </>
                  )}
                </Box>
              )}
              
              {/* Photos */}
              <Typography variant="h6" display="flex" alignItems="center" mt={3}>
                <PhotoIcon sx={{ mr: 1 }} />
                Photos ({selectedReport.photos.length})
              </Typography>
              
              <Grid container spacing={1} sx={{ mt: 1 }}>
                {selectedReport.photos.map((photo, index) => (
                  <Grid item xs={4} sm={3} key={index}>
                    <Box sx={{ position: 'relative' }}>
                      <CardMedia
                        component="img"
                        height="100"
                        image={photo.file_path ? getApiUrl(`/uploads/${photo.file_path}`) : 'https://placehold.co/600x400/png?text=Photo'}
                        alt={`Problem photo ${index + 1}`}
                        sx={{ 
                          borderRadius: 1, 
                          cursor: 'pointer',
                          objectFit: 'cover',
                          border: '1px solid #e0e0e0',
                          '&:hover': {
                            boxShadow: 3,
                            transform: 'scale(1.02)',
                            transition: 'all 0.2s ease-in-out'
                          }
                        }}
                        onClick={() => handleImageClick(photo.file_path ? getApiUrl(`/uploads/${photo.file_path}`) : null)}
                      />
                      <Box sx={{ 
                        position: 'absolute', 
                        bottom: 0, 
                        right: 0, 
                        bgcolor: 'rgba(0,0,0,0.5)', 
                        color: 'white',
                        px: 1,
                        borderTopLeftRadius: 4
                      }}>
                        {index + 1}
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              
              <Divider sx={{ my: 3 }} />
              
              {/* Action buttons */}
              <Box display="flex" justifyContent="space-between" gap={2} mt={2}>
                {selectedReport.status === 'new' && (
                  <Button 
                    variant="contained" 
                    color="warning"
                    fullWidth
                    onClick={() => handleStatusUpdate(selectedReport.report_id, 'in_progress')}
                    disabled={statusUpdateLoading}
                    startIcon={<AssignmentIcon />}
                    size="large"
                  >
                    {statusUpdateLoading ? <CircularProgress size={24} /> : 'Mark In Progress'}
                  </Button>
                )}
                
                {(selectedReport.status === 'new' || selectedReport.status === 'in_progress') && (
                  <Button 
                    variant="contained" 
                    color="success"
                    fullWidth
                    onClick={() => handleResolveClick(selectedReport)}
                    disabled={statusUpdateLoading}
                    startIcon={<ResolvedIcon />}
                    size="large"
                  >
                    {statusUpdateLoading ? <CircularProgress size={24} /> : 'Resolve Issue'}
                  </Button>
                )}
              </Box>
              
              {/* Delete button - separate from workflow buttons above */}
              <Box mt={2}>
                <Button 
                  variant="outlined" 
                  color="error"
                  fullWidth
                  onClick={() => handleDeleteClick(selectedReport, { stopPropagation: () => {} })}
                  disabled={deleteLoading}
                  startIcon={<DeleteIcon />}
                  size="medium"
                >
                  {deleteLoading ? <CircularProgress size={24} /> : 'Delete Report'}
                </Button>
              </Box>
              
              {/* Raw data for debugging - can be removed in production */}
              {false && (
                <Box sx={{ mt: 4, p: 2, bgcolor: '#f5f5f5', borderRadius: 1, maxHeight: 200, overflow: 'auto' }}>
                  <Typography variant="caption">Raw Report Data:</Typography>
                  <pre>{JSON.stringify(selectedReport, null, 2)}</pre>
                </Box>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>
      
      {/* Image Dialog */}
      <Dialog 
        open={imageDialogOpen} 
        onClose={() => setImageDialogOpen(false)} 
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          <img 
            src={selectedImage} 
            alt="Problem" 
            style={{ width: '100%', height: 'auto' }} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Map Dialog */}
      <Dialog 
        open={mapDialogOpen} 
        onClose={() => setMapDialogOpen(false)} 
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Location Map</DialogTitle>
        <DialogContent>
          <Box sx={{ height: 400, width: '100%' }}>
            {selectedReport && (selectedReport.coordinates || (selectedReport.latitude && selectedReport.longitude)) && (
              <MapContainer 
                center={[
                  selectedReport.coordinates?.lat || selectedReport.latitude, 
                  selectedReport.coordinates?.lng || selectedReport.longitude
                ]} 
                zoom={13} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker 
                  position={[
                    selectedReport.coordinates?.lat || selectedReport.latitude, 
                    selectedReport.coordinates?.lng || selectedReport.longitude
                  ]}
                >
                  <Popup>
                    <Typography variant="body2" fontWeight="bold">
                      {selectedReport.location}
                    </Typography>
                    <Typography variant="body2">
                      {selectedReport.problemDetails}
                    </Typography>
                  </Popup>
                </Marker>
              </MapContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMapDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* AI Analysis Dialog */}
      <Dialog 
        open={aiResponseDialogOpen} 
        onClose={() => setAiResponseDialogOpen(false)} 
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          AI Analysis
          {selectedReport?.ai?.severity && (
            <Chip 
              label={selectedReport.ai.severity || "Unknown"} 
              size="small" 
              color={
                selectedReport.ai.severity === 'critical' ? 'error' :
                selectedReport.ai.severity === 'high' ? 'warning' :
                selectedReport.ai.severity === 'medium' ? 'info' : 'success'
              }
              sx={{ ml: 1 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {/* Check for AI data in both the nested ai object AND direct properties */}
          {(selectedReport?.ai?.analyzed || selectedReport?.ai?.category || 
            selectedReport?.ai?.severity || selectedReport?.ai?.department || 
            selectedReport?.ai?.details ||
            selectedReport?.ai_analyzed === true || selectedReport?.ai_category || 
            selectedReport?.ai_severity || selectedReport?.ai_department || 
            selectedReport?.ai_details) ? (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>Summary</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={4}>
                    <Paper sx={{ p: 2 }} variant="outlined">
                      <Typography variant="subtitle2" color="primary">Category</Typography>
                      <Typography variant="body1">
                        {selectedReport.ai?.category || selectedReport.ai_category || "Not specified"}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Paper sx={{ p: 2 }} variant="outlined">
                      <Typography variant="subtitle2" color="primary">Department</Typography>
                      <Typography variant="body1">
                        {selectedReport.ai?.department || selectedReport.ai_department || "Not specified"}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Paper sx={{ p: 2 }} variant="outlined">
                      <Typography variant="subtitle2" color="primary">Report Validity</Typography>
                      <Typography variant="body1" color={
                        (selectedReport.ai?.is_valid !== undefined ? selectedReport.ai.is_valid : 
                         (selectedReport.ai_is_valid !== undefined ? selectedReport.ai_is_valid : true)) 
                         ? "success.main" : "error.main"
                      }>
                        {(selectedReport.ai?.is_valid !== undefined ? selectedReport.ai.is_valid : 
                          (selectedReport.ai_is_valid !== undefined ? selectedReport.ai_is_valid : true)) 
                          ? "Valid Report" : "Invalid Report"}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
              
              <Typography variant="subtitle1" gutterBottom>Details</Typography>
              
              {/* Show invalid reason if the report is invalid */}
              {(selectedReport.ai?.is_valid === false || selectedReport.ai_is_valid === false) && 
                (selectedReport.ai?.invalid_reason || selectedReport.ai_invalid_reason) && (
                <Box mt={1} mb={2} p={2} sx={{ bgcolor: '#ffebee', borderRadius: 1, border: '1px solid #ffcdd2' }}>
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    Invalid Report Reason:
                  </Typography>
                  <Typography variant="body2">
                    {selectedReport.ai?.invalid_reason || selectedReport.ai_invalid_reason}
                  </Typography>
                </Box>
              )}
              
              <Typography variant="body1" paragraph style={{ whiteSpace: 'pre-line' }}>
                {selectedReport.ai?.analysis_text || selectedReport.ai_analysis || 'No detailed analysis available.'}
              </Typography>
              
              {(selectedReport.ai?.details || selectedReport.ai_details) && (
                <>
                  <Typography variant="subtitle1" gutterBottom>Additional Information</Typography>
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    {/* Display all available fields from the AI details */}
                    {Object.entries(selectedReport.ai?.details || selectedReport.ai_details || {}).map(([key, value]) => {
                      // Skip fields that are already displayed elsewhere in the UI
                      if (['category', 'severity', 'department', 'is_valid_report'].includes(key)) {
                        return null;
                      }
                      
                      // Format the key for display (capitalize, replace underscores)
                      const displayKey = key
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                        
                      return (
                        <Typography key={key} variant="body2" paragraph>
                          <strong>{displayKey}:</strong> {
                            typeof value === 'object' 
                              ? JSON.stringify(value, null, 2) 
                              : String(value)
                          }
                        </Typography>
                      );
                    })}
                  </Paper>
                </>
              )}
            </>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 2 }}>
              <Typography variant="body1">
                This report has not been analyzed by AI yet.
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => {
                  handleAnalyzeReport(selectedReport.report_id);
                  setAiResponseDialogOpen(false);
                }}
                startIcon={<AssignmentIcon />}
                disabled={statusUpdateLoading}
              >
                Analyze Now
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiResponseDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* AI Settings Dialog has been removed - now only available in Settings page */}
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      
      {/* Filter Dialog */}
      <Dialog 
        open={filterDialogOpen} 
        onClose={() => setFilterDialogOpen(false)} 
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Filter Reports</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Date Range</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={dateFilter.start}
                onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={dateFilter.end}
                onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
              />
            </Grid>
          </Grid>
          
          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>Location</Typography>
          <TextField
            fullWidth
            label="Location"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            placeholder="Filter by location..."
          />
          
          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>AI Analysis Filters</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>AI Analyzed</InputLabel>
                <Select
                  value={aiFilters.analyzed !== null ? aiFilters.analyzed.toString() : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAiFilters({
                      ...aiFilters,
                      analyzed: value === "" ? null : value === "true"
                    });
                  }}
                  label="AI Analyzed"
                >
                  <MenuItem value="">All Reports</MenuItem>
                  <MenuItem value="true">Analyzed by AI</MenuItem>
                  <MenuItem value="false">Not Analyzed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={aiFilters.severity}
                  onChange={(e) => setAiFilters({
                    ...aiFilters,
                    severity: e.target.value
                  })}
                  label="Severity"
                >
                  <MenuItem value="">All Severities</MenuItem>
                  {severityOptions.map(severity => (
                    <MenuItem key={severity} value={severity}>
                      {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={aiFilters.category}
                  onChange={(e) => setAiFilters({
                    ...aiFilters,
                    category: e.target.value
                  })}
                  label="Category"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {aiCategoryOptions.map(category => (
                    <MenuItem key={category} value={category}>
                      {category.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Validity</InputLabel>
                <Select
                  value={aiFilters.is_valid !== null ? aiFilters.is_valid.toString() : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAiFilters({
                      ...aiFilters,
                      is_valid: value === "" ? null : value === "true"
                    });
                  }}
                  label="Validity"
                >
                  <MenuItem value="">All Reports</MenuItem>
                  <MenuItem value="true">Valid Reports</MenuItem>
                  <MenuItem value="false">Invalid Reports</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFilterClear}>Clear All</Button>
          <Button onClick={handleFilterApply} variant="contained">Apply Filters</Button>
        </DialogActions>
      </Dialog>
      
      {/* Resolve Dialog */}
      <Dialog 
        open={resolveDialogOpen} 
        onClose={() => setResolveDialogOpen(false)} 
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Resolve Issue</DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph sx={{ mt: 1 }}>
            Please provide a resolution note for this issue:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Resolution Note"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="Describe how the issue was resolved..."
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => handleStatusUpdate(selectedReport.report_id, 'resolved')} 
            variant="contained"
            color="success"
            disabled={!resolutionNote.trim() || statusUpdateLoading}
          >
            {statusUpdateLoading ? <CircularProgress size={24} /> : 'Mark as Resolved'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleteLoading && setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" color="error.main">
            <DeleteIcon sx={{ mr: 1 }} />
            Confirm Deletion
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph sx={{ mt: 1 }}>
            Are you sure you want to delete this report? This action <strong>cannot be undone</strong>.
          </Typography>
          {reportToDelete && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f9f9f9' }}>
              <Typography variant="subtitle2" gutterBottom>
                Report ID: {reportToDelete.report_id}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Location:</strong> {reportToDelete.location}
              </Typography>
              <Typography variant="body2">
                <strong>Problem:</strong> {reportToDelete.problem_details}
              </Typography>
            </Paper>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This will permanently delete the report and all associated photos from the system.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialogOpen(false)} 
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteReport} 
            variant="contained" 
            color="error"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default Reports;