import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  ReportProblem as ProblemIcon,
  LocationOn as LocationIcon,
  Today as TodayIcon,
  CheckCircle as ResolvedIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import axios from 'axios';

// Dashboard component
function Dashboard() {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#e57373', '#4caf50', '#ff5722', '#9c27b0'];

  // Fetch dashboard statistics
  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get('/api/dashboard/statistics');
        setStatistics(response.data);
      } catch (error) {
        console.error('Error fetching dashboard statistics:', error);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStatistics();
  }, []);

  // Prepare data for location pie chart
  const prepareLocationData = (data) => {
    if (!data || !data.reportsByLocation) return [];

    return Object.entries(data.reportsByLocation)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 locations
  };

  // Prepare data for category pie chart
  const prepareCategoryData = (data) => {
    if (!data || !data.reportsByCategory) return [];

    const entries = Object.entries(data.reportsByCategory);

    // Find and move "Other" to the end of the array no matter its value
    let otherEntry = null;
    const nonOtherEntries = entries.filter(([name, value]) => {
      if (name.toLowerCase() === 'other') {
        otherEntry = [name, value];
        return false;
      }
      return true;
    });

    // Sort non-other entries by value (descending)
    nonOtherEntries.sort((a, b) => b[1] - a[1]);

    // Add other entry at the end if it exists
    const sortedEntries = otherEntry ? [...nonOtherEntries, otherEntry] : nonOtherEntries;

    return sortedEntries.map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
      value
    }));
  };

  // Dummy data for preview
  const dummyStatistics = {
    totalReports: 157,
    regularReports: 102,
    droneReports: 55,
    reportsToday: 12,
    resolvedReports: 89,
    uniqueLocations: 34,
    reportsByDate: [
      { date: '2025-05-01', count: 8, regularCount: 5, droneCount: 3 },
      { date: '2025-05-02', count: 10, regularCount: 6, droneCount: 4 },
      { date: '2025-05-03', count: 15, regularCount: 9, droneCount: 6 },
      { date: '2025-05-04', count: 12, regularCount: 7, droneCount: 5 },
      { date: '2025-05-05', count: 18, regularCount: 11, droneCount: 7 }
    ],
    reportsByLocation: {
      'Downtown': 42,
      'North District': 35,
      'East Side': 28,
      'West End': 22,
      'South Area': 18,
      'Others': 12
    },
    reportsByCategory: {
      'infrastructure': 35,
      'fire': 28,
      'public safety': 22,
      'waste management': 19,
      'utilities': 15,
      'other': 38
    }
  };

  // Use dummy data if no statistics available yet
  const data = statistics || dummyStatistics;
  const locationData = prepareLocationData(data);
  const categoryData = prepareCategoryData(data);

  // Display loading state
  if (loading) {
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

  // Display error if any
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>

      {/* Info Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Total Reports */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={2}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 120,
              bgcolor: 'primary.light',
              color: 'white',
            }}
          >
            <Box display="flex" alignItems="center">
              <ProblemIcon sx={{ mr: 1 }} />
              <Typography variant="h6" component="div">
                Total Reports
              </Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography
                variant="h3"
                component="div"
                sx={{ fontWeight: 'bold', mt: 1 }}
              >
                {data.totalReports}
              </Typography>
              <Box textAlign="right">
                <Typography variant="caption" component="div">
                  Regular: {data.regularReports}
                </Typography>
                <Typography variant="caption" component="div">
                  Drone: {data.droneReports}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Today's Reports */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={2}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 120,
              bgcolor: 'success.light',
              color: 'white',
            }}
          >
            <Box display="flex" alignItems="center">
              <TodayIcon sx={{ mr: 1 }} />
              <Typography variant="h6" component="div">
                Today's Reports
              </Typography>
            </Box>
            <Typography
              variant="h3"
              component="div"
              sx={{ fontWeight: 'bold', mt: 1 }}
            >
              {data.reportsToday}
            </Typography>
          </Paper>
        </Grid>

        {/* Resolved Reports */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={2}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 120,
              bgcolor: 'info.light',
              color: 'white',
            }}
          >
            <Box display="flex" alignItems="center">
              <ResolvedIcon sx={{ mr: 1 }} />
              <Typography variant="h6" component="div">
                Resolved
              </Typography>
            </Box>
            <Typography
              variant="h3"
              component="div"
              sx={{ fontWeight: 'bold', mt: 1 }}
            >
              {data.resolvedReports}
            </Typography>
          </Paper>
        </Grid>

        {/* Unique Locations */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={2}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 120,
              bgcolor: 'warning.light',
              color: 'white',
            }}
          >
            <Box display="flex" alignItems="center">
              <LocationIcon sx={{ mr: 1 }} />
              <Typography variant="h6" component="div">
                Locations
              </Typography>
            </Box>
            <Typography
              variant="h3"
              component="div"
              sx={{ fontWeight: 'bold', mt: 1 }}
            >
              {data.uniqueLocations}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Reports by Date */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" gutterBottom>
                Reports by Date
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.reportsByDate}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 25,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tickMargin={20}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend wrapperStyle={{ paddingTop: 30 }} />
                    <Bar
                      dataKey="regularCount"
                      stackId="a"
                      fill="#8884d8"
                      name="Regular Reports"
                    />
                    <Bar
                      dataKey="droneCount"
                      stackId="a"
                      fill="#82ca9d"
                      name="Drone Reports"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Reports by Category */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" gutterBottom>
                Reports by Category
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {categoryData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>


        {/* Reports by Status */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" gutterBottom>
                Status Distribution
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {data.reportsByStatus && Object.entries(data.reportsByStatus).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={Object.entries(data.reportsByStatus).map(([status, count]) => ({
                        status: status.charAt(0).toUpperCase() + status.slice(1),
                        count
                      }))}
                      margin={{ top: 20, right: 30, left: 70, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="status" type="category" width={80} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" name="Reports" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body1" color="text.secondary" align="center">
                    No status data available
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}

export default Dashboard;