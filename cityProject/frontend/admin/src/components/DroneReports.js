import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  CircularProgress,
  Card,
  CardMedia,
  CardContent,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  TextField,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Assignment as ReportsIcon,
  VisibilityOutlined as ViewIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircleOutline as CheckCircleIcon,
  DirectionsWalk as TravelIcon,
  Terrain as TerrainIcon,
  LocalFireDepartment as FireIcon,
  Delete as DeleteIcon,
  AssignmentTurnedIn as ResolvedIcon,
  Map as MapIcon
} from '@mui/icons-material';
import axios from 'axios';
import { getApiUrl } from '../contexts/AuthContext';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function DroneReports() {
  // State for reports data
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // State for detail dialog
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // State for status management
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // State for map dialog
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [mapReport, setMapReport] = useState(null);

  // State for notifications
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // State for filtering
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filterApplied, setFilterApplied] = useState(false);

  // State for temporary filter values (before applying)
  const [tempStatusFilter, setTempStatusFilter] = useState('all');
  const [tempSeverityFilter, setTempSeverityFilter] = useState('all');
  
  // Function to fetch reports from API
  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build the filter parameters
      const params = {};

      // Apply status filter if not 'all'
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      // Make the API call with status filter
      const response = await axios.get('/api/drone/reports', { params });

      // Client-side filtering for severity since backend doesn't support it
      let filteredData = [...response.data];
      if (severityFilter !== 'all') {
        filteredData = filteredData.filter(report => report.severity === severityFilter);
      } else {
        filteredData = response.data;
      }

      // For each report in the filtered list, fetch the detailed report to get location info
      const detailedReports = await Promise.all(
        filteredData.map(async (report) => {
          try {
            // Fetch detailed report to get location data and photos
            const detailResponse = await axios.get(`/api/drone/reports/${report.report_id}`);
            const detailedReport = detailResponse.data;

            // Merge the detailed report with the list report to get all fields
            return {
              ...report,
              // Add location fields from the detailed report
              latitude: detailedReport.latitude,
              longitude: detailedReport.longitude,
              altitude: detailedReport.altitude,
              location_description: detailedReport.location_description,
              // Add recommendation fields
              recommendations: detailedReport.recommendations,
              visible_details: detailedReport.visible_details,
              thermal_details: detailedReport.thermal_details,
              // Add photos from the detailed report
              photos: detailedReport.photos || []
            };
          } catch (error) {
            console.error(`Error fetching details for report ${report.report_id}:`, error);
            // Return the original report if we can't get the detailed one
            return report;
          }
        })
      );

      // Process the reports to ensure they have the expected image structure
      const processedReports = detailedReports.map(report => {
        // Create a proper images array based on the photos or photo_urls property
        const images = [];

        // If the report has a photo_urls property (from the backend schema)
        if (report.photo_urls) {
          if (report.photo_urls.regular) {
            images.push({
              type: 'regular',
              url: getApiUrl(report.photo_urls.regular)
            });
          }
          if (report.photo_urls.thermal) {
            images.push({
              type: 'thermal',
              url: getApiUrl(report.photo_urls.thermal)
            });
          }
        }
        // If the report has a photos array (direct from DB relationship)
        else if (report.photos && report.photos.length > 0) {
          report.photos.forEach(photo => {
            images.push({
              type: photo.photo_type,
              url: getApiUrl(`/uploads/${photo.file_path}`)
            });
          });
        }

        // Return the report with the processed images
        return {
          ...report,
          images: images
        };
      });

      setReports(processedReports);
    } catch (err) {
      console.error('Error fetching drone reports:', err);
      setError('Failed to load drone reports. Please try again later.');
      // For now, use some dummy data
      setReports([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch of reports when component mounts
  useEffect(() => {
    fetchReports();
  }, []);
  
  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Open detail dialog
  const handleOpenDetailDialog = (report) => {
    // Since we now fetch all details in the initial load, we can just use the report directly
    setSelectedReport(report);
    setDetailDialogOpen(true);
  };

  // Close detail dialog
  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedReport(null);
  };

  // Handle map click to show location on map
  const handleMapClick = (report) => {
    setMapReport(report);
    setMapDialogOpen(true);
  };

  // Get chip color based on severity
  const getSeverityChipColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'primary';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  // Get status chip props
  const getStatusChipProps = (status) => {
    const statusMap = {
      'new': { color: 'error', label: 'New' },
      'in_progress': { color: 'warning', label: 'In Progress' },
      'resolved': { color: 'success', label: 'Resolved' },
      'ignored': { color: 'default', label: 'Ignored' }
    };

    return statusMap[status] || { color: 'default', label: status };
  };
  
  // Get icon based on category
  const getCategoryIcon = (category) => {
    switch (category?.toLowerCase()) {
      case 'fire':
      case 'hot spot':
        return <FireIcon />;
      case 'structural':
      case 'building':
        return <TerrainIcon />;
      case 'safety':
      case 'security':
        return <WarningIcon />;
      case 'person':
      case 'human':
        return <TravelIcon />;
      default:
        return <CheckCircleIcon />;
    }
  };
  
  // Format date string
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Handle status update
  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      setStatusUpdateLoading(true);

      // Add debug log to trace what's happening
      console.log('Updating status for report:', reportId, 'to status:', newStatus);

      // Make the API call to update the status
      const response = await axios.put(`/api/drone/reports/${reportId}`, {
        status: newStatus,
        resolution_notes: newStatus === 'resolved' ? resolutionNote : undefined
      });

      // Update the local reports state
      setReports(reports.map(report =>
        report.report_id === reportId ? response.data : report
      ));

      // Update selected report if it's the one we just modified
      if (selectedReport && selectedReport.report_id === reportId) {
        setSelectedReport(response.data);
      }

      // Show success message
      setStatusUpdateSuccess(true);
      setResolveDialogOpen(false);
      setResolutionNote('');

      setSnackbar({
        open: true,
        message: `Report status updated to ${newStatus}`,
        severity: "success"
      });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setStatusUpdateSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error updating report status:', error);
      setError('Failed to update report status. Please try again.');

      setSnackbar({
        open: true,
        message: "Failed to update report status",
        severity: "error"
      });
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
    e?.stopPropagation(); // Prevent card click if event provided
    setReportToDelete(report);
    setDeleteDialogOpen(true);
  };

  // Handle report delete
  const handleDeleteReport = async () => {
    if (!reportToDelete) return;

    try {
      setDeleteLoading(true);

      // Make the delete API call
      await axios.delete(`/api/drone/reports/${reportToDelete.report_id}`);

      // Update the local state to remove the deleted report
      setReports(reports.filter(report => report.report_id !== reportToDelete.report_id));

      // If the deleted report was selected, clear the selection
      if (selectedReport && selectedReport.report_id === reportToDelete.report_id) {
        setSelectedReport(null);
        setDetailDialogOpen(false);
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

  // Handle filter apply
  const handleFilterApply = async () => {
    setFilterDialogOpen(false);
    setFilterApplied(true);
    // Reset to first page when filters are applied
    setPage(0);

    // Directly fetch reports with the new filter values
    try {
      setLoading(true);
      setError(null);

      // Build the filter parameters
      const params = {};

      // Apply status filter if not 'all'
      if (tempStatusFilter !== 'all') {
        params.status = tempStatusFilter;
      }

      // Make the API call with status filter
      const response = await axios.get('/api/drone/reports', { params });

      // Client-side filtering for severity since backend doesn't support it
      let filteredData = [...response.data];
      if (tempSeverityFilter !== 'all') {
        filteredData = filteredData.filter(report => report.severity === tempSeverityFilter);
      } else {
        filteredData = response.data;
      }

      // After successful fetch, update the actual filter states
      setStatusFilter(tempStatusFilter);
      setSeverityFilter(tempSeverityFilter);

      // Continue with the normal report processing...
      const detailedReports = await Promise.all(
        filteredData.map(async (report) => {
          try {
            // Fetch detailed report to get location data and photos
            const detailResponse = await axios.get(`/api/drone/reports/${report.report_id}`);
            const detailedReport = detailResponse.data;

            return {
              ...report,
              latitude: detailedReport.latitude,
              longitude: detailedReport.longitude,
              altitude: detailedReport.altitude,
              location_description: detailedReport.location_description,
              recommendations: detailedReport.recommendations,
              visible_details: detailedReport.visible_details,
              thermal_details: detailedReport.thermal_details,
              photos: detailedReport.photos || []
            };
          } catch (error) {
            console.error(`Error fetching details for report ${report.report_id}:`, error);
            return report;
          }
        })
      );

      // Process the reports to ensure they have the expected image structure
      const processedReports = detailedReports.map(report => {
        const images = [];
        if (report.photo_urls) {
          if (report.photo_urls.regular) {
            images.push({
              type: 'regular',
              url: getApiUrl(report.photo_urls.regular)
            });
          }
          if (report.photo_urls.thermal) {
            images.push({
              type: 'thermal',
              url: getApiUrl(report.photo_urls.thermal)
            });
          }
        } else if (report.photos && report.photos.length > 0) {
          report.photos.forEach(photo => {
            images.push({
              type: photo.photo_type,
              url: getApiUrl(`/uploads/${photo.file_path}`)
            });
          });
        }

        return {
          ...report,
          images: images
        };
      });

      setReports(processedReports);
    } catch (err) {
      console.error('Error applying filters:', err);
      setError('Failed to apply filters. Please try again.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle filter clear
  const handleFilterClear = async () => {
    // Reset temporary filters
    setTempStatusFilter('all');
    setTempSeverityFilter('all');
    // Reset actual filters
    setStatusFilter('all');
    setSeverityFilter('all');
    setFilterApplied(false);
    setFilterDialogOpen(false);
    // Reset to first page when filters are cleared
    setPage(0);

    // Directly fetch reports with cleared filters
    try {
      setLoading(true);
      setError(null);

      // No filters, just get all reports
      const response = await axios.get('/api/drone/reports');
      const filteredData = response.data;

      // Process reports as usual
      const detailedReports = await Promise.all(
        filteredData.map(async (report) => {
          try {
            // Fetch detailed report to get location data and photos
            const detailResponse = await axios.get(`/api/drone/reports/${report.report_id}`);
            const detailedReport = detailResponse.data;

            return {
              ...report,
              latitude: detailedReport.latitude,
              longitude: detailedReport.longitude,
              altitude: detailedReport.altitude,
              location_description: detailedReport.location_description,
              recommendations: detailedReport.recommendations,
              visible_details: detailedReport.visible_details,
              thermal_details: detailedReport.thermal_details,
              photos: detailedReport.photos || []
            };
          } catch (error) {
            console.error(`Error fetching details for report ${report.report_id}:`, error);
            return report;
          }
        })
      );

      // Process the reports to ensure they have the expected image structure
      const processedReports = detailedReports.map(report => {
        const images = [];
        if (report.photo_urls) {
          if (report.photo_urls.regular) {
            images.push({
              type: 'regular',
              url: getApiUrl(report.photo_urls.regular)
            });
          }
          if (report.photo_urls.thermal) {
            images.push({
              type: 'thermal',
              url: getApiUrl(report.photo_urls.thermal)
            });
          }
        } else if (report.photos && report.photos.length > 0) {
          report.photos.forEach(photo => {
            images.push({
              type: photo.photo_type,
              url: getApiUrl(`/uploads/${photo.file_path}`)
            });
          });
        }

        return {
          ...report,
          images: images
        };
      });

      setReports(processedReports);
    } catch (err) {
      console.error('Error clearing filters:', err);
      setError('Failed to clear filters. Please try again.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle filter dialog open
  const handleFilterDialogOpen = () => {
    // Initialize temp filters with current values
    setTempStatusFilter(statusFilter);
    setTempSeverityFilter(severityFilter);
    setFilterDialogOpen(true);
  };

  // If loading, show spinner
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <>
      <Box display="flex" alignItems="center" mb={3}>
        <ReportsIcon sx={{ mr: 1 }} />
        <Typography variant="h4" component="h1">
          Drone Reports
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Paper elevation={2} sx={{ mb: 3, p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" component="h2">
            AI-Generated Reports from Drone Footage
          </Typography>
          <Box>
            <Tooltip title="Refresh reports">
              <IconButton onClick={fetchReports} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Filter reports">
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={handleFilterDialogOpen}
                color={filterApplied ? "secondary" : "primary"}
                size="small"
              >
                Filters {filterApplied ? "(Applied)" : ""}
              </Button>
            </Tooltip>
          </Box>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        {reports.length === 0 ? (
          <Alert severity="info">
            No drone reports found. When the drone's AI analysis detects problems, they will appear here.
          </Alert>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((report) => (
                      <TableRow key={report.id} hover>
                        <TableCell>{formatDate(report.timestamp)}</TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            {getCategoryIcon(report.category)}
                            <Typography sx={{ ml: 1 }}>{report.category}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={report.severity} 
                            color={getSeverityChipColor(report.severity)} 
                            size="small" 
                          />
                        </TableCell>
                        <TableCell>
                          <Box>
                            {report.latitude && report.longitude ? (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<MapIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMapClick(report);
                                }}
                              >
                                View on Map
                              </Button>
                            ) : (
                              'N/A'
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {report.description ? 
                            (report.description.length > 50 ? 
                              `${report.description.substring(0, 50)}...` : 
                              report.description) : 
                            'N/A'}
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ViewIcon />}
                              onClick={() => handleOpenDetailDialog(report)}
                            >
                              View
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
                                In Progress
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
                            >
                              Delete
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={reports.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </Paper>
      
      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={handleCloseDetailDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedReport && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center">
                {getCategoryIcon(selectedReport.category)}
                <Typography variant="h6" sx={{ ml: 1 }}>
                  {selectedReport.category} Issue Detected
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight="bold">Date & Time:</Typography>
                  <Typography paragraph>{formatDate(selectedReport.timestamp)}</Typography>
                  
                  <Typography variant="subtitle1" fontWeight="bold">Severity:</Typography>
                  <Box display="flex" gap={1}>
                    <Chip
                      label={selectedReport.severity}
                      color={getSeverityChipColor(selectedReport.severity)}
                    />
                    <Chip
                      {...getStatusChipProps(selectedReport.status)}
                      size="medium"
                    />
                  </Box>
                  
                  <Typography variant="subtitle1" fontWeight="bold" mt={2}>Location:</Typography>
                  <Box display="flex" alignItems="center">
                    {selectedReport.latitude && selectedReport.longitude ? (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<MapIcon />}
                        onClick={() => handleMapClick(selectedReport)}
                        sx={{ mr: 1 }}
                      >
                        View on Map
                      </Button>
                    ) : (
                      <Typography>N/A</Typography>
                    )}
                  </Box>
                  
                  <Typography variant="subtitle1" fontWeight="bold">Analysis:</Typography>
                  <Typography paragraph>{selectedReport.description || 'N/A'}</Typography>
                  
                  {selectedReport.recommendations && (
                    <>
                      <Typography variant="subtitle1" fontWeight="bold">Recommendations:</Typography>
                      <Typography paragraph>{selectedReport.recommendations}</Typography>
                    </>
                  )}
                </Grid>
                
                <Grid item xs={12} md={6}>
                  {selectedReport.images && selectedReport.images.length > 0 ? (
                    <Grid container spacing={2}>
                      {selectedReport.images.map((image, index) => (
                        <Grid item xs={12} key={index}>
                          <Card>
                            <CardMedia
                              component="img"
                              height="200"
                              image={image.url}
                              alt={`Image ${index + 1}`}
                              onError={(e) => {
                                console.error(`Failed to load image: ${image.url}`);
                                e.target.onerror = null;
                                e.target.src = 'https://placehold.co/600x400/png?text=Image+Not+Available';
                              }}
                            />
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">
                                {image.type === 'thermal' ? 'Thermal Image' : 'Regular Image'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {image.url.split('/').pop()}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Alert severity="info">No images available. This may happen if the drone report doesn't have any associated photos.</Alert>
                  )}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Box display="flex" gap={1}>
                <Button onClick={handleCloseDetailDialog}>Close</Button>
                {selectedReport.status === 'new' && (
                  <Button
                    variant="contained"
                    color="warning"
                    onClick={() => handleStatusUpdate(selectedReport.report_id, 'in_progress')}
                    disabled={statusUpdateLoading}
                  >
                    {statusUpdateLoading ? <CircularProgress size={24} /> : 'Mark In Progress'}
                  </Button>
                )}
                {(selectedReport.status === 'new' || selectedReport.status === 'in_progress') && (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => handleResolveClick(selectedReport)}
                    disabled={statusUpdateLoading}
                  >
                    {statusUpdateLoading ? <CircularProgress size={24} /> : 'Resolve Issue'}
                  </Button>
                )}
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => handleDeleteClick(selectedReport, { stopPropagation: () => {} })}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? <CircularProgress size={24} /> : 'Delete Report'}
                </Button>
              </Box>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog
        open={resolveDialogOpen}
        onClose={() => setResolveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Resolve Drone Issue</DialogTitle>
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
            Are you sure you want to delete this drone report? This action <strong>cannot be undone</strong>.
          </Typography>
          {reportToDelete && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f9f9f9' }}>
              <Typography variant="subtitle2" gutterBottom>
                Report ID: {reportToDelete.report_id}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Category:</strong> {reportToDelete.category || 'N/A'}
              </Typography>
              <Typography variant="body2">
                <strong>Description:</strong> {reportToDelete.description || 'N/A'}
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

      {/* Map Dialog */}
      <Dialog
        open={mapDialogOpen}
        onClose={() => setMapDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <MapIcon sx={{ mr: 1 }} />
            Location Map
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ height: 400, width: '100%' }}>
            {mapReport && mapReport.latitude && mapReport.longitude && (
              <MapContainer
                center={[mapReport.latitude, mapReport.longitude]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={[mapReport.latitude, mapReport.longitude]}>
                  <Popup>
                    <Typography variant="body2" fontWeight="bold">
                      {mapReport.category || 'Drone Report'}
                    </Typography>
                    <Typography variant="body2">
                      {mapReport.description || 'No description available'}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      Coordinates: {mapReport.latitude.toFixed(6)}, {mapReport.longitude.toFixed(6)}
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
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Filter Drone Reports</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Status</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Status</InputLabel>
                <Select
                  value={tempStatusFilter}
                  onChange={(e) => setTempStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="new">New</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="ignored">Ignored</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Typography variant="subtitle1" gutterBottom>Severity</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Severity</InputLabel>
                <Select
                  value={tempSeverityFilter}
                  onChange={(e) => setTempSeverityFilter(e.target.value)}
                  label="Severity"
                >
                  <MenuItem value="all">All Severities</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFilterClear}>Clear All</Button>
          <Button onClick={handleFilterApply} variant="contained" color="primary">Apply Filters</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default DroneReports;