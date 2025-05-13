import { useMapEvents } from 'react-leaflet';

const MapClickHandler = ({ handleMapClick }) => {
  useMapEvents({ click: handleMapClick });
  return null;
};

export default MapClickHandler;