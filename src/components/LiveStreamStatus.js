import React, { useState, useEffect } from 'react';
import { 
  WifiIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon 
} from '@heroicons/react/24/outline';

/**
 * Live Stream Status Indicator Component
 * Shows real-time connection status between React toolbar and CAD BIM workbench
 */
const LiveStreamStatus = ({ isConnected, selectedTool, lastActivatedTool, className = "" }) => {
  const [connectionPulse, setConnectionPulse] = useState(false);
  const [lastToolActivation, setLastToolActivation] = useState(null);

  // Pulse animation when tool is activated
  useEffect(() => {
    if (lastActivatedTool) {
      setLastToolActivation(lastActivatedTool);
      setConnectionPulse(true);
      const timer = setTimeout(() => setConnectionPulse(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [lastActivatedTool]);

  const getStatusIcon = () => {
    // WEBSOCKET INTEGRATION DISABLED - Building independent CAD engine
    // Always show active status for standalone mode
    return <CheckCircleIcon className="w-4 h-4 text-blue-400" />;
    
    // Original websocket-dependent logic (commented out):
    // if (!isConnected) {
    //   return <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />;
    // }
    // 
    // if (connectionPulse) {
    //   return <ArrowPathIcon className="w-4 h-4 text-green-400 animate-spin" />;
    // }
    // 
    // return <CheckCircleIcon className="w-4 h-4 text-green-400" />;
  };

  const getStatusText = () => {
    // WEBSOCKET INTEGRATION DISABLED - Building independent CAD engine
    // Always show standalone mode instead of connection status
    return "Standalone CAD Engine";
    
    // Original websocket-dependent logic (commented out):
    // if (!isConnected) {
    //   return "CAD Disconnected";
    // }
    // 
    // if (connectionPulse && lastToolActivation) {
    //   return `Activating ${lastToolActivation}...`;
    // }
    // 
    // if (selectedTool && selectedTool !== 'pointer') {
    //   return `Active: ${selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1)}`;
    // }
    // 
    // return "CAD Connected";
  };

  const getStatusColor = () => {
    // WEBSOCKET INTEGRATION DISABLED - Building independent CAD engine
    // Always show active status for standalone mode
    return "text-blue-400";
    
    // Original websocket-dependent logic (commented out):
    // if (!isConnected) return "text-red-400";
    // if (connectionPulse) return "text-yellow-400";
    // return "text-green-400";
  };

  return (
    <div className={`flex items-center space-x-2 px-3 py-1 rounded-md bg-gray-900/50 border border-gray-700/50 ${className}`}>
      {/* Connection Icon */}
      <div className="relative">
        {getStatusIcon()}
        {/* WEBSOCKET INTEGRATION DISABLED - Always show active indicator for standalone mode */}
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full"></div>
      </div>
      
      {/* Status Text */}
      <span className={`text-xs font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </span>
      
      {/* Live indicator dot - Always show for standalone mode */}
      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
    </div>
  );
};

export default LiveStreamStatus;