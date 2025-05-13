import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Divider,
  Paper,
  Grid,
  Tabs,
  Tab,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Chip,
  Stack,
  Autocomplete,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  SmartToy as AIIcon,
  FlightTakeoff as DroneIcon,
  Send as SendIcon,
  Telegram as TelegramIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import axios from 'axios';

// TabPanel component for tab content
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

function Settings() {
  const [tabValue, setTabValue] = useState(0);

  // Report AI settings
  const [reportSettings, setReportSettings] = useState({
    use_vision_api: true,
    vision_prompt: '',
    vision_model: ''
  });

  // Drone AI settings
  const [droneSettings, setDroneSettings] = useState({
    enabled: false,
    frame_type: 'regular',
    regular_prompt: '',
    thermal_prompt: '',
    both_prompt: ''
  });

  // Telegram notification settings
  const [telegramSettings, setTelegramSettings] = useState({
    enabled: false,
    bot_token: '',
    chat_id: '',
    notify_severity: ['critical']
  });

  // Available severity options for Telegram notifications
  const severityOptions = ['critical', 'high', 'medium', 'low'];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSending, setTestingSending] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch report AI settings
        const reportResponse = await axios.get('/api/reports/settings/ai-status');
        setReportSettings(reportResponse.data);

        // Fetch drone AI settings
        try {
          const droneResponse = await axios.get('/api/drone/settings/ai-status');
          setDroneSettings(droneResponse.data);
          console.log('Drone settings loaded:', droneResponse.data);
        } catch (droneError) {
          console.error('Error fetching drone settings:', droneError);
          // Don't fail the entire settings load if drone settings fail
        }

        // Fetch Telegram notification settings
        try {
          const telegramResponse = await axios.get('/api/reports/settings/telegram-status');
          setTelegramSettings(telegramResponse.data);
        } catch (telegramError) {
          console.error('Error fetching Telegram settings:', telegramError);
          // Don't fail the entire settings load if Telegram settings fail
        }

      } catch (error) {
        console.error('Error fetching settings:', error);
        setError('Failed to load settings. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Handle report settings changes
  const handleReportToggleChange = (event) => {
    setReportSettings({
      ...reportSettings,
      use_vision_api: event.target.checked
    });
  };

  const handleReportPromptChange = (event) => {
    setReportSettings({
      ...reportSettings,
      vision_prompt: event.target.value
    });
  };

  // Handle drone settings changes
  const handleDroneToggleChange = (event) => {
    setDroneSettings({
      ...droneSettings,
      enabled: event.target.checked
    });
  };

  const handleDroneFrameTypeChange = (event) => {
    setDroneSettings({
      ...droneSettings,
      frame_type: event.target.value
    });
  };

  const handleDronePromptChange = (field) => (event) => {
    setDroneSettings({
      ...droneSettings,
      [field]: event.target.value
    });
  };

  // Handle save settings
  const handleSaveReportSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      
      await axios.post('/api/reports/settings/update-ai-settings', {
        use_vision_api: reportSettings.use_vision_api,
        vision_prompt: reportSettings.vision_prompt
      });
      
      setSuccessMessage('Report AI settings updated successfully!');
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings. Please try again later.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDroneSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      
      // This endpoint needs to be implemented in the backend
      await axios.post('/api/drone/settings/update-ai-settings', {
        enabled: droneSettings.enabled,
        frame_type: droneSettings.frame_type,
        regular_prompt: droneSettings.regular_prompt,
        thermal_prompt: droneSettings.thermal_prompt,
        both_prompt: droneSettings.both_prompt
      });
      
      setSuccessMessage('Drone AI settings updated successfully!');
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving drone settings:', error);
      setError('Failed to save drone settings. Please try again later.');
    } finally {
      setSaving(false);
    }
  };

  // Handle Telegram settings changes
  const handleTelegramToggleChange = (event) => {
    setTelegramSettings({
      ...telegramSettings,
      enabled: event.target.checked
    });
  };

  const handleTelegramInputChange = (field) => (event) => {
    setTelegramSettings({
      ...telegramSettings,
      [field]: event.target.value
    });
  };

  const handleSeverityChange = (event, newValues) => {
    setTelegramSettings({
      ...telegramSettings,
      notify_severity: newValues
    });
  };

  // Handle saving Telegram settings
  const handleSaveTelegramSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      await axios.post('/api/reports/settings/update-telegram-settings', {
        enabled: telegramSettings.enabled,
        bot_token: telegramSettings.bot_token,
        chat_id: telegramSettings.chat_id,
        notify_severity: telegramSettings.notify_severity
      });

      setSuccessMessage('Telegram notification settings updated successfully!');

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving Telegram settings:', error);
      setError('Failed to save Telegram settings. Please try again later.');
    } finally {
      setSaving(false);
    }
  };

  // Handle sending test Telegram notification
  const handleSendTestNotification = async () => {
    try {
      setTestingSending(true);
      setError(null);
      setSuccessMessage(null);

      const response = await axios.post('/api/reports/settings/test-telegram');

      if (response.data.success) {
        setSuccessMessage('Test notification sent successfully! Check your Telegram.');
      } else {
        setError(`Failed to send test notification: ${response.data.message}`);
      }

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error sending test notification:', error);
      setError('Failed to send test notification. Please check your settings and try again.');
    } finally {
      setTestingSending(false);
    }
  };

  // Handle refresh settings
  const handleRefreshSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Refresh report AI settings
      const reportResponse = await axios.get('/api/reports/settings/ai-status');
      setReportSettings(reportResponse.data);

      // Refresh drone AI settings
      try {
        const droneResponse = await axios.get('/api/drone/settings/ai-status');
        setDroneSettings(droneResponse.data);
        console.log('Drone settings refreshed:', droneResponse.data);
      } catch (droneError) {
        console.error('Error refreshing drone settings:', droneError);
        // Don't fail the entire refresh if drone settings fail
      }

      // Refresh Telegram settings
      try {
        const telegramResponse = await axios.get('/api/reports/settings/telegram-status');
        setTelegramSettings(telegramResponse.data);
      } catch (telegramError) {
        console.error('Error refreshing Telegram settings:', telegramError);
      }

      setSuccessMessage('Settings refreshed successfully!');

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error refreshing settings:', error);
      setError('Failed to refresh settings. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <>
      <Box display="flex" alignItems="center" mb={3}>
        <SettingsIcon sx={{ mr: 1 }} />
        <Typography variant="h4" component="h1">
          System Settings
        </Typography>
      </Box>

      {/* Display error or success message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      <Paper elevation={2}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="settings tabs"
            variant="fullWidth"
          >
            <Tab icon={<AIIcon />} label="Report AI Settings" {...a11yProps(0)} />
            <Tab icon={<DroneIcon />} label="Drone AI Settings" {...a11yProps(1)} />
            <Tab icon={<TelegramIcon />} label="Telegram Notifications" {...a11yProps(2)} />
          </Tabs>
        </Box>
        
        {/* Report AI Settings Tab */}
        <TabPanel value={tabValue} index={0}>
          <Typography variant="h5" component="h2" gutterBottom>
            Report Analysis Settings
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Box mb={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={reportSettings.use_vision_api}
                  onChange={handleReportToggleChange}
                  color="primary"
                />
              }
              label={`AI Analysis is currently ${reportSettings.use_vision_api ? 'ENABLED' : 'DISABLED'}`}
            />
            {reportSettings.vision_model && (
              <Typography variant="body2" color="textSecondary" mt={1}>
                Using model: {reportSettings.vision_model}
              </Typography>
            )}
          </Box>

          <Box mb={3}>
            <Typography variant="h6" component="h3" gutterBottom>
              AI Analysis Prompt
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              This prompt will be used for analyzing reports with images. Customize this to focus on specific aspects of city problems.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={10}
              variant="outlined"
              value={reportSettings.vision_prompt}
              onChange={handleReportPromptChange}
              placeholder="Enter AI analysis prompt..."
              sx={{ mb: 2 }}
            />
          </Box>

          <Box display="flex" justifyContent="space-between">
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefreshSettings}
              disabled={saving}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSaveReportSettings}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Box>
        </TabPanel>
        
        {/* Drone AI Settings Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h5" component="h2" gutterBottom>
            Drone AI Analysis Settings
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Box mb={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={droneSettings.enabled}
                  onChange={handleDroneToggleChange}
                  color="primary"
                />
              }
              label={`Drone AI Analysis is currently ${droneSettings.enabled ? 'ENABLED' : 'DISABLED'}`}
            />
            <Typography variant="body2" color="textSecondary" mt={1}>
              When enabled, drone frames will be analyzed for anomalies or issues.
            </Typography>
          </Box>

          <Box mb={3}>
            <FormControl component="fieldset">
              <FormLabel component="legend">Frame Type to Analyze</FormLabel>
              <RadioGroup
                row
                name="frame-type"
                value={droneSettings.frame_type}
                onChange={handleDroneFrameTypeChange}
              >
                <FormControlLabel value="regular" control={<Radio />} label="Regular" />
                <FormControlLabel value="thermal" control={<Radio />} label="Thermal" />
                <FormControlLabel value="both" control={<Radio />} label="Both" />
              </RadioGroup>
            </FormControl>
          </Box>
          
          <Box mb={3}>
            <Typography variant="h6" component="h3" gutterBottom>
              Regular Frame Prompt
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              This prompt will be used when analyzing only regular drone camera frames.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={5}
              variant="outlined"
              value={droneSettings.regular_prompt}
              onChange={handleDronePromptChange('regular_prompt')}
              placeholder="Enter prompt for regular frame analysis..."
              sx={{ mb: 2 }}
              disabled={!droneSettings.enabled || (droneSettings.frame_type !== 'regular' && droneSettings.frame_type !== 'both')}
            />
          </Box>
          
          <Box mb={3}>
            <Typography variant="h6" component="h3" gutterBottom>
              Thermal Frame Prompt
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              This prompt will be used when analyzing only thermal drone camera frames.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={5}
              variant="outlined"
              value={droneSettings.thermal_prompt}
              onChange={handleDronePromptChange('thermal_prompt')}
              placeholder="Enter prompt for thermal frame analysis..."
              sx={{ mb: 2 }}
              disabled={!droneSettings.enabled || (droneSettings.frame_type !== 'thermal' && droneSettings.frame_type !== 'both')}
            />
          </Box>
          
          <Box mb={3}>
            <Typography variant="h6" component="h3" gutterBottom>
              Both Frames Prompt
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              This prompt will be used when analyzing both regular and thermal frames together.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={5}
              variant="outlined"
              value={droneSettings.both_prompt}
              onChange={handleDronePromptChange('both_prompt')}
              placeholder="Enter prompt for analyzing both frames together..."
              sx={{ mb: 2 }}
              disabled={!droneSettings.enabled || droneSettings.frame_type !== 'both'}
            />
          </Box>

          <Box display="flex" justifyContent="space-between">
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefreshSettings}
              disabled={saving}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSaveDroneSettings}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Drone Settings'}
            </Button>
          </Box>
        </TabPanel>

        {/* Telegram Notifications Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h5" component="h2" gutterBottom>
            Telegram Notification Settings
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Box mb={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={telegramSettings.enabled}
                  onChange={handleTelegramToggleChange}
                  color="primary"
                />
              }
              label={`Telegram Notifications are currently ${telegramSettings.enabled ? 'ENABLED' : 'DISABLED'}`}
            />
            <Typography variant="body2" color="textSecondary" mt={1}>
              When enabled, critical reports will be sent as notifications to the configured Telegram chat.
            </Typography>
          </Box>

          <Box mb={3}>
            <Typography variant="h6" component="h3" gutterBottom>
              Bot Configuration
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Bot Token"
                  variant="outlined"
                  value={telegramSettings.bot_token}
                  onChange={handleTelegramInputChange('bot_token')}
                  placeholder="Enter your Telegram bot token"
                  margin="normal"
                  type="password"
                  helperText="You can create a bot and get a token using BotFather in Telegram"
                  disabled={!telegramSettings.enabled}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Chat ID"
                  variant="outlined"
                  value={telegramSettings.chat_id}
                  onChange={handleTelegramInputChange('chat_id')}
                  placeholder="Enter the chat ID where notifications should be sent"
                  margin="normal"
                  helperText="This can be a group chat ID or your personal chat ID"
                  disabled={!telegramSettings.enabled}
                />
              </Grid>
            </Grid>
            <Typography variant="body2" color="textSecondary" mt={2}>
              To create a Telegram bot, message @BotFather on Telegram and follow the instructions.
              To find your chat ID, you can message @userinfobot on Telegram.
            </Typography>
          </Box>

          <Box mb={3}>
            <Typography variant="h6" component="h3" gutterBottom>
              Notification Settings
            </Typography>
            <Autocomplete
              multiple
              id="severity-tags"
              options={severityOptions}
              value={telegramSettings.notify_severity}
              onChange={handleSeverityChange}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option}
                    {...getTagProps({ index })}
                    color={
                      option === 'critical' ? 'error' :
                      option === 'high' ? 'warning' :
                      option === 'medium' ? 'info' : 'success'
                    }
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  label="Severity Levels for Notifications"
                  placeholder="Select severity levels"
                  helperText="Select which severity levels should trigger notifications"
                  fullWidth
                  margin="normal"
                  disabled={!telegramSettings.enabled}
                />
              )}
            />
            <Typography variant="body2" color="textSecondary" mt={2}>
              Notifications will be sent when reports with the selected severity levels are detected.
            </Typography>
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefreshSettings}
              disabled={saving || testingSending}
            >
              Refresh
            </Button>
            <Box>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<SendIcon />}
                onClick={handleSendTestNotification}
                disabled={!telegramSettings.enabled || saving || testingSending}
                sx={{ mr: 2 }}
              >
                {testingSending ? 'Sending...' : 'Send Test Message'}
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSaveTelegramSettings}
                disabled={saving || testingSending}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </Box>
          </Box>
        </TabPanel>
      </Paper>
    </>
  );
}

export default Settings;